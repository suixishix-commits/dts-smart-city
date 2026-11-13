import type { AlarmLevel } from './smartCity'

/** 四张管网 */
export type PipeSystem = 'water' | 'power' | 'gas' | 'drain'
/** 生命线的五类设施（四张管网 + 桥梁） */
export type LifelineSystem = PipeSystem | 'bridge'

/**
 * 设施在真实地理上的位置。只引用 geo.json 里的道路、路口、地标，不写经纬度；
 * 场景按投影后的路网把它换成坐标（见 views/lifeline/anchor.ts）。
 */
export type Anchor =
  /** 路口 */
  | { kind: 'intersection'; id: string }
  /** 地标 */
  | { kind: 'landmark'; id: string }
  /** 道路上按比例 t（0–1）取的点 */
  | { kind: 'road'; roadId: string; t: number }
  /** 道路上两个路口之间按比例 t 取的点（t = 0 在 from 路口，1 在 to 路口） */
  | { kind: 'between'; roadId: string; from: string; to: string; t: number }

/** 一段管线：沿一条真实道路敷设，from / to 是道路长度上的比例 */
export interface PipeSegment {
  id: string
  system: PipeSystem
  /** trunk 主干，branch 配水 / 馈线 / 支线 */
  grade: 'trunk' | 'branch'
  roadId: string
  /** 管线名，含真实道路名 */
  name: string
  from: number
  to: number
  /** 实际绘制的长度，km */
  lengthKm: number
  /** 规格，如 DN600 球墨铸铁 */
  spec: string
}

/** 设施状态：0 正常 1 关注 2 预警 3 异常（对应 kit 的 STATUS_RAMP） */
export type FacilityStatus = 0 | 1 | 2 | 3

/** 变电站 */
export interface Substation {
  id: string
  name: string
  anchor: Anchor
  location: string
  districtId: string | null
  /** 负荷率，% */
  loadPercent: number
  /** 主变容量，MVA */
  capacityMva: number
  status: FacilityStatus
}

/** 燃气调压站 */
export interface GasStation {
  id: string
  name: string
  anchor: Anchor
  location: string
  /** 进口压力（中压），kPa */
  inletKpa: number
  /** 出口压力（低压），kPa */
  outletKpa: number
  status: FacilityStatus
}

/** 易涝点 */
export interface FloodPoint {
  id: string
  name: string
  anchor: Anchor
  location: string
  /** 当前积水深度，cm */
  depthCm: number
  /** 积水范围半径，米 */
  radius: number
  status: FacilityStatus
}

/** 排水泵站 */
export interface PumpStation {
  id: string
  name: string
  anchor: Anchor
  location: string
  /** 运行中的水泵台数 */
  running: number
  total: number
  /** 当前抽排量，m³/h */
  flow: number
  status: FacilityStatus
}

/** 桥梁健康。id 就是 geo.json 里 bridge 类地标的 id */
export interface BridgeHealth {
  id: string
  name: string
  /** 列表里用的短名 */
  shortName: string
  /** 健康评分 0–100 */
  score: number
  /** 技术状况等级 */
  grade: string
  builtYear: number
  /** 在线传感器数 */
  sensors: number
  /** 最近一次定期检测 */
  lastInspect: string
}

/** 运行告警 */
export interface LifelineAlarm {
  id: string
  level: AlarmLevel
  system: LifelineSystem
  /** 告警类型，如 爆管 / 积水 / 负荷偏高 */
  type: string
  title: string
  /** 标注上用的短标题 */
  shortTitle: string
  /** 关联设施的名称和编号 */
  facility: string
  /** 关联设施的业务 id（变电站、调压站、易涝点、泵站、桥梁）；管线告警没有 */
  facilityId?: string
  /** 位置描述，用真实道路名 */
  location: string
  districtId: string | null
  /** 片区名 */
  area: string
  time: string
  anchor: Anchor
  /** 受影响的管段：道路上两个相邻路口之间 */
  segment?: { roadId: string; from: string; to: string }
  /** 传感器读数 */
  readings: { label: string; value: string; normal?: string }[]
  /** 影响范围（户数或面积） */
  impact: string
  /** 抢修队伍 */
  crew: string
  /** 当前处置状态 */
  status: string
  /** 处置步骤 */
  steps: { name: string; time: string; done: boolean }[]
}

/** 抢修工单 */
export interface WorkOrder {
  id: string
  alarmId: string
  title: string
  crew: string
  /** 预计完成时间 */
  eta: string
  /** 进度 0–100 */
  progress: number
  status: string
}

/** 分系统状态（面板里的一行） */
export interface SystemStatus {
  key: PipeSystem
  name: string
  /** 关键指标名 */
  metric: string
  value: string
  unit: string
  /** 辅助说明 */
  note: string
  /** 该系统未办结告警里最严重的等级；没有告警为 0 */
  level: 0 | AlarmLevel
  /** 状态文字 */
  status: string
}

/** 运行总览的四个指标 */
export interface LifelineSummary {
  /** 管网总长，km（按实际绘制的道路长度累加） */
  totalKm: number
  /** 各管网长度，km */
  kmBySystem: Record<PipeSystem, number>
  /** 在线监测点数 */
  sensors: number
  /** 今日告警数 */
  alarmsToday: number
  /** 设施完好率，% */
  integrity: number
}

export interface LifelineData {
  /** 数据时刻（小时，如 14.5 = 14:30） */
  hour: number
  pipes: PipeSegment[]
  substations: Substation[]
  gasStations: GasStation[]
  floodPoints: FloodPoint[]
  pumpStations: PumpStation[]
  bridges: BridgeHealth[]
  alarms: LifelineAlarm[]
  orders: WorkOrder[]
  systems: SystemStatus[]
  summary: LifelineSummary
}
