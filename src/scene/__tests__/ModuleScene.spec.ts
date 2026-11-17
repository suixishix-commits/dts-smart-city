import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModuleScene } from '../ModuleScene'
import type { SceneApi, SceneObjectType } from '../SceneApi'

type Op = 'add' | 'remove' | 'setVisible'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(res => (resolve = res))
  return { promise, resolve }
}

/** 等所有已排队的微任务跑完 */
const flush = () => new Promise<void>(resolve => setTimeout(resolve))

/**
 * 严格的场景替身：重复添加同一个 id、操作不存在的 id 都会抛错（真实场景里前者会产生重复对象）。
 * hold(op) 让下一次该操作停住，直到调用返回的 resolve()，用来构造“进行中”的状态。
 */
class FakeApi implements SceneApi {
  objects = new Map<string, boolean>() // key = type:id，value = 是否可见
  payloads = new Map<string, any>()
  /** 每次 add 的对象，按调用顺序 */
  added: any[] = []
  private held: Record<Op, { promise: Promise<void> }[]> = { add: [], remove: [], setVisible: [] }
  private failing: Record<Op, number> = { add: 0, remove: 0, setVisible: 0 }

  hold(op: Op) {
    const d = deferred()
    this.held[op].push(d)
    return d
  }
  /** 让下一次该操作失败 */
  failNext(op: Op) {
    this.failing[op]++
  }
  private async gate(op: Op) {
    const d = this.held[op].shift()
    if (d) await d.promise
    if (this.failing[op] > 0) {
      this.failing[op]--
      throw new Error(`${op} failed`)
    }
  }

  async add(type: SceneObjectType, objects: { id: string }[]) {
    await this.gate('add')
    objects.forEach(o => {
      const key = `${type}:${o.id}`
      if (this.objects.has(key)) throw new Error('add: id already exists: ' + key)
      this.objects.set(key, true)
      this.payloads.set(key, o)
      this.added.push(o)
    })
  }
  async remove(type: SceneObjectType, ids: string[]) {
    await this.gate('remove')
    ids.forEach(id => {
      const key = `${type}:${id}`
      if (!this.objects.has(key)) throw new Error('remove: id does not exist: ' + key)
      this.objects.delete(key)
      this.payloads.delete(key)
    })
  }
  async setVisible(type: SceneObjectType, ids: string[], visible: boolean) {
    await this.gate('setVisible')
    ids.forEach(id => {
      const key = `${type}:${id}`
      if (!this.objects.has(key)) throw new Error('setVisible: id does not exist: ' + key)
      this.objects.set(key, visible)
    })
  }
  async setCamera() {}
  async focus() {}
  async project(lonLat: number[][]) {
    return lonLat.map(p => [p[0], p[1], 0])
  }
  keys() {
    return [...this.objects.keys()].sort()
  }
}

/** 带版本号的 marker，用来区分同一个 id 的不同载荷 */
const marker = (id: string, v: number): { id: string } => ({ id, v }) as { id: string }

/** 测试用场景：进入时等一个可控的 promise，再添加两个 marker 和一个 polygon */
class DemoScene extends ModuleScene {
  gate: Promise<void> = Promise.resolve()
  protected async onEnter(token: number) {
    await this.gate
    await this.add(token, 'marker', [{ id: 'm1' }, { id: 'm2' }], 'points')
    await this.add(token, 'polygon', [{ id: 'p1' }], 'areas')
  }
}

