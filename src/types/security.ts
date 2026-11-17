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
  /** 今日上报的城市事件（警情趋势「今日」的同一批事件） */
  events: CityEvent[]
  /** 由 events 汇总出的统计 */
  eventStats: EventStats
  /** 视频智能告警，按时间由近到远 */
  aiAlarms: AiAlarm[]
}

/** 今日事件的各项统计，都由 SecurityData.events 汇总 */
export interface EventStats {
  summary: EventSummary
  flow: FlowStep[]
  departments: DepartmentEfficiency[]
  /** 全部片区，按事件量从多到少 */
  districts: DistrictEvents[]
}

/** 警情趋势：本期与对比期两条序列。今日序列里还没到的小时为 null */
export interface IncidentTrend {
  labels: string[]
  current: (number | null)[]
  previous: number[]
  currentName: string
  previousName: string
}

// ---------- 事件处置（今日事件、处置流程、部门效率、片区事件量） ----------

/** 处置部门 */
export type Department = '城管' | '交警' | '消防' | '市政' | '环卫'
/** 事件当前走到的处置环节 */
export type EventStage = '上报' | '派单' | '处置' | '办结'

/** 今日上报的一条城市事件（轻量记录，只用于统计） */
export interface CityEvent {
  id: string
  districtId: string
  department: Department
  /** 上报时刻，当天的分钟数 */
  reportedAt: number
  stage: EventStage
  /** 处置用时（办结的为实际用时，未办结的为截至现在已耗时），分钟 */
  handleMinutes: number
  /** 是否超过处置时限 */
  overdue: boolean
}

/** 处置流程漏斗的一步 */
export interface FlowStep {
  name: EventStage
  count: number
  /** 占上报总数的比例，0–1 */
  rate: number
}

/** 部门处置效率 */
export interface DepartmentEfficiency {
  department: Department
  /** 平均处置时长，分钟 */
  avgMinutes: number
  /** 今日承办事件数 */
  events: number
}

/** 片区事件量 */
export interface DistrictEvents {
  districtId: string
  name: string
  total: number
  closed: number
  active: number
  overdue: number
  /** 办结率，0–1 */
  closeRate: number
  /** 承办最多的部门 */
  topDepartment: Department
}

/** 今日事件汇总 */
export interface EventSummary {
  reported: number
  active: number
  closed: number
  overdue: number
}

// ---------- 视频智能告警 ----------

export type AiAlarmType = '人员聚集' | '机动车逆行' | '占道经营' | '垃圾堆放' | '烟火识别' | '非机动车乱停'
export type AiAlarmStatus = '待确认' | '已派单' | '已办结' | '误报'

/** 摄像头 AI 识别出的一条告警 */
export interface AiAlarm {
  id: string
  type: AiAlarmType
  level: AlarmLevel
  /** 列表里显示的标题，如「人员聚集（约 120 人）」 */
  title: string
  cameraId: string
  /** 告警时刻 HH:mm */
  time: string
  /** 告警距现在的分钟数（回放时往前推这么多） */
  ageMinutes: number
  /** 识别置信度，0–1 */
  confidence: number
  status: AiAlarmStatus
}
