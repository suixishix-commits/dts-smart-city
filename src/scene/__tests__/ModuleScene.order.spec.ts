import { describe, expect, it } from 'vitest'
import { ModuleScene } from '../ModuleScene'
import type { SceneApi, SceneObjectType } from '../SceneApi'

/** 只记录调用顺序的场景接口 */
class OrderApi implements SceneApi {
  calls: string[] = []
  async add(type: SceneObjectType, objects: { id: string }[]) {
    this.calls.push('add ' + objects.map(o => o.id).join(','))
  }
  async remove(type: SceneObjectType, ids: string[]) {
    this.calls.push('remove ' + ids.join(','))
  }
  async setVisible() {}
  async setCamera() {}
  async focus() {}
  async project(lonLat: number[][]) {
    return lonLat
  }
}

class HeatScene extends ModuleScene {
  protected async onEnter(token: number) {
    await this.add(token, 'heatmap', [{ id: 'heat-a' }], 'heat')
  }
}

describe('ModuleScene 替换图层', () => {
  it('新旧对象 id 不同时先建后删，替换期间画面上始终有对象', async () => {
    const api = new OrderApi()
    const scene = new HeatScene(api)
    await scene.enter()
    api.calls = []
    await scene.replaceLayer('heat', 'heatmap', [{ id: 'heat-b' }])
    expect(api.calls).toEqual(['add heat-b', 'remove heat-a'])
  })

  it('同 id 替换时只能先删再加', async () => {
    const api = new OrderApi()
    const scene = new HeatScene(api)
    await scene.enter()
    api.calls = []
    await scene.replaceLayer('heat', 'heatmap', [{ id: 'heat-a' }])
    expect(api.calls).toEqual(['remove heat-a', 'add heat-a'])
  })
})
