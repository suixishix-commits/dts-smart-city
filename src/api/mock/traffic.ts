import { pointInRing } from '@/scene/geo'
import type { GeoData, GeoRoad } from '@/types/geo'
import type { CongestionLevel, IncidentType, NetworkStats, OdFlow, ParkingLot, RoadSegment, SignalJunction, SignalStatus, TrafficData, TrafficIncident, TransitStats } from '@/types/traffic'

/** 拥堵等级名称，下标即等级 */
export const CONGESTION_TEXT = ['畅通', '缓行', '拥堵', '严重拥堵'] as const
/** 拥堵指数的分级阈值：≥1.5 缓行，≥2.0 拥堵，≥2.6 严重拥堵 */
export const CONGESTION_STEPS = [1.5, 2.0, 2.6] as const
export const INCIDENT_TEXT: Record<IncidentType, string> = { accident: '事故', construction: '施工', breakdown: '故障', control: '管制' }

/** 市中心片区：早晚高峰最堵 */
const DOWNTOWN = ['danah', 'markaziyah', 'zahiyah', 'wahda']
/** 就业集中的片区（通勤 OD 的目的地） */
const WORK = ['danah', 'markaziyah', 'zahiyah', 'wahda', 'manhal']
/** 短于这个长度的端头不单独成段，公里 */
const MIN_STUB_KM = 0.25
/** 没有路口的道路按这个长度等分，公里 */
const SLICE_KM = 2.2

type P = [number, number]

/** 以 id 为种子的固定伪随机数 0–1：每次打开数据一样，测试可重复 */
function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

/** 控制点之间线性插值 */
function interpolate(points: [number, number][], hour: number): number {
  const h = Math.min(24, Math.max(0, hour))
  for (let i = 1; i < points.length; i++) {
    const [h0, v0] = points[i - 1]
    const [h1, v1] = points[i]
    if (h <= h1) return v0 + ((v1 - v0) * (h - h0)) / (h1 - h0)
  }
  return points[points.length - 1][1]
}

const gauss = (h: number, mu: number, sigma: number) => Math.exp(-((h - mu) ** 2) / (2 * sigma * sigma))

/** 经纬度 → 以主岛中心为基准的近似平面坐标（米），只用来在 mock 里量距离和比例 */
function metric(geo: GeoData): (p: number[]) => P {
  const kx = 111320 * Math.cos((geo.center[1] * Math.PI) / 180)
  return p => [(p[0] - geo.center[0]) * kx, (p[1] - geo.center[1]) * 110540]
}

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** 折线上离 p 最近的点在全长上的比例 0–1 */
function ratioOnLine(line: P[], p: P): number {
  let total = 0
  let best = Infinity
  let at = 0
  for (let i = 1; i < line.length; i++) {
    const [x0, y0] = line[i - 1]
    const [x1, y1] = line[i]
    const len = Math.hypot(x1 - x0, y1 - y0)
    const t = len ? Math.min(1, Math.max(0, ((p[0] - x0) * (x1 - x0) + (p[1] - y0) * (y1 - y0)) / (len * len))) : 0
    const d = dist(p, [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t])
    if (d < best) {
      best = d
      at = total + len * t
    }
    total += len
  }
  return total ? at / total : 0
}

/** 折线上按比例取点 */
function pointOnLine(line: P[], ratio: number): P {
  let total = 0
  for (let i = 1; i < line.length; i++) total += dist(line[i - 1], line[i])
  let left = total * ratio
  for (let i = 1; i < line.length; i++) {
    const len = dist(line[i - 1], line[i])
    if (left <= len || i === line.length - 1) {
      const t = len ? left / len : 0
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t]
    }
    left -= len
  }
  return line[0]
}

/**
 * 把每条道路切成路段：有路口的道路在路口处断开，没有路口的按长度等分。
 * 路段名用相邻的两条相交道路命名；纵向主干路的东南端用最近的桥命名。
 */
