import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildLifelineData } from '@/api/mock/lifeline'
import type { SceneApi, SceneObjectType } from '@/scene/SceneApi'
import { buildCityGeo, pointInRing, sliceLine, type CityGeo } from '@/scene/geo'
import { COLOR, focusView, LEVEL_COLOR, rgba, STATUS_RAMP } from '@/scene/kit'
import type { GeoData } from '@/types/geo'
import geoJson from '../../../../public/data/smart-city/geo.json'
import { bufferLine, fractionOf, resolveAnchor, segmentBetween } from '../anchor'
import { COOLING_COLOR, DRAIN_COLOR, POWER_COLOR, LIFELINE_LAYERS, LifelineScene, PIPE_HEIGHT, VALVE_COLOR } from '../LifelineScene'

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
  let dimCalls: boolean[]
  let scene: LifelineScene

  beforeAll(async () => {
    geo = await buildCityGeo(raw, async ll => ll.map(p => [p[0] * 1e5, p[1] * 1e5, 0]))
  })

  beforeEach(() => {
    api = new FakeApi()
    roadCalls = []
    dimCalls = []
    scene = new LifelineScene(api, geo, { cameraView: null, pak: false, roads: { setRoadsVisible: async v => void roadCalls.push(v), setRoadsDimmed: async v => void dimCalls.push(v) } })
    scene.setData(data)
  })

  it('进入后创建七个图层的全部对象', async () => {
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
    expect(api.ids('polyline', 'll-pipe-cooling-')).toHaveLength(count('cooling'))
    expect(api.ids('marker', 'll-cooling-')).toHaveLength(data.coolingPlants.length)
    // 阀门和影响范围只在选中告警后出现
    expect(api.ids('marker', 'll-valve-')).toEqual([])
    expect(api.ids('polygon', 'll-impact-')).toEqual([])
    expect(scene.objectCount()).toBe(api.store.size)
  })

  it('默认视角（燃气、排水、供冷默认关闭）一屏的标注不超过 30 个', async () => {
    for (const l of ['gas', 'drain', 'cooling']) await scene.setLayerVisible(l, false)
    await scene.enter()
    expect(api.ids('marker').length).toBeLessThanOrEqual(30)
  })

  it('各管网沿真实道路敷设，离地高度互不相同', async () => {
    await scene.enter()
    expect(new Set(Object.values(PIPE_HEIGHT)).size).toBe(5)
    for (const p of data.pipes) {
      const line = api.get('polyline:ll-pipe-' + p.id)
      const road = geo.road(p.roadId)?.line as [number, number][]
      const path = p.from <= 0 && p.to >= 1 ? road : sliceLine(road, p.from, p.to)
      expect(line.coordinates).toEqual(path.map(xy => [xy[0], xy[1], PIPE_HEIGHT[p.system]]))
    }
  })

  it('管网颜色：供水蓝、电力紫、燃气暖色且亮度最低、排水暗蓝；亮度都不超过 1，免得泛光把颜色冲白', async () => {
    await scene.enter()
    const water = api.get('polyline:ll-pipe-water-khaleej')
    const branch = api.get('polyline:ll-pipe-water-zayed1')
    const power = api.get('polyline:ll-pipe-power-salam')
    const gas = api.get('polyline:ll-pipe-gas-delma')
    const drain = api.get('polyline:ll-pipe-drain-muroor')
    expect(water.color).toEqual(rgba(COLOR.accent))
    expect(water.thickness).toBe(100)
    expect(branch.thickness).toBe(56)
    // 线宽按管网和主次：供水 100/56、电力 76/50、燃气 50、排水 70/50
    const WIDTH = { water: [100, 56], power: [76, 50], gas: [50, 50], drain: [70, 50], cooling: [70, 46] }
    for (const p of data.pipes) expect(api.get('polyline:ll-pipe-' + p.id).thickness, p.id).toBe(WIDTH[p.system][p.grade === 'trunk' ? 0 : 1])
    expect(power.color).toEqual(rgba(POWER_COLOR))
    expect(gas.color.slice(0, 3)).toEqual(rgba(COLOR.warn).slice(0, 3))
    expect(gas.intensity).toBeLessThan(power.intensity)
    expect(gas.intensity).toBeLessThan(water.intensity)
    expect(drain.color.slice(0, 3)).toEqual(rgba(DRAIN_COLOR).slice(0, 3))
    expect(api.get('polyline:ll-pipe-cooling-corniche').color).toEqual(rgba(COOLING_COLOR))
    expect(COOLING_COLOR).toBe('#66d9e8')
    for (const p of data.pipes) expect(api.get('polyline:ll-pipe-' + p.id).intensity, p.id).toBeLessThanOrEqual(1)
  })

  it('供冷站在供冷管经过的道路上，按状态着色，可点击', async () => {
    await scene.enter()
    for (const c of data.coolingPlants) {
      const m = api.get('marker:ll-cooling-' + c.id)
      expect(m.groupId).toBe('sc_lifeline_cooling')
      expect(JSON.parse(m.userData)).toEqual({ id: c.id })
      expect(m.lineColor.slice(0, 3)).toEqual(rgba(STATUS_RAMP[c.status]).slice(0, 3))
      expect(m.coordinate.slice(0, 2)).toEqual(resolveAnchor(geo, c.anchor))
    }
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
      // 告警全部常显（优先级 ≥ 10），级别越高优先级越高
      expect(m.priority).toBe(20 - a.level)
      expect(m.displayMode).toBe(2)
    }
  })

  it('变电站在真实路口上，标注带负荷率并按负荷状态着色', async () => {
    await scene.enter()
    for (const s of data.substations) {
      const m = api.get('marker:ll-sub-' + s.id)
      // 负荷正常的只显示负荷率，偏高或过载的才带站名
      expect(m.text).toBe(s.status > 0 ? `${s.name} ${s.loadPercent}%` : `${s.loadPercent}%`)
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

  it('地下模式默认关闭：进入不动底座路网，离开后清空场景', async () => {
    await scene.enter()
    expect(roadCalls).toEqual([])
    await scene.leave()
    expect(roadCalls).toEqual([])
    expect(api.store.size).toBe(0)
    expect(scene.objectCount()).toBe(0)
  })

  it('地上时压暗底座路网让管网突出：进入压暗，切到地下模式取消压暗（路网已隐藏），离开时恢复', async () => {
    await scene.enter()
    expect(dimCalls).toEqual([true])
    await scene.setUnderground(true)
    expect(dimCalls).toEqual([true, false])
    await scene.setUnderground(false)
    expect(dimCalls).toEqual([true, false, true])
    await scene.leave()
    expect(dimCalls).toEqual([true, false, true, false])
  })

  it('地下模式：打开隐藏底座路网，关闭恢复；重复设置不重复调用', async () => {
    await scene.enter()
    await scene.setUnderground(true)
    await scene.setUnderground(true)
    expect(roadCalls).toEqual([false])
    await scene.setUnderground(false)
    expect(roadCalls).toEqual([false, true])
  })

  it('地下模式进入前打开：进入时隐藏路网，离开时恢复；离开后再切换不动路网', async () => {
    await scene.setUnderground(true)
    expect(roadCalls).toEqual([])
    await scene.enter()
    expect(roadCalls).toEqual([false])
    await scene.leave()
    expect(roadCalls).toEqual([false, true])
    await scene.setUnderground(false)
    await scene.setUnderground(true)
    expect(roadCalls).toEqual([false, true])
  })

  it('选中告警后标出相关阀门（低优先级、白色），再选别的告警时替换，清除后移除', async () => {
    await scene.enter()
    await scene.showAlarmContext('a1')
    expect(api.ids('marker', 'll-valve-')).toEqual(['marker:ll-valve-valve-V-1023', 'marker:ll-valve-valve-V-1027'])
    const v = api.get('marker:ll-valve-valve-V-1023')
    expect(v.text).toBe('阀门 V-1023 · 已关闭')
    expect(v.priority).toBeLessThan(10)
    expect(v.lineColor.slice(0, 3)).toEqual(rgba(VALVE_COLOR).slice(0, 3))
    expect(v.coordinate.slice(0, 2)).toEqual(geo.intersections.find(i => i.id === 'hamdan-khaleej')?.xy)

    await scene.showAlarmContext('w2')
    expect(api.ids('marker', 'll-valve-')).toEqual(['marker:ll-valve-valve-PRV-118'])
    await scene.showAlarmContext('a5')
    expect(api.ids('marker', 'll-valve-')).toEqual([])
    await scene.showAlarmContext('a1')
    await scene.clearAlarmContext()
    expect(api.ids('marker', 'll-valve-')).toEqual([])
  })

  it('影响分析：爆管沿受影响管段画缓冲面并标出阀门，收起后只留阀门，清除后全部移除', async () => {
    await scene.enter()
    await scene.showImpact('a1')
    const poly = api.get('polygon:ll-impact-a1')
    expect(poly.color.slice(0, 3)).toEqual(rgba(LEVEL_COLOR[1]).slice(0, 3))
    const ring = (poly.coordinates as number[][]).map(p => [p[0], p[1]])
    // 爆管点和管段两端的路口都在影响范围内
    const burst = resolveAnchor(geo, data.alarms.find(a => a.id === 'a1')!.anchor)
    expect(pointInRing(burst, ring)).toBe(true)
    for (const id of ['hamdan-khaleej', 'zayed1-khaleej']) expect(pointInRing(geo.intersections.find(i => i.id === id)!.xy, ring)).toBe(true)
    expect(api.ids('marker', 'll-valve-')).toHaveLength(2)

    await scene.hideImpact()
    expect(api.ids('polygon', 'll-impact-')).toEqual([])
    expect(api.ids('marker', 'll-valve-')).toHaveLength(2)

    await scene.showImpact('a6')
    expect(api.ids('polygon', 'll-impact-')).toEqual(['polygon:ll-impact-a6'])
    // 没有受影响管段的告警：以告警点为圆心
    const a6 = data.alarms.find(a => a.id === 'a6')!
    const center = resolveAnchor(geo, a6.anchor)
    for (const p of api.get('polygon:ll-impact-a6').coordinates as number[][]) expect(Math.hypot(p[0] - center[0], p[1] - center[1])).toBeCloseTo(a6.analysis!.radius, 3)

    await scene.clearAlarmContext()
    expect(api.ids('polygon', 'll-impact-')).toEqual([])
    expect(api.ids('marker', 'll-valve-')).toEqual([])
  })

  it('没有影响分析的告警（桥梁）不画影响范围', async () => {
    await scene.enter()
    await scene.showImpact('b1')
    expect(api.ids('polygon', 'll-impact-')).toEqual([])
  })

  it('离开时影响范围和阀门一并清掉', async () => {
    await scene.enter()
    await scene.showImpact('a1')
    await scene.leave()
    expect(api.store.size).toBe(0)
    // 离开后再请求不会往场景里加东西
    await scene.showImpact('a1')
    expect(api.store.size).toBe(0)
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

  it('七个图层键都能单独关掉', async () => {
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

  it('定位告警和桥梁：不论图层开关都飞到统一的俯瞰机位（告警 3000 米、桥梁 3600 米），不聚焦标注', async () => {
    const alarmAt = (id: string) => resolveAnchor(geo, data.alarms.find(a => a.id === id)!.anchor)
    const bridgeAt = (id: string) => resolveAnchor(geo, { kind: 'landmark', id })
    await scene.enter()
    await scene.focusAlarm('a1')
    await scene.focusBridge('maqta-bridge')
    await scene.focusAlarm('不存在')
    await scene.focusBridge('不存在')
    expect(api.cameraCalls).toEqual([focusView(alarmAt('a1')), focusView(bridgeAt('maqta-bridge'), 3600)])
    expect(api.cameraCalls[0].slice(2)).toEqual([3000, -42, -38])
    expect(api.cameraCalls[1].slice(2)).toEqual([3600, -42, -38])

    api.cameraCalls = []
    await scene.setLayerVisible('alarm', false)
    await scene.setLayerVisible('bridge', false)
    await scene.focusAlarm('a5')
    await scene.focusBridge('maqta-bridge')
    expect(api.cameraCalls).toEqual([focusView(alarmAt('a5')), focusView(bridgeAt('maqta-bridge'), 3600)])
    expect(api.cameraCalls[0][0]).toBeLessThan(alarmAt('a5')[0])
    expect(api.focusCalls).toEqual([])
  })

  it('巡航机位：先一、二级告警（从重到轻），再三座桥', () => {
    const views = scene.tourViews()
    const urgent = data.alarms.filter(a => a.level <= 2).sort((a, b) => a.level - b.level || b.time.localeCompare(a.time))
    expect(urgent[0].id).toBe('a1')
    expect(data.bridges).toHaveLength(3)
    expect(views).toEqual([...urgent.map(a => focusView(resolveAnchor(geo, a.anchor))), ...data.bridges.map(b => focusView(resolveAnchor(geo, { kind: 'landmark', id: b.id })))])
    views.forEach(v => expect(v.slice(2)).toEqual([3000, -42, -38]))
  })

  it('进入过程中离开，不留下任何对象，路网恢复显示', async () => {
    await scene.setUnderground(true)
    const entering = scene.enter()
    await scene.leave()
    await entering
    expect(api.store.size).toBe(0)
    expect(roadCalls.length === 0 || roadCalls[roadCalls.length - 1]).toBe(true)
  })

  it('反复进入离开不会累积对象', async () => {
    for (let i = 0; i < 4; i++) {
      await scene.enter()
      await scene.leave()
    }
    await scene.enter()
    const expected = data.pipes.length + 1 + data.substations.length + data.alarms.length * 2 + data.gasStations.length + data.floodPoints.length * 2 + data.pumpStations.length + 6 + data.coolingPlants.length
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

  it('bufferLine：环上的点到折线的距离在缓冲距离和两倍之间，折线在环内', () => {
    const line = [[0, 0], [1000, 0], [1500, 600]]
    const ring = bufferLine(line, 200)
    const distToLine = (p: number[]) => {
      let best = Infinity
      for (let i = 1; i < line.length; i++) {
        const [x0, y0] = line[i - 1]
        const dx = line[i][0] - x0
        const dy = line[i][1] - y0
        const t = Math.min(1, Math.max(0, ((p[0] - x0) * dx + (p[1] - y0) * dy) / (dx * dx + dy * dy)))
        best = Math.min(best, Math.hypot(p[0] - x0 - dx * t, p[1] - y0 - dy * t))
      }
      return best
    }
    ring.forEach(p => {
      expect(distToLine(p)).toBeGreaterThan(199)
      expect(distToLine(p)).toBeLessThan(400)
    })
    for (const p of [[0, 0], [500, 0], [1000, 0], [1250, 300], [1500, 600], [500, 150], [500, -150]]) expect(pointInRing(p, ring)).toBe(true)
    expect(pointInRing([500, 260], ring)).toBe(false)
    expect(bufferLine([[5, 5]], 100)).toHaveLength(16)
  })

  it('两个路口之间的管段不受路口先后顺序影响', () => {
    expect(segmentBetween(geo, 'muroor', 'falah-muroor', 'hazza-muroor')).toEqual(segmentBetween(geo, 'muroor', 'hazza-muroor', 'falah-muroor'))
  })
})
