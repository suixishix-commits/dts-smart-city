import { describe, expect, it } from 'vitest'
import { HEAT_FIELD_MATERIAL, heatFieldColors, HeatFieldLayer, heatFieldMesh, sampleHeatField } from '../heatField'
import type { SceneApi, SceneObjectType } from '../SceneApi'

const at = (field: ReturnType<typeof sampleHeatField>, x: number, y: number) => {
  const c = Math.round((x - field.origin[0]) / field.step)
  const r = Math.round((y - field.origin[1]) / field.step)
  return field.values[r * field.cols + c]
}

describe('sampleHeatField', () => {
  it('interpolates averaged points smoothly and normalises by the range', () => {
    const points = [
      { at: [0, 0], radius: 500, value: 2 },
      { at: [500, 0], radius: 500, value: 2 }
    ]
    const f = sampleHeatField({ points, range: [0, 4], step: 100 })
    // 两点都是 2：中间也是 2（平均，不是相加），归一化成 0.5
    expect(at(f, 0, 0)).toBeCloseTo(0.5, 2)
    expect(at(f, 200, 0)).toBeCloseTo(0.5, 2)
    // 远离所有点时按覆盖度淡出到 0
    expect(at(f, 250, 700)).toBeLessThan(0.05)
  })

  it('adds extra sources on top as local peaks, clamped to 1', () => {
    const points = [{ at: [0, 0], radius: 500, value: 1 }]
    const base = sampleHeatField({ points, range: [0, 4], step: 100 })
    const peak = sampleHeatField({ points, extra: [{ at: [0, 0], radius: 300, value: 2 }], range: [0, 4], step: 100 })
    expect(at(peak, 0, 0)).toBeCloseTo(at(base, 0, 0) + 0.5, 2)
    const over = sampleHeatField({ points, extra: [{ at: [0, 0], radius: 300, value: 99 }], range: [0, 4], step: 100 })
    expect(at(over, 0, 0)).toBe(1)
  })

  it('returns an empty field without points', () => {
    expect(sampleHeatField({ points: [], range: [0, 1], step: 100 }).values).toHaveLength(0)
  })
})

