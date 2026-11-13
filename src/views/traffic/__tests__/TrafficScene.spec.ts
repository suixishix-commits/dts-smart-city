import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildTrafficData, congestionAt, congestionLevel, rankSegmentsAt } from '@/api/mock/traffic'
import type { SceneApi, SceneObjectType } from '@/scene/SceneApi'
import { buildCityGeo, type CityGeo } from '@/scene/geo'
import { COLOR, flowLine, rgba, STATUS_RAMP, type FlowLineOptions } from '@/scene/kit'
import type { GeoData } from '@/types/geo'
import geoJson from '../../../../public/data/smart-city/geo.json'
import { INCIDENT_COLOR, SIGNAL_COLOR, TrafficScene, type TrafficSceneOptions } from '../TrafficScene'

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
/** 全部图层打开、总包不可用时的对象数：路段 + OD + 事件(波纹+标注) + 信号(波纹+异常标注) + 片区 */
const abnormal = data.signals.filter(s => s.status !== 'normal')
const TOTAL = data.segments.length + data.odFlows.length + data.incidents.length * 2 + data.signals.length + abnormal.length + raw.districts.length

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

  beforeAll(async () => {
    geo = await buildCityGeo(raw, async ll => ll.map(p => [p[0] * 1e5, p[1] * 1e5, 0]))
  })

  beforeEach(() => {
    api = new FakeApi()
    baseRoads = []
    create()
  })

  it('进入后创建五个图层的对象', async () => {
    await scene.enter()
    expect(api.ids('polyline')).toHaveLength(data.segments.length)
    expect(api.ids('polyline').every(k => k.startsWith('polyline:seg-'))).toBe(true)
    expect(api.ids('odline')).toHaveLength(8)
    expect(api.ids('marker')).toHaveLength(data.incidents.length + abnormal.length)
    expect(api.ids('radiationPoint')).toHaveLength(data.incidents.length + 36)
    expect(api.ids('polygon')).toHaveLength(16)
    expect(api.store.size).toBe(TOTAL)
    expect(scene.objectCount()).toBe(TOTAL)
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
    // 横街是两点直线：路段两端应当正好在路口上
    const seg = data.segments.find(s => s.id === 'hamdan-2') as (typeof data.segments)[number]
    const [a, b] = ['hamdan-khaleej', 'hamdan-airport'].map(id => geo.intersections.find(i => i.id === id)?.xy as number[])
    const coords = api.get('polyline', 'seg-' + seg.id).coordinates
    expect(Math.hypot(coords[0][0] - a[0], coords[0][1] - a[1])).toBeLessThan(30)
    expect(Math.hypot(coords[coords.length - 1][0] - b[0], coords[coords.length - 1][1] - b[1])).toBeLessThan(30)
    // 晚高峰市中心有拥堵色，主干路比支路宽
    const colors = new Set(data.segments.filter(s => s.downtown).map(s => String(api.get('polyline', 'seg-' + s.id).color)))
    expect([...colors].every(c => c === String(rgba(COLOR.warn)) || c === String(rgba(COLOR.danger)))).toBe(true)
    expect(api.get('polyline', 'seg-khaleej-2').thickness).toBeGreaterThan(api.get('polyline', 'seg-hamdan-2').thickness)
  })

  it('夜间全部是畅通色；切换小时后重新着色且不留下重复对象', async () => {
    create({}, 3)
    await scene.enter()
    data.segments.forEach(s => expect(api.get('polyline', 'seg-' + s.id).color).toEqual(rgba(COLOR.ok)))
    await scene.setHour(18)
    expect(api.ids('polyline')).toHaveLength(data.segments.length)
    expect(api.get('polyline', 'seg-airport-2').color).not.toEqual(rgba(COLOR.ok))
    expect(api.store.size).toBe(TOTAL)
  })

  it('拥堵等级没有变化时不重画路况', async () => {
    create({}, 2)
    await scene.enter()
    const before = api.addCalls.length
    await scene.setHour(2.5)
    await scene.setHour(3)
    expect(api.addCalls.length).toBe(before)
  })

  it('OD 飞线上午从居住区指向商务区，下午反向；只有最重的两条是暖色', async () => {
    create({}, 8)
    await scene.enter()
    const top = data.odFlows[0]
    const home = geo.district(top.homeId)?.centerXY as number[]
    const work = geo.district(top.workId)?.centerXY as number[]
    const id = 'od-' + top.id
    expect(api.get('odline', id).coordinates[0].slice(0, 2)).toEqual(home)
    expect(api.get('odline', id).coordinates[1].slice(0, 2)).toEqual(work)
    const warm = api.ids('odline').filter(k => String(api.store.get(k).color) === String(rgba(COLOR.warn)))
    expect(warm.sort()).toEqual(data.odFlows.slice(0, 2).map(f => 'odline:od-' + f.id).sort())
    api.ids('odline').filter(k => !warm.includes(k)).forEach(k => expect(api.store.get(k).color).toEqual(rgba(COLOR.accentLight)))

    await scene.setHour(18)
    expect(api.get('odline', id).coordinates[0].slice(0, 2)).toEqual(work)
    expect(api.get('odline', id).coordinates[1].slice(0, 2)).toEqual(home)
    expect(api.ids('odline')).toHaveLength(8)
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

  it('片区按平均拥堵着色：晚高峰市中心转暖，夜间全是最低一档', async () => {
    create({}, 18)
    await scene.enter()
    const fill = (id: string) => String(api.get('polygon', 'district-' + id).color.slice(0, 3))
    expect(fill('markaziyah')).not.toBe(fill('rasakhdar'))
    await scene.setHour(3)
    expect(new Set(raw.districts.map(d => fill(d.id))).size).toBe(1)
    expect(api.ids('polygon')).toHaveLength(16)
  })

  it('进入前关掉的图层不创建对象，打开后才创建', async () => {
    await scene.setLayerVisible('signal', false)
    await scene.setLayerVisible('district', false)
    await scene.enter()
    expect(api.ids('polygon')).toEqual([])
    expect(api.ids('marker')).toHaveLength(data.incidents.length)
    expect(api.ids('radiationPoint')).toHaveLength(data.incidents.length)
    // 隐藏期间换了小时，打开时用的是最新的小时
    await scene.setHour(18)
    await scene.setLayerVisible('district', true)
    await scene.setLayerVisible('signal', true)
    expect(api.ids('polygon')).toHaveLength(16)
    expect(api.ids('radiationPoint')).toHaveLength(data.incidents.length + 36)
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
    await scene.setLayerVisible('od', false)
    expect(api.visible.get('odline:od-' + data.odFlows[0].id)).toBe(false)
  })

  it('定位：图层开着时聚焦对象，关着时直接移动相机', async () => {
    await scene.enter()
    const incident = data.incidents[0]
    await scene.focusIncident(incident.id)
    await scene.focusSignal(abnormal[0].id)
    await scene.focusSegment('airport-2')
    expect(api.focusCalls).toEqual(['marker:incident-' + incident.id, 'radiationPoint:signal-' + abnormal[0].id, 'polyline:seg-airport-2'])

    api.focusCalls = []
    await scene.setLayerVisible('incident', false)
    await scene.focusIncident(incident.id)
    expect(api.focusCalls).toEqual([])
    expect(api.cameraCalls).toHaveLength(1)
    const xy = geo.intersections.find(x => x.id === incident.intersectionId)?.xy as number[]
    expect(api.cameraCalls[0][0]).toBeLessThan(xy[0])
    expect(api.cameraCalls[0].slice(3)).toEqual([-38, -38])
    await scene.focusIncident('不存在')
    expect(api.cameraCalls).toHaveLength(1)
  })

  it('巡航机位：所选时刻最堵的 5 个路段，每条道路只取一段', async () => {
    create({}, 18)
    await scene.enter()
    const views = scene.tourViews()
    expect(views).toHaveLength(5)
    views.forEach(v => expect(v).toHaveLength(5))
    expect(new Set(views.map(String)).size).toBe(5)
    // 第一站是全网最堵的路段
    const worst = rankSegmentsAt(data.segments, 18, 1)[0].segment
    const line = api.get('polyline', 'seg-' + worst.id).coordinates
    const near = line.some((p: number[]) => Math.hypot(p[0] - (views[0][0] + 1500), p[1] - (views[0][1] + 1900)) < worst.lengthKm * 1000)
    expect(near).toBe(true)
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

  describe('效果总包可用时', () => {
    const w = window as any
    const g = globalThis as any
    // 点阵流光适配库的替身，只记录调用。loadLib 会缓存库对象，所以整个分组共用一个
    const lib = {
      PRESETS: { hatch: { dotSpacingM: 10, dotSizeM: 2 } },
      DEFAULT_STYLE: {},
      calls: [] as string[],
      async create(_: unknown, o: { regions: unknown[] }) {
        lib.calls.push('create:' + o.regions.length)
      },
      async remove() {
        lib.calls.push('remove')
      },
      async setColors() {
        lib.calls.push('setColors')
        return true
      }
    }
    /** 某个路段最近一次传给 flowLine 的参数 */
    const optionsOf = (id: string) => vi.mocked(flowLine).mock.calls.map(c => c[0]).findLast(o => o.id === 'seg-' + id) as FlowLineOptions

    beforeEach(() => {
      lib.calls.length = 0
      w.RegionDotFlow = lib
      g.__xapi = { customObject: { showByGroupId: async () => lib.calls.push('show'), hideByGroupId: async () => lib.calls.push('hide') } }
      vi.mocked(flowLine).mockClear()
      create({ pak: true }, 18)
    })

    afterEach(() => {
      delete g.__xapi
    })

    it('路况用 flowLine：主干路是追逐箭头，其余是粒子流，颜色同拥堵等级', async () => {
      await scene.enter()
      expect(vi.mocked(flowLine)).toHaveBeenCalledTimes(data.segments.length)
      for (const s of data.segments) {
        const o = optionsOf(s.id)
        expect(o.style).toBe(s.level === 1 ? 'arrow' : 'particles')
        expect(o.color).toBe(STATUS_RAMP[congestionLevel(congestionAt(s, 18))])
        expect(api.get('polyline', 'seg-' + s.id).color).toEqual(rgba(o.color))
      }
      expect(optionsOf('khaleej-2').width).toBeGreaterThanOrEqual(60)
      expect(optionsOf('hamdan-2').width).toBeGreaterThanOrEqual(30)
      expect(optionsOf('hamdan-2').width).toBeLessThanOrEqual(50)
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
      expect(api.ids('polyline')).toHaveLength(data.segments.length)
    })

    it('片区用点阵流光，换小时只换色，离开时删除', async () => {
      await scene.enter()
      expect(api.ids('polygon')).toEqual([])
      expect(lib.calls).toEqual(['create:16'])
      await scene.setHour(3)
      expect(lib.calls).toEqual(['create:16', 'setColors'])
      await scene.setLayerVisible('district', false)
      await scene.leave()
      expect(lib.calls).toEqual(['create:16', 'setColors', 'hide', 'remove'])
      expect(api.store.size).toBe(0)
    })

    it('片区图层默认关闭时，效果创建后立刻隐藏', async () => {
      await scene.setLayerVisible('district', false)
      await scene.enter()
      expect(lib.calls).toEqual(['create:16', 'hide'])
    })
  })
})
