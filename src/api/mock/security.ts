import { pointAt, sliceLine } from '@/scene/geo'
import type { GeoData, LonLat } from '@/types/geo'
import type {
  AiAlarm,
  AiAlarmStatus,
  AiAlarmType,
  CityEvent,
  Department,
  DepartmentEfficiency,
  DistrictEvents,
  EventStage,
  EventStats,
  FlowStep,
  GuardZone,
  Incident,
  IncidentStatus,
  IncidentStep,
  IncidentTrend,
  IncidentType,
  PatrolRoute,
  PatrolUnit,
  PatrolUnitKind,
  SecurityCamera,
  SecurityData,
  SecurityPeriod,
  ViewCone
} from '@/types/security'
import type { AlarmLevel } from '@/types/smartCity'

/** 警情类型，面板和场景按这个顺序展示 */
export const INCIDENT_TYPES: IncidentType[] = ['治安', '求助', '人员聚集', '火情', '可疑物品']
/** 各类型在全部警情里的占比（合计 1） */
const TYPE_SHARE: Record<IncidentType, number> = { 治安: 0.34, 求助: 0.28, 人员聚集: 0.16, 火情: 0.12, 可疑物品: 0.1 }

/** 确定性伪随机 0–1：同样的输入每次得到同样的值 */
function noise(a: number, b: number): number {
  const s = Math.sin(a * 0.0127 + b * 0.0311) * 43758.5453
  return s - Math.floor(s)
}

/** 经纬度 → 近似的平面米坐标。只用于 mock 内部比较距离，不用于场景定位 */
function toMeters(p: number[]): [number, number] {
  return [(p[0] - 54.39) * 101334, (p[1] - 24.457) * 110600]
}

/** 两个经纬度之间的近似距离，米 */
export function distanceMeters(a: number[], b: number[]): number {
  const [ax, ay] = toMeters(a)
  const [bx, by] = toMeters(b)
  return Math.hypot(ax - bx, ay - by)
}

/** 一天中的分钟数 → HH:mm（跨零点时回绕） */
function clock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
}

// ---------- 重点防护区 ----------

const ZONE_DEFS: { id: string; radius: number; height: number; guardLevel: 1 | 2 | 3; guards: number }[] = [
  { id: 'emirates-palace', radius: 450, height: 160, guardLevel: 1, guards: 32 },
  { id: 'qasr-al-watan', radius: 500, height: 200, guardLevel: 1, guards: 36 },
  { id: 'grand-mosque', radius: 600, height: 180, guardLevel: 2, guards: 28 },
  { id: 'bateen-airport', radius: 550, height: 140, guardLevel: 2, guards: 24 },
  { id: 'mina-zayed', radius: 400, height: 120, guardLevel: 3, guards: 16 }
]
/** 防护区周边多远以内有一、二级在办警情时转入「加强警戒」，米 */
const ALERT_DISTANCE = 2500

// ---------- 巡逻 ----------

const ROUTE_DEFS: { id: string; roadId: string; from: number; to: number }[] = [
  { id: 'R1', roadId: 'corniche', from: 0, to: 1 },
  { id: 'R2', roadId: 'hamdan', from: 0.2, to: 0.8 },
  { id: 'R3', roadId: 'salam', from: 0, to: 0.5 },
  { id: 'R4', roadId: 'khaleej', from: 0.08, to: 0.6 },
  { id: 'R5', roadId: 'muroor', from: 0.4, to: 0.95 }
]
const UNIT_KINDS: PatrolUnitKind[] = ['警车', '摩托', '步巡']
const UNIT_CREW: Record<PatrolUnitKind, number> = { 警车: 4, 摩托: 2, 步巡: 6 }
/** 每条路线上的巡逻单元位置（路线上的比例） */
const UNIT_AT = [0.15, 0.5, 0.85]

// ---------- 警情 ----------

interface IncidentDef {
  id: string
  type: IncidentType
  level: AlarmLevel
  /** 发生地点：地标 id 或路口 id，二选一 */
  landmark?: string
  intersection?: string
  title: string
  description: string
  status: IncidentStatus
  /** 接警距现在的分钟数 */
  ago: number
  /** 接警后多少分钟到场；未到场为 null */
  arrive: number | null
  /** 接警后多少分钟办结；未办结为 null */
  close: number | null
  /** 除巡逻单元外另外派出的力量 */
  extra: string[]
  /** 派出的巡逻单元数 */
  patrols: number
}