describe('heatFieldMesh', () => {
  const grid = (values: number[], covered: number[]) => ({ origin: [0, 0] as [number, number], step: 10, cols: 4, rows: 2, values: new Float32Array(values), covered: new Uint8Array(covered) })

  it('emits the covered cells with the density in vertex alpha, independent of the values', () => {
    const f = grid([0, 0, 0, 0.5, 0, 0, 0, 0.5], [0, 0, 1, 1, 0, 0, 1, 1])
    const built = heatFieldMesh('m', f) as NonNullable<ReturnType<typeof heatFieldMesh>>
    const mesh = built.mesh as unknown as { coordinates: number[][]; colors: number[][]; indices: number[]; material: string; scalarParameters: unknown[] }
    // 只有最右一格（第 2–3 列）四角都被覆盖：4 个顶点、2 个三角形；值为 0 的格点也要发（换时刻时形状不变）
    expect(mesh.indices).toHaveLength(6)
    expect(mesh.coordinates.map(c => c[0]).sort()).toEqual([20, 20, 30, 30])
    expect(mesh.colors.map(c => c[3]).sort()).toEqual([0, 0, 0.5, 0.5])
    expect(mesh.material).toBe(HEAT_FIELD_MATERIAL)
    expect(mesh.scalarParameters).toEqual([{ name: 'Opacity', value: 1 }])
    // 同样覆盖、不同数值：拓扑相同
    const other = heatFieldMesh('m', grid([0, 0, 1, 1, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0, 1, 1])) as NonNullable<ReturnType<typeof heatFieldMesh>>
    expect(other.layout.key).toBe(built.layout.key)
    expect(heatFieldColors(f, built.layout).map(c => c[3])).toEqual(mesh.colors.map(c => c[3]))
  })

  it('returns null when nothing is covered', () => {
    expect(heatFieldMesh('m', grid([1, 1, 1, 1, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull()
  })
})

class FakeApi implements SceneApi {
  log: string[] = []
  ids = new Set<string>()
  async add(type: SceneObjectType, objects: { id: string }[]) {
    for (const o of objects) {
      this.ids.add(o.id)
      this.log.push(`add ${o.id}`)
    }
  }
  async remove(type: SceneObjectType, ids: string[]) {
    ids.forEach(id => this.ids.delete(id))
    this.log.push('remove ' + ids.join(','))
  }
  async update(type: SceneObjectType, objects: { id: string }[]) {
    for (const o of objects) {
      const colors = (o as unknown as { colors: number[][] }).colors
      this.log.push(`update ${o.id} max=${Math.max(...colors.map(c => c[3])).toFixed(2)}`)
    }
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

const field = (v: number) => sampleHeatField({ points: [{ at: [0, 0], radius: 300, value: v }], range: [0, 1], step: 100 })

describe('HeatFieldLayer', () => {
  it('builds the mesh once, then only tweens the vertex colours towards the new values', async () => {
    const api = new FakeApi()
    const layer = new HeatFieldLayer(api, { id: 'h', tweenMs: 0, tweenSteps: 2 })
    await layer.show(field(1))
    expect(api.log).toEqual(['add h-b'])
    api.log = []
    await layer.show(field(0))
    // 不新增、不删除：两步插值 1 → 0.5 → 0
    expect(api.log).toEqual(['update h-b max=0.50', 'update h-b max=0.00'])
    expect([...api.ids]).toEqual(['h-b'])
  })

  it('keeps only the latest of overlapping updates and continues from what is on screen', async () => {
    const api = new FakeApi()
    const layer = new HeatFieldLayer(api, { id: 'h', tweenMs: 0, tweenSteps: 4 })
    await layer.show(field(1))
    const runs = [layer.show(field(0.2)), layer.show(field(0.3)), layer.show(field(0))]
    await Promise.all(runs)
    expect(api.log.filter(l => l.startsWith('add'))).toEqual(['add h-b'])
    expect(api.log.at(-1)).toBe('update h-b max=0.00')
    expect(api.ids.size).toBe(1)
  })

  it('replaces the mesh (make before break) when the coverage changes', async () => {
    const api = new FakeApi()
    const layer = new HeatFieldLayer(api, { id: 'h', tweenMs: 0 })
    await layer.show(field(1))
    await layer.show(sampleHeatField({ points: [{ at: [5000, 0], radius: 300, value: 1 }], range: [0, 1], step: 100 }))
    expect(api.log).toEqual(['add h-b', 'add h-a', 'remove h-b'])
  })

  it('swaps whole meshes when the api cannot update, and clears on leave', async () => {
    const api = new FakeApi()
    const plain: SceneApi = { add: api.add.bind(api), remove: api.remove.bind(api), setVisible: api.setVisible.bind(api), setCamera: api.setCamera, focus: api.focus, project: api.project }
    const layer = new HeatFieldLayer(plain, { id: 'h' })
    await layer.show(field(1))
    await layer.show(field(0.5))
    expect(api.log).toEqual(['add h-b', 'add h-a', 'remove h-b'])
    await layer.clear()
    expect(api.ids.size).toBe(0)
  })

  it('creates nothing while the layer is switched off and shows the latest field when it is switched on', async () => {
    const api = new FakeApi()
    const layer = new HeatFieldLayer(api, { id: 'h', tweenMs: 0 })
    await layer.setVisible(false)
    await layer.show(field(1))
    await layer.show(field(0.5))
    expect(api.log).toEqual([])
    await layer.setVisible(true)
    expect(api.log).toEqual(['add h-b'])
    await layer.setVisible(false)
    expect(api.log.at(-1)).toBe('visible h-b false')
  })
})
