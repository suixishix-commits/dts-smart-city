import { describe, expect, it } from 'vitest'
import { pointInRing } from '../geo'
import { loadGeoJson, loadOverviewJson } from './fixtures'

/**
 * geo.json（scripts/build-geo.mjs 的产物）和 overview.json 的数据体检：
 * 所有模块的 mock 都从 geo.json 派生，它出问题时各模块的图层会掉进海里或对不上路网。
 */
const geo = loadGeoJson()
const overview = loadOverviewJson()

/** 经纬度 → 以主岛中心为原点的近似平面坐标（米） */
function metres(p: number[]): [number, number] {
  const lat0 = (geo.center[1] * Math.PI) / 180
  return [(p[0] - geo.center[0]) * 111320 * Math.cos(lat0), (p[1] - geo.center[1]) * 110540]
}

/** 点到闭合多边形边线的最短距离，米 */
function distanceToRing(p: number[], ring: number[][]): number {
  const [px, py] = metres(p)
  let best = Infinity
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = metres(ring[i])
    const [bx, by] = metres(ring[(i + 1) % ring.length])
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2
    const t = len2 ? Math.min(1, Math.max(0, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2)) : 0
    best = Math.min(best, Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay))))
  }
  return best
}

const onIsland = (p: number[]) => pointInRing(p, geo.island)

describe('geo.json', () => {
  it('has the documented amount of content', () => {
    expect(geo.districts).toHaveLength(16)
    expect(geo.roads).toHaveLength(17)
    expect(geo.intersections).toHaveLength(36)
    expect(geo.landmarks).toHaveLength(21)
  })

  it('has unique ids within each collection', () => {
    for (const list of [geo.districts, geo.roads, geo.intersections, geo.landmarks]) {
      const ids = list.map(x => x.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('keeps every coordinate inside the bounding box', () => {
    const [minLon, minLat, maxLon, maxLat] = geo.bbox
    const all = [...geo.island, ...geo.land, ...geo.districts.flatMap(d => [d.center, d.centroid, ...d.boundary]), ...geo.roads.flatMap(r => r.path), ...geo.intersections.map(i => i.position)]
    for (const p of all) {
      expect(p[0]).toBeGreaterThanOrEqual(minLon - 1e-6)
      expect(p[0]).toBeLessThanOrEqual(maxLon + 1e-6)
      expect(p[1]).toBeGreaterThanOrEqual(minLat - 1e-6)
      expect(p[1]).toBeLessThanOrEqual(maxLat + 1e-6)
    }
  })

  it('gives every district a boundary of at least 4 points, a positive area and density', () => {
    for (const d of geo.districts) {
      expect(d.boundary.length, d.id).toBeGreaterThanOrEqual(4)
      expect(d.areaKm2, d.id).toBeGreaterThan(0)
      expect(d.baseDensity, d.id).toBeGreaterThan(0)
    }
  })

  it('does not repeat the first boundary point at the end of a district ring', () => {
    for (const d of geo.districts) expect(d.boundary[d.boundary.length - 1], d.id).not.toEqual(d.boundary[0])
  })

  it('puts every district label point inside its own boundary', () => {
    for (const d of geo.districts) expect(pointInRing(d.center, d.boundary), d.id).toBe(true)
  })

  it('keeps the shrunken land ring inside the coastline', () => {
    for (const p of geo.land) expect(onIsland(p), p.join(',')).toBe(true)
  })

  it('gives every road at least two points, a valid level and a length', () => {
    for (const r of geo.roads) {
      expect(r.path.length, r.id).toBeGreaterThanOrEqual(2)
      expect([1, 2, 3], r.id).toContain(r.level)
      expect(['long', 'cross'], r.id).toContain(r.direction)
      expect(r.lengthKm, r.id).toBeGreaterThan(0)
    }
  })

  it('has no repeated consecutive points in any road', () => {
    for (const r of geo.roads) {
      for (let i = 1; i < r.path.length; i++) expect(r.path[i], `${r.id}[${i}]`).not.toEqual(r.path[i - 1])
    }
  })

  it('places every landmark except bridges inside the island polygon', () => {
    for (const l of geo.landmarks.filter(l => l.type !== 'bridge')) expect(onIsland(l.position), l.id).toBe(true)
  })

  it('places every intersection inside the island polygon', () => {
    for (const i of geo.intersections) expect(onIsland(i.position), i.id).toBe(true)
  })

  it('references existing roads from every intersection: a cross street and a longitudinal trunk road', () => {
    const roads = new Map(geo.roads.map(r => [r.id, r]))
    for (const i of geo.intersections) {
      expect(i.roads, i.id).toHaveLength(2)
      const [cross, long] = i.roads.map(id => roads.get(id))
      expect(cross, i.id).toBeDefined()
      expect(long, i.id).toBeDefined()
      expect(cross?.direction, i.id).toBe('cross')
      expect(long?.direction, i.id).toBe('long')
      expect(i.id).toBe(`${i.roads[0]}-${i.roads[1]}`)
    }
  })

  it('only references existing districts, and the point lies in or on the edge of that district', () => {
    const districts = new Map(geo.districts.map(d => [d.id, d]))
    for (const x of [...geo.intersections, ...geo.landmarks]) {
      if (x.districtId === null) continue
      const d = districts.get(x.districtId)
      expect(d, x.id).toBeDefined()
      // 路口是横街与主干路的交点，正好落在片区的公共边上：坐标取整后可能偏到边线外几米
      expect(pointInRing(x.position, d!.boundary) || distanceToRing(x.position, d!.boundary) <= 20, x.id).toBe(true)
    }
  })
})

describe('overview.json', () => {
  it('places every hotspot inside the island polygon or within 300 m of it', () => {
    for (const h of overview.hotspots) {
      expect(onIsland(h.position) || distanceToRing(h.position, geo.island) <= 300, h.id).toBe(true)
    }
  })

  it('places every camera inside the island polygon or within 300 m of it', () => {
    for (const c of overview.cameras) {
      expect(onIsland(c.position) || distanceToRing(c.position, geo.island) <= 300, c.id).toBe(true)
    }
  })

  it('links every hotspot to an existing district and camera', () => {
    const districtIds = geo.districts.map(d => d.id)
    const cameraIds = overview.cameras.map(c => c.id)
    for (const h of overview.hotspots) {
      expect(districtIds, h.id).toContain(h.districtId)
      expect(cameraIds, h.id).toContain(h.cameraId)
      expect(h.heat, h.id).toBeGreaterThan(0)
      expect(h.heat, h.id).toBeLessThanOrEqual(100)
    }
  })
})