const INCIDENT_DEFS: IncidentDef[] = [
  { id: 'inc-01', type: '人员聚集', level: 1, landmark: 'corniche-beach', title: '海滩入口人员聚集', description: '海滩东入口聚集约 1,200 人，通道拥堵，已启动分流并限制入场。', status: '处置中', ago: 26, arrive: 4, close: null, extra: ['特勤 T-02'], patrols: 2 },
  { id: 'inc-02', type: '火情', level: 2, landmark: 'wtc', title: '商场后厨起火', description: '二层餐饮后厨烟道起火，明火已压制，正在排烟并疏散该层人员。', status: '处置中', ago: 14, arrive: 6, close: null, extra: ['消防 F-03', '消防 F-07', '急救 A-11'], patrols: 1 },
  { id: 'inc-03', type: '可疑物品', level: 2, landmark: 'bus-station', title: '候车厅发现无主行李', description: '候车厅 B 区发现无人认领的行李箱，已拉起警戒线，排爆组在途。', status: '处置中', ago: 9, arrive: null, close: null, extra: ['排爆 E-01'], patrols: 1 },
  { id: 'inc-04', type: '治安', level: 3, intersection: 'falah-muroor', title: '路口纠纷', description: '两车剐蹭后双方发生争执并阻塞右转车道，巡逻单元正在现场调解。', status: '处置中', ago: 38, arrive: 7, close: null, extra: [], patrols: 1 },
  { id: 'inc-05', type: '求助', level: 4, landmark: 'umm-al-emarat-park', title: '儿童走失求助', description: '家长报称一名 6 岁儿童在公园游乐区附近走失，等待派单。', status: '待派单', ago: 4, arrive: null, close: null, extra: [], patrols: 0 },
  { id: 'inc-06', type: '治安', level: 4, intersection: 'saada-airport', title: '噪音扰民', description: '沿街店铺外放音响扰民，已现场劝止并登记。', status: '已办结', ago: 71, arrive: 5, close: 32, extra: [], patrols: 1 },
  { id: 'inc-07', type: '求助', level: 4, landmark: 'adnec', title: '游客身体不适', description: '展馆入口一名游客中暑，已由急救单元处置并送医。', status: '已办结', ago: 52, arrive: 8, close: 25, extra: ['急救 A-06'], patrols: 1 }
]

/** 接警后多少分钟派单 */
const DISPATCH_AFTER = 2

function timelineOf(def: IncidentDef, reportedAt: number): IncidentStep[] {
  const dispatched = def.status !== '待派单'
  const arrived = def.arrive !== null
  const closed = def.close !== null
  const step = (name: string, done: boolean, after: number): IncidentStep => ({ name, done, time: done ? clock(reportedAt + after) : '' })
  return [
    step('接警', true, 0),
    step('派单', dispatched, DISPATCH_AFTER),
    step('到场', arrived, def.arrive ?? 0),
    step('处置', arrived, (def.arrive ?? 0) + 1),
    step('办结', closed, def.close ?? 0)
  ]
}

/** 路口名改写成「某街与某街口」 */
function crossingName(name: string): string {
  return name.replace(' / ', '与') + '口'
}

/** 摄像头：全部地标 + 次干路和哈姆丹街上的路口，共约 40 路 */
function buildCameras(geo: GeoData): SecurityCamera[] {
  const crossRoads = new Set(geo.roads.filter(r => r.direction === 'cross' && (r.level === 2 || r.id === 'hamdan')).map(r => r.id))
  const spots: { name: string; position: LonLat }[] = [
    ...geo.landmarks.map(l => ({ name: l.name, position: l.position })),
    ...geo.intersections.filter(i => crossRoads.has(i.roads[0])).map(i => ({ name: crossingName(i.name), position: i.position }))
  ]
  return spots.map((s, i) => ({
    id: 'CAM-' + String(101 + i).padStart(4, '0'),
    name: s.name,
    position: s.position,
    // 约一成离线，位置固定
    online: i % 9 !== 4
  }))
}

