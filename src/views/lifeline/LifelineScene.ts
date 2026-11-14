import { bridgeStatus } from '@/api/mock/lifeline'
import { ModuleScene } from '@/scene/ModuleScene'
import type { SceneApi } from '@/scene/SceneApi'
import type { CityGeo, XY } from '@/scene/geo'
import { sliceLine } from '@/scene/geo'
import { area, circleRing, COLOR, flowLine, focusView, LEVEL_COLOR, pin, plainLine, prepareFlowLines, RAMP, ripple, STATUS_RAMP } from '@/scene/kit'
import type { LifelineData, PipeSegment, PipeSystem } from '@/types/lifeline'
import { resolveAnchor, segmentBetween } from './anchor'

export interface LifelineSceneOptions {
  /** [x, y, z, pitch, yaw]；为 null 时不动相机 */
  cameraView: number[] | null
  /** 效果总包是否可用；不可用时管线退回普通发光线 */
  pak: boolean
  /** 底座路网的开关（传 cityBase）：进入时隐藏、离开时恢复，让管网看得清 */
  roads?: { setRoadsVisible(visible: boolean): Promise<void> }
}

/** 各管网的离地高度（米）：错开后彼此不闪面，也不和底座路网闪面 */
export const PIPE_HEIGHT: Record<PipeSystem, number> = { drain: 16, water: 20, gas: 28, power: 36 }
/** 受影响管段画在供水管之上 */
const ALARM_PIPE_HEIGHT = 24
/** 排水管的颜色：比供水更暗的蓝 */
export const DRAIN_COLOR = RAMP[1]
/** 各管网的颜色（图例与此一致） */
export const PIPE_COLOR: Record<PipeSystem, string> = { water: COLOR.accent, power: COLOR.ice, gas: COLOR.warn, drain: DRAIN_COLOR }
/** 告警波纹半径，米 */
const ALARM_RADIUS: Record<number, number> = { 1: 700, 2: 520, 3: 400, 4: 300 }
const LEVEL_TEXT: Record<number, string> = { 1: '一级', 2: '二级', 3: '三级', 4: '四级' }

/** 图层开关的六个键 */
export const LIFELINE_LAYERS = ['water', 'power', 'alarm', 'gas', 'drain', 'bridge'] as const

/**
 * 城市生命线的场景图层（管线都沿真实道路敷设）：
 * - water  供水：主干管（脉冲粒子流）+ 配水干管（粒子流）；
 * - power  电力：电缆（流动虚线）+ 变电站标注（按负荷率着色）；
 * - alarm  运行告警：波纹 + 标注 + 受影响管段（红色重绘）；
 * - gas    燃气：中压管（暖色虚线，亮度压低）+ 调压站标注；
 * - drain  排水与内涝：排水管 + 易涝点范围面和水深标注 + 泵站标注；
 * - bridge 桥梁：健康评分标注 + 柔和波纹。
 */
export class LifelineScene extends ModuleScene {
  private data: LifelineData | null = null
  private alarmXY = new Map<string, XY>()
  private bridgeXY = new Map<string, XY>()
  private hidden = new Set<string>()
  /** 本次进入是否隐藏了底座路网 */
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

  /** 一段管线的场景对象：有效果总包用流动线，没有则用普通发光线 */
  private pipe(p: PipeSegment): { id: string } {
    const trunk = p.grade === 'trunk'
    const base = { id: 'll-pipe-' + p.id, groupId: 'sc_lifeline_' + p.system, path: this.path(p), color: PIPE_COLOR[p.system], height: PIPE_HEIGHT[p.system] }
    if (p.system === 'drain') return plainLine({ ...base, width: trunk ? 70 : 50, brightness: 0.9, alpha: 0.85 })
    if (p.system === 'water') {
      const o = { ...base, width: trunk ? 100 : 56, brightness: trunk ? 2.6 : 1.6 }
      return this.options.pak ? flowLine({ ...o, style: trunk ? 'pulse' : 'particles', spacing: trunk ? 150 : 110, speed: trunk ? 0.3 : 0.22 }) : plainLine({ ...o, flow: true })
    }
    if (p.system === 'power') {
      const o = { ...base, width: trunk ? 76 : 50, brightness: trunk ? 1.8 : 1.3 }
      return this.options.pak ? flowLine({ ...o, style: 'dash', spacing: trunk ? 220 : 160, speed: 0.34 }) : plainLine({ ...o, flow: true })
    }
    // 燃气是唯一的暖色管网，亮度压低，不抢告警的注意力
    const o = { ...base, width: 50, brightness: 0.9 }
    return this.options.pak ? flowLine({ ...o, style: 'dash', spacing: 180, speed: 0.18 }) : plainLine({ ...o, alpha: 0.8 })
  }

  private pipes(system: PipeSystem): { id: string }[] {
    return (this.data?.pipes ?? []).filter(p => p.system === system).map(p => this.pipe(p))
  }

