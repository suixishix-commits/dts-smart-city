import { commuteAt, congestionAt, congestionLevel, districtCongestionAt, INCIDENT_TEXT, rankSegmentsAt } from '@/api/mock/traffic'
import { ModuleScene } from '@/scene/ModuleScene'
import type { SceneApi } from '@/scene/SceneApi'
import { pointAt, sliceLine, type CityGeo } from '@/scene/geo'
import { arc, area, COLOR, flowLine, LEVEL_COLOR, pin, plainLine, prepareFlowLines, rampColor, regionLayer, ripple, STATUS_RAMP } from '@/scene/kit'
import type { IncidentType, RoadSegment, SignalStatus, TrafficData } from '@/types/traffic'

export interface TrafficSceneOptions {
  /** [x, y, z, pitch, yaw]；为 null 时不动相机 */
  cameraView: number[] | null
  /** 效果总包是否可用；不可用时路况退回普通发光线、片区退回普通面 */
  pak: boolean
  /** 显示/隐藏底座路网（cityBase.setRoadsVisible）。本模块自己画路况，进入时隐藏、离开时恢复 */
  setBaseRoads?: (visible: boolean) => Promise<void>
}

/** 事件类型的颜色：事故最醒目，施工和管制是提示色，故障用冷色 */
export const INCIDENT_COLOR: Record<IncidentType, string> = {
  accident: COLOR.warn,
  construction: COLOR.caution,
  control: COLOR.caution,
  breakdown: LEVEL_COLOR[4]
}
/** 信号路口状态的颜色：正常是冷色，离线和手动控制才用暖色 */
export const SIGNAL_COLOR: Record<SignalStatus, string> = { normal: COLOR.accent, offline: COLOR.danger, manual: COLOR.warn }
export const SIGNAL_TEXT: Record<SignalStatus, string> = { normal: '正常', offline: '离线', manual: '手动控制' }

/** 片区平均拥堵指数 → 色带颜色。指数 2.0（拥堵）以上才转暖 */
export function districtColor(index: number): string {
  return rampColor((index - 1) / 1.5)
}

/** 各拥堵等级的流速：越堵越慢 */
const FLOW_SPEED = [0.34, 0.22, 0.13, 0.07]
/** 各等级道路的线宽，米 */
const ROAD_WIDTH: Record<number, number> = { 1: 70, 2: 44, 3: 32 }
const DISTRICT_LAYER_ID = 'sc_traffic_districts'
/** 巡航经过的拥堵路段数 */
const TOUR_STOPS = 5

/** 从西南方向俯瞰某点的机位；k 越小越近 */
function viewOf(p: number[], k = 1): number[] {
  return [p[0] - 1500 * k, p[1] - 1900 * k, 2200 * k, -38, -38]
}

/**
 * 智慧交通的场景图层：
 * - road     实时路况：每条路在路口处切成路段，按所选时刻的拥堵等级着色，越堵流得越慢；
 * - od       通勤 OD：片区中心之间的飞线，上午进城、下午出城；
 * - incident 交通事件：扩散波纹 + 标注，可点击；
 * - signal   信号路口：全部路口的小波纹，异常的加标注（默认关闭）；
 * - district 片区拥堵：按片区平均拥堵指数着色（默认关闭）。
 */
export class TrafficScene extends ModuleScene {
  private data: TrafficData | null = null
  private hour = 12
  /** onEnter 已经创建完图层。在此之前 setHour 只记录小时 */
  private entered = false
  private districts: Awaited<ReturnType<typeof regionLayer>> | null = null
  /** 路段 id → 投影坐标折线 */
  private paths = new Map<string, number[][]>()
  private xy = new Map<string, number[]>()
  private layerOn = new Map<string, boolean>()
  /** 上一次画出的内容的签名；没变就不重画，拖动时间轴时省掉大部分指令 */
  private drawn: { road: string | null; od: string | null; district: string | null } = { road: null, od: null, district: null }

  constructor(
    api: SceneApi,
    private readonly geo: CityGeo,
    private readonly options: TrafficSceneOptions
  ) {
    super(api)
  }

  /** 进入前设置数据和初始小时 */
  setData(data: TrafficData, hour: number) {
    this.data = data
    this.hour = hour
  }

