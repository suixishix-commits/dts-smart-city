import { incidentHeatGrid, isActive } from '@/api/mock/security'
import { HeatFieldLayer, sampleHeatField } from '@/scene/heatField'
import { ModuleScene, type SceneEffect } from '@/scene/ModuleScene'
import type { SceneApi } from '@/scene/SceneApi'
import { pointAt, sliceLine, type CityGeo, type XY } from '@/scene/geo'
import { alarmPoints, area, circleRing, COLOR, fence, flowLine, FOCUS_HEIGHT, focusView, frustum, heatmap, LEVEL_COLOR, pin, plainLine, prepareFlowLines, staggerHeights } from '@/scene/kit'
import type { SecurityData, SecurityPeriod } from '@/types/security'

export interface SecuritySceneOptions {
  /** [x, y, z, pitch, yaw]；为 null 时不动相机 */
  cameraView: number[] | null
  /** 热力图垂直范围 [minZ, maxZ] */
  heatmapZ: [number, number]
  /** 效果总包是否可用；不可用时围栏退回范围面、巡逻路线退回普通线、视域退回贴地扇形 */
  pak: boolean
  /** 压暗/恢复底座路网（cityBase.setRoadsDimmed）。本模块有巡逻路线、防护区等大量线面，进入时压暗街道免得混在一起 */
  dimBaseRoads?: (dim: boolean) => Promise<void>
  /** 分级点位材质包是否可用；不可用时警情点用扩散波纹 */
  beacons?: boolean
  /** 热力场材质包是否可用；可用时警情热力用 UE 热力场（换周期交叉淡入淡出），否则用 DTS 热力图 */
  heatField?: boolean
}


/** 警情等级的文字，同右侧列表 */
const LEVEL_TEXT: Record<number, string> = { 1: '一级', 2: '二级', 3: '三级', 4: '四级' }
/** 警情相距多近（米）时错开标注高度 */
const INCIDENT_STAGGER = 1800
/** 图层开关的定义和默认状态，页面和场景共用 */
export const SECURITY_LAYERS: { key: string; name: string; on: boolean }[] = [
  { key: 'fence', name: '重点防护区', on: true },
  { key: 'incident', name: '实时警情', on: true },
  { key: 'patrol', name: '巡逻警力', on: true },
  { key: 'camera', name: '摄像头', on: false },
  { key: 'cone', name: '监控视域', on: false },
  { key: 'heat', name: '警情热力', on: false }
]

/** 标注的 groupId，点击标注时 emitter 派发同名事件 */
export const SECURITY_GROUP = {
  incident: 'sc_security_incident',
  zone: 'sc_security_zone',
  unit: 'sc_security_unit',
  camera: 'sc_security_camera'
} as const

/** 热力网格间距，米 */
const HEAT_STEP = 500
/** 热力场采样网格间距，米 */
const FIELD_STEP = 160
/** 波纹半径按警情等级，米 */
const RIPPLE_RADIUS: Record<number, number> = { 1: 700, 2: 560, 3: 420, 4: 300 }
const GUARD_TEXT: Record<number, string> = { 1: '一级防护', 2: '二级防护', 3: '三级防护' }
/** 摄像头镜头离地高度，米 */
const CAMERA_HEIGHT = 60
/** 视域长度，米 */
const CONE_RANGE = 900
/** 视域水平张角，度（与 kit.frustum 的默认值一致） */
const CONE_HFOV = 60
/** 摄像头没有可对准的警情时，视域朝向的瞄准距离，米 */
const AIM_DISTANCE = 600

/** 贴地扇形：从 from 朝 to 张开 hfov 度、长 range 米。效果总包不可用时代替视锥 */
export function sectorRing(from: number[], to: number[], range = CONE_RANGE, hfov = CONE_HFOV, segments = 12): number[][] {
  const dir = Math.atan2(to[1] - from[1], to[0] - from[0])
  const half = (hfov * Math.PI) / 360
  const arc = Array.from({ length: segments + 1 }, (_, i) => {
    const a = dir - half + (2 * half * i) / segments
    return [from[0] + Math.cos(a) * range, from[1] + Math.sin(a) * range]
  })
  return [[from[0], from[1]], ...arc]
}

