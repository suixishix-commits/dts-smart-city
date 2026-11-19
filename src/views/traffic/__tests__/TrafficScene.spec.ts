import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildTrafficData, congestionAt, congestionLevel, rankSegmentsAt, vehicleStateAt } from '@/api/mock/traffic'
import type { SceneApi, SceneObjectType } from '@/scene/SceneApi'
import { buildCityGeo, pointAt, type CityGeo } from '@/scene/geo'
import { COLOR, flowLine, focusView, rgba, STATUS_RAMP, type FlowLineOptions } from '@/scene/kit'
import type { GeoData } from '@/types/geo'
import geoJson from '../../../../public/data/smart-city/geo.json'
import { DETOUR_COLOR, INCIDENT_COLOR, SIGNAL_COLOR, TrafficScene, VEHICLE_COLOR, type TrafficSceneOptions } from '../TrafficScene'

// flowLine 的 speed / reverse 等参数目前不体现在返回的对象上，包一层 spy 来检查场景传了什么
vi.mock('@/scene/kit', async importOriginal => {
  const kit = await importOriginal<typeof import('@/scene/kit')>()
  return { ...kit, flowLine: vi.fn(kit.flowLine) }
})

/** 严格的场景替身：重复添加同一个 id、删除不存在的 id 都会抛错 */
class FakeApi implements SceneApi {
  store = new Map<string, any>()
  visible = new Map<string, boolean>()
  addCalls: string[] = []
  cameraCalls: number[][] = []
  focusCalls: string[] = []
  /** 设置后 setCamera() 会等它 resolve，用来停在“正在进入”的状态 */
  cameraGate: Promise<void> | null = null
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
    if (this.cameraGate) await this.cameraGate
    this.cameraCalls.push(view)
  }
  async focus(type: SceneObjectType, id: string) {
    this.focusCalls.push(`${type}:${id}`)
  }
  async project(lonLat: number[][]) {
    return lonLat.map(p => [p[0] * 1e5, p[1] * 1e5, 0])
  }
  ids(type: string) {
    return [...this.store.keys()].filter(k => k.startsWith(type + ':')).sort()
  }
  get(type: string, id: string) {
    return this.store.get(`${type}:${id}`)
  }
}

const raw = geoJson as unknown as GeoData
const data = buildTrafficData(raw)
const HOME = [1, 2, 3, -38, -38]
/** 全部图层打开、总包不可用时的对象数：路段 + OD + 事件(波纹+标注) + 信号(波纹+异常标注) + 车辆(标注+轨迹) */
const abnormal = data.signals.filter(s => s.status !== 'normal')
const V = data.vehicles.length
/** 通勤 OD 只画通勤量最大的 3 条 */
const OD = Math.min(3, data.odFlows.length)
const TOTAL = data.segments.length + OD + data.incidents.length * 2 + data.signals.length + abnormal.length + V * 2

