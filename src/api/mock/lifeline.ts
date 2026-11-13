import type { GeoData, GeoIntersection, GeoLandmark, GeoRoad } from '@/types/geo'
import type {
  Anchor,
  BridgeHealth,
  FacilityStatus,
  FloodPoint,
  GasStation,
  LifelineAlarm,
  LifelineData,
  LifelineSummary,
  PipeSegment,
  PipeSystem,
  PumpStation,
  Substation,
  SystemStatus,
  WorkOrder
} from '@/types/lifeline'
import type { AlarmLevel } from '@/types/smartCity'

/** mock 数据的时刻：14:30（与告警时间一致） */
export const LIFELINE_HOUR = 14.5

/** 出厂水压（MPa）一天内的控制点：分时调压，早晚用水高峰抬高、夜间降压减漏 */
const PRESSURE: [number, number][] = [
  [0, 0.27], [4, 0.26], [6, 0.3], [7.5, 0.35], [9, 0.34], [11, 0.31],
  [14, 0.3], [17, 0.32], [19, 0.36], [21, 0.35], [23, 0.29], [24, 0.27]
]
/** 主岛用电负荷（MW）一天内的控制点：早高峰、午后空调负荷、晚高峰最高 */
const LOAD: [number, number][] = [
  [0, 620], [4, 540], [6, 600], [8, 820], [9.5, 905], [12, 860],
  [14.5, 880], [17, 850], [19, 960], [20.5, 985], [22, 860], [24, 640]
]

function interpolate(points: [number, number][], hour: number): number {
  const h = Math.min(24, Math.max(0, hour))
  for (let i = 1; i < points.length; i++) {
    const [h0, v0] = points[i - 1]
    const [h1, v1] = points[i]
    if (h <= h1) return v0 + ((v1 - v0) * (h - h0)) / (h1 - h0)
  }
  return points[points.length - 1][1]
}

/** 某时刻的出厂水压，MPa */
export function waterPressureAt(hour: number): number {
  return interpolate(PRESSURE, hour)
}

/** 某时刻的主岛用电负荷，MW */
export function powerLoadAt(hour: number): number {
  return interpolate(LOAD, hour)
}

/** 每半小时一个点的全天序列：[小时, 水压 MPa] 和 [小时, 负荷 MW] */
export function lifelineSeries(): { pressure: [number, number][]; load: [number, number][] } {
  const pressure: [number, number][] = []
  const load: [number, number][] = []
  for (let i = 0; i <= 48; i++) {
    const h = i / 2
    pressure.push([h, Math.round(waterPressureAt(h) * 1000) / 1000])
    load.push([h, Math.round(powerLoadAt(h))])
  }
  return { pressure, load }
}

/** 一天中的用电负荷峰值时刻与数值 */
export function powerLoadPeak(): { hour: number; value: number } {
  const top = LOAD.reduce((a, b) => (b[1] > a[1] ? b : a))
  return { hour: top[0], value: top[1] }
}

/** 变电站负荷率 → 状态：75% 以下正常，85% 以下关注，95% 以下预警，其余异常 */
export function loadStatus(percent: number): FacilityStatus {
  return percent < 75 ? 0 : percent < 85 ? 1 : percent < 95 ? 2 : 3
}

/** 积水深度（cm）→ 状态：10 以下正常，20 以下关注，40 以下预警，其余异常 */
export function depthStatus(cm: number): FacilityStatus {
  return cm < 10 ? 0 : cm < 20 ? 1 : cm < 40 ? 2 : 3
}

/** 桥梁健康评分 → 状态：85 分及以上正常，其余关注 */
export function bridgeStatus(score: number): FacilityStatus {
  return score >= 85 ? 0 : 1
}

/** 从 geo.json 里按 id 取对象；取不到直接报错，避免 mock 悄悄落到不存在的地方 */
class GeoIndex {
  constructor(private readonly geo: GeoData) {}