function buildPatrols(geo: GeoData): PatrolRoute[] {
  let n = 0
  return ROUTE_DEFS.flatMap(def => {
    const road = geo.roads.find(r => r.id === def.roadId)
    if (!road) return []
    const units: PatrolUnit[] = UNIT_AT.map((at, i) => {
      n += 1
      const kind = UNIT_KINDS[(n + i) % UNIT_KINDS.length]
      return { id: 'P-' + String(n).padStart(2, '0'), kind, at, crew: UNIT_CREW[kind], status: '巡逻中' }
    })
    return [{ id: def.id, name: road.name + '巡线', roadId: def.roadId, from: def.from, to: def.to, units }]
  })
}

/** 巡逻单元的近似经纬度（在道路的经纬度折线上按比例取点），只用来找离警情最近的单元 */
function unitPositions(geo: GeoData, patrols: PatrolRoute[]): { unit: PatrolUnit; position: number[] }[] {
  return patrols.flatMap(route => {
    const road = geo.roads.find(r => r.id === route.roadId)
    if (!road) return []
    const line = sliceLine(road.path, route.from, route.to)
    return route.units.map(unit => ({ unit, position: pointAt(line, unit.at) }))
  })
}

/** 是否还在办（未办结） */
export function isActive(incident: Pick<Incident, 'status'>): boolean {
  return incident.status !== '已办结'
}

/**
 * 生成公共安全模块的全部数据。位置全部取自 geo.json 的地标、路口和道路；
 * nowHour 是当前时刻（小时，可带小数），警情的时间都相对它推算。
 */
export function buildSecurityData(geo: GeoData, nowHour = 14.5): SecurityData {
  const now = nowHour * 60
  const cameras = buildCameras(geo)
  const patrols = buildPatrols(geo)
  const unitSpots = unitPositions(geo, patrols)
  const usedUnits = new Set<string>()

  const incidents: Incident[] = INCIDENT_DEFS.flatMap(def => {
    const spot = def.landmark ? geo.landmarks.find(l => l.id === def.landmark) : geo.intersections.find(i => i.id === def.intersection)
    if (!spot) return []
    const place = def.landmark ? spot.name : crossingName(spot.name)
    const reportedAt = now - def.ago
    // 就近派出还没有任务的巡逻单元
    const nearestUnits = unitSpots
      .filter(u => !usedUnits.has(u.unit.id))
      .sort((a, b) => distanceMeters(a.position, spot.position) - distanceMeters(b.position, spot.position))
      .slice(0, def.patrols)
    nearestUnits.forEach(u => {
      usedUnits.add(u.unit.id)
      if (def.status !== '已办结') u.unit.status = '出警中'
    })
    const cameraIds = [...cameras]
      .sort((a, b) => distanceMeters(a.position, spot.position) - distanceMeters(b.position, spot.position))
      .slice(0, 4)
      .map(c => c.id)
    return [
      {
        id: def.id,
        type: def.type,
        level: def.level,
        title: def.title,
        place,
        districtId: spot.districtId,
        position: spot.position,
        time: clock(reportedAt),
        description: def.description,
        status: def.status,
        units: [...nearestUnits.map(u => '巡逻 ' + u.unit.id), ...def.extra],
        cameraIds,
        arriveMinutes: def.arrive,
        timeline: timelineOf(def, reportedAt)
      }
    ]
  })

  const active = incidents.filter(isActive).sort((a, b) => a.level - b.level)
  const severe = active.filter(i => i.level <= 2)

  const zones: GuardZone[] = ZONE_DEFS.flatMap(def => {
    const l = geo.landmarks.find(x => x.id === def.id)
    if (!l) return []
    const alert = severe.some(i => distanceMeters(i.position, l.position) <= ALERT_DISTANCE)
    return [
      {
        id: l.id,
        name: l.name,
        position: l.position,
        radius: def.radius,
        height: def.height,
        guardLevel: def.guardLevel,
        status: alert ? '加强警戒' : '正常',
        guards: def.guards,
        cameras: cameras.filter(c => distanceMeters(c.position, l.position) <= def.radius + 1200).length
      }
    ]
  })

  // 视域：每条一、二级在办警情配最近的 2 路在线摄像头。和警情同点位的摄像头是垂直俯视，画不出视锥，跳过
  const viewCones: ViewCone[] = []
  const coneCameras = new Set<string>()
  for (const inc of severe) {
    const near = cameras
      .filter(c => c.online && !coneCameras.has(c.id))
      .map(c => ({ c, d: distanceMeters(c.position, inc.position) }))
      .filter(x => x.d >= 150 && x.d <= 2500)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
    for (const x of near) {
      if (viewCones.length >= 6) break
      coneCameras.add(x.c.id)
      viewCones.push({ cameraId: x.c.id, incidentId: inc.id })
    }
  }

  // 视频巡查：按警情等级依次取最近的摄像头，凑满 4 路
  const featured: string[] = []
  for (let rank = 0; rank < 4 && featured.length < 4; rank++) {
    for (const inc of active) {
      const id = inc.cameraIds[rank]
      if (id && !featured.includes(id) && featured.length < 4) featured.push(id)
    }
  }

  const arrived = incidents.flatMap(i => (i.arriveMinutes === null ? [] : [i.arriveMinutes]))
  const events = buildEvents(geo, nowHour)
  return {
    zones,
    incidents,
    patrols,
    cameras,
    viewCones,
    featuredCameraIds: featured,
    onlineForce: zones.reduce((n, z) => n + z.guards, 0) + patrols.reduce((n, r) => n + r.units.reduce((m, u) => m + u.crew, 0), 0),
    avgArriveMinutes: arrived.length ? Math.round((arrived.reduce((a, b) => a + b, 0) / arrived.length) * 10) / 10 : 0,
    events,
    eventStats: eventStats(events, geo.districts),
    aiAlarms: buildAiAlarms(geo, cameras, now)
  }
}