describe('TrafficScene', () => {
  let geo: CityGeo
  let api: FakeApi
  let scene: TrafficScene
  let baseRoads: boolean[]

  const create = (options: Partial<TrafficSceneOptions> = {}, hour = 12) => {
    scene = new TrafficScene(api, geo, { cameraView: null, pak: false, setBaseRoads: async v => void baseRoads.push(v), ...options })
    scene.setData(data, hour)
    return scene
  }

  const segIds = () => api.ids('polyline').filter(k => k.startsWith('polyline:seg-'))
  const odIds = () => api.ids('polyline').filter(k => k.startsWith('polyline:od-'))
  /** 路段中点的投影坐标 */
  const midOf = (s: (typeof data.segments)[number]) => pointAt((geo.road(s.roadId) as NonNullable<ReturnType<CityGeo['road']>>).line, (s.from + s.to) / 2)

  beforeAll(async () => {
    geo = await buildCityGeo(raw, async ll => ll.map(p => [p[0] * 1e5, p[1] * 1e5, 0]))
  })

  beforeEach(() => {
    api = new FakeApi()
    baseRoads = []
    create()
  })

  it('进入后创建五个图层的对象，拥堵只在道路上表达（没有片区面）', async () => {
    await scene.enter()
    // 路段、通勤飞线、车辆轨迹都是折线
    expect(segIds()).toHaveLength(data.segments.length)
    expect(odIds()).toHaveLength(OD)
    expect(api.ids('polyline')).toHaveLength(data.segments.length + OD + V)
    expect(api.ids('odline')).toEqual([])
    expect(api.ids('marker')).toHaveLength(data.incidents.length + abnormal.length + V)
    expect(api.ids('radiationPoint')).toHaveLength(data.incidents.length + geo.intersections.length)
    expect(api.ids('polygon')).toEqual([])
    expect(api.store.size).toBe(TOTAL)
    expect(scene.objectCount()).toBe(TOTAL)
  })

  it('交通流光材质包可用时：路况和通勤 OD 各一个 UE 流光网格，换小时不新建，离开时删除', async () => {
    create({ trafficFlow: true }, 8)
    await scene.enter()
    expect(segIds()).toEqual([])
    expect(odIds()).toEqual([])
    const meshes = () => api.ids('customMesh').filter(k => k.includes('flow'))
    expect(meshes()).toEqual(['customMesh:traffic-od-flow-b', 'customMesh:traffic-road-flow-b'])
    const road = api.get('customMesh', 'traffic-road-flow-b')
    expect(road.material).toContain('RoadFlow')
    // 通勤方向翻转（上午 → 下午）后仍然只有这两个网格
    await scene.setHour(18)
    expect(meshes()).toHaveLength(2)
    await scene.setLayerVisible('od', false)
    await scene.leave()
    expect(meshes()).toEqual([])
  })

  it('进入时隐藏底座路网并设置相机，离开时恢复', async () => {
    create({ cameraView: HOME })
    await scene.enter()
    expect(api.cameraCalls).toEqual([HOME])
    expect(baseRoads).toEqual([false])
    await scene.leave()
    expect(baseRoads).toEqual([false, true])
  })

  it('路段落在所属道路上，按拥堵等级用 STATUS_RAMP 着色', async () => {
    create({}, 18)
    await scene.enter()
    for (const s of data.segments) {
      const line = api.get('polyline', 'seg-' + s.id)
      expect(line.color).toEqual(rgba(STATUS_RAMP[congestionLevel(congestionAt(s, 18))]))
      expect(line.coordinates.length).toBeGreaterThanOrEqual(2)
    }
    // 两个路口之间的路段，两端应当正好在路口上
    const seg = data.segments.find(s => s.roadId === 'hamdan' && s.junctions.includes('hamdan-khaleej')) as (typeof data.segments)[number]
    const [a, b] = ['hamdan-khaleej', 'hamdan-airport'].map(id => geo.intersections.find(i => i.id === id)?.xy as number[])
    const coords = api.get('polyline', 'seg-' + seg.id).coordinates
    expect(Math.hypot(coords[0][0] - a[0], coords[0][1] - a[1])).toBeLessThan(30)
    expect(Math.hypot(coords[coords.length - 1][0] - b[0], coords[coords.length - 1][1] - b[1])).toBeLessThan(30)
    // 晚高峰市中心有拥堵色，主干路比支路宽
    const colors = new Set(data.segments.filter(s => s.downtown).map(s => String(api.get('polyline', 'seg-' + s.id).color)))
    expect([...colors].every(c => c === String(rgba(COLOR.warn)) || c === String(rgba(COLOR.danger)))).toBe(true)
    expect(api.get('polyline', 'seg-khaleej-2').thickness).toBeGreaterThan(api.get('polyline', 'seg-' + seg.id).thickness)
    // 线宽按道路等级：主干 100、次干 64、支路 44
    const WIDTH: Record<number, number> = { 1: 100, 2: 64, 3: 44 }
    for (const s of data.segments) expect(api.get('polyline', 'seg-' + s.id).thickness).toBe(WIDTH[s.level])
  })

  it('夜间全部是畅通色；切换小时后重新着色且不留下重复对象', async () => {
    create({}, 3)
    await scene.enter()
    data.segments.forEach(s => expect(api.get('polyline', 'seg-' + s.id).color).toEqual(rgba(COLOR.ok)))
    await scene.setHour(18)
    expect(segIds()).toHaveLength(data.segments.length)
    expect(api.get('polyline', 'seg-airport-2').color).not.toEqual(rgba(COLOR.ok))
    expect(api.store.size).toBe(TOTAL)
  })

  it('拥堵等级没有变化时不重画路况', async () => {
    create({}, 2)
    // 车辆位置每个小时都变，这里只看路况
    await scene.setLayerVisible('vehicle', false)
    await scene.enter()
    const before = api.addCalls.length
    await scene.setHour(2.5)
    await scene.setHour(3)
    expect(api.addCalls.length).toBe(before)
  })

  it('OD 飞线只画最重的 3 条，上午从居住区指向商务区，下午反向；最重的两条是暖色', async () => {
    create({}, 8)
    await scene.enter()
    const top = data.odFlows[0]
    const home = geo.district(top.homeId)?.centerXY as number[]
    const work = geo.district(top.workId)?.centerXY as number[]
    const id = 'od-' + top.id
    // 飞线是折线：首点是起点，末点是终点，中间抬高
    const ends = () => {
      const c = api.get('polyline', id).coordinates as number[][]
      expect(c.length).toBeGreaterThan(2)
      expect(Math.max(...c.map(p => p[2]))).toBeGreaterThan(c[0][2])
      return [c[0].slice(0, 2), c[c.length - 1].slice(0, 2)]
    }
    expect(api.get('polyline', id).groupId).toBe('sc_traffic_od')
    expect(ends()).toEqual([home, work])
    const warm = odIds().filter(k => String(api.store.get(k).color) === String(rgba(COLOR.warn)))
    expect(warm.sort()).toEqual(data.odFlows.slice(0, 2).map(f => 'polyline:od-' + f.id).sort())
    odIds().filter(k => !warm.includes(k)).forEach(k => expect(api.store.get(k).color).toEqual(rgba(COLOR.accentLight)))

    await scene.setHour(18)
    expect(ends()).toEqual([work, home])
    expect(odIds()).toHaveLength(OD)
    expect(api.ids('odline')).toEqual([])
  })

  it('交通事件是路口上的波纹 + 可点击标注', async () => {
    await scene.enter()
    for (const i of data.incidents) {
      const xy = geo.intersections.find(x => x.id === i.intersectionId)?.xy as number[]
      const m = api.get('marker', 'incident-' + i.id)
      expect(m.groupId).toBe('sc_traffic_incident')
      expect(JSON.parse(m.userData)).toEqual({ id: i.id })
      expect(m.coordinate.slice(0, 2)).toEqual(xy)
      expect(m.text).toContain(i.title)
      expect(m.lineColor).toEqual(rgba(INCIDENT_COLOR[i.type], 0.95))
      const r = api.get('radiationPoint', 'incident-ripple-' + i.id)
      expect(r.coordinate.slice(0, 2)).toEqual(xy)
      expect(r.radius).toBeGreaterThanOrEqual(250)
      expect(r.radius).toBeLessThanOrEqual(800)
    }
  })

  it('信号路口：36 个波纹按状态着色，只有异常的带标注', async () => {
    await scene.enter()
    for (const s of data.signals) {
      expect(api.get('radiationPoint', 'signal-' + s.id).color).toEqual(rgba(SIGNAL_COLOR[s.status], 0.9))
      expect(!!api.get('marker', 'signal-pin-' + s.id)).toBe(s.status !== 'normal')
    }
    const pinned = api.get('marker', 'signal-pin-' + abnormal[0].id)
    expect(pinned.groupId).toBe('sc_traffic_signal')
    expect(JSON.parse(pinned.userData)).toEqual({ id: abnormal[0].id })
  })

  it('进入前关掉的图层不创建对象，打开后才创建', async () => {
    await scene.setLayerVisible('signal', false)
    await scene.enter()
    expect(api.ids('marker')).toHaveLength(data.incidents.length + V)
    expect(api.ids('radiationPoint')).toHaveLength(data.incidents.length)
    // 隐藏期间换了小时，打开时用的是最新的小时
    await scene.setHour(18)
    await scene.setLayerVisible('signal', true)
    expect(api.ids('radiationPoint')).toHaveLength(data.incidents.length + geo.intersections.length)
    expect(api.store.size).toBe(TOTAL)
  })

  it('图层开关：交通事件同时控制波纹和标注，不影响其它图层', async () => {
    await scene.enter()
    await scene.setLayerVisible('incident', false)
    const id = data.incidents[0].id
    expect(api.visible.get('marker:incident-' + id)).toBe(false)
    expect(api.visible.get('radiationPoint:incident-ripple-' + id)).toBe(false)
    expect(api.visible.get('radiationPoint:signal-' + data.signals[0].id)).toBe(true)
    expect(api.visible.get('polyline:seg-' + data.segments[0].id)).toBe(true)
    await scene.setLayerVisible('road', false)
    expect(api.visible.get('polyline:seg-' + data.segments[0].id)).toBe(false)
    // 路况和通勤飞线都是折线，但各自受自己的图层开关控制
    expect(api.visible.get('polyline:od-' + data.odFlows[0].id)).toBe(true)
    await scene.setLayerVisible('od', false)
    expect(api.visible.get('polyline:od-' + data.odFlows[0].id)).toBe(false)
    await scene.setLayerVisible('road', true)
    expect(api.visible.get('polyline:seg-' + data.segments[0].id)).toBe(true)
    expect(api.visible.get('polyline:od-' + data.odFlows[0].id)).toBe(false)
  })

  it('定位：不论图层开关都用统一的俯瞰机位移动相机，不聚焦对象', async () => {
    await scene.enter()
    const incident = data.incidents[0]
    const xy = (id: string) => geo.intersections.find(x => x.id === id)?.xy as number[]
    const segment = (id: string) => data.segments.find(x => x.id === id) as (typeof data.segments)[number]
    const height = (km: number) => Math.min(5200, Math.max(3000, km * 1500))
    const seg = segment('airport-2')
    const expected = [focusView(xy(incident.intersectionId)), focusView(xy(abnormal[0].id), 2600), focusView(midOf(seg), height(seg.lengthKm))]

    await scene.focusIncident(incident.id)
    await scene.focusSignal(abnormal[0].id)
    await scene.focusSegment('airport-2')
    expect(api.cameraCalls).toEqual(expected)
    expect(api.cameraCalls[0][0]).toBeLessThan(xy(incident.intersectionId)[0])
    expect(api.cameraCalls[0].slice(2)).toEqual([1700, -42, 60])
    expect(api.cameraCalls[1][2]).toBe(2600)

    // 路段越长相机越高，限制在 3000–5200 米
    const byLength = [...data.segments].sort((a, b) => a.lengthKm - b.lengthKm)
    for (const s of [byLength[0], byLength[byLength.length - 1]]) {
      api.cameraCalls = []
      await scene.focusSegment(s.id)
      expect(api.cameraCalls).toEqual([focusView(midOf(s), height(s.lengthKm))])
      expect(api.cameraCalls[0][2]).toBeGreaterThanOrEqual(3000)
      expect(api.cameraCalls[0][2]).toBeLessThanOrEqual(5200)
    }

    // 图层关着时机位相同
    api.cameraCalls = []
    await scene.setLayerVisible('incident', false)
    await scene.setLayerVisible('signal', false)
    await scene.setLayerVisible('road', false)
    await scene.focusIncident(incident.id)
    await scene.focusSignal(abnormal[0].id)
    await scene.focusSegment('airport-2')
    expect(api.cameraCalls).toEqual(expected)

    // 不存在的 id 什么都不做
    await scene.focusIncident('不存在')
    await scene.focusSignal('不存在')
    await scene.focusSegment('不存在')
    expect(api.cameraCalls).toHaveLength(3)
    expect(api.focusCalls).toEqual([])
  })

  it('巡航机位：所选时刻最堵的 5 个路段，每条道路只取一段', async () => {
    create({}, 18)
    await scene.enter()
    const views = scene.tourViews()
    expect(views).toHaveLength(5)
    views.forEach(v => expect(v.slice(2)).toEqual([1700, -42, 60]))
    expect(new Set(views.map(String)).size).toBe(5)
    // 依次是最堵的路段（跳过已经取过的道路），机位是路段中点的统一俯瞰机位
    const seen = new Set<string>()
    const stops = rankSegmentsAt(data.segments, 18, Infinity)
      .map(r => r.segment)
      .filter(s => !seen.has(s.roadId) && !!seen.add(s.roadId))
      .slice(0, 5)
    expect(stops[0].id).toBe(rankSegmentsAt(data.segments, 18, 1)[0].segment.id)
    expect(views).toEqual(stops.map(s => focusView(midOf(s))))
  })

  it('离开后清干净；反复进出对象数不增长', async () => {
    await scene.enter()
    await scene.leave()
    expect(api.store.size).toBe(0)
    expect(scene.objectCount()).toBe(0)
    for (let i = 0; i < 4; i++) {
      await scene.enter()
      await scene.setHour(6 + i * 4)
      await scene.leave()
    }
    await scene.enter()
    expect(api.store.size).toBe(TOTAL)
    expect(scene.objectCount()).toBe(TOTAL)
  })

  it('进入过程中只记录小时，进入完成后应用最新值', async () => {
    create({ cameraView: HOME }, 3)
    let open!: () => void
    api.cameraGate = new Promise<void>(resolve => (open = resolve))
    const entering = scene.enter()
    await scene.setHour(8)
    await scene.setHour(18)
    expect(api.ids('polyline')).toEqual([])
    open()
    await entering
    const s = data.segments.find(x => x.id === 'airport-2') as (typeof data.segments)[number]
    expect(api.get('polyline', 'seg-airport-2').color).toEqual(rgba(STATUS_RAMP[congestionLevel(congestionAt(s, 18))]))
    expect(api.store.size).toBe(TOTAL)
  })

  it('进入过程中离开：不再隐藏底座路网，也不留下对象', async () => {
    create({ cameraView: HOME })
    let open!: () => void
    api.cameraGate = new Promise<void>(resolve => (open = resolve))
    const entering = scene.enter()
    const leaving = scene.leave()
    open()
    await Promise.all([entering, leaving])
    expect(baseRoads).toEqual([true])
    expect(api.store.size).toBe(0)
  })

  it('没有数据时进入不创建任何对象', async () => {
    scene = new TrafficScene(api, geo, { cameraView: HOME, pak: false })
    await scene.enter()
    expect(api.store.size).toBe(0)
    expect(scene.tourViews()).toEqual([])
    await scene.leave()
  })

  describe('车辆轨迹', () => {
    const roadOf = (id: string) => geo.road(id) as NonNullable<ReturnType<CityGeo['road']>>
    const posOf = (v: (typeof data.vehicles)[number], h: number) => pointAt(roadOf(v.roadId).line, vehicleStateAt(v, data.segments, h).ratio)

    it('每辆车一个可点击标注 + 一段轨迹线，落在所走道路上，轨迹终点就是车辆当前位置', async () => {
      await scene.enter()
      expect(api.ids('marker').filter(k => k.startsWith('marker:vehicle-'))).toHaveLength(V)
      for (const v of data.vehicles) {
        const m = api.get('marker', 'vehicle-' + v.id)
        expect(m.groupId).toBe('sc_traffic_vehicle')
        expect(JSON.parse(m.userData)).toEqual({ id: v.id })
        expect(m.lineColor).toEqual(rgba(VEHICLE_COLOR[v.kind], 0.95))
        expect(m.text).toContain(v.name)
        // 车辆标注不常显，不占事件标注的常显名额
        expect(m.priority).toBeLessThan(10)
        const at = posOf(v, 12)
        expect(m.coordinate.slice(0, 2)).toEqual(at)
        const trail = api.get('polyline', 'vehicle-trail-' + v.id)
        expect(trail.groupId).toBe('sc_traffic_vehicle_trail')
        expect(trail.color).toEqual(rgba(VEHICLE_COLOR[v.kind]))
        const last = trail.coordinates[trail.coordinates.length - 1]
        expect(Math.hypot(last[0] - at[0], last[1] - at[1])).toBeLessThan(1)
      }
    })

    it('位置随时间轴的小时推进，替换后不留下重复对象', async () => {
      await scene.enter()
      const v = data.vehicles[0]
      const before = api.get('marker', 'vehicle-' + v.id).coordinate.slice(0, 2)
      await scene.setHour(15)
      const after = api.get('marker', 'vehicle-' + v.id).coordinate.slice(0, 2)
      expect(after).toEqual(posOf(v, 15))
      expect(after).not.toEqual(before)
      expect(api.store.size).toBe(TOTAL)
    })

    it('图层开关同时控制标注和轨迹线；默认关闭时不创建，打开后用最新小时创建', async () => {
      await scene.setLayerVisible('vehicle', false)
      await scene.enter()
      expect(api.ids('marker').filter(k => k.startsWith('marker:vehicle-'))).toEqual([])
      expect(api.ids('polyline').filter(k => k.startsWith('polyline:vehicle-trail-'))).toEqual([])
      await scene.setHour(9)
      await scene.setLayerVisible('vehicle', true)
      const v = data.vehicles[1]
      expect(api.get('marker', 'vehicle-' + v.id).coordinate.slice(0, 2)).toEqual(posOf(v, 9))
      expect(api.ids('polyline').filter(k => k.startsWith('polyline:vehicle-trail-'))).toHaveLength(V)
      await scene.setLayerVisible('vehicle', false)
      expect(api.visible.get('marker:vehicle-' + v.id)).toBe(false)
      expect(api.visible.get('polyline:vehicle-trail-' + v.id)).toBe(false)
      expect(api.visible.get('polyline:seg-' + data.segments[0].id)).toBe(true)
    })

    it('定位车辆：1700 米俯瞰所选小时的位置；摄像头定位 2400 米', async () => {
      await scene.enter()
      const v = data.vehicles[2]
      await scene.focusVehicle(v.id)
      await scene.setHour(20)
      await scene.focusVehicle(v.id)
      await scene.focusCamera('zayed1-airport')
      await scene.focusVehicle('不存在')
      await scene.focusCamera('不存在')
      const xy = geo.intersections.find(x => x.id === 'zayed1-airport')?.xy as number[]
      expect(api.cameraCalls).toEqual([focusView(posOf(v, 12)), focusView(posOf(v, 20)), focusView(xy, 2400)])
    })
  })

  describe('绕行方案', () => {
    const incident = data.incidents.find(i => i.detour) as (typeof data.incidents)[number]
    const other = data.incidents.find(i => i.detour && i.id !== incident.id) as (typeof data.incidents)[number]
    const detourIds = () => [...api.ids('polyline'), ...api.ids('marker')].filter(k => k.includes(':detour-')).sort()

    it('沿真实道路画出绕行线和起终点标注，起点、终点在被绕开路段两端的路口上，并调整相机', async () => {
      await scene.enter()
      api.cameraCalls = []
      expect(await scene.showDetour(incident.id)).toBe(true)
      expect(scene.activeDetour).toBe(incident.id)
      const line = api.get('polyline', 'detour-' + incident.id)
      expect(line.groupId).toBe('sc_traffic_detour')
      expect(line.color).toEqual(rgba(DETOUR_COLOR))
      expect(line.coordinates.length).toBeGreaterThan(3)
      const plan = incident.detour as NonNullable<typeof incident.detour>
      const xyOf = (name: string) => geo.intersections.find(x => x.name === name)?.xy as number[]
      const near = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1])
      expect(near(line.coordinates[0], xyOf(plan.fromName))).toBeLessThan(60)
      expect(near(line.coordinates[line.coordinates.length - 1], xyOf(plan.toName))).toBeLessThan(60)
      // 不经过事件路口
      const blocked = geo.intersections.find(x => x.id === incident.intersectionId)?.xy as number[]
      line.coordinates.forEach((p: number[]) => expect(near(p, blocked)).toBeGreaterThan(200))
      expect(api.get('marker', 'detour-from-' + incident.id).text).toContain(plan.fromName)
      expect(api.get('marker', 'detour-to-' + incident.id).text).toContain(plan.toName)
      expect(api.cameraCalls).toHaveLength(1)
      expect(api.cameraCalls[0][2]).toBeGreaterThanOrEqual(3600)
      expect(api.cameraCalls[0][2]).toBeLessThanOrEqual(6000)
    })

    it('换一个事件时替换旧路线；清除后删干净；没有方案或未进入时不画', async () => {
      expect(await scene.showDetour(incident.id)).toBe(false)
      await scene.enter()
      await scene.showDetour(incident.id)
      await scene.showDetour(other.id)
      expect(detourIds()).toEqual(['marker:detour-from-' + other.id, 'marker:detour-to-' + other.id, 'polyline:detour-' + other.id])
      await scene.clearDetour()
      expect(detourIds()).toEqual([])
      expect(scene.activeDetour).toBeNull()
      expect(api.store.size).toBe(TOTAL)
      const none = data.incidents.find(i => !i.detour)
      if (none) expect(await scene.showDetour(none.id)).toBe(false)
      expect(await scene.showDetour('不存在')).toBe(false)
      expect(detourIds()).toEqual([])
    })

    it('离开时绕行路线一并删除，再次进入不会重画', async () => {
      await scene.enter()
      await scene.showDetour(incident.id)
      await scene.leave()
      expect(api.store.size).toBe(0)
      expect(scene.activeDetour).toBeNull()
      await scene.enter()
      expect(detourIds()).toEqual([])
      expect(api.store.size).toBe(TOTAL)
    })
  })

  describe('效果总包可用时', () => {
    /** 某个路段最近一次传给 flowLine 的参数 */
    const optionsOf = (id: string) => vi.mocked(flowLine).mock.calls.map(c => c[0]).findLast(o => o.id === 'seg-' + id) as FlowLineOptions

    beforeEach(() => {
      vi.mocked(flowLine).mockClear()
      create({ pak: true }, 18)
    })

    it('路况用 flowLine：主干路是追逐箭头，其余是粒子流，颜色同拥堵等级', async () => {
      await scene.enter()
      expect(vi.mocked(flowLine).mock.calls.filter(c => c[0].id.startsWith('seg-'))).toHaveLength(data.segments.length)
      for (const s of data.segments) {
        const o = optionsOf(s.id)
        expect(o.style).toBe(s.level === 1 ? 'arrow' : 'particles')
        expect(o.color).toBe(STATUS_RAMP[congestionLevel(congestionAt(s, 18))])
        expect(api.get('polyline', 'seg-' + s.id).color).toEqual(rgba(o.color))
      }
      // 线宽按道路等级：主干 100、次干 64、支路 44
      const WIDTH: Record<number, number> = { 1: 100, 2: 64, 3: 44 }
      for (const s of data.segments) expect(optionsOf(s.id).width).toBe(WIDTH[s.level])
      expect(optionsOf('khaleej-2').width).toBeGreaterThan(optionsOf('hamdan-2').width)
    })

    it('越堵流得越慢', async () => {
      await scene.enter()
      const speeds = [0, 1, 2, 3].flatMap(level => {
        const s = data.segments.find(x => congestionLevel(congestionAt(x, 18)) === level)
        return s ? [optionsOf(s.id).speed as number] : []
      })
      expect(speeds.length).toBeGreaterThanOrEqual(3)
      speeds.forEach((v, i) => i > 0 && expect(v).toBeLessThan(speeds[i - 1]))
    })

    it('纵向道路的流向跟着通勤方向：上午朝西北，下午朝东南；横街不变', async () => {
      await scene.enter()
      expect(optionsOf('khaleej-13').reverse).toBe(false)
      await scene.setHour(8)
      expect(optionsOf('khaleej-13').reverse).toBe(true)
      expect(optionsOf('hamdan-2').reverse).toBe(false)
      expect(segIds()).toHaveLength(data.segments.length)
    })
  })
})
