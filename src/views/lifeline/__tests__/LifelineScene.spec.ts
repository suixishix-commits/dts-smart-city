import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildLifelineData } from '@/api/mock/lifeline'
import type { SceneApi, SceneObjectType } from '@/scene/SceneApi'
import { buildCityGeo, type CityGeo } from '@/scene/geo'
import { COLOR, LEVEL_COLOR, rgba, STATUS_RAMP } from '@/scene/kit'
import type { GeoData } from '@/types/geo'
import geoJson from '../../../../public/data/smart-city/geo.json'
import { fractionOf, resolveAnchor, segmentBetween } from '../anchor'
import { DRAIN_COLOR, LIFELINE_LAYERS, LifelineScene, PIPE_HEIGHT } from '../LifelineScene'

/** 严格的场景替身：重复添加同一个 id、删除不存在的 id 都会抛错 */
class FakeApi implements SceneApi {
  store = new Map<string, any>()
  visible = new Map<string, boolean>()
  cameraCalls: number[][] = []
  focusCalls: string[] = []
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
  async focus(type: SceneObjectType, id: string) {
    this.focusCalls.push(`${type}:${id}`)
  }
  async project(lonLat: number[][]) {
    return lonLat.map(p => [p[0] * 1e5, p[1] * 1e5, 0])
  }
  ids(type: string, prefix = '') {
    return [...this.store.keys()].filter(k => k.startsWith(`${type}:${prefix}`)).sort()
  }
  get(key: string) {
    return this.store.get(key)
  }
}

const raw = geoJson as unknown as GeoData
const data = buildLifelineData(raw)
const count = (system: string) => data.pipes.filter(p => p.system === system).length