/**
 * 公共安全的场景图层：
 * - fence    重点防护区：电子围栏（兜底为范围面）+ 名称与防护等级标注；
 * - incident 实时警情：扩散波纹（半径、颜色按等级）+ 标注；
 * - patrol   巡逻警力：沿真实道路的巡逻路线 + 巡逻单元标注；
 * - camera   摄像头：点位标注（默认关闭）；
 * - cone     监控视域：对准一、二级在办警情的摄像头视锥（兜底为贴地扇形，默认关闭）；
 * - heat     警情热力：随统计周期变化（默认关闭）；
 * 另有不受图层开关控制的「投射」：详情卡片里把某一路摄像头的视域投射到场景，同一时刻只有一路。
 */
export class SecurityScene extends ModuleScene {
  private data: SecurityData | null = null
  private period: SecurityPeriod = 'today'
  /** onEnter 已经创建完图层。在此之前 setPeriod 只记录周期 */
  private entered = false
  private token = 0
  private visible = new Map<string, boolean>(SECURITY_LAYERS.map(l => [l.key, l.on]))
  /** UE 热力场图层；材质包不可用时为 null，用 DTS 热力图 */
  private readonly heatField: HeatFieldLayer | null
  /** 视锥在视域图层第一次显示时才创建，避免默认关闭的图层闪一帧 */
  private conesCreated = false
  /** 当前投射的摄像头 id */
  private projected: string | null = null
  /** 投射用的视锥（效果总包）。兜底的扇形放在 projection 图层里，由基类管理 */
  private projectionEffect: SceneEffect | null = null
  /** 每次投射或取消都 +1，丢弃过期的视锥创建 */
  private projectionToken = 0
  private incidentXY = new Map<string, XY>()
  private zoneXY = new Map<string, XY>()
  private cameraXY = new Map<string, XY>()
  private grid: { xy: number[]; districtId: string }[] = []

  constructor(
    api: SceneApi,
    private readonly geo: CityGeo,
    private readonly options: SecuritySceneOptions
  ) {
    super(api)
    this.heatField = options.heatField ? new HeatFieldLayer(api, { id: 'security-field', groupId: 'sc_security_heat', brightness: 0.85, levels: 5 }) : null
    // 把默认关闭的图层告诉基类（此时图层还没有对象，不会产生场景调用）
    SECURITY_LAYERS.filter(l => !l.on).forEach(l => void super.setLayerVisible(l.key, false))
    if (SECURITY_LAYERS.some(l => l.key === 'heat' && !l.on)) void this.heatField?.setVisible(false)
  }

  /** 进入前设置数据和初始统计周期 */
  setData(data: SecurityData, period: SecurityPeriod) {
    this.data = data
    this.period = period
  }

  protected async onEnter(token: number): Promise<void> {
    this.entered = false
    this.conesCreated = false
    this.token = token
    const data = this.data
    if (!data) return
    const geo = this.geo

    // mock 里的位置都取自 geo.json，直接查投影坐标
    this.incidentXY = new Map(data.incidents.map(i => [i.id, geo.xy(i.position)]))
    this.zoneXY = new Map(data.zones.map(z => [z.id, geo.xy(z.position)]))
    this.cameraXY = new Map(data.cameras.map(c => [c.id, geo.xy(c.position)]))
    this.grid = geo.landGrid(HEAT_STEP)

    if (this.options.cameraView) await this.api.setCamera(this.options.cameraView)
    // 等相机期间可能已经离开：离开时会恢复底座路网，这里不能再把它压暗
    if (!this.isCurrent(token)) return
    await this.options.dimBaseRoads?.(true)

    await this.addZones(token, data)
    await this.addIncidents(token, data)
    await this.addPatrols(token, data)
    await this.add(
      token,
      'marker',
      data.cameras.map(c => pin({ id: 'camera-' + c.id, icon: 'camera', groupId: SECURITY_GROUP.camera, at: this.cameraXY.get(c.id) as XY, text: c.id, color: c.online ? COLOR.accent : COLOR.muted, userId: c.id, lineHeight: 26, fontSize: 11 })),
      'camera'
    )
    // 兜底：贴地扇形交给基类，视域图层关着时不会创建
    if (!this.options.pak) {
      await this.add(token, 'polygon', data.viewCones.flatMap(c => this.coneSector('cone-' + c.cameraId, 'sc_security_cone', c.cameraId)), 'cone')
    }

    if (!this.isCurrent(token)) return
    // 随周期变化的图层最后创建，用进入期间记录的最新周期；此后 setPeriod 直接替换
    this.entered = true
    // 进入期间打开视域图层的，在这里补建视锥；之后由 setLayerVisible 负责
    if (this.visible.get('cone')) await this.createCones(token)
    await this.applyPeriod(data)
  }

