import { incidentHeatGrid, isActive } from '@/api/mock/security'
import { ModuleScene } from '@/scene/ModuleScene'
import type { SceneApi } from '@/scene/SceneApi'
import { pointAt, sliceLine, type CityGeo, type XY } from '@/scene/geo'
import { area, circleRing, COLOR, fence, flowLine, frustum, heatmap, LEVEL_COLOR, pin, plainLine, prepareFlowLines, ripple } from '@/scene/kit'
import type { SecurityData, SecurityPeriod } from '@/types/security'

export interface SecuritySceneOptions {
  /** [x, y, z, pitch, yaw]；为 null 时不动相机 */
  cameraView: number[] | null
  /** 热力图垂直范围 [minZ, maxZ] */
  heatmapZ: [number, number]
  /** 效果总包是否可用；不可用时围栏退回范围面、巡逻路线退回普通线、不画视域 */
  pak: boolean
}

/** 图层开关的定义和默认状态，页面和场景共用 */
export const SECURITY_LAYERS: { key: string; name: string; on: boolean }[] = [
  { key: 'fence', name: '重点防护区', on: true },
  { key: 'incident', name: '实时警情', on: true },
  { key: 'patrol', name: '巡逻警力', on: true },
  { key: 'camera', name: '摄像头', on: false },
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
/** 波纹半径按警情等级，米 */
const RIPPLE_RADIUS: Record<number, number> = { 1: 700, 2: 560, 3: 420, 4: 300 }
const GUARD_TEXT: Record<number, string> = { 1: '一级防护', 2: '二级防护', 3: '三级防护' }
/** 摄像头镜头离地高度，米 */
const CAMERA_HEIGHT = 60
/** 视域长度，米 */
const CONE_RANGE = 900

/** 从西南方向俯瞰某一点的机位，height 为相机高度 */
function viewOf(p: number[], height: number): number[] {
  return [p[0] - height * 0.68, p[1] - height * 0.86, height, -38, -38]
}

/**
 * 公共安全的场景图层：
 * - fence    重点防护区：电子围栏（兜底为范围面）+ 名称与防护等级标注；
 * - incident 实时警情：扩散波纹（半径、颜色按等级）+ 标注；
 * - patrol   巡逻警力：沿真实道路的巡逻路线 + 巡逻单元标注；
 * - camera   摄像头：点位标注；对准一、二级在办警情的摄像头另画视域（默认关闭）；
 * - heat     警情热力：随统计周期变化（默认关闭）。
 */
export class SecurityScene extends ModuleScene {
  private data: SecurityData | null = null
  private period: SecurityPeriod = 'today'
  /** onEnter 已经创建完图层。在此之前 setPeriod 只记录周期 */
  private entered = false
  private token = 0
  private visible = new Map<string, boolean>(SECURITY_LAYERS.map(l => [l.key, l.on]))
  /** 视域在摄像头图层第一次显示时才创建，避免默认关闭的图层闪一帧 */
  private conesCreated = false
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
    // 把默认关闭的图层告诉基类（此时图层还没有对象，不会产生场景调用）
    SECURITY_LAYERS.filter(l => !l.on).forEach(l => void super.setLayerVisible(l.key, false))
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

    await this.addZones(token, data)
    await this.addIncidents(token, data)
    await this.addPatrols(token, data)
    await this.add(
      token,
      'marker',
      data.cameras.map(c => pin({ id: 'camera-' + c.id, groupId: SECURITY_GROUP.camera, at: this.cameraXY.get(c.id) as XY, text: c.id, color: c.online ? COLOR.accent : COLOR.muted, userId: c.id, lineHeight: 26, fontSize: 11 })),
      'camera'
    )

    if (!this.isCurrent(token)) return
    // 随周期变化的图层最后创建，用进入期间记录的最新周期；此后 setPeriod 直接替换
    this.entered = true
    // 进入期间打开摄像头图层的，在这里补建视域；之后由 setLayerVisible 负责
    if (this.visible.get('camera')) await this.createCones(token)
    await this.applyPeriod(data)
  }

  protected async onLeave(): Promise<void> {
    this.entered = false
    this.conesCreated = false
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
      data.zones.map(z => pin({ id: 'zone-' + z.id, groupId: SECURITY_GROUP.zone, at: this.zoneXY.get(z.id) as XY, text: `${z.name} · ${GUARD_TEXT[z.guardLevel]}`, color: COLOR.accent, userId: z.id, lineHeight: 44, fontSize: 12, priority: 5 })),
      'fence'
    )
  }

  private async addIncidents(token: number, data: SecurityData): Promise<void> {
    await this.add(
      token,
      'radiationPoint',
      data.incidents.map(i => ripple({ id: 'incident-ripple-' + i.id, groupId: 'sc_security_incident_ripple', at: this.incidentXY.get(i.id) as XY, radius: RIPPLE_RADIUS[i.level], color: LEVEL_COLOR[i.level] })),
      'incident'
    )
    await this.add(
      token,
      'marker',
      data.incidents.map(i => pin({ id: 'incident-' + i.id, groupId: SECURITY_GROUP.incident, at: this.incidentXY.get(i.id) as XY, text: i.title, color: LEVEL_COLOR[i.level], userId: i.id, lineHeight: 60, priority: 15 - i.level })),
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
      lines.push(flow ? flowLine({ ...o, style: 'dash', spacing: 110, speed: 0.2, brightness: 2 }) : plainLine({ ...o, brightness: 1.2 }))
      for (const u of route.units) {
        units.push(pin({ id: 'unit-' + u.id, groupId: SECURITY_GROUP.unit, at: pointAt(path, u.at), text: `${u.id} ${u.kind}`, color: COLOR.ok, userId: u.id, lineHeight: 22, fontSize: 11 }))
      }
    }
    await this.add(token, 'polyline', lines, 'patrol')
    await this.add(token, 'marker', units, 'patrol')
  }

  /** 摄像头视域：镜头在摄像头上方，瞄准警情点。需要效果总包 */
  private async createCones(token: number): Promise<void> {
    const data = this.data
    if (!this.options.pak || this.conesCreated || !data) return
    this.conesCreated = true
    for (const cone of data.viewCones) {
      const from = this.cameraXY.get(cone.cameraId)
      const to = this.incidentXY.get(cone.incidentId)
      if (!from || !to) continue
      await this.effect(token, 'camera', () => frustum('sc_security_cone_' + cone.cameraId, [from[0], from[1], CAMERA_HEIGHT], [to[0], to[1], 0], { range: CONE_RANGE }))
    }
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
    await this.replaceLayer('heat', 'heatmap', points.length ? [heatmap({ id: 'security-heat', groupId: 'sc_security_heat', points, range: [0, 1], z: this.options.heatmapZ })] : [])
  }

  /** 图层开关。摄像头图层第一次打开时补建视域 */
  async setLayerVisible(layer: string, visible: boolean): Promise<void> {
    this.visible.set(layer, visible)
    await super.setLayerVisible(layer, visible)
    if (layer === 'camera' && visible && this.entered) await this.createCones(this.token)
  }

  /** 城市巡航的机位：先看五个重点防护区，再看最严重的三条在办警情 */
  tourViews(): number[][] {
    const data = this.data
    if (!data) return []
    const zones = data.zones.flatMap(z => {
      const p = this.zoneXY.get(z.id)
      return p ? [viewOf(p, 2000)] : []
    })
    const incidents = data.incidents
      .filter(isActive)
      .sort((a, b) => a.level - b.level)
      .slice(0, 3)
      .flatMap(i => {
        const p = this.incidentXY.get(i.id)
        return p ? [viewOf(p, 1500)] : []
      })
    return [...zones, ...incidents]
  }

  /** 飞到某条警情 */
  async focusIncident(id: string): Promise<void> {
    await this.flyTo(this.incidentXY.get(id), 1400)
  }

  /** 飞到某个重点防护区 */
  async focusZone(id: string): Promise<void> {
    await this.flyTo(this.zoneXY.get(id), 1900)
  }

  /** 飞到某个摄像头 */
  async focusCamera(id: string): Promise<void> {
    await this.flyTo(this.cameraXY.get(id), 900)
  }

  private async flyTo(p: number[] | undefined, height: number): Promise<void> {
    if (p) await this.api.setCamera(viewOf(p, height), 1.5)
  }
}
