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
}

/** 噪声监测点（设在路口） */
export interface NoisePoint {
  id: string
  name: string
  place: { intersection: string }
  /** 昼间平峰的基准声级，dB(A) */
  base: number
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
}

export interface EnvironmentData {
  districts: EnvDistrict[]
  stations: EnvStation[]
  sources: PollutionSource[]
  noisePoints: NoisePoint[]
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