  protected async onLeave(): Promise<void> {
    this.entered = false
    this.conesCreated = false
    await this.clearProjection()
    await this.options.dimBaseRoads?.(false)
    await this.heatField?.clear()
  }

  private async addZones(token: number, data: SecurityData): Promise<void> {
    const rings = data.zones.map(z => ({ zone: z, ring: circleRing(this.zoneXY.get(z.id) as XY, z.radius) }))
    if (this.options.pak) {
      for (const { zone, ring } of rings) {
        await this.effect(token, 'fence', () => fence('sc_security_fence_' + zone.id, ring, { height: zone.height, color: COLOR.accent }))
      }
    } else {
      await this.add(token, 'polygon', rings.map(({ zone, ring }) => area({ id: 'zone-area-' + zone.id, groupId: 'sc_security_zone_area', ring, color: COLOR.accent, fill: 0.12 })), 'fence')
    }
    await this.add(
      token,
      'marker',
      data.zones.map(z => pin({ id: 'zone-' + z.id, icon: 'shield', groupId: SECURITY_GROUP.zone, at: this.zoneXY.get(z.id) as XY, text: `${z.name} · ${GUARD_TEXT[z.guardLevel]}`, color: COLOR.accent, userId: z.id, lineHeight: 44, fontSize: 12, priority: 5 })),
      'fence'
    )
  }

  private async addIncidents(token: number, data: SecurityData): Promise<void> {
    const marks = alarmPoints({
      id: 'incident-ripple',
      groupId: 'sc_security_incident_ripple',
      beacons: !!this.options.beacons,
      points: data.incidents.map(i => ({ id: i.id, at: this.incidentXY.get(i.id) as XY, level: i.level, color: LEVEL_COLOR[i.level], radius: RIPPLE_RADIUS[i.level] }))
    })
    await this.add(token, marks.type, marks.objects, 'incident')
    // 等级小标签同右侧「实时警情」列表；挨得近的错开引线高度，级别高的排最低一档
    const bySeverity = [...data.incidents].sort((a, b) => a.level - b.level)
    const heights = staggerHeights(bySeverity.map(i => this.incidentXY.get(i.id) as XY), 60, 34, INCIDENT_STAGGER)
    const lead = new Map(bySeverity.map((i, k) => [i.id, heights[k]]))
    await this.add(
      token,
      'marker',
      data.incidents.map(i =>
        pin({ id: 'incident-' + i.id, groupId: SECURITY_GROUP.incident, at: this.incidentXY.get(i.id) as XY, tag: LEVEL_TEXT[i.level], text: i.title, color: LEVEL_COLOR[i.level], userId: i.id, lineHeight: lead.get(i.id), priority: isActive(i) && i.level <= 2 ? 15 - i.level : 8 - i.level })
      ),
      'incident'
    )
  }

