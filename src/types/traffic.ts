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
  mode: '自适应' | '定时'
  /** 异常说明；正常时为空串 */
  note: string
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