describe('ModuleScene', () => {
  let api: FakeApi
  let scene: DemoScene

  beforeEach(() => {
    api = new FakeApi()
    scene = new DemoScene(api)
  })

  it('adds objects on enter and tracks them', async () => {
    await scene.enter()
    expect([...api.objects.keys()].sort()).toEqual(['marker:m1', 'marker:m2', 'polygon:p1'])
    expect(scene.objectCount()).toBe(3)
  })

  it('removes everything it added on leave', async () => {
    await scene.enter()
    await scene.leave()
    expect(api.objects.size).toBe(0)
    expect(scene.objectCount()).toBe(0)
  })

  it('abandon() fires every removal at once without waiting, and leaves the active set', async () => {
    await scene.enter()
    expect(ModuleScene.active.has(scene)).toBe(true)
    // 删除挂起：abandon 也要把两种类型的删除都发出去（页面关闭时等不到回执）
    const gates = [api.hold('remove'), api.hold('remove')]
    scene.abandon()
    expect(ModuleScene.active.has(scene)).toBe(false)
    expect(scene.objectCount()).toBe(0)
    gates.forEach(g => g.resolve())
    await flush()
    await flush()
    expect(api.objects.size).toBe(0)
  })

  it('drops a scene from the active set on leave', async () => {
    await scene.enter()
    await scene.leave()
    expect(ModuleScene.active.has(scene)).toBe(false)
  })

  it('does not add objects when leave happens before enter finishes', async () => {
    let open!: () => void
    scene.gate = new Promise<void>(resolve => (open = resolve))
    const entering = scene.enter()
    await scene.leave()
    open()
    await entering
    expect(api.objects.size).toBe(0)
  })

  it('does not grow after repeated enter/leave', async () => {
    for (let i = 0; i < 20; i++) {
      await scene.enter()
      await scene.leave()
    }
    await scene.enter()
    expect(api.objects.size).toBe(3)
    expect(scene.objectCount()).toBe(3)
  })

  it('shows and hides a layer', async () => {
    await scene.enter()
    await scene.setLayerVisible('points', false)
    expect(api.objects.get('marker:m1')).toBe(false)
    expect(api.objects.get('marker:m2')).toBe(false)
    expect(api.objects.get('polygon:p1')).toBe(true)
    await scene.setLayerVisible('points', true)
    expect(api.objects.get('marker:m1')).toBe(true)
  })

  it('replaces a layer', async () => {
    await scene.enter()
    await scene.replaceLayer('points', 'marker', [{ id: 'm9' }])
    expect([...api.objects.keys()].sort()).toEqual(['marker:m9', 'polygon:p1'])
  })

  describe('overlapping replaceLayer calls', () => {
    it('ends on the last payload when calls overlap during the remove', async () => {
      await scene.enter()
      const removing = api.hold('remove')
      const calls = [1, 2, 3].map(v => scene.replaceLayer('points', 'marker', [marker('x', v)]))
      await flush()
      removing.resolve()
      await Promise.all(calls)
      expect(api.keys()).toEqual(['marker:x', 'polygon:p1'])
      expect(api.payloads.get('marker:x').v).toBe(3)
      expect(scene.objectCount()).toBe(2)
      // 中间的请求被丢弃，不会进场景
      expect(api.added.filter(o => o.id === 'x').map(o => o.v)).toEqual([3])
    })

    it('ends on the last payload when calls overlap during the add', async () => {
      await scene.enter()
      const adding = api.hold('add')
      const first = scene.replaceLayer('points', 'marker', [marker('x', 1)])
      await flush()
      const rest = [2, 3].map(v => scene.replaceLayer('points', 'marker', [marker('x', v)]))
      adding.resolve()
      await Promise.all([first, ...rest])
      expect(api.keys()).toEqual(['marker:x', 'polygon:p1'])
      expect(api.payloads.get('marker:x').v).toBe(3)
      expect(scene.objectCount()).toBe(2)
      expect(api.added.filter(o => o.id === 'x').map(o => o.v)).toEqual([1, 3])
    })
  })

  describe('leave during an in-flight replaceLayer', () => {
    it('leaves nothing behind when the remove is in flight', async () => {
      await scene.enter()
      const removing = api.hold('remove')
      const replacing = scene.replaceLayer('points', 'marker', [{ id: 'm9' }])
      await flush()
      const leaving = scene.leave()
      removing.resolve()
      await Promise.all([replacing, leaving])
      expect(api.keys()).toEqual([])
      expect(scene.objectCount()).toBe(0)
    })

    it('leaves nothing behind when the add is in flight', async () => {
      await scene.enter()
      const adding = api.hold('add')
      const replacing = scene.replaceLayer('points', 'marker', [{ id: 'm9' }])
      await flush()
      const leaving = scene.leave()
      adding.resolve()
      await Promise.all([replacing, leaving])
      expect(api.keys()).toEqual([])
      expect(scene.objectCount()).toBe(0)
    })
  })

  it('still removes the other layers when one remove fails on leave', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await scene.enter()
    api.failNext('remove') // 第一个图层（points）的删除失败
    await scene.leave()
    expect(api.objects.has('polygon:p1')).toBe(false)
    expect(scene.objectCount()).toBe(0)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  describe('layer visibility', () => {
    it('honours setLayerVisible called before the layer exists', async () => {
      await scene.setLayerVisible('points', false)
      await scene.enter()
      expect(api.objects.get('marker:m1')).not.toBe(true)
      expect(api.objects.get('marker:m2')).not.toBe(true)
      expect(api.objects.get('polygon:p1')).toBe(true)
      await scene.setLayerVisible('points', true)
      expect(api.objects.get('marker:m1')).toBe(true)
      expect(api.objects.get('marker:m2')).toBe(true)
    })

    it('does not lose a toggle made while entering', async () => {
      let open!: () => void
      scene.gate = new Promise<void>(resolve => (open = resolve))
      const entering = scene.enter()
      const hiding = scene.setLayerVisible('points', false)
      open()
      await Promise.all([entering, hiding])
      expect(api.objects.get('marker:m1')).not.toBe(true)
      expect(api.objects.get('polygon:p1')).toBe(true)
    })

    it('keeps a hidden layer hidden across leave and enter', async () => {
      await scene.enter()
      await scene.setLayerVisible('points', false)
      await scene.leave()
      await scene.enter()
      expect(api.objects.get('marker:m1')).not.toBe(true)
      expect(api.objects.get('polygon:p1')).toBe(true)
      await scene.setLayerVisible('points', true)
      expect(api.keys()).toEqual(['marker:m1', 'marker:m2', 'polygon:p1'])
      expect(api.objects.get('marker:m1')).toBe(true)
    })

    it('never creates an object visible while its layer is hidden', async () => {
      const created: string[] = []
      const add = api.add.bind(api)
      api.add = async (type, objects) => {
        await add(type, objects)
        created.push(...objects.map(o => o.id))
      }
      await scene.setLayerVisible('points', false)
      await scene.enter()
      await scene.replaceLayer('points', 'marker', [{ id: 'm9' }])
      expect(created).toEqual(['p1'])
    })

    it('adds nothing on replaceLayer while hidden, then shows the latest payload', async () => {
      await scene.enter()
      await scene.setLayerVisible('points', false)
      await scene.replaceLayer('points', 'marker', [{ id: 'm8' }])
      await scene.replaceLayer('points', 'marker', [{ id: 'm9' }])
      expect(api.objects.has('marker:m8')).toBe(false)
      expect(api.objects.has('marker:m9')).toBe(false)
      expect(api.objects.get('marker:m1')).not.toBe(true)
      await scene.setLayerVisible('points', true)
      expect(api.keys()).toEqual(['marker:m9', 'polygon:p1'])
      expect(api.objects.get('marker:m9')).toBe(true)
      expect(scene.objectCount()).toBe(2)
    })

    it('hides an object whose layer was hidden while it was being added', async () => {
      await scene.enter()
      const adding = api.hold('add')
      const replacing = scene.replaceLayer('points', 'marker', [{ id: 'm9' }])
      await flush()
      const hiding = scene.setLayerVisible('points', false)
      adding.resolve()
      await Promise.all([replacing, hiding])
      expect(api.objects.get('marker:m9')).toBe(false)
    })
  })
})

/** 支持原地更新的场景替身：update 只能改已有对象 */
class UpdatingApi extends FakeApi {
  updated: any[] = []
  failUpdate = false
  async update(type: SceneObjectType, objects: { id: string }[]) {
    if (this.failUpdate) throw new Error('update failed')
    objects.forEach(o => {
      const key = `${type}:${o.id}`
      if (!this.objects.has(key)) throw new Error('update: id does not exist: ' + key)
      this.payloads.set(key, o)
      this.updated.push(o)
    })
  }
}

describe('ModuleScene in-place updates', () => {
  it('updates a visible marker with the same id instead of removing and re-adding it', async () => {
    const api = new UpdatingApi()
    const scene = new DemoScene(api)
    await scene.enter()
    await scene.replaceLayer('points', 'marker', [marker('m1', 2), marker('m3', 1)])
    expect(api.keys()).toEqual(['marker:m1', 'marker:m3', 'polygon:p1'])
    expect(api.payloads.get('marker:m1').v).toBe(2)
    expect(api.updated.map(o => o.id)).toEqual(['m1'])
    // m1 只在进入时 add 过一次
    expect(api.added.filter(o => o.id === 'm1')).toHaveLength(1)
    expect(scene.objectCount()).toBe(3)
  })

  it('falls back to remove and add when the update fails', async () => {
    const api = new UpdatingApi()
    const scene = new DemoScene(api)
    await scene.enter()
    api.failUpdate = true
    await scene.replaceLayer('points', 'marker', [marker('m1', 2)])
    expect(api.keys()).toEqual(['marker:m1', 'polygon:p1'])
    expect(api.payloads.get('marker:m1').v).toBe(2)
    expect(scene.objectCount()).toBe(2)
  })

  it('does not update other object types in place', async () => {
    const api = new UpdatingApi()
    const scene = new DemoScene(api)
    await scene.enter()
    await scene.replaceLayer('areas', 'polygon', [marker('p1', 2)])
    expect(api.updated).toEqual([])
    expect(api.payloads.get('polygon:p1').v).toBe(2)
  })
})