  protected async onEnter(token: number): Promise<void> {
    this.entered = false
    this.drawn = { road: null, od: null, district: null }
    const data = this.data
    if (!data) return
    const geo = this.geo

    this.paths.clear()
    for (const s of data.segments) {
      const road = geo.road(s.roadId)
      if (road) this.paths.set(s.id, sliceLine(road.line, s.from, s.to))
    }
    // 事件和信号都在路口上，坐标直接取投影好的路口
    this.xy = new Map(geo.intersections.map(i => [i.id, i.xy]))

    if (this.options.cameraView) await this.api.setCamera(this.options.cameraView)
    // 等相机期间可能已经离开：离开时会恢复底座路网，这里不能再把它藏掉
    if (!this.isCurrent(token)) return
    await this.options.setBaseRoads?.(false)
    if (this.options.pak) await prepareFlowLines()

    const incidents = data.incidents.filter(i => this.xy.has(i.intersectionId))
    await this.add(
      token,
      'radiationPoint',
      incidents.map(i => ripple({ id: 'incident-ripple-' + i.id, groupId: 'sc_traffic_incident_ripple', at: this.xy.get(i.intersectionId) as number[], radius: Math.min(800, 300 + i.queue * 0.5), color: INCIDENT_COLOR[i.type] })),
      'incident'
    )
    await this.add(
      token,
      'marker',
      incidents.map(i =>
        pin({ id: 'incident-' + i.id, groupId: 'sc_traffic_incident', at: this.xy.get(i.intersectionId) as number[], text: `${INCIDENT_TEXT[i.type]} · ${i.title}`, color: INCIDENT_COLOR[i.type], userId: i.id, lineHeight: 56, priority: 10 })
      ),
      'incident'
    )

    const signals = data.signals.filter(s => this.xy.has(s.id))
    await this.add(
      token,
      'radiationPoint',
      signals.map(s => ripple({ id: 'signal-' + s.id, groupId: 'sc_traffic_signal_ripple', at: this.xy.get(s.id) as number[], radius: s.status === 'normal' ? 250 : 320, rings: 2, color: SIGNAL_COLOR[s.status], brightness: s.status === 'normal' ? 0.5 : 0.9 })),
      'signal'
    )
    // 36 个路口都加标注会超过一屏 30 个的上限，只标异常的
    await this.add(
      token,
      'marker',
      signals
        .filter(s => s.status !== 'normal')
        .map(s => pin({ id: 'signal-pin-' + s.id, groupId: 'sc_traffic_signal', at: this.xy.get(s.id) as number[], text: '信号' + SIGNAL_TEXT[s.status], color: SIGNAL_COLOR[s.status], userId: s.id, lineHeight: 28, fontSize: 11 })),
      'signal'
    )

    if (this.options.pak) {
      const colors = this.districtColors(data)
      await this.effect(token, 'district', async () => {
        this.districts = await regionLayer(
          DISTRICT_LAYER_ID,
          geo.districts.map(d => ({ id: d.id, color: colors[d.id], ring: d.ring })),
          { pattern: 'hatch', scale: 3, fill: 0.1 }
        )
        return this.districts
      })
    }

    if (!this.isCurrent(token)) return
    // 随时间变化的图层最后创建，用进入期间记录的最新小时；此后 setHour 直接替换
    this.entered = true
    await this.applyHour(data)
  }

  protected async onLeave(): Promise<void> {
    this.entered = false
    this.districts = null
    this.drawn = { road: null, od: null, district: null }
    await this.options.setBaseRoads?.(true)
  }

  /** 切换到某个小时。进入完成前只记录小时，由 onEnter 应用最新值 */
  async setHour(hour: number): Promise<void> {
    this.hour = hour
    if (!this.entered || !this.data) return
    await this.applyHour(this.data)
  }

  private async applyHour(data: TrafficData): Promise<void> {
    const tasks: (Promise<void> | undefined)[] = []

    const levels = data.segments.map(s => congestionLevel(congestionAt(s, this.hour)))
    const inbound = commuteAt(this.hour) === 'in'
    const roadKey = levels.join('') + inbound
    if (roadKey !== this.drawn.road) {
      this.drawn.road = roadKey
      tasks.push(this.replaceLayer('road', 'polyline', this.buildRoads(data.segments, levels, inbound)))
    }

    if (String(inbound) !== this.drawn.od) {
      this.drawn.od = String(inbound)
      tasks.push(this.replaceLayer('od', 'odline', this.buildOd(data, inbound)))
    }

    const colors = this.districtColors(data)
    if (this.options.pak) {
      tasks.push(this.districts?.setColors(colors))
    } else {
      const districtKey = JSON.stringify(colors)
      if (districtKey !== this.drawn.district) {
        this.drawn.district = districtKey
        tasks.push(this.replaceLayer('district', 'polygon', this.geo.districts.map(d => area({ id: 'district-' + d.id, groupId: 'sc_traffic_district', ring: d.ring, color: colors[d.id], fill: 0.16 }))))
      }
    }
    await Promise.all(tasks)
  }

