/** public/data/smart-city/geo.json 的结构（由 scripts/build-geo.mjs 生成）。坐标均为 WGS84 [lon, lat] */

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

export interface GeoData {
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
}
