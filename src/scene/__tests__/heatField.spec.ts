import { describe, expect, it } from 'vitest'
import { HEAT_FIELD_MATERIAL, HeatFieldLayer, heatFieldMesh, sampleHeatField } from '../heatField'
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
  it('emits only the cells that carry heat, with the density in vertex alpha', () => {
    const f = { origin: [0, 0] as [number, number], step: 10, cols: 4, rows: 2, values: new Float32Array([0, 0, 0, 0.5, 0, 0, 0, 0.5]) }
    const mesh = heatFieldMesh('m', f, { opacity: 0 }) as { coordinates: number[][]; colors: number[][]; indices: number[]; material: string; scalarParameters: unknown[] }
    // 只有最右一格（第 3 列）有热度：4 个顶点、2 个三角形
    expect(mesh.indices).toHaveLength(6)
    expect(mesh.coordinates).toHaveLength(4)
    expect(mesh.coordinates.map(c => c[0]).sort()).toEqual([20, 20, 30, 30])
    expect(mesh.colors.map(c => c[3]).sort()).toEqual([0, 0, 0.5, 0.5])
    expect(mesh.material).toBe(HEAT_FIELD_MATERIAL)
    expect(mesh.scalarParameters).toEqual([{ name: 'Opacity', value: 0 }])
  })

  it('returns null when nothing is hot', () => {
    expect(heatFieldMesh('m', { origin: [0, 0], step: 10, cols: 2, rows: 2, values: new Float32Array(4) })).toBeNull()
  })
})

class FakeApi implements SceneApi {
  log: string[] = []
  ids = new Set<string>()
  async add(type: SceneObjectType, objects: { id: string }[]) {
    for (const o of objects) {
      this.ids.add(o.id)
      const op = (o as { scalarParameters?: { value: number }[] }).scalarParameters?.[0]?.value
      this.log.push(`add ${o.id} ${op}`)
    }
  }
  async remove(type: SceneObjectType, ids: string[]) {
    ids.forEach(id => this.ids.delete(id))
    this.log.push('remove ' + ids.join(','))
  }
  async update(type: SceneObjectType, objects: { id: string }[]) {
    this.log.push('update ' + objects.map(o => `${o.id}=${(o as { scalarParameters: { value: number }[] }).scalarParameters[0].value.toFixed(2)}`).join(' '))
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
  it('shows the first field at once, then cross-fades to the next and removes the old one', async () => {
    const api = new FakeApi()
    const layer = new HeatFieldLayer(api, { id: 'h', fadeMs: 0, fadeSteps: 2 })
    await layer.show(field(1))
    expect(api.log).toEqual(['add h-b 1'])
    api.log = []
    await layer.show(field(0.5))
    expect(api.log).toEqual(['add h-a 0', 'update h-a=0.50 h-b=0.50', 'update h-a=1.00 h-b=0.00', 'remove h-b'])
    expect([...api.ids]).toEqual(['h-a'])
  })

  it('keeps only the latest of overlapping updates', async () => {
    const api = new FakeApi()
    const layer = new HeatFieldLayer(api, { id: 'h', fadeMs: 0, fadeSteps: 4 })
    await layer.show(field(1))
    const runs = [layer.show(field(0.2)), layer.show(field(0.3)), layer.show(field(0.4))]
    await Promise.all(runs)
    // 第一次切换进行中又来了两次：中间那次被丢掉，只再切换一次到最新
    expect(api.log.filter(l => l.startsWith('add'))).toEqual(['add h-b 1', 'add h-a 0', 'add h-b 0'])
    expect(api.ids.size).toBe(1)
  })

  it('swaps without fading when the api cannot update, and clears on leave', async () => {
    const api = new FakeApi()
    const plain: SceneApi = { ...api, add: api.add.bind(api), remove: api.remove.bind(api), setVisible: api.setVisible.bind(api), setCamera: api.setCamera, focus: api.focus, project: api.project }
    delete (plain as { update?: unknown }).update
    const layer = new HeatFieldLayer(plain, { id: 'h' })
    await layer.show(field(1))
    await layer.show(field(0.5))
    expect(api.log).toEqual(['add h-b 1', 'add h-a 1', 'remove h-b'])
    await layer.clear()
    expect(api.ids.size).toBe(0)
  })

  it('creates nothing while the layer is switched off and shows the latest field when it is switched on', async () => {
    const api = new FakeApi()
    const layer = new HeatFieldLayer(api, { id: 'h', fadeMs: 0 })
    await layer.setVisible(false)
    await layer.show(field(1))
    await layer.show(field(0.5))
    expect(api.log).toEqual([])
    await layer.setVisible(true)
    expect(api.log).toEqual(['add h-b 1'])
    // 再关上：隐藏现有的面
    await layer.setVisible(false)
    expect(api.log.at(-1)).toBe('visible h-b false')
  })
})
