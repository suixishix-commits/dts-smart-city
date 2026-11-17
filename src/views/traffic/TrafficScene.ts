import { commuteAt, congestionAt, congestionLevel, INCIDENT_TEXT, rankSegmentsAt, vehicleStateAt } from '@/api/mock/traffic'
import { lineFlowMesh, type LineFlowStyle } from '@/scene/lineFlow'
import { ModuleScene } from '@/scene/ModuleScene'
import { odArcMeshDirected, RecolorMeshLayer, roadFlowMesh, type RoadFlow } from '@/scene/trafficFlow'
import type { SceneApi } from '@/scene/SceneApi'
import { pointAt, sliceLine, type CityGeo } from '@/scene/geo'
import { alarmPoints, arc, COLOR, flowLine, focusView, LEVEL_COLOR, pin, plainLine, prepareFlowLines, ripple, labelWidth, staggerLabels, STATUS_RAMP } from '@/scene/kit'
import type { DetourLeg, IncidentType, KeyVehicle, RoadSegment, SignalStatus, TrafficData, VehicleKind } from '@/types/traffic'

export interface TrafficSceneOptions {
  /** [x, y, z, pitch, yaw]；为 null 时不动相机 */
  cameraView: number[] | null
  /** 效果总包是否可用；不可用时路况退回普通发光线 */
  pak: boolean
  /** 分级点位材质包是否可用；不可用时事件点用扩散波纹 */
  beacons?: boolean
  /** 交通流光材质包是否可用；可用时路况和通勤 OD 用 UE 流光丝带（换时刻只改顶点颜色），否则用效果总包或 DTS 线 */
  trafficFlow?: boolean
  /** 通用流光线材质包是否可用；可用时绕行路线、车辆轨迹用流光线 */
  lineFlow?: boolean
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
/** 事件类型在分级点位里的等级（颜色同 INCIDENT_COLOR）：事故二级、施工管制三级、故障四级 */
export const INCIDENT_LEVEL: Record<IncidentType, 1 | 2 | 3 | 4> = { accident: 2, construction: 3, control: 3, breakdown: 4 }
/** 信号路口状态的颜色：正常是冷色，离线和手动控制才用暖色 */
export const SIGNAL_COLOR: Record<SignalStatus, string> = { normal: COLOR.accent, offline: COLOR.danger, manual: COLOR.warn }
export const SIGNAL_TEXT: Record<SignalStatus, string> = { normal: '正常', offline: '离线', manual: '手动控制' }

/** 重点车辆的颜色：公交、巡逻是冷色，急救和清障是需要让行/关注的车辆才用暖色 */
export const VEHICLE_COLOR: Record<VehicleKind, string> = { bus: COLOR.accent, patrol: COLOR.accentLight, ambulance: COLOR.danger, wrecker: COLOR.caution }
export const VEHICLE_TEXT: Record<VehicleKind, string> = { bus: '公交', patrol: '巡逻', ambulance: '急救', wrecker: '清障' }
/** 绕行路线的颜色：冰蓝，和路况的绿黄橙红、通勤飞线的浅蓝都区分得开 */
export const DETOUR_COLOR = COLOR.ice

/** 各拥堵等级的流速：越堵越慢 */
const FLOW_SPEED = [0.34, 0.22, 0.13, 0.07]
/** 各等级道路的线宽，米 */
const ROAD_WIDTH: Record<number, number> = { 1: 100, 2: 64, 3: 44 }
/** 流光丝带的宽度，米（中心线约占 1/10，其余是柔光） */
const FLOW_WIDTH: Record<number, number> = { 1: 56, 2: 44, 3: 34 }
/** 通勤 OD 只画通勤量最大的几条：多了会在画面上交错成一片 */
const OD_TOP = 3
/** 车辆轨迹由标注和轨迹线两个图层组成，图层开关 vehicle 同时控制两者 */
/** 绕行路线：冰白色、较宽，光点沿绕行方向快速流动 */
const DETOUR_FLOW: Omit<LineFlowStyle, 'color'> = { period: 320, speed: 0.55, light: 1.4, lightLen: 0.14, brightness: 1.1, coreWidth: 0.14 }
/** 车辆轨迹：整条一个周期，尾部渐隐，光点流向车辆当前位置 */
const TRAIL_FLOW: Omit<LineFlowStyle, 'color'> = { period: 'whole', speed: 0.6, light: 1.1, lightLen: 0.3, tail: 1, brightness: 1 }
const VEHICLE_LAYER = 'vehicle'
const VEHICLE_TRAIL_LAYER = 'vehicleTrail'
const DETOUR_LAYER = 'detour'
const DETOUR_PIN_LAYER = 'detourPin'
/** 摄像头定位的相机高度，米 */
const CAMERA_HEIGHT = 2400
/** 巡航经过的拥堵路段数 */
const TOUR_STOPS = 5

/**
 * 智慧交通的场景图层：
 * - road     实时路况：每条路在路口处切成路段，按所选时刻的拥堵等级着色，越堵流得越慢；
 * - od       通勤 OD：片区中心之间的飞线，上午进城、下午出城；
 * - incident 交通事件：扩散波纹 + 标注，可点击；
 * - signal   信号路口：全部路口的小波纹，异常的加标注（默认关闭）；
 * - vehicle  车辆轨迹：重点车辆的标注 + 身后一小段轨迹线，位置随所选小时推进（默认关闭）；
 * - detour   绕行方案：选中交通事件后按需画出，取消选中或离开时删除（不在图层开关里）。
 */
export class TrafficScene extends ModuleScene {
  private data: TrafficData | null = null
  /** UE 交通流光（路况、通勤 OD）；材质包不可用时为 null */
  private roadFlow: RecolorMeshLayer | null = null
  private odFlow: RecolorMeshLayer | null = null
  private hour = 12
  /** onEnter 已经创建完图层。在此之前 setHour 只记录小时 */
  private entered = false
  /** 路段 id → 投影坐标折线 */
  private paths = new Map<string, number[][]>()
  private xy = new Map<string, number[]>()
  /** 上一次画出的内容的签名；没变就不重画，拖动时间轴时省掉大部分指令 */
  private drawn: { road: string | null; od: string | null; vehicle: string | null } = { road: null, od: null, vehicle: null }
  /** 当前画出的绕行方案对应的事件 id */
  private detourId: string | null = null

