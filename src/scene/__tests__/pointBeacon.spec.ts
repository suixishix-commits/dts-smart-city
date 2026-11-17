import { describe, expect, it } from 'vitest'
import { alarmPoints } from '../kit'
import { BEACON_MATERIAL, BEACON_TIERS, beaconMesh } from '../pointBeacon'

describe('beaconMesh', () => {
  it('returns null for no points', () => {
    expect(beaconMesh('x', [])).toBeNull()
  })

  it('puts only a ground quad under every point by default', () => {
    const mesh = beaconMesh('layer', [
      { at: [1000, 2000], level: 1 },
      { at: [3000, 4000], level: 4 }
    ]) as { coordinates: number[][] }
    expect(mesh.coordinates).toHaveLength(2 * 4)
  })

  it('adds crossed beam quads for a tier with a beam height', () => {
    const tiers = { ...BEACON_TIERS, 1: { radius: BEACON_TIERS[1].radius, beam: 900, beamWidth: 110 } }
    const mesh = beaconMesh('layer', [
      { at: [1000, 2000], level: 1 },
      { at: [3000, 4000], level: 4 }
    ], { tiers }) as { coordinates: number[][]; colors: number[][]; indices: number[]; material: string }
    // 一级：地面 1 片 + 光柱 3 片；四级：只有地面 1 片；每片 4 个顶点、2 个三角形
    expect(mesh.coordinates).toHaveLength((1 + 3 + 1) * 4)
    expect(mesh.indices).toHaveLength((1 + 3 + 1) * 6)
    expect(mesh.material).toBe(BEACON_MATERIAL)
    // 地面方片：以点为中心、边长 2 × 半径
    const r = BEACON_TIERS[1].radius
    expect(mesh.coordinates[0].slice(0, 2)).toEqual([1000 - r, 2000 - r])
    expect(mesh.coordinates[2].slice(0, 2)).toEqual([1000 + r, 2000 + r])
    // 光柱面片顶部高出地面 beam 米
    const beamTop = mesh.coordinates[6][2] - mesh.coordinates[4][2]
    expect(beamTop).toBeCloseTo(900)
  })

  it('encodes quad corners in R/G, ground or beam in B and the level in A', () => {
    const tiers = { ...BEACON_TIERS, 1: { radius: 100, beam: 200, beamWidth: 20 } }
    const mesh = beaconMesh('layer', [{ at: [0, 0], level: 1 }], { tiers }) as { colors: number[][] }
    expect(mesh.colors.slice(0, 4)).toEqual([
      [0, 0, 0, 0.25],
      [1, 0, 0, 0.25],
      [1, 1, 0, 0.25],
      [0, 1, 0, 0.25]
    ])
    expect(mesh.colors[4][2]).toBe(1)
  })
})

describe('alarmPoints', () => {
  const points = [{ id: 'a', at: [10, 20], level: 1 as const, color: '#ff6b6b', radius: 500 }]

  it('builds one customMesh for the layer when the beacon pak is mounted', () => {
    const r = alarmPoints({ id: 'incident-ripple', groupId: 'g', beacons: true, points })
    expect(r.type).toBe('customMesh')
    expect(r.objects.map(o => o.id)).toEqual(['incident-ripple'])
  })

  it('falls back to one DTS ripple per point with the old ids', () => {
    const r = alarmPoints({ id: 'incident-ripple', groupId: 'g', beacons: false, points })
    expect(r.type).toBe('radiationPoint')
    expect(r.objects).toMatchObject([{ id: 'incident-ripple-a', groupId: 'g', radius: 500 }])
  })
})
