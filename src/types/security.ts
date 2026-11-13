import type { LonLat } from './geo'
import type { AlarmLevel } from './smartCity'

/** 统计周期：今日 / 近 7 日 / 近 30 日 */
export type SecurityPeriod = 'today' | 'week' | 'month'

export type IncidentType = '人员聚集' | '治安' | '火情' | '求助' | '可疑物品'
export type IncidentStatus = '待派单' | '处置中' | '已办结'

/** 处置流程里的一步 */
export interface IncidentStep {
  name: string
  /** HH:mm；还没走到这一步时为空字符串 */
  time: string
  done: boolean
}

/** 一条警情。位置取自 geo.json 的地标或路口 */
export interface Incident {
  id: string
  type: IncidentType
  level: AlarmLevel
  title: string
  /** 地点名称（地标名或路口名） */
  place: string
  districtId: string | null
  position: LonLat
  /** 接警时刻 HH:mm */
  time: string
  description: string
  status: IncidentStatus
  /** 已派出的力量，如「巡逻 P-03」 */
  units: string[]
  /** 最近的摄像头 id，由近到远 */
  cameraIds: string[]
  /** 从接警到首个警力到场的分钟数；未到场为 null */
  arriveMinutes: number | null
  timeline: IncidentStep[]
}

/** 重点防护区：以地标为圆心的圆形范围 */
export interface GuardZone {
  /** 与地标 id 相同 */
  id: string
  name: string
  position: LonLat
  /** 防护半径，米 */
  radius: number
  /** 围栏幕墙高度，米 */
  height: number
  /** 防护等级：1 最高 */
  guardLevel: 1 | 2 | 3
  status: '正常' | '加强警戒'
  /** 驻守警力，人 */
  guards: number
  /** 范围内及周边的摄像头数 */
  cameras: number
}

export type PatrolUnitKind = '警车' | '摩托' | '步巡'

/** 巡逻单元，位置用所在巡逻路线上的比例表示 */
export interface PatrolUnit {
  id: string
  kind: PatrolUnitKind
  /** 在巡逻路线上的位置，0–1 */
  at: number
  /** 人数 */
  crew: number
  status: '巡逻中' | '出警中'
}

/** 巡逻路线：某条道路的一段 */
export interface PatrolRoute {
  id: string
  name: string
  roadId: string
  /** 截取道路的起止比例，0–1 */
  from: number
  to: number
  units: PatrolUnit[]
}

export interface SecurityCamera {
  id: string
  name: string
  position: LonLat
  online: boolean
}

/** 摄像头视域：哪个摄像头对准哪条警情 */
export interface ViewCone {
  cameraId: string
  incidentId: string
}

export interface SecurityData {
  zones: GuardZone[]
  incidents: Incident[]
  patrols: PatrolRoute[]
  cameras: SecurityCamera[]
  /** 对准一、二级在办警情的摄像头视域，4–6 个 */
  viewCones: ViewCone[]
  /** 视频巡查里展示的摄像头 id（离在办警情最近的 4 路） */
  featuredCameraIds: string[]
  /** 在线警力，人 */
  onlineForce: number
  /** 平均到场时间，分钟 */
  avgArriveMinutes: number
}

/** 警情趋势：本期与对比期两条序列。今日序列里还没到的小时为 null */
export interface IncidentTrend {
  labels: string[]
  current: (number | null)[]
  previous: number[]
  currentName: string
  previousName: string
}