  constructor(
    api: SceneApi,
    private readonly geo: CityGeo,
    private readonly options: TrafficSceneOptions
  ) {
    super(api)
    if (options.trafficFlow) {
      this.roadFlow = new RecolorMeshLayer(api, 'traffic-road-flow')
      this.odFlow = new RecolorMeshLayer(api, 'traffic-od-flow')
    }
  }

  /** 进入前设置数据和初始小时 */
  setData(data: TrafficData, hour: number) {
    this.data = data
    this.hour = hour
  }

  protected async onEnter(token: number): Promise<void> {
    this.entered = false
    this.drawn = { road: null, od: null, vehicle: null }
    this.detourId = null
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
    const marks = alarmPoints({
      id: 'incident-ripple',
      groupId: 'sc_traffic_incident_ripple',
      beacons: !!this.options.beacons,
      points: incidents.map(i => ({ id: i.id, at: this.xy.get(i.intersectionId) as number[], level: INCIDENT_LEVEL[i.type], color: INCIDENT_COLOR[i.type], radius: Math.min(800, 300 + i.queue * 0.5) }))
    })
    await this.add(token, marks.type, marks.objects, 'incident')
    // 西侧老城的事件挨得很近，引线错开高度，文字框才不叠在一起
    const heights = staggerLabels(incidents.map(i => ({ at: this.xy.get(i.intersectionId) as number[], width: labelWidth(i.title, { tag: INCIDENT_TEXT[i.type] }) })), 56, 34, { camera: this.options.cameraView })
    await this.add(
      token,
      'marker',
      incidents.map((i, k) =>
        pin({ id: 'incident-' + i.id, groupId: 'sc_traffic_incident', at: this.xy.get(i.intersectionId) as number[], tag: INCIDENT_TEXT[i.type], text: i.title, color: INCIDENT_COLOR[i.type], userId: i.id, lineHeight: heights[k], priority: 10 })
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
        .map(s => pin({ id: 'signal-pin-' + s.id, groupId: 'sc_traffic_signal', at: this.xy.get(s.id) as number[], text: '信号' + SIGNAL_TEXT[s.status], icon: 'signal', color: SIGNAL_COLOR[s.status], userId: s.id, lineHeight: 28, fontSize: 11 })),
      'signal'
    )

    if (!this.isCurrent(token)) return
    // 随时间变化的图层最后创建，用进入期间记录的最新小时；此后 setHour 直接替换
    this.entered = true
    await this.applyHour(data)
  }

  protected async onLeave(): Promise<void> {
    this.entered = false
    this.detourId = null
    this.drawn = { road: null, od: null, vehicle: null }
    await Promise.all([this.roadFlow?.clear(), this.odFlow?.clear()])
    await this.options.setBaseRoads?.(true)
  }

  protected onAbandon(): void {
    this.roadFlow?.abandon()
    this.odFlow?.abandon()
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
      tasks.push(this.roadFlow ? this.roadFlow.show(id => roadFlowMesh(id, this.flowRoads(data.segments, levels, inbound), { groupId: 'sc_traffic_road' })) : this.replaceLayer('road', 'polyline', this.buildRoads(data.segments, levels, inbound)))
    }

    if (String(inbound) !== this.drawn.od) {
      this.drawn.od = String(inbound)
      tasks.push(this.odFlow ? this.odFlow.show(id => odArcMeshDirected(id, this.flowArcs(data, inbound), { groupId: 'sc_traffic_od' })) : this.replaceLayer('od', 'polyline', this.buildOd(data, inbound)))
    }

    if (String(this.hour) !== this.drawn.vehicle) {
      this.drawn.vehicle = String(this.hour)
      const { pins, trails } = this.buildVehicles(data)
      tasks.push(this.replaceLayer(VEHICLE_LAYER, 'marker', pins), this.replaceLayer(VEHICLE_TRAIL_LAYER, this.lineType, trails))
    }
    await Promise.all(tasks)
  }

