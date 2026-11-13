export type AlarmLevel = 1 | 2 | 3 | 4

/** 片区。坐标均为 WGS84 [lon, lat] */
export interface District {
  id: string
  name: string
  center: [number, number]
  boundary: [number, number][]
  /** 日间基准人口密度，万人/km² */
  baseDensity: number
}

/** 城市热点事件 */
export interface Hotspot {
  id: string
  name: string
  shortName: string
  type: string
  districtId: string
  position: [number, number]
  /** 热度 0–100 */
  heat: number
  people: number
  /** 关联的摄像头 id */
  cameraId: string
  nearbyCameras: number
}

export interface Camera {
  id: string
  name: string
  position: [number, number]
  online: boolean
  /** 是否在「重点摄像头」里展示 */
  featured: boolean
}

export interface Alarm {
  id: string
  module: '交通' | '安全' | '环境' | '生命线'
  level: AlarmLevel
  title: string
  area: string
  time: string
}

export interface OverviewData {
  vitals: { label: string; value: string; unit: string }[]
  districts: District[]
  hotspots: Hotspot[]
  cameras: Camera[]
  alarms: Alarm[]
}

/** 一个热力点（投影前，WGS84） */
export interface HeatPoint {
  id: string
  position: [number, number]
  /** 影响半径，米 */
  radius: number
  /** 热力值，万人/km² */
  value: number
}
