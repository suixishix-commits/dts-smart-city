import { beforeAll, describe, expect, it, vi } from 'vitest'
import { alongLine, buildCityGeo, type CityGeo, lineLength, pointAt, pointInRing, sliceLine } from '../geo'
import { fakeProject, loadCityGeo, loadGeoJson } from './fixtures'

const SQUARE = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10]
]
/** 直角折线：先向东 10，再向北 10 */
const BENT = [
  [0, 0],
  [10, 0],
  [10, 10]
]

describe('pointInRing', () => {
  it('tells inside from outside', () => {
    expect(pointInRing([5, 5], SQUARE)).toBe(true)
    expect(pointInRing([15, 5], SQUARE)).toBe(false)
    expect(pointInRing([5, -1], SQUARE)).toBe(false)
  })

  it('handles concave rings', () => {
    // L 形：右上角缺一块
    const L = [
      [0, 0],
      [10, 0],
      [10, 4],
      [4, 4],
      [4, 10],
      [0, 10]
    ]
    expect(pointInRing([2, 8], L)).toBe(true)
    expect(pointInRing([8, 2], L)).toBe(true)
    expect(pointInRing([8, 8], L)).toBe(false)
  })

  it('gives the same answer whether or not the ring repeats its first point', () => {
    const closed = [...SQUARE, SQUARE[0]]
    expect(pointInRing([5, 5], closed)).toBe(true)
    expect(pointInRing([15, 5], closed)).toBe(false)
  })
})

describe('lineLength', () => {
  it('sums the segment lengths', () => {
    expect(lineLength(BENT)).toBe(20)
    expect(lineLength([[0, 0]])).toBe(0)
  })
})

describe('alongLine', () => {
  it('samples every step metres starting at the first point', () => {
    expect(
      alongLine(
        [
          [0, 0],
          [10, 0]
        ],
        4
      )
    ).toEqual([
      [0, 0],
      [4, 0],
      [8, 0]
    ])
  })

  it('carries the remainder across a vertex so the spacing stays even', () => {
    expect(alongLine(BENT, 4)).toEqual([
      [0, 0],
      [4, 0],
      [8, 0],
      [10, 2],
      [10, 6],
      [10, 10]
    ])
  })

  it('returns only the start when the line is shorter than the step', () => {
    expect(alongLine(BENT, 100)).toEqual([[0, 0]])
  })

  it('skips zero-length segments instead of producing NaN', () => {
    const points = alongLine(
      [
        [0, 0],
        [0, 0],
        [10, 0]
      ],
      5
    )
    expect(points).toEqual([
      [0, 0],
      [5, 0],
      [10, 0]
    ])
  })
})

describe('pointAt', () => {
  it('returns the point at a fraction of the total length', () => {
    expect(pointAt(BENT, 0)).toEqual([0, 0])
    expect(pointAt(BENT, 0.25)).toEqual([5, 0])
    expect(pointAt(BENT, 0.5)).toEqual([10, 0])
    expect(pointAt(BENT, 0.75)).toEqual([10, 5])
    expect(pointAt(BENT, 1)).toEqual([10, 10])
  })

  it('clamps the fraction to 0–1', () => {
    expect(pointAt(BENT, -2)).toEqual([0, 0])
    expect(pointAt(BENT, 3)).toEqual([10, 10])
  })

  it('returns the only point of a degenerate line', () => {
    expect(
      pointAt(
        [
          [3, 4],
          [3, 4]
        ],
        0.5
      )
    ).toEqual([3, 4])
  })
})

describe('sliceLine', () => {
  it('keeps the vertices strictly between the two cut points', () => {
    expect(sliceLine(BENT, 0.25, 0.75)).toEqual([
      [5, 0],
      [10, 0],
      [10, 5]
    ])
  })

  it('returns just the two cut points when no vertex lies between them', () => {
    expect(sliceLine(BENT, 0.1, 0.4)).toEqual([
      [2, 0],
      [8, 0]
    ])
  })

  it('returns the whole line for 0–1 without duplicating the ends', () => {
    expect(sliceLine(BENT, 0, 1)).toEqual(BENT)
  })

  it('has the length of the requested share', () => {
    expect(lineLength(sliceLine(BENT, 0.2, 0.9))).toBeCloseTo(14)
  })
})

