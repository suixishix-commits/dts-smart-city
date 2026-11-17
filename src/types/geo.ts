/**
 * public/data/smart-city/geo.json 的结构（由 scripts/build-geo.mjs 从 OpenStreetMap 快照生成）。坐标均为 WGS84 [lon, lat]。
 * 数据 © OpenStreetMap contributors，ODbL 许可。
 */

export type LonLat = [number, number]

export interface GeoDistrict {
  id: string
  name: string
  /** 一定落在片区内部的点，适合放标注 */
  center: LonLat
  centroid: LonLat
  areaKm2: number
  /** 日间基准人口密度，万人/km² */
  baseDensity: number
  boundary: LonLat[]
}

export interface GeoRoad {
  id: string
  name: string
  /** OSM 里的英文路名 */
  nameEn?: string
  /** 1 主干路 2 次干路 3 支路 */
  level: 1 | 2 | 3
  /** long 顺岛轴方向（西北—东南），cross 横向 */
  direction: 'long' | 'cross'
  path: LonLat[]
  lengthKm: number
}

export interface GeoIntersection {
  id: string
  name: string
  /** [横街 id, 纵向主干路 id] */
  roads: [string, string]
  level: number
  position: LonLat
  districtId: string | null
}

export type LandmarkType = 'landmark' | 'beach' | 'mall' | 'port' | 'transit' | 'hospital' | 'park' | 'venue' | 'bridge'

export interface GeoLandmark {
  id: string
  name: string
  type: LandmarkType
  position: LonLat
  districtId: string | null
}

/** 底图街道（OSM 岛内全部主次干路和支路），只用来画城市路网骨架，没有名称 */
export interface GeoStreet {
  id: string
  /** 1 快速路/主干路 2 主要道路 3 次要道路 4 支路 */
  level: 1 | 2 | 3 | 4
  path: LonLat[]
}

export interface GeoData {
  /** 数据来源署名 */
  attribution?: string
  /** OSM 快照时间 */
  osmTimestamp?: string | null
  bbox: [number, number, number, number]
  center: LonLat
  /** 主岛海岸线 */
  island: LonLat[]
  /** 向内收 250 米的陆地范围 */
  land: LonLat[]
  districts: GeoDistrict[]
  roads: GeoRoad[]
  intersections: GeoIntersection[]
  landmarks: GeoLandmark[]
  /** 底图街道；旧数据没有这一项 */
  streets?: GeoStreet[]
}