describe('LifelineScene', () => {
  let geo: CityGeo
  let api: FakeApi
  let roadCalls: boolean[]
  let scene: LifelineScene

  beforeAll(async () => {
    geo = await buildCityGeo(raw, async ll => ll.map(p => [p[0] * 1e5, p[1] * 1e5, 0]))
  })

  beforeEach(() => {
    api = new FakeApi()
    roadCalls = []
    scene = new LifelineScene(api, geo, { cameraView: null, pak: false, roads: { setRoadsVisible: async v => void roadCalls.push(v) } })
    scene.setData(data)
  })

  it('进入后创建六个图层的全部对象', async () => {
    await scene.enter()
    expect(api.ids('polyline', 'll-pipe-')).toHaveLength(data.pipes.length)
    expect(api.ids('polyline', 'll-alarm-pipe-')).toEqual(['polyline:ll-alarm-pipe-a1'])
    expect(api.ids('marker', 'll-sub-')).toHaveLength(data.substations.length)
    expect(api.ids('marker', 'll-alarm-')).toHaveLength(data.alarms.length)
    expect(api.ids('radiationPoint', 'll-alarm-ripple-')).toHaveLength(data.alarms.length)
    expect(api.ids('marker', 'll-gas-')).toHaveLength(data.gasStations.length)
    expect(api.ids('polygon', 'll-flood-area-')).toHaveLength(data.floodPoints.length)
    expect(api.ids('marker', 'll-flood-')).toHaveLength(data.floodPoints.length)
    expect(api.ids('marker', 'll-pump-')).toHaveLength(data.pumpStations.length)
    expect(api.ids('marker', 'll-bridge-')).toHaveLength(3)
    expect(api.ids('radiationPoint', 'll-bridge-ripple-')).toHaveLength(3)
    expect(scene.objectCount()).toBe(api.store.size)
  })

  it('一屏的标注不超过 30 个', async () => {
    await scene.enter()
    expect(api.ids('marker').length).toBeLessThanOrEqual(30)
  })

  it('各管网沿真实道路敷设，离地高度互不相同', async () => {
    await scene.enter()
    expect(new Set(Object.values(PIPE_HEIGHT)).size).toBe(4)
    for (const p of data.pipes) {
      const line = api.get('polyline:ll-pipe-' + p.id)
      const road = geo.road(p.roadId)
      expect(line.coordinates).toEqual(road?.line.map(xy => [xy[0], xy[1], PIPE_HEIGHT[p.system]]))
    }
  })

  it('管网颜色：供水蓝、电力冰蓝、燃气暖色且亮度最低、排水暗蓝', async () => {
    await scene.enter()
    const water = api.get('polyline:ll-pipe-water-khaleej')
    const branch = api.get('polyline:ll-pipe-water-zayed1')
    const power = api.get('polyline:ll-pipe-power-salam')
    const gas = api.get('polyline:ll-pipe-gas-delma')
    const drain = api.get('polyline:ll-pipe-drain-muroor')
    expect(water.color).toEqual(rgba(COLOR.accent))
    expect(water.thickness).toBe(60)
    expect(branch.thickness).toBe(34)
    expect(power.color).toEqual(rgba(COLOR.ice))
    expect(gas.color.slice(0, 3)).toEqual(rgba(COLOR.warn).slice(0, 3))
    expect(gas.intensity).toBeLessThan(power.intensity)
    expect(gas.intensity).toBeLessThan(water.intensity)
    expect(drain.color.slice(0, 3)).toEqual(rgba(DRAIN_COLOR).slice(0, 3))
  })

  it('爆管的受影响管段是两个相邻路口之间的阿拉伯湾街，用告警红重绘', async () => {
    await scene.enter()
    const seg = api.get('polyline:ll-alarm-pipe-a1')
    expect(seg.color).toEqual(rgba(COLOR.danger))
    const at = (id: string) => geo.intersections.find(i => i.id === id)?.xy as number[]
    const first = seg.coordinates[0]
    const last = seg.coordinates[seg.coordinates.length - 1]
    expect(Math.hypot(first[0] - at('hamdan-khaleej')[0], first[1] - at('hamdan-khaleej')[1])).toBeLessThan(30)
    expect(Math.hypot(last[0] - at('zayed1-khaleej')[0], last[1] - at('zayed1-khaleej')[1])).toBeLessThan(30)
    // 爆管点在这一段上
    const burst = api.get('marker:ll-alarm-a1').coordinate
    const road = geo.road('khaleej')?.line as number[][]
    const f = fractionOf(road, burst)
    expect(f).toBeGreaterThan(fractionOf(road, at('hamdan-khaleej')))
    expect(f).toBeLessThan(fractionOf(road, at('zayed1-khaleej')))
  })

  it('告警的波纹和标注按等级着色，标注可点击', async () => {
    await scene.enter()
    for (const a of data.alarms) {
      const m = api.get('marker:ll-alarm-' + a.id)
      const r = api.get('radiationPoint:ll-alarm-ripple-' + a.id)
      expect(m.groupId).toBe('sc_lifeline_alarm')
      expect(JSON.parse(m.userData)).toEqual({ id: a.id })
      expect(m.lineColor.slice(0, 3)).toEqual(rgba(LEVEL_COLOR[a.level]).slice(0, 3))
      expect(r.color.slice(0, 3)).toEqual(rgba(LEVEL_COLOR[a.level]).slice(0, 3))
      expect(r.radius).toBeGreaterThanOrEqual(250)
      expect(r.radius).toBeLessThanOrEqual(800)
      expect(r.coordinate.slice(0, 2)).toEqual(m.coordinate.slice(0, 2))
    }
  })

  it('变电站在真实路口上，标注带负荷率并按负荷状态着色', async () => {
    await scene.enter()
    for (const s of data.substations) {
      const m = api.get('marker:ll-sub-' + s.id)
      expect(m.text).toContain(s.loadPercent + '%')
      expect(m.lineColor.slice(0, 3)).toEqual(rgba(STATUS_RAMP[s.status]).slice(0, 3))
      expect(geo.intersections.some(i => i.xy[0] === m.coordinate[0] && i.xy[1] === m.coordinate[1])).toBe(true)
    }
  })

  it('易涝点范围面以积水点为圆心，标注显示水深', async () => {
    await scene.enter()
    for (const f of data.floodPoints) {
      const center = resolveAnchor(geo, f.anchor)
      const ring = api.get('polygon:ll-flood-area-' + f.id).coordinates as number[][]
      ring.forEach(p => expect(Math.hypot(p[0] - center[0], p[1] - center[1])).toBeCloseTo(f.radius, 3))
      expect(api.get('marker:ll-flood-' + f.id).text).toBe(`积水 ${f.depthCm} cm`)
      expect(api.get('polygon:ll-flood-area-' + f.id).color.slice(0, 3)).toEqual(rgba(STATUS_RAMP[f.status]).slice(0, 3))
    }
  })

  it('三座桥的标注在桥梁地标上，带健康评分', async () => {
    await scene.enter()
    for (const b of data.bridges) {
      const m = api.get('marker:ll-bridge-' + b.id)
      expect(m.text).toContain(String(b.score))
      expect(m.coordinate.slice(0, 2)).toEqual(geo.landmark(b.id)?.xy)
      const expected = b.score >= 85 ? COLOR.ok : COLOR.caution
      expect(api.get('radiationPoint:ll-bridge-ripple-' + b.id).color.slice(0, 3)).toEqual(rgba(expected).slice(0, 3))
    }
  })

  it('进入时隐藏底座路网，离开后恢复并清空场景', async () => {
    await scene.enter()
    expect(roadCalls).toEqual([false])
    await scene.leave()
    expect(roadCalls).toEqual([false, true])
    expect(api.store.size).toBe(0)
    expect(scene.objectCount()).toBe(0)
  })

  it('进入前关闭的图层不创建对象，打开后才创建', async () => {
    await scene.setLayerVisible('gas', false)
    await scene.setLayerVisible('drain', false)
    await scene.enter()
    expect(api.ids('polyline', 'll-pipe-gas-')).toEqual([])
    expect(api.ids('marker', 'll-gas-')).toEqual([])
    expect(api.ids('polygon')).toEqual([])
    expect(api.ids('polyline', 'll-pipe-water-')).toHaveLength(count('water'))

    await scene.setLayerVisible('gas', true)
    expect(api.ids('polyline', 'll-pipe-gas-')).toHaveLength(count('gas'))
    expect(api.ids('marker', 'll-gas-')).toHaveLength(data.gasStations.length)
    expect(api.ids('polygon')).toEqual([])
  })

  it('图层开关控制该图层的全部对象，不影响其它图层', async () => {
    await scene.enter()
    await scene.setLayerVisible('alarm', false)
    expect(api.visible.get('marker:ll-alarm-a1')).toBe(false)
    expect(api.visible.get('radiationPoint:ll-alarm-ripple-a1')).toBe(false)
    expect(api.visible.get('polyline:ll-alarm-pipe-a1')).toBe(false)
    expect(api.visible.get('polyline:ll-pipe-water-khaleej')).toBe(true)
    expect(api.visible.get('marker:ll-bridge-zayed-bridge')).toBe(true)

    await scene.setLayerVisible('power', false)
    expect(api.visible.get('polyline:ll-pipe-power-salam')).toBe(false)
    expect(api.visible.get('marker:ll-sub-' + data.substations[0].id)).toBe(false)

    await scene.setLayerVisible('alarm', true)
    expect(api.visible.get('marker:ll-alarm-a1')).toBe(true)
  })

  it('六个图层键都能单独关掉', async () => {
    await scene.enter()
    for (const l of LIFELINE_LAYERS) await scene.setLayerVisible(l, false)
    expect([...api.visible.values()].every(v => v === false)).toBe(true)
  })

  it('配置了默认机位时进入先设置相机', async () => {
    scene = new LifelineScene(api, geo, { cameraView: [1, 2, 3, -38, -38], pak: false })
    scene.setData(data)
    await scene.enter()
    expect(api.cameraCalls).toEqual([[1, 2, 3, -38, -38]])
  })

  it('定位告警和桥梁：图层开着聚焦标注，关着直接飞相机', async () => {
    await scene.enter()
    await scene.focusAlarm('a1')
    await scene.focusBridge('maqta-bridge')
    await scene.focusAlarm('不存在')
    expect(api.focusCalls).toEqual(['marker:ll-alarm-a1', 'marker:ll-bridge-maqta-bridge'])

    await scene.setLayerVisible('alarm', false)
    await scene.focusAlarm('a5')
    expect(api.focusCalls).toHaveLength(2)
    expect(api.cameraCalls).toHaveLength(1)
    const target = resolveAnchor(geo, data.alarms.find(a => a.id === 'a5')!.anchor)
    expect(api.cameraCalls[0][0]).toBeLessThan(target[0])
    expect(api.cameraCalls[0].slice(3)).toEqual([-38, -38])
  })

  it('巡航机位：先一、二级告警，再三座桥', () => {
    const views = scene.tourViews()
    const urgent = data.alarms.filter(a => a.level <= 2)
    expect(views).toHaveLength(urgent.length + 3)
    const first = resolveAnchor(geo, urgent[0].anchor)
    expect(urgent[0].id).toBe('a1')
    expect(views[0]).toEqual([first[0] - 3270 * 0.46, first[1] - 3270 * 0.58, 3270 * 0.67, -38, -38])
    views.forEach(v => expect(v).toHaveLength(5))
  })

  it('进入过程中离开，不留下任何对象，路网恢复显示', async () => {
    const entering = scene.enter()
    await scene.leave()
    await entering
    expect(api.store.size).toBe(0)
    expect(roadCalls[roadCalls.length - 1]).toBe(true)
  })

  it('反复进入离开不会累积对象', async () => {
    for (let i = 0; i < 4; i++) {
      await scene.enter()
      await scene.leave()
    }
    await scene.enter()
    const expected = data.pipes.length + 1 + data.substations.length + data.alarms.length * 2 + data.gasStations.length + data.floodPoints.length * 2 + data.pumpStations.length + 6
    expect(api.store.size).toBe(expected)
  })

  it('没有数据时进入不报错也不创建对象', async () => {
    const empty = new LifelineScene(api, geo, { cameraView: null, pak: false })
    await empty.enter()
    expect(api.store.size).toBe(0)
    expect(empty.tourViews()).toEqual([])
  })
})