export function buildSegments(geo: GeoData): RoadSegment[] {
  const m = metric(geo)
  const roadName = new Map(geo.roads.map(r => [r.id, r.name]))
  const districts = geo.districts.map(d => ({ id: d.id, name: d.name, ring: d.boundary.map(m), center: m(d.center) }))
  const bridges = geo.landmarks.filter(l => l.type === 'bridge').map(l => ({ name: l.name, at: m(l.position) }))

  const districtOf = (p: P) => {
    const inside = districts.find(d => pointInRing(p, d.ring))
    if (inside) return inside
    return districts.reduce((a, b) => (dist(p, b.center) < dist(p, a.center) ? b : a))
  }

  const out: RoadSegment[] = []
  for (const road of geo.roads) {
    const line = road.path.map(m)
    const arterial = road.level === 1 && road.direction === 'long'
    const cuts = cutsOf(road, line)
    cuts.forEach((c, i) => {
      if (i === 0) return
      const prev = cuts[i - 1]
      const district = districtOf(pointOnLine(line, (prev.ratio + c.ratio) / 2))
      const id = `${road.id}-${out.filter(s => s.roadId === road.id).length + 1}`
      out.push({
        id,
        roadId: road.id,
        roadName: road.name,
        name: prev.label || c.label ? `${road.name}（${prev.label}—${c.label}）` : `${road.name}（${district.name}段）`,
        level: road.level,
        from: prev.ratio,
        to: c.ratio,
        lengthKm: Math.round(road.lengthKm * (c.ratio - prev.ratio) * 100) / 100,
        districtId: district.id,
        downtown: DOWNTOWN.includes(district.id),
        arterial,
        bridge: arterial && c.ratio === 1,
        jitter: hash01(id)
      })
    })
  }
  // 等分路段可能有两段落在同一个片区，重名的加上序号
  const seen = new Map<string, number>()
  out.forEach(s => seen.set(s.name, (seen.get(s.name) ?? 0) + 1))
  const count = new Map<string, number>()
  out.forEach(s => {
    if ((seen.get(s.name) as number) < 2) return
    const n = (count.get(s.name) ?? 0) + 1
    count.set(s.name, n)
    s.name = s.name.replace('段）', ` ${n} 段）`)
  })
  return out

  /** 一条道路的断点（含两端）：比例 + 用来命名的标签 */
  function cutsOf(road: GeoRoad, line: P[]): { ratio: number; label: string }[] {
    const nodes = geo.intersections
      .filter(i => i.roads.includes(road.id))
      .map(i => ({ ratio: ratioOnLine(line, m(i.position)), label: roadName.get(i.roads[0] === road.id ? i.roads[1] : i.roads[0]) ?? i.name }))
      .sort((a, b) => a.ratio - b.ratio)
    if (nodes.length === 0) {
      const n = Math.max(2, Math.round(road.lengthKm / SLICE_KM))
      return Array.from({ length: n + 1 }, (_, i) => ({ ratio: i / n, label: '' }))
    }
    const long = road.direction === 'long'
    const end = line[line.length - 1]
    const bridge = bridges.length ? bridges.reduce((a, b) => (dist(end, b.at) < dist(end, a.at) ? b : a)) : null
    const endLabel = long ? (bridge && dist(end, bridge.at) < 2500 ? bridge.name : '东南端') : '东北端'
    const stub = MIN_STUB_KM / road.lengthKm
    const cuts = [...nodes]
    if (nodes[0].ratio > stub) cuts.unshift({ ratio: 0, label: long ? '西北端' : '西南端' })
    if (1 - nodes[nodes.length - 1].ratio > stub) cuts.push({ ratio: 1, label: endLabel })
    return cuts
  }
}

/** 一天里的日间基础车流：夜间接近 0，白天是一个平台 */
const DAY_SHAPE: [number, number][] = [[0, 0.03], [5, 0.03], [6.5, 0.25], [10, 0.55], [13, 0.6], [16, 0.6], [20, 0.5], [22, 0.25], [24, 0.03]]

/** 路段的早高峰、晚高峰、日间权重：市中心和纵向主干路高峰最重，桥头是进出岛的咽喉 */
function weights(s: Pick<RoadSegment, 'level' | 'downtown' | 'arterial' | 'bridge'>): [number, number, number] {
  if (s.bridge) return [1.35, 1.5, 0.45]
  if (s.downtown) return s.arterial ? [1.35, 1.55, 0.9] : [1.25, 1.45, 0.9]
  if (s.arterial) return [0.65, 0.75, 0.45]
  const k = s.level === 3 ? 0.8 : 1
  return [0.35 * k, 0.45 * k, 0.35 * k]
}

