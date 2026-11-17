import { describe, expect, it } from 'vitest'
import type { SceneApi, SceneObjectType } from '../SceneApi'
import { FLOW_PERIOD, OD_ARC_MATERIAL, odArcMeshDirected, RecolorMeshLayer, ROAD_FLOW_MATERIAL, roadFlowMesh, type RoadFlow } from '../trafficFlow'

const road = (o: Partial<RoadFlow> = {}): RoadFlow => ({
  id: 'r',
  path: [
    [0, 0],
    [400, 0],
    [400, 250]
  ],
  width: 40,
  level: 2,
  reverse: false,
  ...o
})

type Built = NonNullable<ReturnType<typeof roadFlowMesh>>
const meshOf = (b: Built) => b.mesh as unknown as { coordinates: number[][]; colors: number[][]; indices: number[]; material: string }

describe('roadFlowMesh', () => {
  it('lays a ribbon of quads along the road, none longer than one flow period', () => {
    const b = roadFlowMesh('m', [road()]) as Built
    const m = meshOf(b)
    expect(m.material).toBe(ROAD_FLOW_MATERIAL)
    expect(m.coordinates.length % 4).toBe(0)
    expect(m.indices).toHaveLength((m.coordinates.length / 4) * 6)
    // 每个四边形的长度不超过一个周期（相位才能落在 0–1 之间）
    for (let q = 0; q < m.coordinates.length; q += 4) {
      const [a, , c] = [m.coordinates[q], m.coordinates[q + 1], m.coordinates[q + 2]]
      const mid0 = a
      const len = Math.hypot(c[0] - mid0[0], c[1] - mid0[1])
      expect(len).toBeLessThanOrEqual(FLOW_PERIOD + 40 + 1e-6)
    }
    // 丝带宽 40 米：同一个横截面两侧相距 40 米
    expect(Math.hypot(m.coordinates[1][0] - m.coordinates[0][0], m.coordinates[1][1] - m.coordinates[0][1])).toBeCloseTo(40)
  })

  it('encodes side in R, the congestion level in G/B and a 0–1 phase in A', () => {
    const b = roadFlowMesh('m', [road({ level: 3 })]) as Built
    for (const c of meshOf(b).colors) {
      expect([0, 1]).toContain(c[0])
      expect([c[1], c[2]]).toEqual([1, 1])
      expect(c[3]).toBeGreaterThanOrEqual(0)
      expect(c[3]).toBeLessThanOrEqual(1)
    }
    const free = roadFlowMesh('m', [road({ level: 0 })]) as Built
    expect(meshOf(free).colors.every(c => c[1] === 0 && c[2] === 0)).toBe(true)
  })

  it('keeps the same geometry when the direction or the level changes, only the colours differ', () => {
    const a = roadFlowMesh('m', [road()]) as Built
    const b = roadFlowMesh('m', [road({ reverse: true, level: 0 })]) as Built
    expect(b.key).toBe(a.key)
    expect(meshOf(b).coordinates).toEqual(meshOf(a).coordinates)
    expect(meshOf(b).colors).not.toEqual(meshOf(a).colors)
    // 反向时相位沿路递减：第一个四边形的起点相位大于终点
    const first = meshOf(b).colors
    expect(first[0][3]).toBeGreaterThan(first[3][3])
    for (const c of first) expect(c[3]).toBeGreaterThanOrEqual(0)
  })

  it('returns null without roads', () => {
    expect(roadFlowMesh('m', [])).toBeNull()
  })
})

describe('odArcMeshDirected', () => {
  const arc = { id: 'f', from: [0, 0], to: [4000, 0], width: 20, warm: true }

  it('draws a low arc from origin to destination with the along position in A', () => {
    const b = odArcMeshDirected('od', [{ ...arc, reverse: false }]) as NonNullable<ReturnType<typeof odArcMeshDirected>>
    const m = b.mesh as unknown as { coordinates: number[][]; colors: number[][]; material: string }
    expect(m.material).toBe(OD_ARC_MATERIAL)
    const top = Math.max(...m.coordinates.map(c => c[2]))
    // 弧高约为弦长的 12%（不在天上铺开一大片）
    expect(top).toBeLessThan(4000 * 0.15)
    expect(m.colors[0][3]).toBe(0)
    expect(m.colors.at(-1)?.[3]).toBe(1)
    expect(m.colors.every(c => c[1] === 1)).toBe(true)
  })

  it('reverses only the colours when the commute direction flips', () => {
    const go = odArcMeshDirected('od', [{ ...arc, reverse: false }]) as NonNullable<ReturnType<typeof odArcMeshDirected>>
    const back = odArcMeshDirected('od', [{ ...arc, reverse: true }]) as NonNullable<ReturnType<typeof odArcMeshDirected>>
    expect(back.key).toBe(go.key)
    expect((back.mesh as { coordinates: unknown }).coordinates).toEqual((go.mesh as { coordinates: unknown }).coordinates)
    expect(back.colors()[0][3]).toBe(1)
  })
})

class FakeApi implements SceneApi {
  log: string[] = []
  ids = new Set<string>()
  async add(type: SceneObjectType, objects: { id: string }[]) {
    objects.forEach(o => (this.ids.add(o.id), this.log.push('add ' + o.id)))
  }
  async remove(type: SceneObjectType, ids: string[]) {
    ids.forEach(id => this.ids.delete(id))
    this.log.push('remove ' + ids.join(','))
  }
  async update(type: SceneObjectType, objects: { id: string }[]) {
    this.log.push('update ' + objects.map(o => o.id).join(','))
  }
  async setVisible(type: SceneObjectType, ids: string[], visible: boolean) {
    this.log.push(`visible ${ids.join(',')} ${visible}`)
  }
  async setCamera() {}
  async focus() {}
  async project(p: number[][]) {
    return p
  }
}

describe('RecolorMeshLayer', () => {
  it('builds once and then only recolours while the shape is unchanged', async () => {
    const api = new FakeApi()
    const layer = new RecolorMeshLayer(api, 'flow')
    await layer.show(id => roadFlowMesh(id, [road()]))
    await layer.show(id => roadFlowMesh(id, [road({ reverse: true, level: 3 })]))
    await layer.show(id => roadFlowMesh(id, [road({ level: 1 })]))
    expect(api.log).toEqual(['add flow-b', 'update flow-b', 'update flow-b'])
  })

  it('replaces the mesh when the shape changes, and clears on leave', async () => {
    const api = new FakeApi()
    const layer = new RecolorMeshLayer(api, 'flow')
    await layer.show(id => roadFlowMesh(id, [road()]))
    await layer.show(id => roadFlowMesh(id, [road({ width: 20 })]))
    expect(api.log).toEqual(['add flow-b', 'add flow-a', 'remove flow-b'])
    await layer.clear()
    expect(api.ids.size).toBe(0)
  })

  it('creates nothing while hidden and builds the latest data when shown', async () => {
    const api = new FakeApi()
    const layer = new RecolorMeshLayer(api, 'flow')
    await layer.setVisible(false)
    await layer.show(id => roadFlowMesh(id, [road()]))
    expect(api.log).toEqual([])
    await layer.setVisible(true)
    expect(api.log).toEqual(['add flow-b'])
  })
})
