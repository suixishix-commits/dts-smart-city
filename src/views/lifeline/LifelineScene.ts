import { bridgeStatus } from '@/api/mock/lifeline'
import { lineFlowMesh, type LineFlowStyle } from '@/scene/lineFlow'
import { ModuleScene } from '@/scene/ModuleScene'
import type { SceneApi } from '@/scene/SceneApi'
import type { CityGeo, XY } from '@/scene/geo'
import { sliceLine } from '@/scene/geo'
import { alarmPoints, area, circleRing, COLOR, flowLine, focusView, LEVEL_COLOR, pin, plainLine, prepareFlowLines, RAMP, ripple, labelWidth, staggerLabels, STATUS_RAMP } from '@/scene/kit'
import type { Anchor, LifelineAlarm, LifelineData, PipeSegment, PipeSystem } from '@/types/lifeline'
import { bufferLine, resolveAnchor, segmentBetween } from './anchor'

export interface LifelineSceneOptions {
  /** [x, y, z, pitch, yaw]；为 null 时不动相机 */
  cameraView: number[] | null
  /** 效果总包是否可用；不可用时管线退回普通发光线 */
  pak: boolean
  /** 底座路网的开关（传 cityBase）：地下模式打开时隐藏；地上时压暗，让管网成为画面主体；离开时恢复 */
  roads?: { setRoadsVisible(visible: boolean): Promise<void>; setRoadsDimmed?(dim: boolean): Promise<void> }
  /** 分级点位材质包是否可用；不可用时告警点用扩散波纹 */
  beacons?: boolean
  /** 通用流光线材质包是否可用；可用时管网画成流光线（每张管网一个网格），否则用 DTS 自带线 */
  lineFlow?: boolean
}

/** 各管网的离地高度（米）：错开后彼此不闪面，也不和底座路网闪面 */
export const PIPE_HEIGHT: Record<PipeSystem, number> = { drain: 16, water: 20, gas: 28, power: 36, cooling: 44 }
/** 受影响管段画在供水管之上 */
const ALARM_PIPE_HEIGHT = 24
/** 排水管的颜色：比供水更暗的蓝 */
export const DRAIN_COLOR = RAMP[1]
/** 电力线的颜色：设计稿的管线色（紫），与供水的蓝拉开 */
export const POWER_COLOR = '#c58bff'
/** 区域供冷的颜色：设计稿的管线色（青） */
export const COOLING_COLOR = '#66d9e8'
/** 各管网的颜色（图例与此一致） */
export const PIPE_COLOR: Record<PipeSystem, string> = { water: COLOR.accent, power: POWER_COLOR, gas: COLOR.warn, drain: DRAIN_COLOR, cooling: COOLING_COLOR }
/**
 * 各管网的线宽 [主干, 支线]（米）、亮度 [主干, 支线] 和不透明度。
 * 实测：DTS 发光线亮度超过 1 左右再叠上泛光，线芯会被冲成白色，供水、电力、供冷就分不出颜色；
 * 所以亮度都压在 1 以下，主次靠线宽区分。燃气是唯一的暖色管网，亮度最低，不抢告警的注意力。
 */
const PIPE_STYLE: Record<PipeSystem, { width: [number, number]; brightness: [number, number]; alpha: number }> = {
  water: { width: [100, 56], brightness: [0.8, 0.65], alpha: 1 },
  power: { width: [76, 50], brightness: [0.65, 0.55], alpha: 1 },
  cooling: { width: [70, 46], brightness: [0.65, 0.55], alpha: 1 },
  drain: { width: [70, 50], brightness: [0.55, 0.5], alpha: 0.85 },
  gas: { width: [50, 50], brightness: [0.45, 0.45], alpha: 0.8 }
}
/**
 * 流光线材质下各管网的线型：每张管网一种「流动方式」，不靠颜色也能分得开。
 * 供水稳定中速流；电力快而短的光点（电流）；燃气虚线慢流、亮度最低；排水慢流；供冷中慢流。
 * width 是丝带宽度 [主干, 支线]（线芯约占 12%，其余是柔光）。
 */