  road(id: string): GeoRoad {
    const r = this.geo.roads.find(x => x.id === id)
    if (!r) throw new Error('geo.json 里没有道路 ' + id)
    return r
  }
  intersection(id: string): GeoIntersection {
    const i = this.geo.intersections.find(x => x.id === id)
    if (!i) throw new Error('geo.json 里没有路口 ' + id)
    return i
  }
  landmark(id: string): GeoLandmark {
    const l = this.geo.landmarks.find(x => x.id === id)
    if (!l) throw new Error('geo.json 里没有地标 ' + id)
    return l
  }
  districtName(id: string | null): string {
    return this.geo.districts.find(d => d.id === id)?.name ?? '主岛'
  }
  /** 路口的位置描述：「阿拉伯湾街与法拉赫街口」 */
  crossing(id: string): string {
    const i = this.intersection(id)
    return `${this.road(i.roads[1]).name}与${this.road(i.roads[0]).name}口`
  }
  /** 两个路口之间的路段描述：「阿拉伯湾街（哈姆丹街—扎耶德一世街段）」 */
  stretch(roadId: string, from: string, to: string): string {
    return `${this.road(roadId).name}（${this.road(this.intersection(from).roads[0]).name}—${this.road(this.intersection(to).roads[0]).name}段）`
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** 各管网敷设在哪些道路上。供水的配水干管取全部次干路横街，在 buildPipes 里按 geo 计算 */
const NETWORK: { system: PipeSystem; grade: 'trunk' | 'branch'; roads: string[]; label: string; spec: string }[] = [
  { system: 'water', grade: 'trunk', roads: ['khaleej', 'airport', 'muroor'], label: '供水主干管', spec: 'DN600 球墨铸铁' },
  { system: 'power', grade: 'trunk', roads: ['corniche', 'salam'], label: '110 kV 电缆', spec: '110 kV 交联电缆' },
  { system: 'power', grade: 'branch', roads: ['falah', 'dhafeer'], label: '11 kV 馈线', spec: '11 kV 电缆' },
  { system: 'gas', grade: 'branch', roads: ['hamdan', 'hazza', 'delma', 'karamah', 'sportcity'], label: '中压燃气管', spec: 'DN200 PE 中压 B 级' },
  { system: 'drain', grade: 'trunk', roads: ['airport', 'muroor'], label: '排水主干管', spec: 'DN1500 钢筋混凝土' },
  { system: 'drain', grade: 'branch', roads: ['mbk', 'mosque'], label: '排水干管', spec: 'DN1000 钢筋混凝土' }
]

/** 各管网的管段：每段沿一条真实道路全线敷设，长度取道路长度 */
export function buildPipes(geo: GeoData): PipeSegment[] {
  const index = new GeoIndex(geo)
  const distribution = geo.roads.filter(r => r.direction === 'cross' && r.level === 2).map(r => r.id)
  const groups = [...NETWORK.slice(0, 1), { system: 'water' as const, grade: 'branch' as const, roads: distribution, label: '配水干管', spec: 'DN300 球墨铸铁' }, ...NETWORK.slice(1)]
  return groups.flatMap(g =>
    g.roads.map(roadId => {
      const road = index.road(roadId)
      return { id: `${g.system}-${roadId}`, system: g.system, grade: g.grade, roadId, name: `${road.name}${g.label}`, from: 0, to: 1, lengthKm: road.lengthKm, spec: g.spec }
    })
  )
}

/** 变电站：[路口, 站号, 负荷率 %, 主变容量 MVA]。都在电力馈线经过的路口 */
const SUBSTATIONS: [string, number, number, number][] = [
  ['falah-khaleej', 3, 92, 120],
  ['falah-airport', 1, 71, 160],
  ['falah-muroor', 2, 64, 120],
  ['dhafeer-khaleej', 1, 48, 80],
  ['dhafeer-airport', 2, 77, 120],
  ['dhafeer-muroor', 4, 58, 80]
]

function buildSubstations(index: GeoIndex): Substation[] {
  return SUBSTATIONS.map(([intersectionId, no, loadPercent, capacityMva]) => {
    const i = index.intersection(intersectionId)
    return {
      id: 'sub-' + intersectionId,
      name: `${index.districtName(i.districtId)} ${no} 号变电站`,
      anchor: { kind: 'intersection', id: intersectionId },
      location: index.crossing(intersectionId),
      districtId: i.districtId,
      loadPercent,
      capacityMva,
      status: loadStatus(loadPercent)
    }
  })
}

/** 燃气调压站：[路口, 进口 kPa, 出口 kPa, 状态]。都在燃气管经过的路口 */
const GAS_STATIONS: [string, number, number, FacilityStatus][] = [
  ['hamdan-airport', 172, 2.6, 0],
  ['delma-airport', 148, 1.7, 2],
  ['karamah-muroor', 168, 2.5, 0],
  ['sportcity-khaleej', 165, 2.4, 0]
]

function buildGasStations(index: GeoIndex): GasStation[] {
  return GAS_STATIONS.map(([intersectionId, inletKpa, outletKpa, status]) => ({
    id: 'gas-' + intersectionId,
    name: `${index.road(index.intersection(intersectionId).roads[0]).name}调压站`,
    anchor: { kind: 'intersection', id: intersectionId },
    location: index.crossing(intersectionId),
    inletKpa,
    outletKpa,
    status
  }))
}

/** 积水的下穿通道：苏丹·本·扎耶德街在法拉赫街与哈扎·本·扎耶德街之间，纳哈扬片区边上 */
const UNDERPASS: Anchor = { kind: 'between', roadId: 'muroor', from: 'falah-muroor', to: 'hazza-muroor', t: 0.5 }

function buildFloodPoints(index: GeoIndex): FloodPoint[] {
  const at = (id: string, depthCm: number, radius: number): FloodPoint => ({
    id: 'flood-' + id,
    name: index.crossing(id) + '低洼段',
    anchor: { kind: 'intersection', id },
    location: index.crossing(id),
    depthCm,
    radius,
    status: depthStatus(depthCm)
  })
  return [
    {
      id: 'flood-underpass',
      name: `${index.road('muroor').name}下穿通道`,
      anchor: UNDERPASS,
      location: index.stretch('muroor', 'falah-muroor', 'hazza-muroor'),
      depthCm: 18,
      radius: 300,
      status: depthStatus(18)
    },
    at('dhafeer-muroor', 12, 280),
    at('mbk-airport', 6, 240),
    at('karamah-airport', 3, 220)
  ]
}

/** 排水泵站：[路口, 运行台数, 总台数, 抽排量 m³/h, 状态]。都在排水管经过的路口 */
const PUMP_STATIONS: [string, number, number, number, FacilityStatus][] = [
  ['hazza-muroor', 3, 3, 5400, 0],
  ['mbk-muroor', 2, 3, 3600, 0],
  ['mosque-airport', 1, 3, 1500, 2]
]

function buildPumpStations(index: GeoIndex): PumpStation[] {
  return PUMP_STATIONS.map(([intersectionId, running, total, flow, status]) => ({
    id: 'pump-' + intersectionId,
    name: `${index.road(index.intersection(intersectionId).roads[0]).name}泵站`,
    anchor: { kind: 'intersection', id: intersectionId },
    location: index.crossing(intersectionId),
    running,
    total,
    flow,
    status
  }))
}

/** 桥梁健康：[地标 id, 评分, 等级, 建成年份, 传感器数, 最近检测] */
const BRIDGES: [string, number, string, number, number, string][] = [
  ['zayed-bridge', 95, '一类', 2010, 186, '2026-09-18'],
  ['maqta-bridge', 86, '二类', 1968, 92, '2026-10-06'],
  ['mussafah-bridge', 78, '三类', 1977, 104, '2026-10-21']
]

function buildBridges(index: GeoIndex): BridgeHealth[] {
  return BRIDGES.map(([id, score, grade, builtYear, sensors, lastInspect]) => {
    const l = index.landmark(id)
    if (l.type !== 'bridge') throw new Error(`地标 ${id} 不是桥梁`)
    return { id, name: l.name, shortName: l.name.replace(/^谢赫/, ''), score, grade, builtYear, sensors, lastInspect }
  })
}

function buildAlarms(index: GeoIndex, subs: Substation[], gas: GasStation[], pumps: PumpStation[], bridges: BridgeHealth[]): LifelineAlarm[] {
  const sub = subs[0]
  const regulator = gas.find(g => g.status > 0) as GasStation
  const pump = pumps.find(p => p.status > 0) as PumpStation
  const bridge = bridges.find(b => b.id === 'mussafah-bridge') as BridgeHealth
  const step = (name: string, time: string, done = true) => ({ name, time, done })

  return [
    {
      id: 'a1',
      level: 1,
      system: 'water',
      type: '爆管',
      title: `${index.road('khaleej').name} DN600 供水主管爆管`,
      shortTitle: 'DN600 爆管',
      facility: '供水主干管 W-2231 · DN600 球墨铸铁',
      location: index.stretch('khaleej', 'hamdan-khaleej', 'zayed1-khaleej'),
      districtId: 'khalidiyah',
      area: index.districtName('khalidiyah'),
      time: '14:26',
      anchor: { kind: 'between', roadId: 'khaleej', from: 'hamdan-khaleej', to: 'zayed1-khaleej', t: 0.4 },
      segment: { roadId: 'khaleej', from: 'hamdan-khaleej', to: 'zayed1-khaleej' },
      readings: [
        { label: '管段压力', value: '0.12 MPa', normal: '0.32 MPa' },
        { label: '瞬时流量', value: '1,860 m³/h', normal: '740 m³/h' },
        { label: '漏损估算', value: '约 1,100 m³/h' }
      ],
      impact: '约 2,140 户、3 个小区低压或停水',
      crew: '供水抢修一队（8 人 · 2 车）',
      status: '关阀处置中',
      steps: [step('压力骤降报警', '14:26'), step('确认爆管并派单', '14:29'), step('关闭上下游阀门 V-1023、V-1027', '14:41'), step('开挖抢修', '预计 15:10', false), step('通水恢复', '预计 17:30', false)]
    },
    {
      id: 'g1',
      level: 2,
      system: 'gas',
      type: '压力异常',
      title: `${regulator.name}出口压力偏低`,
      shortTitle: '调压站压力偏低',
      facility: `${regulator.name} · 中低压调压柜`,
      facilityId: regulator.id,
      location: regulator.location,
      districtId: index.intersection('delma-airport').districtId,
      area: index.districtName(index.intersection('delma-airport').districtId),
      time: '14:02',
      anchor: regulator.anchor,
      readings: [
        { label: '出口压力', value: `${regulator.outletKpa} kPa`, normal: '2.2–2.8 kPa' },
        { label: '进口压力', value: `${regulator.inletKpa} kPa`, normal: '160–180 kPa' },
        { label: '可燃气体浓度', value: '0 %LEL' }
      ],
      impact: '下游约 1,260 户用气压力不足',
      crew: '燃气运维二班（4 人 · 1 车）',
      status: '已到场检查',
      steps: [step('出口压力低限报警', '14:02'), step('远程切换备用调压路', '14:06'), step('运维人员到场', '14:24'), step('更换主路调压器皮膜', '预计 15:30', false)]
    },
    {
      id: 'p1',
      level: 2,
      system: 'power',
      type: '温度异常',
      title: `${index.road('salam').name} 110 kV 电缆接头温度异常`,
      shortTitle: '电缆接头过热',
      facility: '110 kV 电缆 P-0417 · 3 号中间接头',
      location: `${index.road('salam').name}电缆隧道 K7+400`,
      districtId: null,
      area: '东北岸',
      time: '13:18',
      anchor: { kind: 'road', roadId: 'salam', t: 0.45 },
      readings: [
        { label: '接头温度', value: '78 ℃', normal: '≤ 65 ℃' },
        { label: '线路负荷', value: '412 A', normal: '额定 630 A' },
        { label: '局部放电', value: '86 pC', normal: '≤ 50 pC' }
      ],
      impact: '线路承担 3 座变电站供电，暂未停电',
      crew: '输电运检三班（5 人 · 1 车）',
      status: '转移负荷中',
      steps: [step('测温光纤超限报警', '13:18'), step('调度转移 30% 负荷', '13:32'), step('红外复测确认', '13:55'), step('夜间停电检修', '预计 23:00', false)]
    },
    {
      id: 'a5',
      level: 3,
      system: 'drain',
      type: '积水',
      title: `${index.road('muroor').name}下穿通道积水 18 cm`,
      shortTitle: '下穿通道积水 18 cm',
      facility: '下穿通道液位计 D-L07',
      facilityId: 'flood-underpass',
      location: index.stretch('muroor', 'falah-muroor', 'hazza-muroor'),
      districtId: 'nahyan',
      area: index.districtName('nahyan'),
      time: '13:57',
      anchor: UNDERPASS,
      readings: [
        { label: '积水深度', value: '18 cm', normal: '警戒 15 cm' },
        { label: '集水井液位', value: '2.6 m', normal: '≤ 2.0 m' },
        { label: '泵站抽排量', value: '5,400 m³/h' }
      ],
      impact: '积水面积约 1,400 m²，通道单向限行',
      crew: '排水应急二队（6 人 · 1 台移动泵车）',
      status: '泵站已全开',
      steps: [step('液位超警戒报警', '13:57'), step('泵站 3 台泵全开', '13:59'), step('移动泵车到场', '14:20'), step('水深降至 5 cm 以下', '预计 15:00', false)]
    },
    {
      id: 'b1',
      level: 3,
      system: 'bridge',
      type: '结构监测',
      title: `${bridge.name}伸缩缝位移超限`,
      shortTitle: '伸缩缝位移超限',
      facility: `${bridge.name} · 2 号伸缩缝位移计`,
      facilityId: bridge.id,
      location: `${bridge.name}主岛侧引桥`,
      districtId: index.landmark(bridge.id).districtId,
      area: index.districtName(index.landmark(bridge.id).districtId),
      time: '12:40',
      anchor: { kind: 'landmark', id: bridge.id },
      readings: [
        { label: '伸缩缝位移', value: '46 mm', normal: '≤ 40 mm' },
        { label: '主梁挠度', value: '21 mm', normal: '≤ 35 mm' },
        { label: '桥面温度', value: '47 ℃' }
      ],
      impact: '重车限速 40 km/h，通行未中断',
      crew: '桥梁养护一组（4 人）',
      status: '现场复核中',
      steps: [step('位移计超限报警', '12:40'), step('发布重车限速', '12:52'), step('养护人员现场复核', '13:30'), step('出具评估意见', '预计 16:00', false)]
    },
    {
      id: 'd2',
      level: 3,
      system: 'drain',
      type: '设备故障',
      title: `${pump.name} 2 号泵故障停机`,
      shortTitle: '泵站 2 号泵故障',
      facility: `${pump.name} · 2 号潜水泵`,
      facilityId: pump.id,
      location: pump.location,
      districtId: index.intersection('mosque-airport').districtId,
      area: index.districtName(index.intersection('mosque-airport').districtId),
      time: '11:25',
      anchor: pump.anchor,
      readings: [
        { label: '运行台数', value: `${pump.running} / ${pump.total} 台` },
        { label: '电机电流', value: '0 A', normal: '86 A' },
        { label: '前池液位', value: '3.1 m', normal: '≤ 3.5 m' }
      ],
      impact: '泵站排水能力下降约三分之一',
      crew: '排水机电班（3 人）',
      status: '备件运输中',
      steps: [step('电机过载跳闸', '11:25'), step('切换 3 号泵待命', '11:31'), step('机电班到场检查', '12:10'), step('更换轴承并试车', '预计 16:30', false)]
    },
    {
      id: 'a6',
      level: 4,
      system: 'power',
      type: '负荷偏高',
      title: `${sub.name}负荷偏高`,
      shortTitle: '变电站负荷偏高',
      facility: `${sub.name} · 2 号主变`,
      facilityId: sub.id,
      location: sub.location,
      districtId: sub.districtId,
      area: index.districtName(sub.districtId),
      time: '13:42',
      anchor: sub.anchor,
      readings: [
        { label: '负荷率', value: `${sub.loadPercent} %`, normal: '≤ 85 %' },
        { label: '主变油温', value: '71 ℃', normal: '≤ 85 ℃' },
        { label: '有功功率', value: `${Math.round((sub.capacityMva * sub.loadPercent) / 100)} MW` }
      ],
      impact: `供电范围约 1.8 万户（${index.districtName(sub.districtId)}片区）`,
      crew: '变电运维一班（值守）',
      status: '加强监视',
      steps: [step('负荷率越限提示', '13:42'), step('值班员确认', '13:45'), step('申请倒换 2 回馈线', '14:10'), step('晚高峰前完成倒负荷', '预计 17:00', false)]
    },
    {
      id: 'w2',
      level: 4,
      system: 'water',
      type: '压力波动',
      title: `${index.road('saada').name} DN300 配水管压力波动`,
      shortTitle: '配水管压力波动',
      facility: '配水干管 W-3508 · DN300 球墨铸铁',
      location: index.stretch('saada', 'saada-khaleej', 'saada-airport'),
      districtId: index.intersection('saada-airport').districtId,
      area: index.districtName(index.intersection('saada-airport').districtId),
      time: '10:52',
      anchor: { kind: 'between', roadId: 'saada', from: 'saada-khaleej', to: 'saada-airport', t: 0.5 },
      readings: [
        { label: '管段压力', value: '0.24–0.33 MPa', normal: '0.30 MPa ± 0.02' },
        { label: '瞬时流量', value: '210 m³/h' }
      ],
      impact: '约 380 户水压不稳',
      crew: '供水巡检三组（2 人）',
      status: '排查中',
      steps: [step('压力波动提示', '10:52'), step('派巡检组排查', '11:20'), step('检查减压阀 PRV-118', '预计 15:30', false)]
    }
  ]
}

/** 工单：[告警 id, 进度 %, 预计完成] */
const ORDERS: [string, number, string][] = [
  ['a1', 35, '17:30'],
  ['g1', 55, '15:30'],
  ['p1', 40, '23:00'],
  ['a5', 70, '15:00'],
  ['d2', 45, '16:30']
]

function buildOrders(alarms: LifelineAlarm[]): WorkOrder[] {
  return ORDERS.map(([alarmId, progress, eta], i) => {
    const a = alarms.find(x => x.id === alarmId) as LifelineAlarm
    return { id: 'WO-1113-' + String(i + 1).padStart(2, '0'), alarmId, title: a.title, crew: a.crew.replace(/（.*$/, ''), eta, progress, status: a.status }
  })
}

/** 告警按等级从高到低、同级按时间从新到旧排序 */
export function sortAlarms<T extends { level: number; time: string }>(alarms: T[]): T[] {
  return [...alarms].sort((a, b) => a.level - b.level || b.time.localeCompare(a.time))
}

const STATUS_TEXT: Record<0 | AlarmLevel, string> = { 0: '正常', 1: '告警', 2: '预警', 3: '关注', 4: '提示' }

function worstLevel(alarms: LifelineAlarm[], system: PipeSystem): 0 | AlarmLevel {
  const levels = alarms.filter(a => a.system === system).map(a => a.level)
  return levels.length ? (Math.min(...levels) as AlarmLevel) : 0
}

function buildSystems(hour: number, data: Pick<LifelineData, 'substations' | 'gasStations' | 'pumpStations' | 'alarms'>, km: Record<PipeSystem, number>): SystemStatus[] {
  const avgLoad = data.substations.reduce((n, s) => n + s.loadPercent, 0) / data.substations.length
  const avgInlet = data.gasStations.reduce((n, g) => n + g.inletKpa, 0) / data.gasStations.length
  const running = data.pumpStations.reduce((n, p) => n + p.running, 0)
  const pumps = data.pumpStations.reduce((n, p) => n + p.total, 0)
  const row = (key: PipeSystem, name: string, metric: string, value: string, unit: string, note: string): SystemStatus => {
    const level = worstLevel(data.alarms, key)
    return { key, name, metric, value, unit, note, level, status: STATUS_TEXT[level] }
  }
  return [
    row('water', '供水', '出厂压力', waterPressureAt(hour).toFixed(2), 'MPa', `管网 ${km.water} km`),
    row('power', '电力', '平均负荷率', String(Math.round(avgLoad)), '%', `变电站 ${data.substations.length} 座`),
    row('gas', '燃气', '中压管网压力', String(Math.round(avgInlet)), 'kPa', `调压站 ${data.gasStations.length} 座`),
    row('drain', '排水', '水泵运行', `${running} / ${pumps}`, '台', `泵站 ${data.pumpStations.length} 座`)
  ]
}

function buildSummary(data: Pick<LifelineData, 'pipes' | 'substations' | 'gasStations' | 'floodPoints' | 'pumpStations' | 'bridges' | 'alarms'>): LifelineSummary {
  const kmBySystem: Record<PipeSystem, number> = { water: 0, power: 0, gas: 0, drain: 0 }
  data.pipes.forEach(p => (kmBySystem[p.system] += p.lengthKm))
  ;(Object.keys(kmBySystem) as PipeSystem[]).forEach(k => (kmBySystem[k] = round1(kmBySystem[k])))
  // 监测点：管线每 250 米一个压力/流量/温度测点，站点各 6 个，易涝点各 2 个，再加桥梁传感器
  const pipeSensors = data.pipes.reduce((n, p) => n + Math.ceil(p.lengthKm / 0.25), 0)
  const sensors =
    pipeSensors + (data.substations.length + data.gasStations.length + data.pumpStations.length) * 6 + data.floodPoints.length * 2 + data.bridges.reduce((n, b) => n + b.sensors, 0)
  // 完好率：每条告警按等级折算成若干个异常测点
  const abnormal = data.alarms.reduce((n, a) => n + (5 - a.level) * 3, 0)
  return {
    totalKm: round1(Object.values(kmBySystem).reduce((a, b) => a + b, 0)),
    kmBySystem,
    sensors,
    alarmsToday: data.alarms.length,
    integrity: round1((1 - abnormal / sensors) * 100)
  }
}

/**
 * 城市生命线的全部 mock 数据。所有设施都落在 geo.json 的真实道路、路口和桥梁上，
 * 同一份 geo 每次生成的结果相同。
 */
export function buildLifelineData(geo: GeoData, hour = LIFELINE_HOUR): LifelineData {
  const index = new GeoIndex(geo)
  const pipes = buildPipes(geo)
  const substations = buildSubstations(index)
  const gasStations = buildGasStations(index)
  const floodPoints = buildFloodPoints(index)
  const pumpStations = buildPumpStations(index)
  const bridges = buildBridges(index)
  const alarms = sortAlarms(buildAlarms(index, substations, gasStations, pumpStations, bridges))
  const base = { pipes, substations, gasStations, floodPoints, pumpStations, bridges, alarms }
  const summary = buildSummary(base)
  return { hour, ...base, orders: buildOrders(alarms), systems: buildSystems(hour, base, summary.kmBySystem), summary }
}
