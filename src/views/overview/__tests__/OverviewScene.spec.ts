import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { hotspotActivityAt } from '@/api/mock/population'
import type { SceneApi, SceneObjectType } from '@/scene/SceneApi'
import type { CityGeo } from '@/scene/geo'
import { COLOR, focusView, rgba } from '@/scene/kit'
import { loadCityGeo, loadOverviewJson } from '@/scene/__tests__/fixtures'
import type { OverviewData } from '@/types/smartCity'

import { OverviewScene } from '../OverviewScene'

/** 严格的场景替身：重复添加同一个 id、删除不存在的 id 都会抛错 */
class FakeApi implements SceneApi {
  store = new Map<string, any>()
  visible = new Map<string, boolean>()
  cameraCalls: number[][] = []
  focusCalls: string[] = []
  projectCalls: number[][][] = []
  /** 设置后 project() 会等它 resolve，用来停在“正在进入”的状态 */
  projectGate: Promise<void> | null = null
  async add(type: SceneObjectType, objects: { id: string }[]) {
    objects.forEach(o => {
      const key = `${type}:${o.id}`
      if (this.store.has(key)) throw new Error('add: id already exists: ' + key)
      this.store.set(key, o)
      this.visible.set(key, true)
    })
  }
  async remove(type: SceneObjectType, ids: string[]) {
    ids.forEach(id => {
      const key = `${type}:${id}`
      if (!this.store.has(key)) throw new Error('remove: id does not exist: ' + key)
      this.store.delete(key)
      this.visible.delete(key)
    })
  }
  async setVisible(type: SceneObjectType, ids: string[], visible: boolean) {
    ids.forEach(id => this.visible.set(`${type}:${id}`, visible))
  }
  async setCamera(view: number[]) {
    this.cameraCalls.push(view)
  }
  async focus(type: SceneObjectType, id: string, distance?: number) {
    this.focusCalls.push(`${type}:${id}:${distance}`)
  }
  async project(lonLat: number[][]) {
    this.projectCalls.push(lonLat)
    if (this.projectGate) await this.projectGate
    // 与 fixtures 的假投影一致：经纬度 ×1e5
    return lonLat.map(p => [p[0] * 1e5, p[1] * 1e5, 0])
  }
  ids(type: string) {
    return [...this.store.keys()].filter(k => k.startsWith(type + ':')).sort()
  }
}

const HEAT_STEP = 480
/** 当前的人口热力图（id 在 population-heat / population-heat-b 之间交替，任何时刻只有一张） */
const heatIds = (api: FakeApi) => api.ids('heatmap').filter(k => k.startsWith('heatmap:population-heat'))
const heat = (api: FakeApi) => api.store.get(heatIds(api)[0])