const PIPE_FLOW: Record<PipeSystem, { width: [number, number]; style: Omit<LineFlowStyle, 'color'> }> = {
  water: { width: [130, 84], style: { period: 520, speed: 0.32, light: 1, brightness: 0.9 } },
  power: { width: [110, 74], style: { period: 360, speed: 0.75, light: 1.2, lightLen: 0.06, brightness: 0.85 } },
  cooling: { width: [110, 74], style: { period: 480, speed: 0.22, light: 0.9, brightness: 0.8 } },
  drain: { width: [110, 74], style: { period: 600, speed: 0.12, light: 0.7, brightness: 0.7 } },
  gas: { width: [90, 90], style: { period: 400, speed: 0.1, light: 0.5, dash: 6, brightness: 0.7 } }
}
/** 流光线下受影响管段的离地高度，米：高过所有管网 */
const ALARM_FLOW_Z = 70
/** 受影响管段：红色、呼吸、快速光点 */
const ALARM_PIPE_FLOW: LineFlowStyle = { color: COLOR.danger, period: 240, speed: 0.6, light: 1.3, breath: 0.35, brightness: 1.3, coreWidth: 0.18, glow: 0.4 }
/** 变电站标注：正常的只写负荷率，异常的带站名 */
function substationText(s: { name: string; loadPercent: number; status: number }): string {
  return s.status ? `${s.name} ${s.loadPercent}%` : `${s.loadPercent}%`
}
/** 桥梁标注 */
function bridgeText(b: { name: string; score: number }): string {
  return `${b.name} ${b.score} 分`
}
/** 阀门标注的颜色 */
export const VALVE_COLOR = COLOR.white
/** 告警波纹半径，米 */
const ALARM_RADIUS: Record<number, number> = { 1: 700, 2: 520, 3: 400, 4: 300 }
const LEVEL_TEXT: Record<number, string> = { 1: '一级', 2: '二级', 3: '三级', 4: '四级' }

/** 图层开关对应的数据图层键 */
export const LIFELINE_LAYERS = ['water', 'power', 'alarm', 'gas', 'drain', 'bridge', 'cooling'] as const
/** 五张管网的图层键（地下模式时全部打开） */
export const PIPE_LAYERS: PipeSystem[] = ['water', 'power', 'gas', 'drain', 'cooling']

/**
 * 城市生命线的场景图层（管线都沿真实道路敷设）：
 * - water   供水：主干管（脉冲粒子流）+ 配水干管（粒子流）；
 * - power   电力：电缆（流动虚线）+ 变电站标注（按负荷率着色）；
 * - alarm   运行告警：波纹 + 标注 + 受影响管段（红色重绘）；
 * - gas     燃气：中压管（暖色虚线，亮度压低）+ 调压站标注；
 * - drain   排水与内涝：排水管 + 易涝点范围面和水深标注 + 泵站标注；
 * - bridge  桥梁：健康评分标注 + 柔和波纹；
 * - cooling 区域供冷：供冷主管 / 支管 + 供冷站标注；
 * 以及随选中告警出现的两个图层：valve（相关阀门标注）、impact（影响范围面）。
 */
export class LifelineScene extends ModuleScene {
  private data: LifelineData | null = null
  private alarmXY = new Map<string, XY>()
  private bridgeXY = new Map<string, XY>()
  /** 地下模式：隐藏底座路网 */
  private underground = false
  private roadsDimmed = false
  /** 是否已进入（进入后地下模式的切换才落到场景） */
  private entered = false
  /** 本模块是否隐藏了底座路网 */
  private roadsHidden = false

  constructor(
    api: SceneApi,
    private readonly geo: CityGeo,
    private readonly options: LifelineSceneOptions
  ) {
    super(api)
  }

  /** 进入前设置数据 */
  setData(data: LifelineData) {
    this.data = data
    this.alarmXY = new Map(data.alarms.map(a => [a.id, resolveAnchor(this.geo, a.anchor)]))
    this.bridgeXY = new Map(data.bridges.map(b => [b.id, resolveAnchor(this.geo, { kind: 'landmark', id: b.id })]))
  }

  /** 一段管线的折线（投影坐标） */
  private path(p: PipeSegment): XY[] {
    const road = this.geo.road(p.roadId)
    if (!road) throw new Error('路网里没有道路 ' + p.roadId)
    return p.from <= 0 && p.to >= 1 ? road.line : sliceLine(road.line, p.from, p.to)
  }

  /** 一段管线的场景对象：按管网和主次取线宽、亮度 */
  private pipe(p: PipeSegment): { id: string } {
    const i = p.grade === 'trunk' ? 0 : 1
    const style = PIPE_STYLE[p.system]
    return plainLine({
      id: 'll-pipe-' + p.id,
      groupId: 'sc_lifeline_' + p.system,
      path: this.path(p),
      color: PIPE_COLOR[p.system],
      height: PIPE_HEIGHT[p.system],
      width: style.width[i],
      brightness: style.brightness[i],
      alpha: style.alpha
    })
  }

