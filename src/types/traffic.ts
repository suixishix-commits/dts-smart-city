import type { LonLat } from './geo'

/** 拥堵等级：0 畅通 1 缓行 2 拥堵 3 严重拥堵（与 kit.STATUS_RAMP 的下标一致） */
export type CongestionLevel = 0 | 1 | 2 | 3

/** 路段：一条道路上相邻两个路口之间（或等分切出）的一段 */
export interface RoadSegment {
  id: string
  roadId: string
  roadName: string
  /** 路段名，如「阿拉伯湾街（哈姆丹街—扎耶德一世街）」 */
  name: string
  /** 道路等级：1 主干路 2 次干路 3 支路 */
  level: 1 | 2 | 3
  /** 在道路折线上的起止比例 0–1 */
  from: number
  to: number
  lengthKm: number
  /** 路段中点所在（或最近）的片区 */
  districtId: string
  /** 位于市中心片区 */
  downtown: boolean
  /** 顺岛轴方向的纵向主干路 */
  arterial: boolean
  /** 东南端的进出岛桥头路段 */
  bridge: boolean
  /** 0–1 的固定扰动，让同类路段的拥堵略有差别 */
  jitter: number
  /** 路段两端的路口 id（geo.intersections）；道路端头或等分点没有路口，所以可能少于 2 个 */
  junctions: string[]
}

/** 路口摄像头 */
export interface NearbyCamera {
  /** 摄像头编号，如 TC-005 */
  id: string
  name: string
  /** 所在路口 id */
  intersectionId: string
  /** 到目标点的距离，米 */
  distance: number
  online: boolean
}

/** 绕行路线的一段：沿某条道路从比例 from 走到 to（from 可以大于 to，表示逆着道路点序走） */
export interface DetourLeg {
  roadId: string
  roadName: string
  from: number
  to: number
}

/** 绕开事件路口的绕行方案：从事件路口的前一个路口出发，经平行道路回到后一个路口 */
export interface DetourPlan {
  /** 被绕开的道路 */
  blockedRoadId: string
  blockedRoadName: string
  /** 起点、终点路口名 */
  fromName: string
  toName: string
  legs: DetourLeg[]
  /** 途经道路，如「哈姆丹街 → 阿拉伯湾街 → 法拉赫街」 */
  via: string
  /** 绕行里程、原路里程，公里 */
  lengthKm: number
  directKm: number
  /** 绕行用时、原路排队通过用时，分钟 */
  minutes: number
  directMinutes: number
}

export type IncidentType = 'accident' | 'construction' | 'breakdown' | 'control'

/** 交通事件，位置在真实路口上 */
export interface TrafficIncident {
  id: string
  type: IncidentType
  title: string
  /** 所在路口 id（geo.intersections） */
  intersectionId: string
  /** 路口名，如「扎耶德一世街 / 谢赫拉希德街」 */
  intersectionName: string
  /** 相交的两条道路名 */
  roadNames: [string, string]
  districtId: string | null
  districtName: string
  position: LonLat
  /** 发生时间 HH:mm */
  time: string
  /** 占用车道数 */
  lanes: number
  /** 排队长度，米 */
  queue: number
  /** 处置状态 */
  status: '处置中' | '管制中' | '已到场'
  /** 处置说明 */
  handling: string
  /** 最近的路口摄像头 */
  cameraId: string
  cameraName: string
  /** 摄像头到事件点的距离，米 */
  cameraDistance: number
  /** 最近的 3 个路口摄像头，由近到远（第一个就是 cameraId） */
  cameras: NearbyCamera[]
  /** 绕行方案；找不到合适的平行道路时为 null */
  detour: DetourPlan | null
}

export type SignalStatus = 'normal' | 'offline' | 'manual'

/** 信号路口 */
export interface SignalJunction {
  /** 与路口 id 相同 */
  id: string
  name: string
  districtId: string | null
  position: LonLat
  status: SignalStatus
  /** 控制方式 */
  mode: SignalMode
  /** 异常说明；正常时为空串 */
  note: string
  /** 路口摄像头编号 */
  cameraId: string
}

/** 信号配时方式 */
export type SignalMode = '自适应' | '定时'

