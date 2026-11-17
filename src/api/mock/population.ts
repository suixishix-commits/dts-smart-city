import type { District, Hotspot } from '@/types/smartCity'

/** 主岛在岛人口（万人）一天内的控制点：[小时, 人口] */
const CURVE: [number, number][] = [
  [0, 62], [3, 58], [6, 61], [8, 74], [10, 79], [12, 80],
  [14.5, 78.6], [16, 82], [18, 88], [19.5, 91.2], [21, 84], [24, 66]
]
/** 某时刻的在岛人口（万人），控制点之间线性插值 */
export function islandPopulationAt(hour: number): number {
  const h = Math.min(24, Math.max(0, hour))
  for (let i = 1; i < CURVE.length; i++) {
    const [h0, v0] = CURVE[i - 1]
    const [h1, v1] = CURVE[i]
    if (h <= h1) return v0 + ((v1 - v0) * (h - h0)) / (h1 - h0)
  }
  return CURVE[CURVE.length - 1][1]
}

/** 一天中的峰值时刻与人口 */
export function populationPeak(): { hour: number; value: number } {
  const top = CURVE.reduce((a, b) => (b[1] > a[1] ? b : a))
  return { hour: top[0], value: top[1] }
}

/** 每半小时一个点的全天序列：[小时, 人口] */
export function populationSeries(): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i <= 48; i++) {
    const h = i / 2
    out.push([h, Math.round(islandPopulationAt(h) * 10) / 10])
  }
  return out
}

/** 昨日同时段的全天序列：形状与今日相同，白天略低、晚高峰略早（昨日是工作日，没有大型活动） */
export function populationSeriesYesterday(): [number, number][] {
  return populationSeries().map(([h, v]) => {
    const evening = Math.exp(-((h - 18.5) ** 2) / 4) // 18:30 附近的晚高峰
    return [h, Math.round((v * 0.97 - evening * 2.6 + Math.sin(h * 1.3) * 0.6) * 10) / 10]
  })
}

/**
 * 片区的功能类型决定它一天里的人口起伏：
 * 商务区白天人多夜里空，居住区相反，滨海休闲区傍晚到夜间最热闹。
 */
type DistrictKind = 'business' | 'residential' | 'leisure'
const KIND: Record<string, DistrictKind> = {
  danah: 'business', markaziyah: 'business', zahiyah: 'business', wahda: 'business', manhal: 'business',
  khalidiyah: 'leisure', rasakhdar: 'leisure', maqta: 'leisure',
  bateen: 'residential', nahyan: 'residential', mushrif: 'residential', muroor: 'residential',
  rawdah: 'residential', qurm: 'residential', safarat: 'residential', zafranah: 'residential'
}
/** 各类型相对基准密度的系数控制点：[小时, 系数] */
const PROFILE: Record<DistrictKind, [number, number][]> = {
  business: [[0, 0.45], [6, 0.5], [9, 1.05], [13, 1.2], [17, 1.15], [20, 0.8], [24, 0.45]],
  residential: [[0, 1.15], [7, 1.1], [10, 0.75], [16, 0.8], [19, 1.05], [22, 1.2], [24, 1.15]],
  leisure: [[0, 0.5], [8, 0.6], [12, 0.9], [16, 1.1], [19.5, 1.6], [22, 1.3], [24, 0.5]]
}

function interpolate(points: [number, number][], hour: number): number {
  const h = Math.min(24, Math.max(0, hour))
  for (let i = 1; i < points.length; i++) {
    const [h0, v0] = points[i - 1]
    const [h1, v1] = points[i]
    if (h <= h1) return v0 + ((v1 - v0) * (h - h0)) / (h1 - h0)
  }
  return points[points.length - 1][1]
}

/** 片区某时刻的人口密度（万人/km²）：基准密度 × 该类片区在这个时刻的系数 */
export function districtDensityAt(district: Pick<District, 'id' | 'baseDensity'>, hour: number): number {
  return district.baseDensity * interpolate(PROFILE[KIND[district.id] ?? 'residential'], hour)
}

/** 热点事件某时刻的活跃度 0–1：傍晚到夜间最高，凌晨接近 0 */
export function hotspotActivityAt(hotspot: Pick<Hotspot, 'heat'>, hour: number): number {
  return (hotspot.heat / 100) * interpolate([[0, 0.1], [8, 0.2], [12, 0.55], [16, 0.75], [19.5, 1], [22, 0.7], [24, 0.1]], hour)
}

/** 位置固定的伪随机数 0–1：同一个网格点每次得到同样的值，热力纹理才不会随时间闪动 */
function noise(x: number, y: number): number {
  const s = Math.sin(x * 0.0127 + y * 0.0311) * 43758.5453
  return s - Math.floor(s)
}

/**
 * 某时刻的人口热力点（投影坐标）。
 * grid 是陆地上的规则网格（CityGeo.landGrid），所以热力只落在岛上、不会漫到海里；
 * 每个点的值 = 所在片区的密度 × 位置扰动，再叠加热点事件周围的人群。
 */
export function heatGridAt(
  hour: number,
  grid: { xy: number[]; districtId: string }[],
  districts: Pick<District, 'id' | 'baseDensity'>[],
  hotspots: { id: string; heat: number; xy: number[] }[],
  step: number
): { id: string; at: number[]; radius: number; value: number }[] {
  const density = new Map(districts.map(d => [d.id, districtDensityAt(d, hour)]))
  const points = grid.map((g, i) => ({
    id: 'g' + i,
    at: g.xy,
    radius: step * 1.1,
    value: (density.get(g.districtId) ?? 0) * (0.7 + 0.6 * noise(g.xy[0], g.xy[1]))
  }))
  hotspots.forEach(h => points.push({ id: 'hot-' + h.id, at: h.xy, radius: 520, value: 3 * hotspotActivityAt(h, hour) }))
  return points
}