  private pipes(system: PipeSystem): { id: string }[] {
    const segments = (this.data?.pipes ?? []).filter(p => p.system === system)
    if (this.options.lineFlow) {
      const flow = PIPE_FLOW[system]
      const mesh = lineFlowMesh(
        'll-pipes-' + system,
        segments.map(p => ({ id: p.id, path: this.path(p), width: flow.width[p.grade === 'trunk' ? 0 : 1], minor: p.grade !== 'trunk' })),
        { ...flow.style, color: PIPE_COLOR[system] },
        { groupId: 'sc_lifeline_' + system, z: PIPE_HEIGHT[system] }
      )
      return mesh ? [mesh] : []
    }
    return segments.map(p => this.pipe(p))
  }

  /** 管网对象的类型：流光线是 customMesh，否则是 DTS 折线 */
  private get pipeType(): 'customMesh' | 'polyline' {
    return this.options.lineFlow ? 'customMesh' : 'polyline'
  }

  protected async onEnter(token: number): Promise<void> {
    const data = this.data
    if (!data) return
    const geo = this.geo
    const at = (anchor: Anchor) => resolveAnchor(geo, anchor)

    if (this.options.cameraView) await this.api.setCamera(this.options.cameraView)
    if (!this.isCurrent(token)) return
    this.entered = true
    await this.applyRoads()
    if (this.options.pak) await prepareFlowLines()

    const lead = this.labelLeads(data)

    // 供水
    await this.add(token, this.pipeType, this.pipes('water'), 'water')

    // 电力：电缆 + 变电站
    await this.add(token, this.pipeType, this.pipes('power'), 'power')
    await this.add(
      token,
      'marker',
      data.substations.map(s =>
        pin({ id: 'll-sub-' + s.id, icon: 'power', groupId: 'sc_lifeline_substation', at: at(s.anchor), text: substationText(s), color: STATUS_RAMP[s.status], userId: s.id, lineHeight: lead.get('sub:' + s.id), fontSize: 12, priority: 2 + s.status })
      ),
      'power'
    )

    // 运行告警：受影响管段 + 波纹 + 标注
    const affected = data.alarms.flatMap(a => (a.segment ? [{ id: a.id, path: segmentBetween(geo, a.segment.roadId, a.segment.from, a.segment.to) }] : []))
    if (this.options.lineFlow) {
      // 每段一个小网格、抬得比管网高：半透明按包围盒远近排序，小而近的网格后画，红线压在整网的供水线上面
      const meshes = affected.flatMap(a => {
        const mesh = lineFlowMesh('ll-alarm-pipe-' + a.id, [{ ...a, width: 170 }], ALARM_PIPE_FLOW, { groupId: 'sc_lifeline_alarm_pipe', z: ALARM_FLOW_Z })
        return mesh ? [mesh] : []
      })
      await this.add(token, 'customMesh', meshes, 'alarm')
    } else {
      await this.add(
        token,
        'polyline',
        affected.map(a => {
          const o = { id: 'll-alarm-pipe-' + a.id, groupId: 'sc_lifeline_alarm_pipe', path: a.path, color: COLOR.danger, width: 80, brightness: 1.2, height: ALARM_PIPE_HEIGHT }
          return this.options.pak ? flowLine({ ...o, style: 'pulse', spacing: 140, speed: 0.4 }) : plainLine({ ...o, flow: true })
        }),
        'alarm'
      )
    }
    const marks = alarmPoints({
      id: 'll-alarm-ripple',
      groupId: 'sc_lifeline_alarm_ripple',
      beacons: !!this.options.beacons,
      points: data.alarms.map(a => ({ id: a.id, at: this.alarmXY.get(a.id) as XY, level: a.level, color: LEVEL_COLOR[a.level], radius: ALARM_RADIUS[a.level], brightness: a.level <= 2 ? 0.9 : 0.6 }))
    })
    await this.add(token, marks.type, marks.objects, 'alarm')
    // 告警只有几条、全部常显（priority ≥ 10），挨得近时错开引线高度，级别高的排在最低一档；最低一档也要高过变电站、泵站这些设施标注
    await this.add(
      token,
      'marker',
      data.alarms.map(a =>
        pin({ id: 'll-alarm-' + a.id, groupId: 'sc_lifeline_alarm', at: this.alarmXY.get(a.id) as XY, tag: LEVEL_TEXT[a.level], text: a.shortTitle, color: LEVEL_COLOR[a.level], userId: a.id, lineHeight: lead.get('alarm:' + a.id), priority: 20 - a.level })
      ),
      'alarm'
    )

    // 燃气：管线 + 调压站（默认关闭）
    await this.add(token, this.pipeType, this.pipes('gas'), 'gas')
    await this.add(
      token,
      'marker',
      data.gasStations.map(g => pin({ id: 'll-gas-' + g.id, icon: 'gas', groupId: 'sc_lifeline_gas', at: at(g.anchor), text: `${g.name} ${g.outletKpa} kPa`, color: STATUS_RAMP[g.status], userId: g.id, lineHeight: 30, fontSize: 12, priority: 2 + g.status })),
      'gas'
    )

    // 排水与内涝：管线 + 易涝点 + 泵站（默认关闭）
    await this.add(token, this.pipeType, this.pipes('drain'), 'drain')
    await this.add(
      token,
      'polygon',
      data.floodPoints.map(f => area({ id: 'll-flood-area-' + f.id, groupId: 'sc_lifeline_flood_area', ring: circleRing(at(f.anchor), f.radius), color: STATUS_RAMP[f.status], fill: 0.24, frameWidth: 8 })),
      'drain'
    )
    await this.add(
      token,
      'marker',
      [
        ...data.floodPoints.map(f => pin({ id: 'll-flood-' + f.id, icon: 'water', groupId: 'sc_lifeline_flood', at: at(f.anchor), text: `积水 ${f.depthCm} cm`, color: STATUS_RAMP[f.status], userId: f.id, lineHeight: 40, fontSize: 12, priority: 4 + f.status })),
        ...data.pumpStations.map(p => pin({ id: 'll-pump-' + p.id, icon: 'pump', groupId: 'sc_lifeline_pump', at: at(p.anchor), text: `${p.name} ${p.running}/${p.total}`, color: STATUS_RAMP[p.status], userId: p.id, lineHeight: 26, fontSize: 12, priority: 2 + p.status }))
      ],
      'drain'
    )

    // 桥梁：健康评分 + 柔和波纹
    const bridgeColor = (score: number) => (bridgeStatus(score) === 0 ? COLOR.ok : COLOR.caution)
    await this.add(
      token,
      'radiationPoint',
      data.bridges.map(b => ripple({ id: 'll-bridge-ripple-' + b.id, groupId: 'sc_lifeline_bridge_ripple', at: this.bridgeXY.get(b.id) as XY, radius: 380, color: bridgeColor(b.score), rings: 2, brightness: 0.45 })),
      'bridge'
    )
    await this.add(
      token,
      'marker',
      data.bridges.map(b => pin({ id: 'll-bridge-' + b.id, icon: 'bridge', groupId: 'sc_lifeline_bridge', at: this.bridgeXY.get(b.id) as XY, text: bridgeText(b), color: bridgeColor(b.score), userId: b.id, lineHeight: lead.get('bridge:' + b.id), priority: 6 })),
      'bridge'
    )

    // 区域供冷：主管 / 支管 + 供冷站（默认关闭）
    await this.add(token, this.pipeType, this.pipes('cooling'), 'cooling')
    await this.add(
      token,
      'marker',
      data.coolingPlants.map(c => pin({ id: 'll-cooling-' + c.id, icon: 'cooling', groupId: 'sc_lifeline_cooling', at: at(c.anchor), text: `${c.name} ${c.loadPercent}%`, color: STATUS_RAMP[c.status], userId: c.id, lineHeight: 34, fontSize: 12, priority: 2 + c.status })),
      'cooling'
    )
  }