/** 信号路口按运行方式的分类：离线的单独计，其余按配时方式 */
export type SignalControl = SignalMode | '离线'

export type VehicleKind = 'bus' | 'ambulance' | 'wrecker' | 'patrol'

/** 车辆沿途可以看到它的路口摄像头 */
export interface VehicleStop {
  intersectionId: string
  /** 路口在车辆所走道路上的比例 0–1 */
  ratio: number
  cameraId: string
  name: string
}

/** 重点车辆（公交、急救、清障、巡逻）：沿一条真实道路往返 */
export interface KeyVehicle {
  id: string
  /** 如「公交 034」 */
  name: string
  kind: VehicleKind
  roadId: string
  roadName: string
  /** 所走道路的走向：long 顺岛轴（点序西北 → 东南），cross 横向（点序西南 → 东北） */
  roadDirection: 'long' | 'cross'
  /** 所走道路的长度，公里 */
  lengthKm: number
  /** 线路/任务，如「34 路 · 阿拉伯湾街往返」 */
  route: string
  /** 车辆状态，如「运营中」「执行任务」 */
  status: string
  /** 0 点时在道路上的相位 0–2（0–1 正向，1–2 返程） */
  phase: number
  /** 每小时推进的单程数（时间轴按半小时步进，取较小的值让相邻时刻的位置连贯） */
  rate: number
  /** 自由流车速，km/h */
  freeSpeed: number
  /** 沿途路口（按比例排序） */
  stops: VehicleStop[]
}

/** 重点车辆某时刻的状态 */
export interface VehicleState {
  /** 在道路上的比例 0–1 */
  ratio: number
  /** 是否沿道路点序方向行驶 */
  forward: boolean
  /** 行驶方向，如「往东南」 */
  heading: string
  /** 近期轨迹（车辆身后一小段）的比例区间，[0] 为较早的位置，[1] 为当前位置 */
  trail: [number, number]
  /** 当前车速，km/h */
  speed: number
  /** 所在路段 */
  segmentId: string | null
  segmentName: string
  /** 最近的路口（摄像头） */
  nearest: VehicleStop | null
  /** 到最近路口的距离，米 */
  nearestDistance: number
}

/** 分时车流量：0–24 点每小时一个值，辆/时 */
export interface HourlyFlow {
  today: number[]
  yesterday: number[]
}

/** 公共交通各方式的客流 */
export interface TransitMode {
  key: 'bus' | 'taxi' | 'ferry' | 'bike'
  name: string
  /** 今日累计，万人次 */
  value: number
}

/** 片区间通勤 OD（早高峰方向：居住区 → 商务区） */
export interface OdFlow {
  id: string
  /** 居住片区 id */
  homeId: string
  homeName: string
  /** 就业片区 id */
  workId: string
  workName: string
  /** 高峰小时通勤量，万人次 */
  volume: number
}

/** 停车场（真实地标） */
export interface ParkingLot {
  /** 地标 id（geo.landmarks） */
  id: string
  name: string
  /** 泊位总数 */
  capacity: number
  /** business 白天满、mall 傍晚满 */
  kind: 'business' | 'mall'
}

/** 智慧交通模块的全部数据 */
export interface TrafficData {
  segments: RoadSegment[]
  incidents: TrafficIncident[]
  signals: SignalJunction[]
  odFlows: OdFlow[]
  parkings: ParkingLot[]
  vehicles: KeyVehicle[]
  flow: HourlyFlow
  /** 今日累计交通事件数（含已办结） */
  incidentsToday: number
}

/** 某时刻的路网运行指标 */
export interface NetworkStats {
  /** 路网拥堵指数（1 为自由流） */
  index: number
  level: CongestionLevel
  /** 平均车速 km/h */
  speed: number
  /** 在途车辆，辆 */
  vehicles: number
  /** 公交准点率 % */
  busOnTime: number
}

/** 某时刻的公共交通运行指标 */
export interface TransitStats {
  /** 公交准点率 % */
  onTime: number
  /** 今日累计客运量，万人次 */
  passengers: number
  /** 在线运营公交，辆 */
  buses: number
}