  /** 道路上某段比例区间的折线，按 from → to 的方向排列点序 */
  private along(roadId: string, from: number, to: number): number[][] | null {
    const road = this.geo.road(roadId)
    if (!road) return null
    const path = sliceLine(road.line, Math.min(from, to), Math.max(from, to))
    return from <= to ? path : path.reverse()
  }

  /** 重点车辆某时刻在场景里的位置 */
  private vehiclePoint(v: KeyVehicle, hour: number): number[] | null {
    const road = this.geo.road(v.roadId)
    return road ? pointAt(road.line, vehicleStateAt(v, this.data?.segments ?? [], hour).ratio) : null
  }

  /** 车辆标注 + 身后的轨迹线。标注不常显，交给引擎避让，不和事件标注抢位置 */
  private buildVehicles(data: TrafficData): { pins: { id: string }[]; trails: { id: string }[] } {
    const pins: { id: string }[] = []
    const trails: { id: string }[] = []
    for (const v of data.vehicles) {
      const state = vehicleStateAt(v, data.segments, this.hour)
      const at = this.vehiclePoint(v, this.hour)
      const trail = this.along(v.roadId, state.trail[0], state.trail[1])
      if (!at || !trail) continue
      const color = VEHICLE_COLOR[v.kind]
      if (this.options.lineFlow) {
        // id 带上时刻：换时刻时新旧轨迹 id 不同，基类先建后删，不闪
        const mesh = lineFlowMesh(`vehicle-trail-${v.id}-${Math.round(this.hour * 2)}`, [{ id: v.id, path: trail, width: 70 }], { ...TRAIL_FLOW, color }, { groupId: 'sc_traffic_vehicle_trail', z: 16 })
        if (mesh) trails.push(mesh)
      } else trails.push(flowLine({ id: 'vehicle-trail-' + v.id, groupId: 'sc_traffic_vehicle_trail', path: trail, color, width: 56, style: 'pulse', brightness: 1.1, speed: 0.3, height: 16 }))
      pins.push(pin({ id: 'vehicle-' + v.id, groupId: 'sc_traffic_vehicle', at, text: v.name, value: `${state.speed} km/h`, icon: 'vehicle', color, userId: v.id, lineHeight: 30, fontSize: 12, priority: 5 }))
    }
    return { pins, trails }
  }

