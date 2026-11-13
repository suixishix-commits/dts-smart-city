import type { SceneApi, SceneObjectType } from './SceneApi'

/** 图层里的一个对象。每次 add()/replaceLayer() 都生成新的 Entry，所以同一个 id 的新旧载荷可以区分 */
interface Entry {
  type: SceneObjectType
  object: { id: string }
}

/** 一个图层的全部状态。wanted 是“应该是什么样”，live 是“场景里现在是什么样”，sync() 负责把后者变成前者 */
interface LayerState {
  /** 期望的可见性。可以在图层有对象之前设置，leave() 之后也保留 */
  visible: boolean
  /** 期望存在的对象（最新一次请求）。leave() 时清空 */
  wanted: Entry[]
  /** 已经在场景里的对象 */
  live: Entry[]
  /** live 里的对象当前是否可见 */
  shown: boolean
  /** 进行中的同步。同一图层同一时刻只有一个 */
  syncing: Promise<void> | null
}

/** 按类型分组（SceneApi 的每次调用只接受一种类型），保持原有顺序 */
function byType(entries: Entry[]): Entry[][] {
  const groups = new Map<SceneObjectType, Entry[]>()
  for (const e of entries) {
    const group = groups.get(e.type)
    if (group) group.push(e)
    else groups.set(e.type, [e])
  }
  return [...groups.values()]
}

const idsOf = (entries: Entry[]) => entries.map(e => e.object.id)

/**
 * 由效果库创建的效果（点阵流光、电子围栏、摄像头视域等）：它们自己管理场景对象，
 * 这里只需要知道怎么显示、隐藏、删除。
 */
export interface SceneEffect {
  show(): Promise<unknown>
  hide(): Promise<unknown>
  remove(): Promise<unknown>
}

/**
 * 模块场景控制器基类。
 * 子类在 onEnter 里通过 add() 创建对象；基类登记每个对象，leave() 时统一删除。
 * token 用来丢弃过期的进入流程：离开后（或再次进入后）旧流程的 add() 不再生效。
 *
 * add / replaceLayer / setLayerVisible / leave 都只修改图层的期望状态，再由 sync() 串行地落到场景里：
 * - 同一图层的场景操作不会重叠；同步期间到来的请求只保留最后一个（中间的被丢弃）；
 * - 先删后加，不会添加场景里已有的 id；
 * - 隐藏的图层不创建新对象（SDK 无法创建即隐藏，先加再藏会闪一帧），重新显示时才创建。
 *
 * 注意：replaceLayer 会替换整个图层，不要在 onEnter 用 add() 填充同一图层的过程中调用。
 */
export abstract class ModuleScene {
  private layers = new Map<string, LayerState>()
  private generation = 0
  private active = false
  private effects: { layer: string; effect: SceneEffect }[] = []

  constructor(protected readonly api: SceneApi) {}

  /** 子类实现：设置相机、创建对象。所有 add() 调用都要传入收到的 token */
  protected abstract onEnter(token: number): Promise<void>
  /** 子类可覆盖：停止定时器、取消订阅 */
  protected async onLeave(): Promise<void> {}

  async enter(): Promise<void> {
    const token = ++this.generation
    this.active = true
    await this.onEnter(token)
  }

  /** 删除本模块创建的全部对象。会等进行中的同步结束；某一批删除失败不影响其余图层 */
  async leave(): Promise<void> {
    this.active = false
    const generation = ++this.generation
    // 先清空期望状态，进行中的同步不会再往已离开的场景里加对象
    this.layers.forEach(layer => (layer.wanted = []))
    await this.onLeave()
    const effects = this.effects
    this.effects = []
    await Promise.all(effects.map(e => e.effect.remove().catch(err => console.error('[ModuleScene] 删除效果失败', err))))
    await Promise.all([...this.layers.values()].map(layer => this.clear(layer, generation)))
  }

  protected isCurrent(token: number): boolean {
    return this.active && token === this.generation
  }

  /** 添加一组对象并登记到名为 layer 的图层 */
  protected async add(token: number, type: SceneObjectType, objects: { id: string }[], layer: string): Promise<void> {
    if (!this.isCurrent(token) || objects.length === 0) return
    const state = this.layer(layer)
    state.wanted = [...state.wanted, ...objects.map(object => ({ type, object }))]
    await this.sync(state)
  }

