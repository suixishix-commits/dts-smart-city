import { describe, expect, it } from 'vitest'
import { loadGeoJson } from '@/scene/__tests__/fixtures'
import { districtDensityAt, heatGridAt, hotspotActivityAt, islandPopulationAt, populationPeak, populationSeries, populationSeriesYesterday } from '../population'

/** 三种功能类型各取一个真实片区 */
const business = { id: 'danah', baseDensity: 2 }
const residential = { id: 'bateen', baseDensity: 0.7 }
const leisure = { id: 'khalidiyah', baseDensity: 1.7 }

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
  it('scales the base density by the daily profile of the district type', () => {
    // 商务区 13 点系数 1.2；居住区 22 点 1.2；滨海休闲区 19:30 1.6
    expect(districtDensityAt(business, 13)).toBeCloseTo(2.4)
    expect(districtDensityAt(residential, 22)).toBeCloseTo(0.84)
    expect(districtDensityAt(leisure, 19.5)).toBeCloseTo(2.72)
  })

  it('interpolates linearly between profile control points', () => {
    // 商务区 6 点 0.5，9 点 1.05 → 7:30 为 0.775
    expect(districtDensityAt(business, 7.5)).toBeCloseTo(2 * 0.775)
  })

  it('empties business districts at night and fills residential ones', () => {
    expect(districtDensityAt(business, 2)).toBeLessThan(districtDensityAt(business, 13))
    expect(districtDensityAt(residential, 2)).toBeGreaterThan(districtDensityAt(residential, 13))
  })

  it('peaks leisure districts in the evening', () => {
    const hours = Array.from({ length: 49 }, (_, i) => i / 2)
    const peak = hours.reduce((a, b) => (districtDensityAt(leisure, b) > districtDensityAt(leisure, a) ? b : a))
    expect(peak).toBe(19.5)
  })

  it('gives districts of different types different curves at the same hour', () => {
    const same = { baseDensity: 1 }
    const at13 = ['danah', 'bateen', 'khalidiyah'].map(id => districtDensityAt({ ...same, id }, 13))
    expect(new Set(at13.map(v => v.toFixed(3))).size).toBe(3)
  })

  it('treats an unknown district as residential', () => {
    expect(districtDensityAt({ id: 'somewhere-else', baseDensity: 0.7 }, 22)).toBeCloseTo(districtDensityAt(residential, 22))
  })

  it('clamps out-of-range hours and is continuous across midnight', () => {
    for (const d of [business, residential, leisure]) {
      expect(districtDensityAt(d, -5)).toBeCloseTo(districtDensityAt(d, 0))
      expect(districtDensityAt(d, 30)).toBeCloseTo(districtDensityAt(d, 24))
      expect(districtDensityAt(d, 24)).toBeCloseTo(districtDensityAt(d, 0))
    }
  })

  it('stays positive and within the colour ramp ceiling all day for every district in geo.json', () => {
    const geo = loadGeoJson()
    for (const d of geo.districts) {
      const values = Array.from({ length: 49 }, (_, i) => districtDensityAt(d, i / 2))
      expect(Math.min(...values), d.id).toBeGreaterThan(0)
      // OverviewScene 的密度色带上限是 2.8 万人/km²
      expect(Math.max(...values), d.id).toBeLessThanOrEqual(2.8)
    }
  })
})

describe('hotspotActivityAt', () => {
  it('is the heat share at the evening peak', () => {
    expect(hotspotActivityAt({ heat: 96 }, 19.5)).toBeCloseTo(0.96)
    expect(hotspotActivityAt({ heat: 50 }, 19.5)).toBeCloseTo(0.5)
  })

  it('is close to zero in the small hours', () => {
    expect(hotspotActivityAt({ heat: 96 }, 0)).toBeCloseTo(0.096)
    expect(hotspotActivityAt({ heat: 96 }, 24)).toBeCloseTo(0.096)
  })

  it('interpolates between control points', () => {
    // 12 点 0.55，16 点 0.75 → 14 点 0.65
    expect(hotspotActivityAt({ heat: 100 }, 14)).toBeCloseTo(0.65)
  })

  it('stays within 0–1 all day and is proportional to heat', () => {
    for (let h = 0; h <= 24; h += 0.5) {
      const a = hotspotActivityAt({ heat: 100 }, h)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThanOrEqual(1)
      expect(hotspotActivityAt({ heat: 40 }, h)).toBeCloseTo(a * 0.4)
    }
  })
})