describe('OverviewScene', () => {
  let geo: CityGeo
  let data: OverviewData
  let api: FakeApi
  let scene: OverviewScene
  /** 进入后场景里的对象总数：热点标注 + 摄像头标注 + 热点波纹 + 1 张热力图 */
  let total: number

  beforeAll(async () => {
    geo = await loadCityGeo()
    // 与 getOverviewData 一样：片区来自 geo.json
    data = { ...loadOverviewJson(), districts: geo.raw.districts }
    total = data.hotspots.length * 2 + data.cameras.length + 1
  })

  beforeEach(() => {
    api = new FakeApi()
    scene = new OverviewScene(api, geo, { cameraView: null, heatmapZ: [-50, 300] })
    scene.setData(data, 12)
  })

  describe('进入', () => {
    it('creates hotspot pins and ripples, camera pins and one heatmap, and no district layer', async () => {
      await scene.enter()
      expect(api.ids('polygon')).toEqual([])
      expect(api.ids('marker')).toEqual([...data.cameras.map(c => 'marker:camera-' + c.id), ...data.hotspots.map(h => 'marker:hotspot-' + h.id)].sort())
      expect(api.ids('radiationPoint')).toEqual(data.hotspots.map(h => 'radiationPoint:hotspot-ripple-' + h.id).sort())
      expect(heatIds(api)).toHaveLength(1)
      expect(api.store.size).toBe(total)
      expect(scene.objectCount()).toBe(total)
    })

    it('does nothing when no data was set', async () => {
      scene = new OverviewScene(api, geo, { cameraView: [1, 2, 3, -45, 0], heatmapZ: [-50, 300] })
      await scene.enter()
      expect(api.store.size).toBe(0)
      expect(api.cameraCalls).toEqual([])
    })

    it('projects only the hotspot and camera positions, in one call', async () => {
      await scene.enter()
      expect(api.projectCalls).toHaveLength(1)
      expect(api.projectCalls[0]).toEqual([...data.hotspots.map(h => h.position), ...data.cameras.map(c => c.position)])
    })

    it('labels hotspots with their rank by heat and colours them by heat', async () => {
      await scene.enter()
      const ranked = [...data.hotspots].sort((a, b) => b.heat - a.heat)
      ranked.forEach((h, i) => {
        const m = api.store.get('marker:hotspot-' + h.id)
        expect(m.text).toBe(`${i + 1} · ${h.shortName}  热度 ${h.heat}`)
        expect(m.groupId).toBe('sc_hotspot')
        expect(JSON.parse(m.userData)).toEqual({ id: h.id })
        expect(m.coordinate[0]).toBeCloseTo(h.position[0] * 1e5)
        expect(m.coordinate[1]).toBeCloseTo(h.position[1] * 1e5)
        const color = h.heat >= 90 ? COLOR.danger : h.heat >= 75 ? COLOR.warn : COLOR.caution
        expect(m.lineColor).toEqual(rgba(color, 0.95))
      })
    })

    it('labels cameras with their id, muted when offline', async () => {
      await scene.enter()
      for (const c of data.cameras) {
        const m = api.store.get('marker:camera-' + c.id)
        expect(m.text).toBe(c.id)
        expect(m.groupId).toBe('sc_camera')
        expect(JSON.parse(m.userData)).toEqual({ id: c.id })
        expect(m.lineColor).toEqual(rgba(c.online ? COLOR.accent : COLOR.muted, 0.95))
      }
      expect(data.cameras.some(c => !c.online)).toBe(true)
    })

    it('builds the heatmap from the land grid plus one point per hotspot', async () => {
      await scene.enter()
      const hm = heat(api)
      const grid = geo.landGrid(HEAT_STEP)
      expect(hm.data).toHaveLength(grid.length + data.hotspots.length)
      expect(hm.data.slice(-data.hotspots.length).map((p: any) => p.id)).toEqual(data.hotspots.map(h => 'hot-' + h.id))
      expect(hm.groupId).toBe('sc_heat')
      expect(hm.bbox).toHaveLength(6)
      expect(hm.bbox[2]).toBe(-50)
      expect(hm.bbox[5]).toBe(300)
    })

    it('keeps every grid heat point on land and every heat value inside the range', async () => {
      await scene.enter()
      const hm = heat(api)
      const gridPoints = hm.data.filter((p: any) => p.id.startsWith('g'))
      expect(gridPoints.length).toBeGreaterThan(100)
      for (const p of gridPoints) expect(geo.onLand(p.coordinate)).toBe(true)
      for (const p of hm.data) {
        expect(p.heatValue).toBeGreaterThanOrEqual(hm.range[0])
        expect(p.heatValue).toBeLessThanOrEqual(hm.range[1])
      }
    })

    it('draws the population heat as a UE heat field instead of a DTS heatmap when the pak is mounted, and removes it on leave', async () => {
      scene = new OverviewScene(api, geo, { cameraView: null, heatmapZ: [-50, 300], heatField: true })
      scene.setData(data, 12)
      await scene.enter()
      expect(heatIds(api)).toEqual([])
      const meshes = api.ids('customMesh').filter(k => k.startsWith('customMesh:population-field'))
      expect(meshes).toHaveLength(1)
      const mesh = api.store.get(meshes[0])
      expect(mesh.material).toContain('HeatField')
      expect(mesh.colors.every((c: number[]) => c[3] >= 0 && c[3] <= 1)).toBe(true)
      await scene.leave()
      expect(api.ids('customMesh').filter(k => k.startsWith('customMesh:population-field'))).toEqual([])
    })

    it('uses the configured heatmap z range', async () => {
      scene = new OverviewScene(api, geo, { cameraView: null, heatmapZ: [-10, 120] })
      scene.setData(data, 12)
      await scene.enter()
      const hm = heat(api)
      expect([hm.bbox[2], hm.bbox[5]]).toEqual([-10, 120])
    })

    it('sizes each hotspot ripple by the activity at the current hour', async () => {
      await scene.enter()
      for (const h of data.hotspots) {
        const r = api.store.get('radiationPoint:hotspot-ripple-' + h.id)
        expect(r.radius).toBeCloseTo(260 + 520 * hotspotActivityAt(h, 12))
        expect(r.groupId).toBe('sc_hotspot_ripple')
        expect(r.coordinate[0]).toBeCloseTo(h.position[0] * 1e5)
      }
    })

    it('flies to the configured camera view', async () => {
      scene = new OverviewScene(api, geo, { cameraView: [1, 2, 3, -45, 0], heatmapZ: [-50, 300] })
      scene.setData(data, 12)
      await scene.enter()
      expect(api.cameraCalls).toEqual([[1, 2, 3, -45, 0]])
    })

    it('leaves the camera alone when no view is configured', async () => {
      await scene.enter()
      expect(api.cameraCalls).toEqual([])
      expect(api.focusCalls).toEqual([])
    })

    it('still builds the heatmap when there are no hotspots', async () => {
      scene.setData({ ...data, hotspots: [] }, 12)
      await scene.enter()
      expect(heatIds(api)).toHaveLength(1)
      expect(api.ids('radiationPoint')).toEqual([])
      expect(api.ids('marker')).toEqual(data.cameras.map(c => 'marker:camera-' + c.id).sort())
      expect(scene.tourViews()).toEqual([])
    })
  })

  describe('时间轴', () => {
    it('rebuilds the heatmap and the ripples when the hour changes, without duplicating them', async () => {
      await scene.enter()
      const before = heat(api)
      await scene.setHour(19.5)
      const after = heat(api)
      expect(after).not.toBe(before)
      expect(api.ids('heatmap')).toHaveLength(1)
      expect(api.store.size).toBe(total)
      const h = data.hotspots[0]
      expect(after.data.find((p: any) => p.id === 'hot-' + h.id).heatValue).toBeCloseTo(Math.min(after.range[1], 3 * hotspotActivityAt(h, 19.5)))
      expect(api.store.get('radiationPoint:hotspot-ripple-' + h.id).radius).toBeCloseTo(260 + 520 * hotspotActivityAt(h, 19.5))
    })

    it('makes hotspot ripples larger in the evening than before dawn', async () => {
      await scene.enter()
      const id = 'radiationPoint:hotspot-ripple-' + data.hotspots[0].id
      await scene.setHour(19.5)
      const evening = api.store.get(id).radius
      await scene.setHour(3)
      expect(api.store.get(id).radius).toBeLessThan(evening)
    })

    it('only records the hour while entering and applies the latest one after enter', async () => {
      let open!: () => void
      api.projectGate = new Promise<void>(resolve => (open = resolve))
      const entering = scene.enter()
      await scene.setHour(8)
      await scene.setHour(19.5)
      expect(api.ids('heatmap')).toEqual([])
      open()
      await entering
      expect(heatIds(api)).toHaveLength(1)
      const h = data.hotspots[0]
      expect(api.store.get('radiationPoint:hotspot-ripple-' + h.id).radius).toBeCloseTo(260 + 520 * hotspotActivityAt(h, 19.5))
      expect(scene.objectCount()).toBe(total)
    })

    it('keeps the hour set after leave for the next enter', async () => {
      await scene.enter()
      await scene.leave()
      await scene.setHour(19.5)
      expect(api.store.size).toBe(0)
      await scene.enter()
      const h = data.hotspots[0]
      expect(api.store.get('radiationPoint:hotspot-ripple-' + h.id).radius).toBeCloseTo(260 + 520 * hotspotActivityAt(h, 19.5))
    })

    it('ends on the last hour when the slider is dragged quickly', async () => {
      await scene.enter()
      await Promise.all([8, 12, 16, 22].map(h => scene.setHour(h)))
      const h = data.hotspots[0]
      expect(api.store.get('radiationPoint:hotspot-ripple-' + h.id).radius).toBeCloseTo(260 + 520 * hotspotActivityAt(h, 22))
      expect(api.store.size).toBe(total)
    })
  })

  describe('图层开关', () => {
    it('toggles a layer by key', async () => {
      await scene.enter()
      const camera = 'marker:camera-' + data.cameras[0].id
      const hotspot = 'marker:hotspot-' + data.hotspots[0].id
      await scene.setLayerVisible('camera', false)
      expect(api.visible.get(camera)).toBe(false)
      expect(api.visible.get(hotspot)).toBe(true)
      await scene.setLayerVisible('camera', true)
      expect(api.visible.get(camera)).toBe(true)
    })

    it('hides hotspot pins and ripples together', async () => {
      await scene.enter()
      await scene.setLayerVisible('hotspot', false)
      for (const h of data.hotspots) {
        expect(api.visible.get('marker:hotspot-' + h.id)).toBe(false)
        expect(api.visible.get('radiationPoint:hotspot-ripple-' + h.id)).toBe(false)
      }
      await scene.setLayerVisible('hotspot', true)
      expect(api.visible.get('radiationPoint:hotspot-ripple-' + data.hotspots[0].id)).toBe(true)
    })

    it('hides the heatmap by its key', async () => {
      await scene.enter()
      await scene.setLayerVisible('heat', false)
      expect(api.visible.get(heatIds(api)[0])).toBe(false)
    })

    it('does not create a layer that was switched off before entering, until it is switched on', async () => {
      await scene.setLayerVisible('heat', false)
      await scene.setLayerVisible('hotspot', false)
      await scene.enter()
      expect(api.ids('heatmap')).toEqual([])
      expect(api.ids('radiationPoint')).toEqual([])
      expect(api.ids('marker')).toEqual(data.cameras.map(c => 'marker:camera-' + c.id).sort())
      await scene.setHour(19.5)
      expect(api.ids('heatmap')).toEqual([])
      await scene.setLayerVisible('heat', true)
      expect(heatIds(api)).toHaveLength(1)
      await scene.setLayerVisible('hotspot', true)
      expect(api.ids('radiationPoint')).toHaveLength(data.hotspots.length)
      expect(api.store.size).toBe(total)
    })
  })

  describe('定位与巡航', () => {
    const xy = (position: number[]) => [position[0] * 1e5, position[1] * 1e5, 0]
    const hotspot = (id: string) => data.hotspots.find(h => h.id === id)!
    const camera = (id: string) => data.cameras.find(c => c.id === id)!

    it('flies to the shared look-down view of a hotspot (1700 m) or camera (2400 m) instead of focusing the object', async () => {
      await scene.enter()
      await scene.focusHotspot('h1')
      await scene.focusCamera('CAM-0705')
      expect(api.cameraCalls).toEqual([focusView(xy(hotspot('h1').position)), focusView(xy(camera('CAM-0705').position), 2400)])
      expect(api.cameraCalls[0].slice(2)).toEqual([1700, -42, 60])
      expect(api.cameraCalls[1].slice(2)).toEqual([2400, -42, 60])
      expect(api.focusCalls).toEqual([])
    })

    it('uses the same view when the layer is switched off', async () => {
      await scene.enter()
      await scene.setLayerVisible('hotspot', false)
      await scene.setLayerVisible('camera', false)
      await scene.focusHotspot('h1')
      await scene.focusCamera('CAM-0705')
      expect(api.cameraCalls).toEqual([focusView(xy(hotspot('h1').position)), focusView(xy(camera('CAM-0705').position), 2400)])
      expect(api.focusCalls).toEqual([])
    })

    it('does nothing for an unknown id', async () => {
      await scene.enter()
      await scene.focusHotspot('不存在')
      await scene.focusCamera('不存在')
      expect(api.cameraCalls).toEqual([])
      expect(api.focusCalls).toEqual([])
    })

    it('flies to a district by name from 3600 m and reports unknown names', async () => {
      await scene.enter()
      const d = geo.districts[0]
      expect(await scene.focusDistrict(d.name)).toBe(true)
      expect(api.cameraCalls).toEqual([focusView(d.centerXY, 3600)])
      expect(await scene.focusDistrict('不存在的片区')).toBe(false)
      expect(api.cameraCalls).toHaveLength(1)
    })

    it('offers one tour view per hotspot, hottest first, looking south-east from the north-west', async () => {
      expect(scene.tourViews()).toEqual([])
      await scene.enter()
      const ranked = [...data.hotspots].sort((a, b) => b.heat - a.heat)
      const views = scene.tourViews()
      expect(views).toEqual(ranked.map(h => focusView(xy(h.position))))
      views.forEach((v, i) => {
        expect(v[0]).toBeLessThan(ranked[i].position[0] * 1e5)
        expect(v[1]).toBeGreaterThan(ranked[i].position[1] * 1e5)
        expect(v.slice(2)).toEqual([1700, -42, 60])
      })
    })
  })

  describe('离开', () => {
    it('removes everything on leave', async () => {
      await scene.enter()
      await scene.leave()
      expect(api.store.size).toBe(0)
      expect(scene.objectCount()).toBe(0)
    })

    it('adds nothing when leave happens while entering', async () => {
      let open!: () => void
      api.projectGate = new Promise<void>(resolve => (open = resolve))
      const entering = scene.enter()
      const leaving = scene.leave()
      open()
      await Promise.all([entering, leaving])
      expect(api.store.size).toBe(0)
    })

    it('ignores setHour after leave', async () => {
      await scene.enter()
      await scene.leave()
      await scene.setHour(19.5)
      expect(api.store.size).toBe(0)
    })

    it('does not grow after repeated enter/leave', async () => {
      for (let i = 0; i < 5; i++) {
        await scene.enter()
        await scene.setHour(i)
        await scene.leave()
      }
      await scene.enter()
      expect(api.store.size).toBe(total)
      expect(scene.objectCount()).toBe(total)
    })
  })
})
