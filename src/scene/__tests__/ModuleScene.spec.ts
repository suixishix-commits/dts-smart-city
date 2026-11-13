import { beforeEach, describe, expect, it } from 'vitest'
import { ModuleScene } from '../ModuleScene'
import type { SceneApi, SceneObjectType } from '../SceneApi'

class FakeApi implements SceneApi {
  objects = new Map<string, boolean>() // key = type:id，value = 是否可见
  async add(type: SceneObjectType, objects: { id: string }[]) {
    objects.forEach(o => this.objects.set(`${type}:${o.id}`, true))
  }
  async remove(type: SceneObjectType, ids: string[]) {
    ids.forEach(id => this.objects.delete(`${type}:${id}`))
  }
  async setVisible(type: SceneObjectType, ids: string[], visible: boolean) {
    ids.forEach(id => this.objects.set(`${type}:${id}`, visible))
  }
  async setCamera() {}
  async focus() {}
  async project(lonLat: number[][]) {
    return lonLat.map(p => [p[0], p[1], 0])
  }
}

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
})