// ---------- 警情统计（趋势、类型分布） ----------

/** 一天内每小时警情数的基准曲线控制点：[小时, 起/小时]。傍晚到夜间最高 */
const HOURLY: [number, number][] = [[0, 3], [4, 1.5], [8, 4], [12, 6.5], [16, 7], [20, 10], [22, 8.5], [24, 3]]

function interpolate(points: [number, number][], x: number): number {
  for (let i = 1; i < points.length; i++) {
    const [x0, v0] = points[i - 1]
    const [x1, v1] = points[i]
    if (x <= x1) return v0 + ((v1 - v0) * (x - x0)) / (x1 - x0)
  }
  return points[points.length - 1][1]
}

/** daysAgo 天前、第 hour 个小时的警情数 */
export function hourlyIncidents(daysAgo: number, hour: number): number {
  return Math.round(interpolate(HOURLY, hour + 0.5) * (0.8 + 0.4 * noise(daysAgo * 977 + 13, hour * 131 + 7)))
}

/** 今天已经过去（含当前）的小时数 */
function elapsedHours(nowHour: number): number {
  return Math.min(24, Math.max(1, Math.floor(nowHour) + 1))
}

/** daysAgo 天前的全天警情数；今天只算到当前小时 */
export function dailyIncidents(daysAgo: number, nowHour = 24): number {
  const hours = daysAgo === 0 ? elapsedHours(nowHour) : 24
  let n = 0
  for (let h = 0; h < hours; h++) n += hourlyIncidents(daysAgo, h)
  return n
}

const PERIOD_DAYS: Record<SecurityPeriod, number> = { today: 1, week: 7, month: 30 }

/** 所选周期的警情总数（含今天已发生的） */
export function periodTotal(period: SecurityPeriod, nowHour: number): number {
  let n = 0
  for (let d = 0; d < PERIOD_DAYS[period]; d++) n += dailyIncidents(d, nowHour)
  return n
}

/**
 * 警情趋势。今日：逐小时，对比上周同日；近 7 / 30 日：逐日，对比上一个 7 / 30 日。
 */
