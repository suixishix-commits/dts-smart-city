import type { GeoData, GeoDistrict, GeoIntersection, GeoLandmark, GeoRoad, GeoStreet, LonLat } from '@/types/geo'

/** 投影坐标 [x, y]（米） */
export type XY = [number, number]

/** 射线法：点是否在多边形内 */
export function pointInRing(p: number[], ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** 沿折线每隔 step 米取一个点（含起点；折线不足 step 时只有起点） */
export function alongLine(line: number[][], step: number): XY[] {
  const out: XY[] = []
  let carry = 0
  for (let i = 1; i < line.length; i++) {
    const [x0, y0] = line[i - 1]
    const [x1, y1] = line[i]
    const len = Math.hypot(x1 - x0, y1 - y0)
    // 重复的相邻点（长度为 0 的线段）跳过，否则 0/0 会产生 NaN 坐标
    if (len === 0) continue
    let d = carry
    for (; d <= len; d += step) out.push([x0 + ((x1 - x0) * d) / len, y0 + ((y1 - y0) * d) / len])
    carry = d - len
  }
  return out
}

/** 折线长度，米 */
export function lineLength(line: number[][]): number {
  let n = 0
  for (let i = 1; i < line.length; i++) n += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1])
  return n
}

/** 折线上按比例 t（0–1）取点 */
export function pointAt(line: number[][], t: number): XY {
  let left = lineLength(line) * Math.min(1, Math.max(0, t))
  for (let i = 1; i < line.length; i++) {
    const [x0, y0] = line[i - 1]
    const [x1, y1] = line[i]
    const len = Math.hypot(x1 - x0, y1 - y0)
    if (left <= len || i === line.length - 1) return len ? [x0 + ((x1 - x0) * left) / len, y0 + ((y1 - y0) * left) / len] : [x0, y0]
    left -= len
  }
  return [line[0][0], line[0][1]]
}

/** 截取折线的一段，from / to 为 0–1 的比例 */
export function sliceLine(line: number[][], from: number, to: number): XY[] {
  const total = lineLength(line)
  const a = total * from
  const b = total * to
  const out: XY[] = [pointAt(line, from)]
  let walked = 0
  for (let i = 1; i < line.length; i++) {
    walked += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1])
    if (walked > a && walked < b) out.push([line[i][0], line[i][1]])
  }
  out.push(pointAt(line, to))
  return out
}

/**
 * 投影后的城市地理数据：所有模块的场景图层都从这里取坐标，保证落在真实的陆地和路网上。
 * 带 XY / ring / line 的字段是投影坐标（米），其余与 geo.json 相同。
 */
export class CityGeo {
  readonly island: XY[]
  readonly land: XY[]
  readonly districts: (GeoDistrict & { ring: XY[]; centerXY: XY })[]
  readonly roads: (GeoRoad & { line: XY[] })[]
  readonly intersections: (GeoIntersection & { xy: XY })[]
  readonly landmarks: (GeoLandmark & { xy: XY })[]
  /** 底图街道（投影后）；geo.json 没有街道时为空 */
  readonly streets: (GeoStreet & { line: XY[] })[]

  constructor(
    readonly raw: GeoData,
    private readonly table: Map<string, XY>
  ) {
    this.island = raw.island.map(p => this.xy(p))
    this.land = raw.land.map(p => this.xy(p))
    this.districts = raw.districts.map(d => ({ ...d, ring: d.boundary.map(p => this.xy(p)), centerXY: this.xy(d.center) }))
    this.roads = raw.roads.map(r => ({ ...r, line: r.path.map(p => this.xy(p)) }))
    this.intersections = raw.intersections.map(i => ({ ...i, xy: this.xy(i.position) }))
    this.landmarks = raw.landmarks.map(l => ({ ...l, xy: this.xy(l.position) }))
    this.streets = (raw.streets ?? []).map(s => ({ ...s, line: s.path.map(p => this.xy(p)) }))
  }

  /** geo.json 里出现过的经纬度 → 投影坐标 */
  xy(p: number[]): XY {
    const c = this.table.get(p[0] + ',' + p[1])
    if (!c) throw new Error(`没有 [${p[0]}, ${p[1]}] 的投影坐标：它不在 geo.json 里，请用 CityGeo.project 转换`)
    return c
  }

  district(id: string) {
    return this.districts.find(d => d.id === id)
  }
  road(id: string) {
    return this.roads.find(r => r.id === id)
  }
  landmark(id: string) {
    return this.landmarks.find(l => l.id === id)
  }

  /** 是否在陆地范围内（海岸线向内收 250 米） */
  onLand(p: number[]): boolean {
    return pointInRing(p, this.land)
  }

  /** 点所在的片区 id；不在任何片区内返回 null */
  districtAt(p: number[]): string | null {
    return this.districts.find(d => pointInRing(p, d.ring))?.id ?? null
  }

  /** 陆地上的规则网格点（间距 step 米），每个点带所在片区。用来生成只落在陆地上的热力、柱阵 */
  landGrid(step: number): { xy: XY; districtId: string }[] {
    const xs = this.island.map(p => p[0])
    const ys = this.island.map(p => p[1])
    const out: { xy: XY; districtId: string }[] = []
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += step) {
      for (let y = Math.min(...ys); y <= Math.max(...ys); y += step) {
        if (!this.onLand([x, y])) continue
        const districtId = this.districtAt([x, y])
        if (districtId) out.push({ xy: [x, y], districtId })
      }
    }
    return out
  }
}

/** 把 geo.json 里的全部经纬度一次投影完。project 是场景的经纬度 → 投影坐标转换 */
export async function buildCityGeo(raw: GeoData, project: (lonLat: number[][]) => Promise<number[][]>): Promise<CityGeo> {
  const all: LonLat[] = [...raw.island, ...raw.land]
  raw.districts.forEach(d => all.push(d.center, d.centroid, ...d.boundary))
  raw.roads.forEach(r => all.push(...r.path))
  raw.intersections.forEach(i => all.push(i.position))
  raw.landmarks.forEach(l => all.push(l.position))
  raw.streets?.forEach(s => all.push(...s.path))
  const unique = [...new Map(all.map(p => [p[0] + ',' + p[1], p])).values()]
  const projected = await project(unique)
  const table = new Map<string, XY>()
  unique.forEach((p, i) => table.set(p[0] + ',' + p[1], [projected[i][0], projected[i][1]]))
  return new CityGeo(raw, table)
}