describe('heatGridAt', () => {
  const districts = [business, residential]
  const grid = [
    { xy: [1000, 2000], districtId: 'danah' },
    { xy: [1480, 2000], districtId: 'danah' },
    { xy: [5000, 9000], districtId: 'bateen' }
  ]
  const hotspots = [{ id: 'h1', heat: 96, xy: [1200, 2100] }]

  it('returns one point per grid cell followed by one per hotspot', () => {
    const pts = heatGridAt(12, grid, districts, hotspots, 480)
    expect(pts.map(p => p.id)).toEqual(['g0', 'g1', 'g2', 'hot-h1'])
    expect(pts[0].at).toEqual([1000, 2000])
    expect(pts[3].at).toEqual([1200, 2100])
  })

  it('sizes grid points from the step so neighbours overlap, and hotspots at 520 m', () => {
    const pts = heatGridAt(12, grid, districts, hotspots, 480)
    expect(pts[0].radius).toBeCloseTo(528)
    expect(pts[2].radius).toBeCloseTo(528)
    expect(pts[3].radius).toBe(520)
    expect(heatGridAt(12, grid, districts, hotspots, 300)[0].radius).toBeCloseTo(330)
  })

  it('keeps each grid value within ±30% of its district density', () => {
    for (const hour of [3, 12, 19.5]) {
      const pts = heatGridAt(hour, grid, districts, [], 480)
      const danah = districtDensityAt(business, hour)
      const bateen = districtDensityAt(residential, hour)
      for (const [p, density] of [
        [pts[0], danah],
        [pts[1], danah],
        [pts[2], bateen]
      ] as const) {
        expect(p.value).toBeGreaterThanOrEqual(density * 0.7 - 1e-9)
        expect(p.value).toBeLessThanOrEqual(density * 1.3 + 1e-9)
      }
    }
  })

  it('varies between cells of the same district but is the same on every call', () => {
    const a = heatGridAt(12, grid, districts, hotspots, 480)
    const b = heatGridAt(12, grid, districts, hotspots, 480)
    expect(a).toEqual(b)
    expect(a[0].value).not.toBeCloseTo(a[1].value, 6)
  })

  it('keeps the texture fixed over time: the ratio to the district density does not depend on the hour', () => {
    const at = (hour: number) => heatGridAt(hour, grid, districts, [], 480)[0].value / districtDensityAt(business, hour)
    expect(at(3)).toBeCloseTo(at(19.5))
  })

  it('follows the district density when the hour changes', () => {
    const noon = heatGridAt(13, grid, districts, [], 480)
    const night = heatGridAt(2, grid, districts, [], 480)
    // 商务区白天高、夜里低；居住区相反
    expect(noon[0].value).toBeGreaterThan(night[0].value)
    expect(noon[2].value).toBeLessThan(night[2].value)
  })

  it('gives a grid cell of an unknown district the value 0', () => {
    const pts = heatGridAt(12, [{ xy: [0, 0], districtId: 'nowhere' }], districts, [], 480)
    expect(pts[0].value).toBe(0)
  })

  it('adds the crowd around hotspots: 3 × activity, higher for hotter events', () => {
    const cooler = { id: 'h2', heat: 48, xy: [3000, 3000] }
    const pts = heatGridAt(19.5, [], districts, [hotspots[0], cooler], 480)
    expect(pts.map(p => p.id)).toEqual(['hot-h1', 'hot-h2'])
    expect(pts[0].value).toBeCloseTo(3 * 0.96)
    expect(pts[1].value).toBeCloseTo(3 * 0.48)
    expect(heatGridAt(3, [], districts, hotspots, 480)[0].value).toBeLessThan(pts[0].value)
  })

  it('returns nothing for an empty grid without hotspots', () => {
    expect(heatGridAt(12, [], districts, [], 480)).toEqual([])
  })
})

describe('populationSeriesYesterday', () => {
  it('has the same half-hour points as today, close to but not equal to today, and no evening event peak', () => {
    const today = populationSeries()
    const y = populationSeriesYesterday()
    expect(y.map(p => p[0])).toEqual(today.map(p => p[0]))
    y.forEach((p, i) => expect(Math.abs(p[1] - today[i][1])).toBeLessThan(6))
    expect(y).not.toEqual(today)
    const at = (s: [number, number][], h: number) => s.find(p => p[0] === h)![1]
    expect(at(y, 19.5)).toBeLessThan(at(today, 19.5))
  })
})