export function incidentTrend(period: SecurityPeriod, nowHour: number): IncidentTrend {
  if (period === 'today') {
    const elapsed = elapsedHours(nowHour)
    const hours = Array.from({ length: 24 }, (_, h) => h)
    return {
      labels: hours.map(h => String(h).padStart(2, '0')),
      current: hours.map(h => (h < elapsed ? hourlyIncidents(0, h) : null)),
      previous: hours.map(h => hourlyIncidents(7, h)),
      currentName: '今日',
      previousName: '上周同日'
    }
  }
  const days = PERIOD_DAYS[period]
  // 从最早的一天排到今天
  const offsets = Array.from({ length: days }, (_, i) => days - 1 - i)
  return {
    labels: offsets.map(d => (d === 0 ? '今日' : d + ' 天前')),
    current: offsets.map(d => dailyIncidents(d, nowHour)),
    previous: offsets.map(d => dailyIncidents(d + days)),
    currentName: period === 'week' ? '近 7 日' : '近 30 日',
    previousName: period === 'week' ? '前 7 日' : '前 30 日'
  }
}

/** 所选周期内各类型的警情数，合计等于 periodTotal */
export function typeDistribution(period: SecurityPeriod, nowHour: number): { type: IncidentType; count: number }[] {
  const total = periodTotal(period, nowHour)
  let left = total
  return INCIDENT_TYPES.map((type, i) => {
    // 最后一类取余数，保证合计与总数一致
    const count = i === INCIDENT_TYPES.length - 1 ? left : Math.min(left, Math.round(total * TYPE_SHARE[type]))
    left -= count
    return { type, count }
  })
}

// ---------- 警情热力 ----------

/** 滨海休闲和商务片区警情更密 */
const BUSY_DISTRICTS = new Set(['khalidiyah', 'danah', 'markaziyah', 'zahiyah', 'rasakhdar', 'wahda', 'maqta'])
/** 周期越长，热力越接近片区的常态分布；越短，越集中在当前警情周围 */
const HEAT_MIX: Record<SecurityPeriod, { base: number; incident: number; seed: number }> = {
  today: { base: 0.3, incident: 0.9, seed: 11 },
  week: { base: 0.55, incident: 0.5, seed: 53 },
  month: { base: 0.8, incident: 0.25, seed: 97 }
}
/** 警情影响范围（高斯核的标准差），米 */
const INCIDENT_SPREAD = 700

/**
 * 所选周期的警情热力点（投影坐标），值域 0–1。
 * grid 是陆地上的规则网格（CityGeo.landGrid），所以热力只落在岛上；
 * 每个点的值 = 所在片区的常态水平 × 位置扰动 + 周围警情的贡献（等级越高贡献越大）。
 */
export function incidentHeatGrid(
  period: SecurityPeriod,
  grid: { xy: number[]; districtId: string }[],
  districts: { id: string; baseDensity: number }[],
  incidents: { level: number; xy: number[] }[],
  step: number
): { id: string; at: number[]; radius: number; value: number }[] {
  const mix = HEAT_MIX[period]
  const maxDensity = Math.max(...districts.map(d => d.baseDensity), 1)
  const base = new Map(districts.map(d => [d.id, (d.baseDensity / maxDensity) * (BUSY_DISTRICTS.has(d.id) ? 1 : 0.6)]))
  return grid.map((g, i) => {
    const structural = (base.get(g.districtId) ?? 0) * mix.base * (0.5 + noise(g.xy[0] + mix.seed * 1000, g.xy[1]))
    let bump = 0
    for (const inc of incidents) {
      const d2 = (inc.xy[0] - g.xy[0]) ** 2 + (inc.xy[1] - g.xy[1]) ** 2
      bump += ((5 - inc.level) / 4) * Math.exp(-d2 / (2 * INCIDENT_SPREAD ** 2))
    }
    return { id: 'g' + i, at: g.xy, radius: step * 1.1, value: Math.min(1, structural + mix.incident * bump) }
  })
}

// ---------- 今日事件：处置流程、部门效率、片区事件量 ----------