  /**
   * 画出某个事件的绕行方案：沿真实道路的发光线 + 起终点标注，并把相机拉到能看到整条路线的高度。
   * 没有绕行方案时什么也不画，返回 false。
   */
  async showDetour(incidentId: string): Promise<boolean> {
    const incident = this.data?.incidents.find(i => i.id === incidentId)
    const plan = incident?.detour
    if (!this.entered || !plan) return false
    const path = plan.legs.flatMap((l: DetourLeg, k) => (this.along(l.roadId, l.from, l.to) ?? []).slice(k > 0 ? 1 : 0))
    if (path.length < 2) return false
    this.detourId = incidentId
    const start = path[0]
    const end = path[path.length - 1]
    await Promise.all([
      this.options.lineFlow
        ? this.replaceLayer(DETOUR_LAYER, 'customMesh', [lineFlowMesh('detour-' + incidentId, [{ id: incidentId, path, width: 150 }], { ...DETOUR_FLOW, color: DETOUR_COLOR }, { groupId: 'sc_traffic_detour', z: 20 })].filter(m => m !== null))
        : this.replaceLayer(DETOUR_LAYER, 'polyline', [flowLine({ id: 'detour-' + incidentId, groupId: 'sc_traffic_detour', path, color: DETOUR_COLOR, width: 84, style: 'pulse', brightness: 1.2, height: 20 })]),
      this.replaceLayer(DETOUR_PIN_LAYER, 'marker', [
        pin({ id: 'detour-from-' + incidentId, groupId: 'sc_traffic_detour_pin', at: start, text: '绕行起点 · ' + plan.fromName, color: DETOUR_COLOR, lineHeight: 40, fontSize: 12 }),
        pin({ id: 'detour-to-' + incidentId, groupId: 'sc_traffic_detour_pin', at: end, text: '汇入点 · ' + plan.toName, color: DETOUR_COLOR, lineHeight: 40, fontSize: 12 })
      ])
    ])
    // 机位对准路线外包框的中心，范围越大拉得越高
    const xs = path.map(p => p[0])
    const ys = path.map(p => p[1])
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
    const center = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2]
    await this.api.setCamera(focusView(center, Math.min(6000, Math.max(3600, span * 1.4))), 1.5)
    return true
  }

  /** 绕行、轨迹这类线的对象类型：流光线是 customMesh，否则是 DTS 折线 */
  private get lineType(): 'customMesh' | 'polyline' {
    return this.options.lineFlow ? 'customMesh' : 'polyline'
  }

  /** 删除绕行方案 */
  async clearDetour(): Promise<void> {
    if (!this.detourId) return
    this.detourId = null
    await Promise.all([this.replaceLayer(DETOUR_LAYER, this.lineType, []), this.replaceLayer(DETOUR_PIN_LAYER, 'marker', [])])
  }

