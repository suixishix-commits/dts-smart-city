import { describe, expect, it } from 'vitest'
import type { District, Hotspot } from '@/types/smartCity'
import { districtDensityAt, heatPointsAt, islandPopulationAt, populationPeak, populationSeries } from '../population'

const districts: District[] = [
  { id: 'd1', name: '甲', center: [54.36, 24.49], boundary: [], baseDensity: 2.0 },
  { id: 'd2', name: '乙', center: [54.34, 24.47], boundary: [], baseDensity: 1.0 }
]
const hotspots: Hotspot[] = [
  { id: 'h1', name: '音乐节', shortName: '音乐节', type: '文体活动', districtId: 'd1', position: [54.35, 24.48], heat: 96, people: 18000, cameraId: 'c1', nearbyCameras: 6 }
]

describe('islandPopulationAt', () => {
  it('returns control point values', () => {
    expect(islandPopulationAt(0)).toBeCloseTo(62)
    expect(islandPopulationAt(14.5)).toBeCloseTo(78.6)
    expect(islandPopulationAt(19.5)).toBeCloseTo(91.2)
  })

  it('interpolates linearly between control points', () => {
    // 8 点 74，10 点 79 → 9 点 76.5
    expect(islandPopulationAt(9)).toBeCloseTo(76.5)
  })

  it('clamps out-of-range hours', () => {
    expect(islandPopulationAt(-3)).toBeCloseTo(62)
    expect(islandPopulationAt(30)).toBeCloseTo(66)
  })
})

describe('populationPeak', () => {
  it('finds the peak hour and value', () => {
    expect(populationPeak()).toEqual({ hour: 19.5, value: 91.2 })
  })
})

describe('populationSeries', () => {
  it('samples every half hour from 0 to 24', () => {
    const s = populationSeries()
    expect(s).toHaveLength(49)
    expect(s[0]).toEqual([0, 62])
    expect(s[48][0]).toBe(24)
  })
})

describe('districtDensityAt', () => {
  it('scales base density by the island curve relative to 12:00', () => {
    // 12 点人口 80 是基准，19.5 点 91.2 → 系数 1.14
    expect(districtDensityAt(districts[0], 12)).toBeCloseTo(2.0)
    expect(districtDensityAt(districts[0], 19.5)).toBeCloseTo(2.28)
  })
})

describe('heatPointsAt', () => {
  it('returns one point per district plus one per hotspot', () => {
    const pts = heatPointsAt(12, districts, hotspots)
    expect(pts.map(p => p.id)).toEqual(['heat-d1', 'heat-d2', 'heat-h1'])
  })

  it('uses district density as the district point value', () => {
    const pts = heatPointsAt(12, districts, hotspots)
    expect(pts[0].value).toBeCloseTo(2.0)
    expect(pts[0].position).toEqual([54.36, 24.49])
  })

  it('gives hotter events a higher value', () => {
    const cooler: Hotspot = { ...hotspots[0], id: 'h2', heat: 48 }
    const pts = heatPointsAt(12, districts, [hotspots[0], cooler])
    expect(pts[2].value).toBeGreaterThan(pts[3].value)
  })
})