/** 部门，面板按这个顺序展示 */
export const DEPARTMENTS: Department[] = ['城管', '交警', '消防', '市政', '环卫']
/** 各部门承办事件的占比（合计 1） */
const DEPT_SHARE: Record<Department, number> = { 城管: 0.3, 交警: 0.26, 消防: 0.1, 市政: 0.16, 环卫: 0.18 }
/** 各部门的基准处置时长，分钟 */
const DEPT_BASE_MINUTES: Record<Department, number> = { 城管: 38, 交警: 26, 消防: 18, 市政: 52, 环卫: 44 }
/** 处置时限，分钟：超过仍未办结即为超时 */
export const EVENT_TIME_LIMIT = 60
/** 部门平均处置时长超过这个值时在面板上标为警示色，分钟 */
export const DEPT_WARN_MINUTES = 45
/** 处置流程的四个环节，按先后顺序 */
export const EVENT_STAGES: EventStage[] = ['上报', '派单', '处置', '办结']

/** 按权重确定性地选一项：t 是 0–1 的伪随机数 */
function pick<T>(items: T[], weight: (x: T) => number, t: number): T {
  const total = items.reduce((n, x) => n + weight(x), 0)
  let acc = 0
  for (const x of items) {
    acc += weight(x) / total
    if (t < acc) return x
  }
  return items[items.length - 1]
}

/**
 * 今日上报的城市事件。每小时的条数与警情趋势一致（hourlyIncidents(0, h)），
 * 片区按人口密度加权（繁忙片区更多），部门按占比，处置时长在部门基准附近浮动，少数拖得很长。
 * 环节由「已过去的时间」和「需要的时长」比较得出，所以 nowHour 越晚，办结的越多。
 */
export function buildEvents(geo: Pick<GeoData, 'districts'>, nowHour: number): CityEvent[] {
  const now = nowHour * 60
  const hours = elapsedHours(nowHour)
  const districtWeight = (d: { id: string; baseDensity: number }) => d.baseDensity * (BUSY_DISTRICTS.has(d.id) ? 1.6 : 1)
  const events: CityEvent[] = []
  for (let h = 0; h < hours; h++) {
    const n = hourlyIncidents(0, h)
    // 当前小时只有已经过去的那部分时间可以有事件
    const span = Math.max(1, Math.min(60, now - h * 60))
    for (let k = 0; k < n; k++) {
      const seed = h * 100 + k
      const reportedAt = h * 60 + Math.floor(noise(seed * 7 + 1, 211) * span)
      const district = pick(geo.districts, districtWeight, noise(seed * 13 + 5, 347))
      const department = pick(DEPARTMENTS, d => DEPT_SHARE[d], noise(seed * 17 + 3, 499))
      // 约一成拖得很长；约 5% 卡在处置环节（等配件、等协调），今天办不完
      const tail = noise(seed * 19 + 11, 613) < 0.12 ? 2.2 : 1
      const stuck = noise(seed * 31 + 17, 907) < 0.05
      const duration = stuck ? Infinity : Math.round(DEPT_BASE_MINUTES[department] * (0.6 + 0.8 * noise(seed * 23 + 7, 701)) * tail)
      const dispatchAt = 2 + Math.floor(noise(seed * 29 + 13, 811) * 4)
      const arriveAt = Math.max(dispatchAt + 1, Math.round(Math.min(duration, DEPT_BASE_MINUTES[department]) * 0.35))
      const age = Math.max(0, now - reportedAt)
      const stage: EventStage = age >= duration ? '办结' : age >= arriveAt ? '处置' : age >= dispatchAt ? '派单' : '上报'
      const closed = stage === '办结'
      events.push({
        id: 'ev-' + String(events.length + 1).padStart(4, '0'),
        districtId: district.id,
        department,
        reportedAt,
        stage,
        handleMinutes: closed ? duration : age,
        overdue: !closed && age > EVENT_TIME_LIMIT
      })
    }
  }
  return events
}