  /** 每个片区的颜色；没有路段经过的片区按畅通算 */
  private districtColors(data: TrafficData): Record<string, string> {
    const index = districtCongestionAt(data.segments, this.hour)
    return Object.fromEntries(this.geo.districts.map(d => [d.id, districtColor(index[d.id] ?? 1)]))
  }

  /**
   * 路况线：主干路是追逐箭头，其余是粒子流；颜色和流速由拥堵等级决定。
   * 纵向道路的流向跟着通勤方向：上午朝西北（进城），下午朝东南（出城）。
   */
  private buildRoads(segments: RoadSegment[], levels: number[], inbound: boolean): { id: string }[] {
    return segments.flatMap((s, i) => {
      const path = this.paths.get(s.id)
      if (!path) return []
      const main = s.level === 1
      const o = { id: 'seg-' + s.id, groupId: 'sc_traffic_road', path, color: STATUS_RAMP[levels[i]], width: ROAD_WIDTH[s.level], brightness: main ? 2.8 : 1.8 }
      if (!this.options.pak) return [plainLine({ ...o, flow: true })]
      const long = this.geo.road(s.roadId)?.direction === 'long'
      return [flowLine({ ...o, style: main ? 'arrow' : 'particles', speed: FLOW_SPEED[levels[i]], spacing: main ? 180 : 110, reverse: long && inbound })]
    })
  }

  /** 通勤飞线：上午居住区 → 商务区，下午反向。只有最重的两条用暖色 */
  private buildOd(data: TrafficData, inbound: boolean): { id: string }[] {
    const flows = [...data.odFlows].sort((a, b) => b.volume - a.volume)
    const max = flows.length ? flows[0].volume : 1
    return flows.flatMap((f, i) => {
      const home = this.geo.district(f.homeId)?.centerXY
      const work = this.geo.district(f.workId)?.centerXY
      if (!home || !work) return []
      return [arc({ id: 'od-' + f.id, groupId: 'sc_traffic_od', from: inbound ? home : work, to: inbound ? work : home, color: i < 2 ? COLOR.warn : COLOR.accentLight, width: 22 + 26 * (f.volume / max), bend: 0.3 })]
    })
  }

  /** 记录图层开关，定位时用来判断目标对象是否在场景里 */
  async setLayerVisible(layer: string, visible: boolean): Promise<void> {
    this.layerOn.set(layer, visible)
    await super.setLayerVisible(layer, visible)
  }

  private isOn(layer: string): boolean {
    return this.entered && this.layerOn.get(layer) !== false
  }

  /** 路段中点的投影坐标 */
  private midOf(segment: RoadSegment): number[] | null {
    const road = this.geo.road(segment.roadId)
    return road ? pointAt(road.line, (segment.from + segment.to) / 2) : null
  }

  /** 城市巡航的机位：依次俯瞰所选时刻最堵的几个路段（每条道路只取最堵的一段） */
  tourViews(): number[][] {
    const seen = new Set<string>()
    const views: number[][] = []
    for (const r of rankSegmentsAt(this.data?.segments ?? [], this.hour, Infinity)) {
      if (views.length >= TOUR_STOPS) break
      if (seen.has(r.segment.roadId)) continue
      const mid = this.midOf(r.segment)
      if (!mid) continue
      seen.add(r.segment.roadId)
      views.push(viewOf(mid))
    }
    return views
  }

  /** 飞到某个交通事件。事件图层关着时标注不在场景里，改为直接移动相机 */
  async focusIncident(id: string): Promise<void> {
    const incident = this.data?.incidents.find(i => i.id === id)
    if (!incident) return
    if (this.isOn('incident')) return this.api.focus('marker', 'incident-' + id, 1500)
    const p = this.xy.get(incident.intersectionId)
    if (p) await this.api.setCamera(viewOf(p, 0.6))
  }

  /** 飞到某个信号路口 */
  async focusSignal(id: string): Promise<void> {
    if (this.isOn('signal')) return this.api.focus('radiationPoint', 'signal-' + id, 1200)
    const p = this.xy.get(id)
    if (p) await this.api.setCamera(viewOf(p, 0.5))
  }

  /** 飞到某个路段 */
  async focusSegment(id: string): Promise<void> {
    const segment = this.data?.segments.find(s => s.id === id)
    if (!segment) return
    if (this.isOn('road') && this.paths.has(id)) return this.api.focus('polyline', 'seg-' + id, Math.max(1500, segment.lengthKm * 1400))
    const mid = this.midOf(segment)
    if (mid) await this.api.setCamera(viewOf(mid, 0.8))
  }
}