  private async addPatrols(token: number, data: SecurityData): Promise<void> {
    let flow = this.options.pak
    if (flow) {
      try {
        await prepareFlowLines()
      } catch (e) {
        console.warn('[SecurityScene] 流动线适配库加载失败，巡逻路线改用普通线', e)
        flow = false
      }
    }
    const lines: { id: string }[] = []
    const units: { id: string }[] = []
    for (const route of data.patrols) {
      const road = this.geo.road(route.roadId)
      if (!road) continue
      const path = sliceLine(road.line, route.from, route.to)
      const o = { id: 'patrol-' + route.id, groupId: 'sc_security_patrol', path, color: COLOR.ok, width: 40, height: 16 }
      lines.push(flow ? flowLine({ ...o, style: 'dash', spacing: 110, speed: 0.2, brightness: 1 }) : plainLine({ ...o, brightness: 1 }))
      for (const u of route.units) {
        units.push(pin({ id: 'unit-' + u.id, icon: 'person', groupId: SECURITY_GROUP.unit, at: pointAt(path, u.at), text: u.id, color: COLOR.ok, userId: u.id, lineHeight: 16, fontSize: 11, priority: -1 }))
      }
    }
    await this.add(token, 'polyline', lines, 'patrol')
    await this.add(token, 'marker', units, 'patrol')
  }

  /** 摄像头视域：镜头在摄像头上方，瞄准警情点。需要效果总包（兜底的扇形在 onEnter 里交给基类） */
  private async createCones(token: number): Promise<void> {
    const data = this.data
    if (!this.options.pak || this.conesCreated || !data) return
    this.conesCreated = true
    for (const cone of data.viewCones) {
      const from = this.cameraXY.get(cone.cameraId)
      const to = this.incidentXY.get(cone.incidentId)
      if (!from || !to) continue
      await this.effect(token, 'cone', () => frustum('sc_security_cone_' + cone.cameraId, [from[0], from[1], CAMERA_HEIGHT], [to[0], to[1], 0], { range: CONE_RANGE }))
    }
  }

  /**
   * 摄像头的瞄准点（投影坐标）：有视域的对准它的警情；否则对准 150–2500 米内最近的警情；
   * 都没有时朝一个按摄像头序号固定的方向。找不到摄像头返回 null。
   */
  cameraTarget(cameraId: string): XY | null {
    const data = this.data
    const from = this.cameraXY.get(cameraId)
    if (!data || !from) return null
    const cone = data.viewCones.find(c => c.cameraId === cameraId)
    const coned = cone && this.incidentXY.get(cone.incidentId)
    if (coned) return coned
    const near = data.incidents
      .map(i => ({ xy: this.incidentXY.get(i.id) as XY, active: isActive(i) }))
      .filter(x => x.xy)
      .map(x => ({ ...x, d: Math.hypot(x.xy[0] - from[0], x.xy[1] - from[1]) }))
      .filter(x => x.d >= 150 && x.d <= 2500)
      .sort((a, b) => Number(b.active) - Number(a.active) || a.d - b.d)[0]
    if (near) return near.xy
    const index = data.cameras.findIndex(c => c.id === cameraId)
    const angle = (index * 137.5 * Math.PI) / 180
    return [from[0] + Math.cos(angle) * AIM_DISTANCE, from[1] + Math.sin(angle) * AIM_DISTANCE]
  }

  /** 某路摄像头视域的贴地扇形（kit.area）；找不到摄像头时返回空数组 */
  private coneSector(id: string, groupId: string, cameraId: string): { id: string }[] {
    const from = this.cameraXY.get(cameraId)
    const to = this.cameraTarget(cameraId)
    if (!from || !to) return []
    return [area({ id, groupId, ring: sectorRing(from, to), color: COLOR.accent, fill: 0.22, frameWidth: 8 })]
  }

  /** 当前投射的摄像头 id；没有投射时为 null */
  projectedCamera(): string | null {
    return this.projected
  }

  /**
   * 把某路摄像头的视域投射到场景（同一时刻只有一路，再次投射会替换）。
   * 效果总包可用时画视锥，不可用或创建失败时画贴地扇形。返回是否投射成功。
   */
  async projectCamera(cameraId: string): Promise<boolean> {
    // 先领令牌再等待：等待期间的取消或新的投射会让这次作废
    const token = ++this.projectionToken
    this.projected = null
    await this.removeProjection()
    const from = this.cameraXY.get(cameraId)
    const to = this.cameraTarget(cameraId)
    if (token !== this.projectionToken || !this.entered || !from || !to) return false
    this.projected = cameraId
    if (this.options.pak) {
      try {
        const effect = await frustum('sc_security_projection_' + cameraId, [from[0], from[1], CAMERA_HEIGHT], [to[0], to[1], 0], { range: CONE_RANGE })
        if (token !== this.projectionToken || !this.entered) {
          await effect.remove()
          return false
        }
        this.projectionEffect = effect
        return true
      } catch (e) {
        console.warn('[SecurityScene] 视锥创建失败，投射改用贴地扇形', e)
        if (token !== this.projectionToken) return false
      }
    }
    await this.replaceLayer('projection', 'polygon', this.coneSector('projection-' + cameraId, 'sc_security_projection', cameraId))
    return token === this.projectionToken
  }