/** 由事件明细汇总出今日事件、处置流程、部门效率和片区事件量 */
export function eventStats(events: CityEvent[], districts: { id: string; name: string }[]): EventStats {
  const closed = events.filter(e => e.stage === '办结').length
  const overdue = events.filter(e => e.overdue).length
  const total = events.length
  const flow: FlowStep[] = EVENT_STAGES.map((name, i) => {
    // 走到（或走过）这一环节的事件数
    const count = events.filter(e => EVENT_STAGES.indexOf(e.stage) >= i).length
    return { name, count, rate: total ? count / total : 0 }
  })

  const departments: DepartmentEfficiency[] = DEPARTMENTS.map(department => {
    const mine = events.filter(e => e.department === department)
    // 用已办结的实际用时；一条都没办结时用已耗时代替
    const done = mine.filter(e => e.stage === '办结')
    const sample = done.length ? done : mine
    const avg = sample.length ? sample.reduce((n, e) => n + e.handleMinutes, 0) / sample.length : 0
    return { department, avgMinutes: Math.round(avg), events: mine.length }
  })

  const byDistrict: DistrictEvents[] = districts.map(d => {
    const mine = events.filter(e => e.districtId === d.id)
    const done = mine.filter(e => e.stage === '办结').length
    const late = mine.filter(e => e.overdue).length
    const counts = DEPARTMENTS.map(dep => ({ dep, n: mine.filter(e => e.department === dep).length }))
    const top = counts.reduce((a, b) => (b.n > a.n ? b : a), counts[0])
    return {
      districtId: d.id,
      name: d.name,
      total: mine.length,
      closed: done,
      active: mine.length - done - late,
      overdue: late,
      closeRate: mine.length ? done / mine.length : 0,
      topDepartment: top.dep
    }
  })
  // 稳定排序：事件量相同时保持 geo.json 的顺序
  byDistrict.sort((a, b) => b.total - a.total)

  return {
    // 上报 = 处置中 + 已办结 + 超时（超时指超过时限仍未办结）
    summary: { reported: total, active: total - closed - overdue, closed, overdue },
    flow,
    departments,
    districts: byDistrict
  }
}

// ---------- 视频智能告警 ----------

interface AiAlarmDef {
  type: AiAlarmType
  level: AlarmLevel
  title: string
  /** 告警地点：地标 id 或路口 id，二选一；告警落在离它最近的在线摄像头上 */
  landmark?: string
  intersection?: string
  /** 告警距现在的分钟数 */
  ago: number
  status: AiAlarmStatus
}

const AI_ALARM_DEFS: AiAlarmDef[] = [
  { type: '人员聚集', level: 3, title: '人员聚集（约 120 人）', landmark: 'corniche-beach', ago: 6, status: '待确认' },
  { type: '机动车逆行', level: 2, title: '机动车逆行', intersection: 'hazza-khaleej', ago: 12, status: '已派单' },
  { type: '占道经营', level: 3, title: '占道经营', landmark: 'wahda-mall', ago: 23, status: '待确认' },
  { type: '垃圾堆放', level: 4, title: '垃圾堆放', intersection: 'delma-muroor', ago: 34, status: '待确认' },
  { type: '烟火识别', level: 2, title: '烟火识别', landmark: 'mina-zayed', ago: 52, status: '已办结' },
  { type: '非机动车乱停', level: 4, title: '非机动车乱停', landmark: 'bus-station', ago: 69, status: '待确认' }
]

/** 视频智能告警：每条落在离指定地点最近的在线摄像头上，摄像头不复用。now 为当天的分钟数 */
function buildAiAlarms(geo: GeoData, cameras: SecurityCamera[], now: number): AiAlarm[] {
  const used = new Set<string>()
  return AI_ALARM_DEFS.flatMap((def, i) => {
    const spot = def.landmark ? geo.landmarks.find(l => l.id === def.landmark) : geo.intersections.find(x => x.id === def.intersection)
    if (!spot) return []
    const camera = cameras
      .filter(c => c.online && !used.has(c.id))
      .sort((a, b) => distanceMeters(a.position, spot.position) - distanceMeters(b.position, spot.position))[0]
    if (!camera) return []
    used.add(camera.id)
    return [
      {
        id: 'ai-' + String(i + 1).padStart(2, '0'),
        type: def.type,
        level: def.level,
        title: def.title,
        cameraId: camera.id,
        time: clock(now - def.ago),
        ageMinutes: def.ago,
        confidence: Math.round((0.82 + 0.16 * noise(i * 97 + 31, 59)) * 100) / 100,
        status: def.status
      }
    ]
  })
}