  protected async onEnter(token: number): Promise<void> {
    const data = this.data
    if (!data) return
    const geo = this.geo
    const at = (anchor: Parameters<typeof resolveAnchor>[1]) => resolveAnchor(geo, anchor)

    if (this.options.cameraView) await this.api.setCamera(this.options.cameraView)
    if (!this.isCurrent(token)) return
    this.roadsHidden = true
    await this.options.roads?.setRoadsVisible(false)
    if (this.options.pak) await prepareFlowLines()

    // 供水
    await this.add(token, 'polyline', this.pipes('water'), 'water')

    // 电力：电缆 + 变电站
    await this.add(token, 'polyline', this.pipes('power'), 'power')
    await this.add(
      token,
      'marker',
      data.substations.map(s =>
        pin({ id: 'll-sub-' + s.id, groupId: 'sc_lifeline_substation', at: at(s.anchor), text: s.status ? `${s.name} ${s.loadPercent}%` : `${s.loadPercent}%`, color: STATUS_RAMP[s.status], userId: s.id, lineHeight: 30, fontSize: 12, priority: 2 + s.status })
      ),
      'power'
    )

    // 运行告警：受影响管段 + 波纹 + 标注
    await this.add(
      token,
      'polyline',
      data.alarms.flatMap(a => {
        if (!a.segment) return []
        const o = { id: 'll-alarm-pipe-' + a.id, groupId: 'sc_lifeline_alarm_pipe', path: segmentBetween(geo, a.segment.roadId, a.segment.from, a.segment.to), color: COLOR.danger, width: 80, brightness: 3, height: ALARM_PIPE_HEIGHT }
        return [this.options.pak ? flowLine({ ...o, style: 'pulse', spacing: 140, speed: 0.4 }) : plainLine({ ...o, flow: true })]
      }),
      'alarm'
    )
    await this.add(
      token,
      'radiationPoint',
      data.alarms.map(a => ripple({ id: 'll-alarm-ripple-' + a.id, groupId: 'sc_lifeline_alarm_ripple', at: this.alarmXY.get(a.id) as XY, radius: ALARM_RADIUS[a.level], color: LEVEL_COLOR[a.level], brightness: a.level <= 2 ? 0.9 : 0.6 })),
      'alarm'
    )
    await this.add(
      token,
      'marker',
      data.alarms.map(a =>
        pin({ id: 'll-alarm-' + a.id, groupId: 'sc_lifeline_alarm', at: this.alarmXY.get(a.id) as XY, text: `${LEVEL_TEXT[a.level]} · ${a.shortTitle}`, color: LEVEL_COLOR[a.level], userId: a.id, lineHeight: 60, priority: a.level <= 2 ? 20 - a.level : 9 - a.level })
      ),
      'alarm'
    )

    // 燃气：管线 + 调压站（默认关闭）
    await this.add(token, 'polyline', this.pipes('gas'), 'gas')
    await this.add(
      token,
      'marker',
      data.gasStations.map(g => pin({ id: 'll-gas-' + g.id, groupId: 'sc_lifeline_gas', at: at(g.anchor), text: `${g.name} ${g.outletKpa} kPa`, color: STATUS_RAMP[g.status], userId: g.id, lineHeight: 30, fontSize: 12, priority: 2 + g.status })),
      'gas'
    )

    // 排水与内涝：管线 + 易涝点 + 泵站（默认关闭）
    await this.add(token, 'polyline', this.pipes('drain'), 'drain')
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
        ...data.floodPoints.map(f => pin({ id: 'll-flood-' + f.id, groupId: 'sc_lifeline_flood', at: at(f.anchor), text: `积水 ${f.depthCm} cm`, color: STATUS_RAMP[f.status], userId: f.id, lineHeight: 40, fontSize: 12, priority: 4 + f.status })),
        ...data.pumpStations.map(p => pin({ id: 'll-pump-' + p.id, groupId: 'sc_lifeline_pump', at: at(p.anchor), text: `${p.name} ${p.running}/${p.total}`, color: STATUS_RAMP[p.status], userId: p.id, lineHeight: 26, fontSize: 12, priority: 2 + p.status }))
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
      data.bridges.map(b => pin({ id: 'll-bridge-' + b.id, groupId: 'sc_lifeline_bridge', at: this.bridgeXY.get(b.id) as XY, text: `${b.name} ${b.score} 分`, color: bridgeColor(b.score), userId: b.id, lineHeight: 44, priority: 6 })),
      'bridge'
    )
  }

  /** 离开时恢复底座路网。同步发出，保证排在下一个模块进入时的调用之前 */
  protected async onLeave(): Promise<void> {
    if (!this.roadsHidden) return
    this.roadsHidden = false
    await this.options.roads?.setRoadsVisible(true)
  }

  /** 图层开关；同时记录状态，定位时据此决定是聚焦标注还是直接飞相机 */
  async setLayerVisible(layer: string, visible: boolean): Promise<void> {
    if (visible) this.hidden.delete(layer)
    else this.hidden.add(layer)
    await super.setLayerVisible(layer, visible)
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
}
