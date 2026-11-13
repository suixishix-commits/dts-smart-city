import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildEnvironmentData, concentrationsAt, noiseDbAt, readingOf } from '@/api/mock/environment'
import type { SceneApi, SceneObjectType } from '@/scene/SceneApi'
import { buildCityGeo, pointAt, type CityGeo } from '@/scene/geo'
import { COLOR, LEVEL_COLOR, rgba } from '@/scene/kit'
import type { EnvironmentData } from '@/types/environment'
import type { GeoData } from '@/types/geo'
import { ENV_LAYERS, EnvironmentScene, noiseColor } from '../EnvironmentScene'

/** 严格的场景替身：重复添加同一个 id、删除不存在的 id 都会抛错 */
class FakeApi implements SceneApi {
  store = new Map<string, any>()
  visible = new Map<string, boolean>()
  addCalls: string[] = []
  cameraCalls: number[][] = []
  focusCalls: string[] = []
  async add(type: SceneObjectType, objects: { id: string }[]) {
    this.addCalls.push(type)
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
  async focus(type: SceneObjectType, id: string) {
    this.focusCalls.push(`${type}:${id}`)
  }
  async project(lonLat: number[][]) {
    return lonLat.map(p => [p[0] * 1e5, p[1] * 1e5, 0])
  }
  ids(type: string, prefix = '') {
    return [...this.store.keys()].filter(k => k.startsWith(`${type}:${prefix}`)).sort()
  }
}

const raw: GeoData = JSON.parse(readFileSync('public/data/smart-city/geo.json', 'utf-8'))
let geo: CityGeo
let data: EnvironmentData

beforeAll(async () => {
  geo = await buildCityGeo(raw, async ll => ll.map(p => [p[0] * 1e5, p[1] * 1e5, 0]))
  data = buildEnvironmentData(raw)
})

describe('EnvironmentScene', () => {
  let api: FakeApi
  let scene: EnvironmentScene

  beforeEach(() => {
    api = new FakeApi()
    scene = new EnvironmentScene(api, geo, { cameraView: null, pak: false })
    scene.setData(data, 11)
  })

  it('默认打开空气质量、监测站点、污染源，噪声和生态空间不创建', async () => {
    await scene.enter()
    expect(ENV_LAYERS.filter(l => l.on).map(l => l.key)).toEqual(['air', 'station', 'source'])
    expect(api.ids('polygon', 'air-')).toHaveLength(16)
    expect(api.ids('marker', 'station-')).toHaveLength(10)
    expect(api.ids('marker', 'source-')).toHaveLength(data.sources.length)
    expect(api.ids('radiationPoint')).toHaveLength(data.sources.length)
    expect(api.ids('polygon3d')).toEqual([])
    expect(api.ids('polygon', 'green-')).toEqual([])
    expect(api.ids('marker', 'water-')).toEqual([])
    expect(scene.objectCount()).toBe(16 + 10 + data.sources.length * 2)
  })

  it('一屏标注不超过 30 个（五个图层全开）', async () => {
    await scene.enter()
    await scene.setLayerVisible('noise', true)
    await scene.setLayerVisible('green', true)
    expect(api.ids('marker').length).toBeLessThanOrEqual(30)
  })

  it('片区按所选时刻的 AQI 等级着色：港区轻度，公园片区优', async () => {
    await scene.enter()
    expect(api.store.get('polygon:air-zahiyah').color).toEqual(rgba(COLOR.warn, 0.16))
    expect(api.store.get('polygon:air-mushrif').color).toEqual(rgba(COLOR.ok, 0.16))
    expect(api.store.get('polygon:air-zahiyah').groupId).toBe('sc_environment_air')
  })

  it('监测站标注落在地标上，显示站名和读数，按等级着色，可点击', async () => {
    await scene.enter()
    const m = api.store.get('marker:station-mina-zayed')
    const xy = geo.landmark('mina-zayed')!.xy
    expect(m.coordinate).toEqual([xy[0], xy[1], 0])
    const station = data.stations.find(s => s.id === 'mina-zayed')!
    const r = readingOf(concentrationsAt(station, 11), 'aqi')
    expect(m.text).toBe(`扎耶德港  ${r.value}`)
    expect(m.lineColor).toEqual(rgba(COLOR.danger, 0.95))
    expect(m.groupId).toBe('sc_environment_station')
    expect(JSON.parse(m.userData)).toEqual({ id: 'mina-zayed' })
    expect(api.store.get('marker:station-umm-al-emarat-park').lineColor).toEqual(rgba(COLOR.ok, 0.95))
  })

  it('污染源是波纹 + 标注，按告警等级用暖色，波纹半径在 250–800 米', async () => {
    await scene.enter()
    for (const s of data.sources) {
      const ripple = api.store.get('radiationPoint:source-ripple-' + s.id)
      const marker = api.store.get('marker:source-' + s.id)
      expect(ripple.color).toEqual(rgba(LEVEL_COLOR[s.level], 0.9))
      expect(ripple.radius).toBeGreaterThanOrEqual(250)
      expect(ripple.radius).toBeLessThanOrEqual(800)
      expect(marker.groupId).toBe('sc_environment_source')
      expect(JSON.parse(marker.userData)).toEqual({ id: s.id })
      expect([COLOR.danger, COLOR.warn, COLOR.caution]).toContain(LEVEL_COLOR[s.level])
    }
  })

  it('切换小时：片区换色、站点读数更新，对象数量不变', async () => {
    await scene.enter()
    const before = api.store.get('marker:station-mina-zayed').text
    await scene.setHour(3)
    expect(api.store.get('marker:station-mina-zayed').text).not.toBe(before)
    expect(api.store.get('polygon:air-zahiyah').color).toEqual(rgba(COLOR.caution, 0.16))
    expect(api.ids('polygon', 'air-')).toHaveLength(16)
    expect(api.ids('marker', 'station-')).toHaveLength(10)
  })

  it('切换指标：O₃ 模式下午后港区不再是暖色，站点显示 O₃ 浓度', async () => {
    scene.setData(data, 15)
    await scene.enter()
    await scene.setIndex('o3')
    const station = data.stations.find(s => s.id === 'wtc')!
    expect(api.store.get('marker:station-wtc').text).toBe(`世贸中心  ${concentrationsAt(station, 15).o3}`)
    expect([rgba(COLOR.ok, 0.16), rgba(COLOR.caution, 0.16)]).toContainEqual(api.store.get('polygon:air-zahiyah').color)
  })

  it('内容没变时不重建图层', async () => {
    await scene.enter()
    const calls = api.addCalls.length
    await scene.setHour(11)
    await scene.setIndex('aqi')
    expect(api.addCalls.length).toBe(calls)
  })

  it('打开噪声图层：每个路口一根柱，高度 (dB − 40) × 25 米，颜色取色带', async () => {
    await scene.enter()
    await scene.setLayerVisible('noise', true)
    expect(api.ids('polygon3d')).toHaveLength(data.noisePoints.length)
    const p = data.noisePoints[0]
    const col = api.store.get('polygon3d:noise-' + p.id)
    const db = noiseDbAt(p, 11)
    expect(col.height).toBeCloseTo((db - 40) * 25)
    expect(col.color).toEqual(rgba(noiseColor(db), 0.85))
    await scene.setHour(3)
    expect(api.store.get('polygon3d:noise-' + p.id).height).toBeLessThan(col.height)
    expect(api.ids('polygon3d')).toHaveLength(data.noisePoints.length)
  })

  it('打开生态空间图层：3 个范围面 + 沿海岸道路的水质采样点', async () => {
    await scene.enter()
    await scene.setLayerVisible('green', true)
    expect(api.ids('polygon', 'green-')).toHaveLength(3)
    expect(api.ids('marker', 'water-')).toHaveLength(data.waterSamples.length)
    const park = api.store.get('polygon:green-umm-al-emarat-park')
    const c = geo.landmark('umm-al-emarat-park')!.xy
    park.coordinates.forEach((p: number[]) => expect(Math.hypot(p[0] - c[0], p[1] - c[1])).toBeLessThanOrEqual(500.001))
    expect(park.color).toEqual(rgba(COLOR.ok, 0.12))
    const w = data.waterSamples[0]
    const at = pointAt(geo.road(w.place.road)!.line, w.place.t)
    expect(api.store.get('marker:water-' + w.id).coordinate).toEqual([at[0], at[1], 0])
  })

  it('图层开关按 key 生效，互不影响', async () => {
    await scene.enter()
    await scene.setLayerVisible('station', false)
    expect(api.visible.get('marker:station-wtc')).toBe(false)
    expect(api.visible.get('marker:source-' + data.sources[0].id)).toBe(true)
    await scene.setLayerVisible('source', false)
    expect(api.visible.get('marker:source-' + data.sources[0].id)).toBe(false)
    expect(api.visible.get('radiationPoint:source-ripple-' + data.sources[0].id)).toBe(false)
    await scene.setLayerVisible('air', false)
    expect(api.visible.get('polygon:air-danah')).toBe(false)
    await scene.setLayerVisible('station', true)
    expect(api.visible.get('marker:station-wtc')).toBe(true)
  })

  it('进入前关掉的图层不创建，打开后才创建', async () => {
    await scene.setLayerVisible('station', false)
    await scene.enter()
    expect(api.ids('marker', 'station-')).toEqual([])
    await scene.setLayerVisible('station', true)
    expect(api.ids('marker', 'station-')).toHaveLength(10)
  })

  it('配置了默认机位时进入即设置相机', async () => {
    scene = new EnvironmentScene(api, geo, { cameraView: [1, 2, 3, -38, -38], pak: false })
    scene.setData(data, 11)
    await scene.enter()
    expect(api.cameraCalls).toEqual([[1, 2, 3, -38, -38]])
  })

  it('定位：图层开着对准标注，关着直接摆相机', async () => {
    await scene.enter()
    await scene.focusStation('wtc')
    await scene.focusSource(data.sources[0].id)
    expect(api.focusCalls).toEqual(['marker:station-wtc', 'marker:source-' + data.sources[0].id])
    await scene.setLayerVisible('station', false)
    await scene.focusStation('wtc')
    expect(api.focusCalls).toHaveLength(2)
    const xy = geo.landmark('wtc')!.xy
    expect(api.cameraCalls).toEqual([[xy[0] - 800, xy[1] - 1000, 1300, -38, -38]])
  })

  it('巡航机位：先最差的三个站，再各污染源', async () => {
    await scene.enter()
    const views = scene.tourViews()
    expect(views).toHaveLength(6)
    const port = geo.landmark('mina-zayed')!.xy
    expect(views[0]).toEqual([port[0] - 1500, port[1] - 1900, 2200, -38, -38])
    views.forEach(v => expect(v).toHaveLength(5))
  })

  it('离开后清干净，反复进出不累积', async () => {
    await scene.enter()
    await scene.setLayerVisible('noise', true)
    await scene.setLayerVisible('green', true)
    await scene.leave()
    expect(api.store.size).toBe(0)
    expect(scene.objectCount()).toBe(0)
    for (let i = 0; i < 3; i++) {
      await scene.enter()
      await scene.setHour(i * 5)
      await scene.leave()
    }
    expect(api.store.size).toBe(0)
  })

  it('进入完成前切换小时只记录，进入后用最新值', async () => {
    await scene.setHour(3)
    expect(api.store.size).toBe(0)
    await scene.enter()
    expect(api.store.get('polygon:air-zahiyah').color).toEqual(rgba(COLOR.caution, 0.16))
  })

  it('没有数据时进入不创建任何对象', async () => {
    const empty = new EnvironmentScene(api, geo, { cameraView: null, pak: false })
    await empty.enter()
    expect(api.store.size).toBe(0)
  })
})