  /** 当前画着绕行方案的事件 id */
  get activeDetour(): string | null {
    return this.detourId
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
      const o = { id: 'seg-' + s.id, groupId: 'sc_traffic_road', path, color: STATUS_RAMP[levels[i]], width: ROAD_WIDTH[s.level], brightness: main ? 1 : 0.8 }
      if (!this.options.pak) return [plainLine({ ...o, flow: true })]
      const long = this.geo.road(s.roadId)?.direction === 'long'
      return [flowLine({ ...o, style: main ? 'arrow' : 'particles', speed: FLOW_SPEED[levels[i]], spacing: main ? 180 : 110, reverse: long && inbound })]
    })
  }

  /** 路况流光的丝带：细中心线 + 柔光，宽度按道路等级；纵向道路的流向跟着通勤方向 */
  private flowRoads(segments: RoadSegment[], levels: number[], inbound: boolean): RoadFlow[] {
    return segments.flatMap((s, i) => {
      const path = this.paths.get(s.id)
      if (!path) return []
      const long = this.geo.road(s.roadId)?.direction === 'long'
      return [{ id: s.id, path, width: FLOW_WIDTH[s.level], level: levels[i], reverse: long && inbound }]
    })
  }

  /** 通勤 OD 弧线：只留通勤量最大的几条；几何固定为居住区 → 商务区，下午只翻转方向（渐变色和光点跟着翻转）。宽度随通勤量 */
  private flowArcs(data: TrafficData, inbound: boolean) {
    const flows = [...data.odFlows].sort((a, b) => b.volume - a.volume).slice(0, OD_TOP)
    const max = flows.length ? flows[0].volume : 1
    return flows.flatMap((f, i) => {
      const home = this.geo.district(f.homeId)?.centerXY
      const work = this.geo.district(f.workId)?.centerXY
      if (!home || !work) return []
      return [{ id: f.id, from: home, to: work, width: 22 + 16 * (f.volume / max), warm: i < 2, reverse: !inbound }]
    })
  }

  /** 通勤飞线：上午居住区 → 商务区，下午反向。只有最重的两条用暖色 */
  private buildOd(data: TrafficData, inbound: boolean): { id: string }[] {
    const flows = [...data.odFlows].sort((a, b) => b.volume - a.volume).slice(0, OD_TOP)
    const max = flows.length ? flows[0].volume : 1
    return flows.flatMap((f, i) => {
      const home = this.geo.district(f.homeId)?.centerXY
      const work = this.geo.district(f.workId)?.centerXY
      if (!home || !work) return []
      return [arc({ id: 'od-' + f.id, groupId: 'sc_traffic_od', from: inbound ? home : work, to: inbound ? work : home, color: i < 2 ? COLOR.warn : COLOR.accentLight, width: 36 + 28 * (f.volume / max), bend: 0.3, brightness: i < 2 ? 1 : 0.8 })]
    })
  }

  /** 图层开关；车辆轨迹的开关同时控制车辆标注和轨迹线 */
  async setLayerVisible(layer: string, visible: boolean): Promise<void> {
    if (layer === 'road') await this.roadFlow?.setVisible(visible)
    if (layer === 'od') await this.odFlow?.setVisible(visible)
    if (layer === VEHICLE_LAYER) await Promise.all([super.setLayerVisible(layer, visible), super.setLayerVisible(VEHICLE_TRAIL_LAYER, visible)])
    else await super.setLayerVisible(layer, visible)
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
      views.push(focusView(mid))
    }
    return views
  }

  /** 飞到某个交通事件 */
  async focusIncident(id: string): Promise<void> {
    const incident = this.data?.incidents.find(i => i.id === id)
    const p = incident && this.xy.get(incident.intersectionId)
    if (p) await this.api.setCamera(focusView(p), 1.5)
  }

  /** 飞到某个信号路口 */
  async focusSignal(id: string): Promise<void> {
    const p = this.xy.get(id)
    if (p) await this.api.setCamera(focusView(p, 2600), 1.5)
  }

  /** 飞到某个路段：越长的路段拉得越高，保证整段在画面里 */
  async focusSegment(id: string): Promise<void> {
    const segment = this.data?.segments.find(s => s.id === id)
    const mid = segment && this.midOf(segment)
    if (mid) await this.api.setCamera(focusView(mid, Math.min(5200, Math.max(3000, segment.lengthKm * 1500))), 1.5)
  }

  /** 飞到某辆重点车辆所选小时的位置 */
  async focusVehicle(id: string): Promise<void> {
    const v = this.data?.vehicles.find(x => x.id === id)
    const p = v && this.vehiclePoint(v, this.hour)
    if (p) await this.api.setCamera(focusView(p), 1.5)
  }

  /** 飞到某个路口摄像头（摄像头统一 2400 米） */
  async focusCamera(intersectionId: string): Promise<void> {
    const p = this.xy.get(intersectionId)
    if (p) await this.api.setCamera(focusView(p, CAMERA_HEIGHT), 1.5)
  }
}