describe('anchor', () => {
  let geo: CityGeo
  beforeAll(async () => {
    geo = await buildCityGeo(raw, async ll => ll.map(p => [p[0] * 1e5, p[1] * 1e5, 0]))
  })

  it('fractionOf 返回点在折线上的比例', () => {
    const line = [[0, 0], [10, 0], [10, 10]]
    expect(fractionOf(line, [5, 1])).toBeCloseTo(0.25)
    expect(fractionOf(line, [11, 5])).toBeCloseTo(0.75)
    expect(fractionOf(line, [-5, 0])).toBe(0)
    expect(fractionOf([[1, 1]], [0, 0])).toBe(0)
  })

  it('路口、地标、道路比例三种位置都能换成坐标', () => {
    expect(resolveAnchor(geo, { kind: 'intersection', id: 'falah-khaleej' })).toEqual(geo.intersections.find(i => i.id === 'falah-khaleej')?.xy)
    expect(resolveAnchor(geo, { kind: 'landmark', id: 'zayed-bridge' })).toEqual(geo.landmark('zayed-bridge')?.xy)
    expect(resolveAnchor(geo, { kind: 'road', roadId: 'salam', t: 0 })).toEqual(geo.road('salam')?.line[0])
    expect(() => resolveAnchor(geo, { kind: 'intersection', id: 'nowhere' })).toThrow(/nowhere/)
  })

  it('两个路口之间的管段不受路口先后顺序影响', () => {
    expect(segmentBetween(geo, 'muroor', 'falah-muroor', 'hazza-muroor')).toEqual(segmentBetween(geo, 'muroor', 'hazza-muroor', 'falah-muroor'))
  })
})
