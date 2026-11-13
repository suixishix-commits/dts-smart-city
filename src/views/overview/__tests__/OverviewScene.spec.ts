import { beforeEach, describe, expect, it } from 'vitest'
import type { SceneApi, SceneObjectType } from '@/scene/SceneApi'
import type { OverviewData } from '@/types/smartCity'
import { OverviewScene } from '../OverviewScene'

class FakeApi implements SceneApi {
  store = new Map<string, any>()
  visible = new Map<string, boolean>()
  cameraCalls: number[][] = []
  focusCalls: string[] = []
  async add(type: SceneObjectType, objects: { id: string }[]) {
    objects.forEach(o => {
      this.store.set(`${type}:${o.id}`, o)
      this.visible.set(`${type}:${o.id}`, true)
    })
  }
  async remove(type: SceneObjectType, ids: string[]) {
    ids.forEach(id => this.store.delete(`${type}:${id}`))
  }
  async setVisible(type: SceneObjectType, ids: string[], visible: boolean) {
    ids.forEach(id => this.visible.set(`${type}:${id}`, visible))
  }
  async setCamera(view: number[]) {
    this.cameraCalls.push(view)
  }
  async focus(type: SceneObjectType, id: string) {
    this.focusCalls.push(`${type}:${id}`)
  }
  async project(lonLat: number[][]) {
    // 假投影：平面坐标不变，z 固定为 7，便于断言
    return lonLat.map(p => [p[0], p[1], 7])
  }
  ids(type: string) {
    return [...this.store.keys()].filter(k => k.startsWith(type + ':')).sort()
  }
}

const data: OverviewData = {
  vitals: [],
  districts: [
    { id: 'd1', name: '甲', center: [54.36, 24.49], baseDensity: 2, boundary: [[54.35, 24.48], [54.37, 24.48], [54.37, 24.5]] }
  ],
  hotspots: [
    { id: 'h1', name: '音乐节', shortName: '音乐节', type: '文体活动', districtId: 'd1', position: [54.352, 24.478], heat: 96, people: 18000, cameraId: 'c1', nearbyCameras: 6 }
  ],
  cameras: [
    { id: 'c1', name: '东入口', position: [54.353, 24.479], online: true, featured: true },
    { id: 'c2', name: '码头', position: [54.338, 24.452], online: false, featured: false }
  ],
  alarms: []
}

describe('OverviewScene', () => {
  let api: FakeApi
  let scene: OverviewScene

  beforeEach(() => {
    api = new FakeApi()
    scene = new OverviewScene(api, { cameraView: null, heatmapZ: [-50, 300] })
    scene.setData(data, 12)
  })

  it('creates districts, hotspots, cameras and one heatmap on enter', async () => {
    await scene.enter()
    expect(api.ids('polygon')).toEqual(['polygon:district-d1'])
    expect(api.ids('marker')).toEqual(['marker:camera-c1', 'marker:camera-c2', 'marker:hotspot-h1'])
    expect(api.ids('heatmap')).toEqual(['heatmap:population-heat'])
  })

  it('projects coordinates before adding', async () => {
    await scene.enter()
    expect(api.store.get('marker:hotspot-h1').coordinate).toEqual([54.352, 24.478, 7])
    expect(api.store.get('polygon:district-d1').coordinates[0]).toEqual([54.35, 24.48, 7])
  })

  it('gives markers a group id and JSON user data', async () => {
    await scene.enter()
    const m = api.store.get('marker:hotspot-h1')
    expect(m.groupId).toBe('sc_hotspot')
    expect(JSON.parse(m.userData)).toEqual({ id: 'h1' })
    expect(api.store.get('marker:camera-c1').groupId).toBe('sc_camera')
  })

  it('builds the heatmap from district and hotspot points', async () => {
    await scene.enter()
    const hm = api.store.get('heatmap:population-heat')
    expect(hm.data.map((p: any) => p.id)).toEqual(['heat-d1', 'heat-h1'])
    expect(hm.data[0].heatValue).toBeCloseTo(2)
    expect(hm.bbox).toHaveLength(6)
    expect(hm.bbox[2]).toBe(-50)
    expect(hm.bbox[5]).toBe(300)
  })

  it('rebuilds the heatmap when the hour changes', async () => {
    await scene.enter()
    await scene.setHour(19.5)
    const hm = api.store.get('heatmap:population-heat')
    expect(hm.data[0].heatValue).toBeCloseTo(2.28)
    expect(api.ids('heatmap')).toHaveLength(1)
  })

  it('uses the configured camera view when present', async () => {
    scene = new OverviewScene(api, { cameraView: [1, 2, 3, -45, 0], heatmapZ: [-50, 300] })
    scene.setData(data, 12)
    await scene.enter()
    expect(api.cameraCalls).toEqual([[1, 2, 3, -45, 0]])
  })

  it('focuses the district when no camera view is configured', async () => {
    await scene.enter()
    expect(api.focusCalls).toEqual(['polygon:district-d1'])
  })

  it('toggles a layer by key', async () => {
    await scene.enter()
    await scene.setLayerVisible('camera', false)
    expect(api.visible.get('marker:camera-c1')).toBe(false)
    expect(api.visible.get('marker:hotspot-h1')).toBe(true)
  })

  it('focuses a hotspot or camera by id', async () => {
    await scene.enter()
    api.focusCalls = []
    await scene.focusHotspot('h1')
    await scene.focusCamera('c2')
    expect(api.focusCalls).toEqual(['marker:hotspot-h1', 'marker:camera-c2'])
  })

  it('removes everything on leave', async () => {
    await scene.enter()
    await scene.leave()
    expect(api.store.size).toBe(0)
  })
})