/** 路段某时刻的拥堵指数（1 为自由流）：早高峰 08:00、晚高峰 18:00 两个峰叠加日间基础车流 */
export function congestionAt(segment: Pick<RoadSegment, 'level' | 'downtown' | 'arterial' | 'bridge' | 'jitter'>, hour: number): number {
  const [am, pm, day] = weights(segment)
  const load = am * gauss(hour, 8, 1) + pm * gauss(hour, 18, 1.3) + day * interpolate(DAY_SHAPE, hour)
  return 1 + load * (0.85 + 0.3 * segment.jitter)
}

/** 拥堵指数 → 等级 0–3 */
export function congestionLevel(index: number): CongestionLevel {
  return index >= CONGESTION_STEPS[2] ? 3 : index >= CONGESTION_STEPS[1] ? 2 : index >= CONGESTION_STEPS[0] ? 1 : 0
}

/** 各等级道路的自由流车速，km/h */
const FREE_SPEED: Record<number, number> = { 1: 72, 2: 56, 3: 45 }

/** 路段某时刻的平均车速，km/h */
export function segmentSpeedAt(segment: RoadSegment, hour: number): number {
  return FREE_SPEED[segment.level] / congestionAt(segment, hour)
}

/** 通勤方向：上午进城（居住区 → 商务区，过桥上岛），下午出城 */
export function commuteAt(hour: number): 'in' | 'out' {
  return hour < 13 ? 'in' : 'out'
}

/** 路段在路网里的权重：越长、等级越高（车道越多）越重 */
const weightOf = (s: RoadSegment) => s.lengthKm * (4 - s.level)

/** 某时刻的路网运行指标 */
export function networkStatsAt(segments: RoadSegment[], hour: number): NetworkStats {
  let total = 0
  let index = 0
  let speed = 0
  for (const s of segments) {
    const w = weightOf(s)
    total += w
    index += w * congestionAt(s, hour)
    speed += w * segmentSpeedAt(s, hour)
  }
  const idx = total ? index / total : 1
  return {
    index: idx,
    level: congestionLevel(idx),
    speed: total ? speed / total : 0,
    vehicles: Math.round((6000 + 78000 * (idx - 1)) / 10) * 10,
    busOnTime: Math.max(60, 98.5 - 14 * (idx - 1))
  }
}

/** 每半小时一个点的全天路网拥堵指数：[小时, 指数] */
export function networkSeries(segments: RoadSegment[]): [number, number][] {
  return Array.from({ length: 49 }, (_, i) => [i / 2, Math.round(networkStatsAt(segments, i / 2).index * 100) / 100] as [number, number])
}

/** 一天中路网最堵的时刻和指数 */
export function networkPeak(segments: RoadSegment[]): { hour: number; value: number } {
  const top = networkSeries(segments).reduce((a, b) => (b[1] > a[1] ? b : a))
  return { hour: top[0], value: top[1] }
}

/** 某时刻最堵的 n 个路段，按拥堵指数从高到低 */
export function rankSegmentsAt(segments: RoadSegment[], hour: number, n: number): { segment: RoadSegment; index: number; level: CongestionLevel; speed: number }[] {
  return segments
    .map(segment => {
      const index = congestionAt(segment, hour)
      return { segment, index, level: congestionLevel(index), speed: segmentSpeedAt(segment, hour) }
    })
    .sort((a, b) => b.index - a.index)
    .slice(0, n)
}

/** 某时刻各片区的平均拥堵指数（按路段长度加权）；没有路段的片区不在结果里 */
export function districtCongestionAt(segments: RoadSegment[], hour: number): Record<string, number> {
  const sum: Record<string, [number, number]> = {}
  for (const s of segments) {
    const acc = (sum[s.districtId] ??= [0, 0])
    acc[0] += weightOf(s) * congestionAt(s, hour)
    acc[1] += weightOf(s)
  }
  return Object.fromEntries(Object.entries(sum).map(([id, [v, w]]) => [id, v / w]))
}

