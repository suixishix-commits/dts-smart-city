import type { District, HeatPoint, Hotspot } from '@/types/smartCity'

/** 主岛在岛人口（万人）一天内的控制点：[小时, 人口] */
const CURVE: [number, number][] = [
  [0, 62], [3, 58], [6, 61], [8, 74], [10, 79], [12, 80],
  [14.5, 78.6], [16, 82], [18, 88], [19.5, 91.2], [21, 84], [24, 66]
]
/** 密度基准时刻的人口（12:00） */
const BASELINE = 80

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

/** 片区某时刻的人口密度（万人/km²） */
export function districtDensityAt(district: District, hour: number): number {
  return (district.baseDensity * islandPopulationAt(hour)) / BASELINE
}

/** 某时刻的热力点：每个片区中心一个点，每个热点事件一个点 */
export function heatPointsAt(hour: number, districts: District[], hotspots: Hotspot[]): HeatPoint[] {
  const points: HeatPoint[] = districts.map(d => ({
    id: 'heat-' + d.id,
    position: d.center,
    radius: 900,
    value: districtDensityAt(d, hour)
  }))
  hotspots.forEach(h => {
    points.push({ id: 'heat-' + h.id, position: h.position, radius: 450, value: (h.heat / 100) * 3 })
  })
  return points
}