  /**
   * 默认打开的几类标注（告警、桥梁、变电站）一起错开引线高度：分图层各自错开的话，彼此还是会叠在一起。
   * 告警按等级在前（排最低一档），桥梁、变电站随后。返回 '类别:id' → lineHeight
   */
  private labelLeads(data: LifelineData): Map<string, number> {
    const at = (anchor: Anchor) => resolveAnchor(this.geo, anchor)
    const items = [
      ...[...data.alarms].sort((x, y) => x.level - y.level).map(a => ({ key: 'alarm:' + a.id, at: this.alarmXY.get(a.id) as XY, width: labelWidth(a.shortTitle, { tag: LEVEL_TEXT[a.level] }) })),
      ...data.bridges.map(b => ({ key: 'bridge:' + b.id, at: this.bridgeXY.get(b.id) as XY, width: labelWidth(bridgeText(b), { icon: true }) })),
      ...data.substations.map(s => ({ key: 'sub:' + s.id, at: at(s.anchor), width: labelWidth(substationText(s), { icon: true }) }))
    ]
    const heights = staggerLabels(items, 40, 34, { camera: this.options.cameraView })
    return new Map(items.map((item, k) => [item.key, heights[k]]))
  }

  /** 离开时恢复底座路网。同步发出，保证排在下一个模块进入时的调用之前 */
  protected async onLeave(): Promise<void> {
    this.entered = false
    await this.applyRoads()
  }

