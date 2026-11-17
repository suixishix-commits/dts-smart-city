import type { AlarmLevel } from './smartCity'

/** 六项常规污染物 */
export type PollutantKey = 'pm25' | 'pm10' | 'o3' | 'no2' | 'so2' | 'co'
/** 界面上可切换的指标：综合 AQI 或单项污染物 */
export type AirIndex = 'aqi' | 'pm25' | 'pm10' | 'o3'
/** 各污染物浓度。CO 为 mg/m³，其余 μg/m³ */
export type Concentrations = Record<PollutantKey, number>
/** 空气质量等级：0 优、1 良、2 轻度污染、3 中度及以上 */
export type AirLevel = 0 | 1 | 2 | 3

/** 一个位置的排放特征，决定它一天里各污染物的起伏 */
export interface EmissionProfile {
  /** 机动车排放强度 0–1：影响 NO₂、CO、PM，随早晚高峰变化 */
  traffic: number
  /** 扬尘强度 0–1.6：港口装卸、工地，主要抬高 PM10，随作业时段变化 */
  dust: number
  /** 绿地与海风的净化作用 0–1.1 */
  green: number
}

/** 位置引用：全部指向 geo.json 里的地标、路口，或某条道路上按比例取的点 */
export type PlaceRef = { landmark: string } | { intersection: string } | { road: string; t: number }

/** 参与空气质量计算的片区 */
export interface EnvDistrict {
  id: string
  name: string
  areaKm2: number
  profile: EmissionProfile
}

/** 空气质量监测站 */
export interface EnvStation {
  id: string
  name: string
  shortName: string
  /** 站点类型：港区站、交通站、公园站…… */
  kind: string
  place: { landmark: string }
  districtName: string
  profile: EmissionProfile
}

export type SourceType = '港区扬尘' | '施工工地' | '餐饮油烟' | '噪声投诉'

/** 告警、污染源、水质超标的处置状态 */
export type HandleStatus = '待处置' | '核查中' | '已办结'

/** 污染源或环境投诉 */
export interface PollutionSource {
  id: string
  name: string
  shortName: string
  type: SourceType
  level: AlarmLevel
  place: PlaceRef
  districtName: string
  /** 现状与处置进度 */
  note: string
  time: string
  /** 处置状态（页面上派发核查后在本地更新） */
  status: HandleStatus
}

/** 噪声监测点（设在路口） */
export interface NoisePoint {
  id: string
  name: string
  place: { intersection: string }
  /** 昼间平峰的基准声级，dB(A) */
  base: number
}

/** 声环境功能区（GB 3096）：由若干片区组成，按片区车流估算昼夜声级 */
export interface NoiseZone {
  id: string
  name: string
  /** 昼间、夜间限值，dB(A) */
  limit: { day: number; night: number }
  districtIds: string[]
  /** 基准声级，dB(A) */
  base: number
  /** 随时段起伏的幅度（相对交通干线），0–1 */
  sway: number
}

/** 生态空间（以地标为圆心的范围） */
export interface GreenSpace {
  id: string
  name: string
  place: { landmark: string }
  /** 半径，米 */
  radius: number
}

/** 海水水质类别：1 一类 … 4 四类 */
export type WaterGrade = 1 | 2 | 3 | 4

/** 近岸水质采样点（沿海岸道路取点） */
export interface WaterSample {
  id: string
  name: string
  place: { road: string; t: number }
  grade: WaterGrade
  /** 主要监测指标 */
  indicators: WaterIndicators
  /** 最近一次采样时间 HH:mm */
  sampledAt: string
}

/** 海水水质主要指标（GB 3097）。溶解氧越高越好，其余越低越好 */
export interface WaterIndicators {
  /** 溶解氧，mg/L */
  do: number
  /** 无机氮，mg/L */
  din: number
  /** 活性磷酸盐，mg/L */
  po4: number
  ph: number
}

/** 告警来源：监测站污染物超标、污染源与投诉、近岸水质超标 */
export type AlarmKind = 'station' | 'source' | 'water'

/** 超标告警 */
export interface EnvAlarm {
  id: string
  kind: AlarmKind
  /** 监测站 / 污染源 / 水质采样点的 id */
  targetId: string
  level: AlarmLevel
  title: string
  note: string
  time: string
  /** 初始处置状态（页面可在本地覆盖） */
  status: HandleStatus
  /** 超标的指标：名称、实测值、限值、单位 */
  metric?: { name: string; value: number; limit: number; unit: string }
}

export interface EnvironmentData {
  districts: EnvDistrict[]
  stations: EnvStation[]
  sources: PollutionSource[]
  noisePoints: NoisePoint[]
  noiseZones: NoiseZone[]
  greenSpaces: GreenSpace[]
  waterSamples: WaterSample[]
  /** 本月优良天数 */
  goodDays: { good: number; total: number }
}

/** 某个指标在某处某时刻的读数 */
export interface AirReading {
  /** 展示值：AQI 或浓度 */
  value: number
  /** 分指数（AQI 模式下即 AQI），用来定等级和排序 */
  index: number
  level: AirLevel
}