  /**
   * 创建一个效果库效果并登记到图层：离开时自动删除，图层开关时跟着显示/隐藏。
   * create 失败只记日志，不影响其它图层（例如效果总包没挂载）。
   */
  protected async effect(token: number, layer: string, create: () => Promise<SceneEffect>): Promise<void> {
    if (!this.isCurrent(token)) return
    let effect: SceneEffect
    try {
      effect = await create()
    } catch (e) {
      console.warn(`[ModuleScene] 图层 ${layer} 的效果创建失败`, e)
      return
    }
    if (!this.isCurrent(token)) {
      await effect.remove()
      return
    }
    this.effects.push({ layer, effect })
    if (!this.layer(layer).visible) await effect.hide()
  }

  /** 用新对象整体替换某个图层（用于随时间变化的图层）。重叠调用时场景最终停在最后一次请求的内容上 */
  async replaceLayer(layer: string, type: SceneObjectType, objects: { id: string }[]): Promise<void> {
    if (!this.active) return
    const state = this.layer(layer)
    state.wanted = objects.map(object => ({ type, object }))
    await this.sync(state)
  }

  async setLayerVisible(layer: string, visible: boolean): Promise<void> {
    const state = this.layer(layer)
    state.visible = visible
    await Promise.all(this.effects.filter(e => e.layer === layer).map(e => (visible ? e.effect.show() : e.effect.hide())))
    await this.sync(state)
  }

  /** 当前在场景里的对象数 */
  objectCount(): number {
    let n = 0
    this.layers.forEach(l => (n += l.live.length))
    return n
  }

  private layer(name: string): LayerState {
    let state = this.layers.get(name)
    if (!state) {
      state = { visible: true, wanted: [], live: [], shown: true, syncing: null }
      this.layers.set(name, state)
    }
    return state
  }

  /** 把图层同步到期望状态；已有同步在进行时复用它（它会读到最新的期望状态） */
  private sync(layer: LayerState): Promise<void> {
    // 推迟一个微任务再开始，保证 reconcile 结束时清空的是已经登记好的 syncing
    layer.syncing ??= Promise.resolve().then(() => this.reconcile(layer))
    return layer.syncing
  }

  /** 每一步都在 await 之后重新读取期望状态，所以中途的 replaceLayer / setLayerVisible / leave 都会生效 */
  private async reconcile(layer: LayerState): Promise<void> {
    try {
      for (;;) {
        // 1. 删除不再需要的对象。先从 live 里去掉：即使删除失败也不再重复尝试
        const stale = layer.live.filter(e => !layer.wanted.includes(e))
        if (stale.length) {
          const batch = byType(stale)[0]
          layer.live = layer.live.filter(e => !batch.includes(e))
          await this.api.remove(batch[0].type, idsOf(batch))
          continue
        }

        // 2. 已有对象的可见性
        if (layer.live.length && layer.shown !== layer.visible) {
          const visible = layer.visible
          for (const batch of byType(layer.live)) await this.api.setVisible(batch[0].type, idsOf(batch), visible)
          layer.shown = visible
          continue
        }

        // 3. 创建缺少的对象（新建的对象默认可见）；隐藏期间不创建
        const missing = layer.visible ? layer.wanted.filter(e => !layer.live.includes(e)) : []
        if (missing.length === 0) return
        const batch = byType(missing)[0]
        await this.api.add(batch[0].type, batch.map(e => e.object))
        layer.live = [...layer.live, ...batch]
        layer.shown = true
      }
    } finally {
      layer.syncing = null
    }
  }

  /** 离开时清空一个图层。每次失败的删除都会让 live 变短，所以循环一定结束；期间再次进入则交还给新的流程 */
  private async clear(layer: LayerState, generation: number): Promise<void> {
    while (this.generation === generation && (layer.syncing || layer.live.length)) {
      try {
        await this.sync(layer)
      } catch (e) {
        console.error('[ModuleScene] 离开时清理图层失败', e)
      }
    }
  }
}