  /** 取消投射（也会作废进行中的投射） */
  async clearProjection(): Promise<void> {
    this.projectionToken++
    this.projected = null
    await this.removeProjection()
  }

  /** 删除场景里的投射对象，不动令牌 */
  private async removeProjection(): Promise<void> {
    const effect = this.projectionEffect
    this.projectionEffect = null
    if (effect) await effect.remove().catch(e => console.error('[SecurityScene] 删除投射视锥失败', e))
    await this.replaceLayer('projection', 'polygon', [])
  }

  /** 切换统计周期（影响警情热力）。进入完成前只记录，由 onEnter 应用最新值 */
  async setPeriod(period: SecurityPeriod): Promise<void> {
    this.period = period
    if (!this.entered || !this.data) return
    await this.applyPeriod(this.data)
  }

  private async applyPeriod(data: SecurityData): Promise<void> {
    // 今日只看在办警情；更长的周期里已办结的也留有痕迹
    const incidents = data.incidents.filter(i => this.period !== 'today' || isActive(i)).map(i => ({ level: i.level, xy: this.incidentXY.get(i.id) as XY }))
    const points = incidentHeatGrid(this.period, this.grid, this.geo.districts, incidents, HEAT_STEP)
    if (this.heatField) {
      await this.heatField.show(sampleHeatField({ points, range: [0, 1], step: FIELD_STEP }))
      return
    }
    await this.replaceLayer('heat', 'heatmap', points.length ? [heatmap({ id: 'security-heat', groupId: 'sc_security_heat', points, range: [0, 1], z: this.options.heatmapZ })] : [])
  }

  /** 图层开关。视域图层第一次打开时补建视锥 */
  async setLayerVisible(layer: string, visible: boolean): Promise<void> {
    this.visible.set(layer, visible)
    await super.setLayerVisible(layer, visible)
    if (layer === 'heat') await this.heatField?.setVisible(visible)
    if (layer === 'cone' && visible && this.entered) await this.createCones(this.token)
  }

  /** 城市巡航的机位：先看五个重点防护区，再看最严重的三条在办警情 */
  tourViews(): number[][] {
    const data = this.data
    if (!data) return []
    const zones = data.zones.flatMap(z => {
      const p = this.zoneXY.get(z.id)
      return p ? [focusView(p, 3600)] : []
    })
    const incidents = data.incidents
      .filter(isActive)
      .sort((a, b) => a.level - b.level)
      .slice(0, 3)
      .flatMap(i => {
        const p = this.incidentXY.get(i.id)
        return p ? [focusView(p)] : []
      })
    return [...zones, ...incidents]
  }

  /** 飞到某条警情 */
  async focusIncident(id: string): Promise<void> {
    await this.flyTo(this.incidentXY.get(id), FOCUS_HEIGHT)
  }

  /** 飞到某个重点防护区 */
  async focusZone(id: string): Promise<void> {
    await this.flyTo(this.zoneXY.get(id), 3600)
  }

  /** 飞到某个片区（片区质心，3600 米） */
  async focusDistrict(id: string): Promise<void> {
    const d = this.geo.district(id)
    await this.flyTo(d ? this.geo.xy(d.centroid) : undefined, 3600)
  }

  /** 飞到某个摄像头 */
  async focusCamera(id: string): Promise<void> {
    await this.flyTo(this.cameraXY.get(id), 2400)
  }

  private async flyTo(p: number[] | undefined, height: number): Promise<void> {
    if (p) await this.api.setCamera(focusView(p, height), 1.5)
  }
}
