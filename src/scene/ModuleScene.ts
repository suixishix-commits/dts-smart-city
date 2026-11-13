import type { SceneApi, SceneObjectType } from './SceneApi'

interface Layer {
  type: SceneObjectType
  ids: string[]
  visible: boolean
}

/**
 * 模块场景控制器基类。
 * 子类在 onEnter 里通过 add() 创建对象；基类登记每个对象，leave() 时统一删除。
 * token 用来丢弃过期的进入流程：离开后（或再次进入后）旧流程的 add() 不再生效。
 */
export abstract class ModuleScene {
  private layers = new Map<string, Layer>()
  private generation = 0
  private active = false

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

  async leave(): Promise<void> {
    this.active = false
    this.generation++
    await this.onLeave()
    const layers = [...this.layers.values()]
    this.layers.clear()
    for (const layer of layers) {
      if (layer.ids.length) await this.api.remove(layer.type, layer.ids)
    }
  }

  protected isCurrent(token: number): boolean {
    return this.active && token === this.generation
  }

  /** 添加一组对象并登记到名为 layer 的图层 */
  protected async add(token: number, type: SceneObjectType, objects: { id: string }[], layer: string): Promise<void> {
    if (!this.isCurrent(token) || objects.length === 0) return
    const entry = this.layers.get(layer) ?? { type, ids: [], visible: true }
    entry.ids.push(...objects.map(o => o.id))
    this.layers.set(layer, entry)
    await this.api.add(type, objects)
    if (!entry.visible) await this.api.setVisible(type, entry.ids, false)
  }

  /** 用新对象整体替换某个图层（用于随时间变化的图层） */
  async replaceLayer(layer: string, type: SceneObjectType, objects: { id: string }[]): Promise<void> {
    if (!this.active) return
    const old = this.layers.get(layer)
    const visible = old ? old.visible : true
    if (old?.ids.length) await this.api.remove(old.type, old.ids)
    this.layers.set(layer, { type, ids: objects.map(o => o.id), visible })
    if (objects.length) {
      await this.api.add(type, objects)
      if (!visible) await this.api.setVisible(type, objects.map(o => o.id), false)
    }
  }

  async setLayerVisible(layer: string, visible: boolean): Promise<void> {
    const entry = this.layers.get(layer)
    if (!entry) return
    entry.visible = visible
    if (entry.ids.length) await this.api.setVisible(entry.type, entry.ids, visible)
  }

  objectCount(): number {
    let n = 0
    this.layers.forEach(l => (n += l.ids.length))
    return n
  }
}