  /** 底座路网：已进入且地下模式打开时隐藏，已进入且在地上时压暗，离开时恢复原样 */
  private async applyRoads(): Promise<void> {
    const hide = this.entered && this.underground
    const dim = this.entered && !this.underground
    if (dim !== this.roadsDimmed) {
      this.roadsDimmed = dim
      await this.options.roads?.setRoadsDimmed?.(dim)
    }
    if (hide === this.roadsHidden) return
    this.roadsHidden = hide
    await this.options.roads?.setRoadsVisible(!hide)
  }

  /** 地下模式：打开时隐藏底座路网，让管网成为画面主体；关闭时恢复。进入前设置也有效 */
  async setUnderground(on: boolean): Promise<void> {
    this.underground = on
    await this.applyRoads()
  }

  /** 选中告警时：在场景里标出与它相关的阀门（低优先级标注，交给引擎避让） */
  async showAlarmContext(alarmId: string): Promise<void> {
    const alarm = this.data?.alarms.find(a => a.id === alarmId)
    const valves = alarm?.analysis?.valves ?? []
    await this.replaceLayer(
      'valve',
      'marker',
      valves.map(v => pin({ id: 'll-valve-' + v.id, icon: 'pump', groupId: 'sc_lifeline_valve', at: resolveAnchor(this.geo, v.anchor), text: `阀门 ${v.name} · ${v.state}`, color: VALVE_COLOR, userId: v.id, lineHeight: 30, fontSize: 12, priority: 3 }))
    )
  }

  /** 影响范围面：有受影响管段时沿管段两侧缓冲，否则以告警点为圆心 */
  impactRing(alarm: LifelineAlarm): XY[] | null {
    const a = alarm.analysis
    if (!a) return null
    if (alarm.segment) return bufferLine(segmentBetween(this.geo, alarm.segment.roadId, alarm.segment.from, alarm.segment.to), a.radius)
    return circleRing(resolveAnchor(this.geo, alarm.anchor), a.radius) as XY[]
  }

  /** 影响分析：画出告警的影响范围（并保证相关阀门已标出）。没有影响分析的告警不画 */
  async showImpact(alarmId: string): Promise<void> {
    const alarm = this.data?.alarms.find(a => a.id === alarmId)
    const ring = alarm ? this.impactRing(alarm) : null
    await Promise.all([
      this.showAlarmContext(alarmId),
      this.replaceLayer('impact', 'polygon', alarm && ring ? [area({ id: 'll-impact-' + alarm.id, groupId: 'sc_lifeline_impact', ring, color: LEVEL_COLOR[alarm.level], fill: 0.16, frameWidth: 10 })] : [])
    ])
  }

  /** 收起影响范围（保留阀门标注） */
  async hideImpact(): Promise<void> {
    await this.replaceLayer('impact', 'polygon', [])
  }

  /** 取消选中：移除阀门标注和影响范围 */
  async clearAlarmContext(): Promise<void> {
    await Promise.all([this.replaceLayer('valve', 'marker', []), this.replaceLayer('impact', 'polygon', [])])
  }

  /** 城市巡航的机位：先看一、二级告警（从重到轻），再看三座桥 */
  tourViews(): number[][] {
    const data = this.data
    if (!data) return []
    const alarms = data.alarms.filter(a => a.level <= 2).sort((a, b) => a.level - b.level || b.time.localeCompare(a.time))
    const points = [...alarms.map(a => this.alarmXY.get(a.id)), ...data.bridges.map(b => this.bridgeXY.get(b.id))]
    return points.flatMap(p => (p ? [focusView(p)] : []))
  }

  /** 飞到某条告警 */
  async focusAlarm(id: string): Promise<void> {
    const p = this.alarmXY.get(id)
    if (p) await this.api.setCamera(focusView(p), 1.5)
  }

  /** 飞到某座桥 */
  async focusBridge(id: string): Promise<void> {
    const p = this.bridgeXY.get(id)
    if (p) await this.api.setCamera(focusView(p, 3600), 1.5)
  }

  /** 飞到某个设施（变电站、调压站、易涝点、泵站、供冷站） */
  async focusAnchor(anchor: Anchor): Promise<void> {
    await this.api.setCamera(focusView(resolveAnchor(this.geo, anchor)), 1.5)
  }
}