describe('buildCityGeo / CityGeo（真实 geo.json + 假投影）', () => {
  let geo: CityGeo

  beforeAll(async () => {
    geo = await loadCityGeo()
  })

  it('projects every coordinate in one call, without duplicates', async () => {
    const project = vi.fn(fakeProject)
    await buildCityGeo(loadGeoJson(), project)
    expect(project).toHaveBeenCalledTimes(1)
    const sent = project.mock.calls[0][0].map(p => p.join(','))
    expect(new Set(sent).size).toBe(sent.length)
  })

  it('exposes projected copies of everything in geo.json', () => {
    const raw = geo.raw
    expect(geo.island).toHaveLength(raw.island.length)
    expect(geo.land).toHaveLength(raw.land.length)
    expect(geo.districts.map(d => d.id)).toEqual(raw.districts.map(d => d.id))
    expect(geo.roads.map(r => r.line.length)).toEqual(raw.roads.map(r => r.path.length))
    expect(geo.intersections).toHaveLength(raw.intersections.length)
    expect(geo.landmarks).toHaveLength(raw.landmarks.length)

    const d = geo.districts[0]
    expect(d.ring[0][0]).toBeCloseTo(d.boundary[0][0] * 1e5)
    expect(d.ring[0][1]).toBeCloseTo(d.boundary[0][1] * 1e5)
    expect(d.centerXY[0]).toBeCloseTo(d.center[0] * 1e5)
    expect(geo.intersections[0].xy[1]).toBeCloseTo(geo.intersections[0].position[1] * 1e5)
    // 只保留 x、y
    expect(d.ring[0]).toHaveLength(2)
  })

  it('looks up the projection of a known coordinate', () => {
    const p = geo.raw.landmarks[0].position
    expect(geo.xy(p)[0]).toBeCloseTo(p[0] * 1e5)
    expect(geo.xy(p)[1]).toBeCloseTo(p[1] * 1e5)
  })

  it('throws a descriptive error for a coordinate that is not in geo.json', () => {
    expect(() => geo.xy([1, 2])).toThrow(/没有 \[1, 2\] 的投影坐标/)
  })

  it('finds districts, roads and landmarks by id', () => {
    expect(geo.district('danah')?.name).toBe('达纳')
    expect(geo.road('corniche')?.name).toBe('滨海大道')
    expect(geo.landmark('grand-mosque')?.name).toBe('谢赫扎耶德大清真寺')
    expect(geo.district('nope')).toBeUndefined()
    expect(geo.road('nope')).toBeUndefined()
    expect(geo.landmark('nope')).toBeUndefined()
  })

  it('districtAt returns the district a point is in, or null outside every district', () => {
    for (const d of geo.districts) expect(geo.districtAt(d.centerXY)).toBe(d.id)
    expect(geo.districtAt([0, 0])).toBeNull()
  })

  it('onLand is true inside the shrunken coastline and false at sea', () => {
    for (const d of geo.districts) expect(geo.onLand(d.centerXY)).toBe(true)
    const [minX, minY] = [Math.min(...geo.island.map(p => p[0])), Math.min(...geo.island.map(p => p[1]))]
    expect(geo.onLand([minX - 1000, minY - 1000])).toBe(false)
    // 海岸线顶点本身在向内收过的陆地范围之外
    expect(geo.island.every(p => !geo.onLand(p))).toBe(true)
  })

  it('landGrid returns only on-land points, each with the district it is in', () => {
    const grid = geo.landGrid(480)
    expect(grid.length).toBeGreaterThan(100)
    for (const g of grid) {
      expect(geo.onLand(g.xy)).toBe(true)
      expect(g.districtId).toBe(geo.districtAt(g.xy))
      expect(geo.district(g.districtId)).toBeDefined()
    }
  })

  it('landGrid is a regular grid: spacing is a multiple of the step and a larger step gives fewer points', () => {
    const grid = geo.landGrid(480)
    const x0 = Math.min(...geo.island.map(p => p[0]))
    const y0 = Math.min(...geo.island.map(p => p[1]))
    const offGrid = (v: number) => Math.abs(v / 480 - Math.round(v / 480))
    for (const g of grid) {
      expect(offGrid(g.xy[0] - x0)).toBeLessThan(1e-6)
      expect(offGrid(g.xy[1] - y0)).toBeLessThan(1e-6)
    }
    expect(geo.landGrid(960).length).toBeLessThan(grid.length)
  })

  it('landGrid covers every district at the heat-map spacing', () => {
    const covered = new Set(geo.landGrid(480).map(g => g.districtId))
    expect([...covered].sort()).toEqual(geo.districts.map(d => d.id).sort())
  })
})