/** 事件模板：at 是 geo.json 里的路口 id */
const INCIDENTS: { at: string; type: IncidentType; title: string; time: string; lanes: number; queue: number; status: TrafficIncident['status']; handling: string }[] = [
  { at: 'zayed1-airport', type: 'accident', title: '多车追尾', time: '17:42', lanes: 2, queue: 640, status: '处置中', handling: '交警 2 组已到场，拖车在途' },
  { at: 'hamdan-airport', type: 'control', title: '供水抢修临时管制', time: '14:28', lanes: 2, queue: 420, status: '管制中', handling: '东向封闭 2 车道，交警手动放行' },
  { at: 'falah-muroor', type: 'construction', title: '占道施工', time: '09:00', lanes: 1, queue: 280, status: '管制中', handling: '围挡作业至 18:00，已设绕行指引' },
  { at: 'hazza-khaleej', type: 'breakdown', title: '车辆抛锚', time: '16:05', lanes: 1, queue: 180, status: '处置中', handling: '清障车在途，预计 10 分钟到达' },
  { at: 'mbk-airport', type: 'accident', title: '两车剐蹭', time: '17:10', lanes: 1, queue: 150, status: '已到场', handling: '交警已到场，快处快赔中' },
  { at: 'mosque-khaleej', type: 'construction', title: '桥头路面维护', time: '10:30', lanes: 1, queue: 350, status: '管制中', handling: '占用外侧车道，22:00 恢复通行' }
]

/** 路口摄像头编号：按路口在 geo.json 里的顺序 */
const cameraIdOf = (index: number) => 'TC-' + String(index + 1).padStart(3, '0')

/** 交通事件：落在真实路口上，路名、片区名取自 geo.json */
export function buildIncidents(geo: GeoData): TrafficIncident[] {
  const roadName = new Map(geo.roads.map(r => [r.id, r.name]))
  const districtName = new Map(geo.districts.map(d => [d.id, d.name]))
  return INCIDENTS.flatMap((t, n) => {
    const index = geo.intersections.findIndex(i => i.id === t.at)
    if (index < 0) return []
    const x = geo.intersections[index]
    return [
      {
        id: 'inc-' + (n + 1),
        type: t.type,
        title: t.title,
        intersectionId: x.id,
        intersectionName: x.name,
        roadNames: [roadName.get(x.roads[0]) ?? x.roads[0], roadName.get(x.roads[1]) ?? x.roads[1]] as [string, string],
        districtId: x.districtId,
        districtName: (x.districtId && districtName.get(x.districtId)) || '主岛',
        position: x.position,
        time: t.time,
        lanes: t.lanes,
        queue: t.queue,
        status: t.status,
        handling: t.handling,
        cameraId: cameraIdOf(index),
        cameraName: x.name + ' 电子警察',
        cameraDistance: 30 + Math.round(hash01(x.id) * 90)
      }
    ]
  })
}

/** 离线的信号路口数 */
const OFFLINE_COUNT = 2

/**
 * 信号路口：geo.json 的每个路口一个。
 * 有管制或处置中事故的路口由交警手动控制；另按 id 固定挑两个离线。
 */
export function buildSignals(geo: GeoData, incidents: TrafficIncident[]): SignalJunction[] {
  const manual = new Set(incidents.filter(i => i.type === 'control' || (i.type === 'accident' && i.status === '处置中')).map(i => i.intersectionId))
  const busy = new Set(incidents.map(i => i.intersectionId))
  const offline = new Set(
    geo.intersections
      .filter(i => !busy.has(i.id))
      .sort((a, b) => hash01(a.id) - hash01(b.id))
      .slice(0, OFFLINE_COUNT)
      .map(i => i.id)
  )
  const notes = ['信号机通信中断，已派单', '信号机断电，抢修中']
  let n = 0
  return geo.intersections.map((i): SignalJunction => {
    const status: SignalStatus = manual.has(i.id) ? 'manual' : offline.has(i.id) ? 'offline' : 'normal'
    return {
      id: i.id,
      name: i.name,
      districtId: i.districtId,
      position: i.position,
      status,
      mode: i.level <= 2 ? '自适应' : '定时',
      note: status === 'manual' ? '交警现场手动放行' : status === 'offline' ? notes[n++ % notes.length] : ''
    }
  })
}

/** OD 条数 */
const OD_COUNT = 8

/**
 * 片区间通勤 OD：重力模型——居住人口 × 就业规模 ÷ 距离，取最大的 8 条。
 * 每个居住片区最多 2 条、每个就业片区最多 3 条，避免全部挤到一个目的地。
 */
