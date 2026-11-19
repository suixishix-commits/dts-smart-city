import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildEnvironmentData, concentrationsAt, noiseDbAt, readingOf } from '@/api/mock/environment'
import type { SceneApi, SceneObjectType } from '@/scene/SceneApi'
import { buildCityGeo, pointAt, type CityGeo } from '@/scene/geo'
import { COLOR, focusView, LABEL_TIERS, LEVEL_COLOR, rgba } from '@/scene/kit'
import type { EnvironmentData } from '@/types/environment'
import type { GeoData } from '@/types/geo'
import { HEAT_FIELD_MATERIAL } from '@/scene/heatField'
import { airFieldValue, ENV_LAYERS, EnvironmentScene, noiseColor, WATER_COLORS } from '../EnvironmentScene'

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

  it('默认打开空气质量、监测站点、污染源，噪声、生态空间和水质不创建', async () => {
    await scene.enter()
    expect(ENV_LAYERS.filter(l => l.on).map(l => l.key)).toEqual(['air', 'station', 'source'])
    expect(ENV_LAYERS.filter(l => l.on).length).toBeLessThanOrEqual(4)
    expect(ENV_LAYERS.find(l => l.key === 'water')).toEqual({ key: 'water', name: '水质', on: false })
    expect(api.ids('polygon', 'air-')).toHaveLength(16)
    expect(api.ids('marker', 'station-')).toHaveLength(10)
    expect(api.ids('marker', 'source-')).toHaveLength(data.sources.length)
    expect(api.ids('radiationPoint')).toHaveLength(data.sources.length)
    expect(api.ids('polygon3d')).toEqual([])
    expect(api.ids('polygon', 'green-')).toEqual([])
    expect(api.ids('marker', 'water-')).toEqual([])
    // 片区：着色面 + 读数标注各 16 个
    expect(api.ids('marker', 'air-label-')).toHaveLength(16)
    expect(scene.objectCount()).toBe(16 + 16 + 10 + data.sources.length * 2)
  })

  it('默认机位一屏能看到的标注不超过 30 个（全部图层打开；次要标注拉近才显示，不计入）', async () => {
    await scene.enter()
    await scene.setLayerVisible('noise', true)
    await scene.setLayerVisible('green', true)
    await scene.setLayerVisible('water', true)
    const visible = api.ids('marker').filter(key => {
      const range = api.store.get(key).viewHeightRange as number[] | undefined
      return !range || range[1] >= 9600
    })
    expect(visible.length).toBeLessThanOrEqual(30)
  })

  it('空气质量开关同时控制片区着色和片区读数标注', async () => {
    await scene.enter()
    const labels = api.ids('marker', 'air-label-')
    expect(labels.every(k => api.visible.get(k))).toBe(true)
    await scene.setLayerVisible('air', false)
    expect(labels.every(k => api.visible.get(k) === false)).toBe(true)
    await scene.setLayerVisible('air', true)
    expect(labels.every(k => api.visible.get(k))).toBe(true)
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
    // 轻度污染及以上的站点始终显示（优先级 10），其余参与避让（优先级 7）
    const levels = new Set<boolean>()
    for (const s of data.stations) {
      const bad = readingOf(concentrationsAt(s, 11), 'aqi').level >= 2
      levels.add(bad)
      const pinned = api.store.get('marker:station-' + s.id)
      expect(pinned.priority, s.id).toBe(bad ? 10 : 2)
      expect(pinned.viewHeightRange, s.id).toEqual(bad ? undefined : [1, LABEL_TIERS.minor])
    }
    expect(levels.size).toBe(2)
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

  it('打开生态空间图层：只有 3 个范围面，水质采样点归水质图层', async () => {
    await scene.enter()
    await scene.setLayerVisible('green', true)
    expect(api.ids('polygon', 'green-')).toHaveLength(3)
    expect(api.ids('marker', 'water-')).toEqual([])
    const park = api.store.get('polygon:green-umm-al-emarat-park')
    const c = geo.landmark('umm-al-emarat-park')!.xy
    park.coordinates.forEach((p: number[]) => expect(Math.hypot(p[0] - c[0], p[1] - c[1])).toBeLessThanOrEqual(500.001))
    expect(park.color).toEqual(rgba(COLOR.ok, 0.12))
  })

  it('打开水质图层：沿海岸道路的采样点按类别着色，超标点常显，可点击', async () => {
    await scene.enter()
    await scene.setLayerVisible('water', true)
    expect(api.ids('marker', 'water-')).toHaveLength(data.waterSamples.length)
    for (const w of data.waterSamples) {
      const m = api.store.get('marker:water-' + w.id)
      const at = pointAt(geo.road(w.place.road)!.line, w.place.t)
      expect(m.coordinate).toEqual([at[0], at[1], 0])
      expect(m.lineColor).toEqual(rgba(WATER_COLORS[w.grade], 0.95))
      expect(m.groupId).toBe('sc_environment_water')
      expect(JSON.parse(m.userData)).toEqual({ id: w.id })
      expect(m.priority >= 10, w.id).toBe(w.grade >= 3)
    }
    // 达标的一、二类用冷色，超标的三、四类用暖色
    expect([WATER_COLORS[1], WATER_COLORS[2]]).toEqual([COLOR.accent, COLOR.accentLight])
    expect([WATER_COLORS[3], WATER_COLORS[4]]).toEqual([COLOR.caution, COLOR.warn])
    await scene.setLayerVisible('water', false)
    expect(api.visible.get('marker:water-' + data.waterSamples[0].id)).toBe(false)
    expect(api.ids('polygon', 'green-')).toEqual([])
  })

  it('定位水质采样点：飞到 1700 米俯瞰机位，水质图层关着也能飞', async () => {
    await scene.enter()
    const w = data.waterSamples[4]
    const at = pointAt(geo.road(w.place.road)!.line, w.place.t)
    await scene.focusWater(w.id)
    expect(api.cameraCalls).toEqual([focusView(at)])
    expect(api.cameraCalls[0][2]).toBe(1700)
    await scene.focusWater('不存在')
    expect(api.cameraCalls).toHaveLength(1)
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

  it('定位：不论图层开关都飞到统一的俯瞰机位（1700 米），不对准标注；未知 id 不动相机', async () => {
    await scene.enter()
    const xy = geo.landmark('wtc')!.xy
    const source = data.sources[0]
    const sourceXY = api.store.get('marker:source-' + source.id).coordinate.slice(0, 2)
    await scene.focusStation('wtc')
    await scene.focusSource(source.id)
    expect(api.cameraCalls).toEqual([focusView(xy), focusView(sourceXY)])
    expect(api.cameraCalls[0][0]).toBeLessThan(xy[0])
    expect(api.cameraCalls[0].slice(2)).toEqual([1700, -42, 60])

    api.cameraCalls = []
    await scene.setLayerVisible('station', false)
    await scene.setLayerVisible('source', false)
    await scene.focusStation('wtc')
    await scene.focusSource(source.id)
    expect(api.cameraCalls).toEqual([focusView(xy), focusView(sourceXY)])

    await scene.focusStation('不存在')
    await scene.focusSource('不存在')
    expect(api.cameraCalls).toHaveLength(2)
    expect(api.focusCalls).toEqual([])
  })

  it('巡航机位：先最差的三个站，再各污染源', async () => {
    await scene.enter()
    const views = scene.tourViews()
    expect(views).toHaveLength(6)
    const port = geo.landmark('mina-zayed')!.xy
    expect(views[0]).toEqual(focusView(port))
    views.forEach(v => expect(v).toHaveLength(5))
  })

  it('离开后清干净，反复进出不累积', async () => {
    await scene.enter()
    await scene.setLayerVisible('noise', true)
    await scene.setLayerVisible('green', true)
    await scene.setLayerVisible('water', true)
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

describe('空气质量连续场', () => {
  it('指数映射到材质密度：等级内部平，等级分界处陡', () => {
    expect(airFieldValue(0)).toBeCloseTo(0.56)
    expect(airFieldValue(75)).toBeGreaterThan(0.8)
    expect(airFieldValue(75)).toBeLessThan(0.81)
    expect(airFieldValue(125)).toBeCloseTo(0.9, 1)
    expect(airFieldValue(400)).toBe(1)
    for (let i = 0; i < 250; i += 5) expect(airFieldValue(i + 5)).toBeGreaterThanOrEqual(airFieldValue(i))
  })

  it('热力场可用时画一张带 AQI 色带的连续面，不画片区面', async () => {
    const api = new FakeApi()
    const scene = new EnvironmentScene(api, geo, { cameraView: null, pak: false, heatField: true })
    scene.setData(data, 11)
    await scene.enter()
    const fields = api.ids('customMesh')
    expect(fields).toHaveLength(1)
    const mesh = api.store.get(fields[0])
    expect(mesh.material).toBe(HEAT_FIELD_MATERIAL)
    expect(mesh.vectorParameters.map((p: { name: string }) => p.name)).toEqual(['C0', 'C1', 'C2', 'C3', 'C4', 'C5'])
    expect(api.ids('polygon', 'air-')).toEqual([])
    await scene.setLayerVisible('air', false)
    expect(api.visible.get(fields[0])).toBe(false)
    await scene.leave()
    expect(api.ids('customMesh')).toEqual([])
  })
})