export function buildOdFlows(geo: GeoData): OdFlow[] {
  const m = metric(geo)
  const size = (d: { baseDensity: number; areaKm2: number }) => d.baseDensity * d.areaKm2
  const homes = geo.districts.filter(d => !WORK.includes(d.id))
  const works = geo.districts.filter(d => WORK.includes(d.id))
  const pairs = homes
    .flatMap(h => works.map(w => ({ h, w, score: (size(h) * size(w)) / Math.max(1, dist(m(h.center), m(w.center)) / 1000) })))
    .sort((a, b) => b.score - a.score)
  const used = new Map<string, number>()
  const picked: typeof pairs = []
  for (const p of pairs) {
    if (picked.length >= OD_COUNT) break
    if ((used.get(p.h.id) ?? 0) >= 2 || (used.get(p.w.id) ?? 0) >= 3) continue
    used.set(p.h.id, (used.get(p.h.id) ?? 0) + 1)
    used.set(p.w.id, (used.get(p.w.id) ?? 0) + 1)
    picked.push(p)
  }
  const max = picked.length ? picked[0].score : 1
  // 最大的一条按高峰小时 2.4 万人次标定
  return picked.map(p => ({ id: `${p.h.id}-${p.w.id}`, homeId: p.h.id, homeName: p.h.name, workId: p.w.id, workName: p.w.name, volume: Math.round((p.score / max) * 240) / 100 }))
}

/** 停车场：泊位数按地标 id 给定，名称取自 geo.json */
const PARKING: { id: string; capacity: number; kind: ParkingLot['kind'] }[] = [
  { id: 'wahda-mall', capacity: 2800, kind: 'mall' },
  { id: 'abu-dhabi-mall', capacity: 3000, kind: 'mall' },
  { id: 'wtc', capacity: 3200, kind: 'business' },
  { id: 'khalidiyah-mall', capacity: 1600, kind: 'mall' }
]

/** 重点停车场，落在真实地标上 */
export function buildParkings(geo: GeoData): ParkingLot[] {
  return PARKING.flatMap(p => {
    const l = geo.landmarks.find(x => x.id === p.id)
    return l ? [{ id: p.id, name: l.name, capacity: p.capacity, kind: p.kind }] : []
  })
}

const PARKING_PROFILE: Record<ParkingLot['kind'], [number, number][]> = {
  mall: [[0, 0.08], [9, 0.15], [12, 0.55], [15, 0.6], [18, 0.8], [20.5, 0.97], [23, 0.4], [24, 0.08]],
  business: [[0, 0.12], [6, 0.15], [9, 0.85], [13, 0.96], [17, 0.85], [20, 0.4], [24, 0.12]]
}

/** 停车场某时刻的占用率 0–1：商务楼白天满，商场傍晚到夜间满 */
export function parkingOccupancyAt(lot: Pick<ParkingLot, 'id' | 'kind'>, hour: number): number {
  return Math.min(0.99, interpolate(PARKING_PROFILE[lot.kind], hour) * (0.92 + 0.08 * hash01(lot.id)))
}

/** 全天公交客运量，万人次 */
const BUS_DAILY = 21.6
/** 在线公交数量的控制点 */
const BUS_ONLINE: [number, number][] = [[0, 96], [5, 80], [7, 520], [9, 640], [16, 560], [18.5, 640], [22, 320], [24, 96]]

/** 公交客流的分时强度：早晚两个峰 + 日间基础 */
const ridership = (h: number) => 0.02 + gauss(h, 8, 1.2) + 1.1 * gauss(h, 18, 1.5) + 0.5 * interpolate(DAY_SHAPE, h)

/** 某时刻的公共交通运行指标；累计客运量是分时强度从 0 点积分到该时刻 */
export function transitStatsAt(segments: RoadSegment[], hour: number): TransitStats {
  let done = 0
  let all = 0
  for (let h = 0.25; h < 24; h += 0.5) {
    const v = ridership(h)
    all += v
    if (h < hour) done += v
  }
  return {
    onTime: networkStatsAt(segments, hour).busOnTime,
    passengers: (BUS_DAILY * done) / all,
    buses: Math.round(interpolate(BUS_ONLINE, hour))
  }
}

/** 由地理底数据生成智慧交通模块的全部 mock 数据 */
export function buildTrafficData(geo: GeoData): TrafficData {
  const incidents = buildIncidents(geo)
  return {
    segments: buildSegments(geo),
    incidents,
    signals: buildSignals(geo, incidents),
    odFlows: buildOdFlows(geo),
    parkings: buildParkings(geo),
    incidentsToday: 37
  }
}
