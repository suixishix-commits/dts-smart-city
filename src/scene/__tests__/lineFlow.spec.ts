import { describe, expect, it } from 'vitest'
import { LINE_FLOW_MATERIAL, lineFlowMesh, linearColor } from '../lineFlow'

const straight = { id: 'a', path: [[0, 0], [1000, 0]], width: 100 }

describe('lineFlowMesh', () => {
  it('returns null without usable lines', () => {
    expect(lineFlowMesh('x', [], { color: '#4c9aff', period: 500 })).toBeNull()
    expect(lineFlowMesh('x', [{ id: 'p', path: [[0, 0]], width: 10 }], { color: '#4c9aff', period: 500 })).toBeNull()
  })

  it('cuts at period boundaries so the phase stays in [0, 1] and rises along each quad', () => {
    const m = lineFlowMesh('x', [straight], { color: '#4c9aff', period: 300 }) as { coordinates: number[][]; colors: number[][]; indices: number[]; material: string }
    expect(m.material).toBe(LINE_FLOW_MATERIAL)
    expect(m.indices.length % 6).toBe(0)
    for (let q = 0; q < m.colors.length; q += 4) {
      const [a, , , b] = [m.colors[q], m.colors[q + 1], m.colors[q + 2], m.colors[q + 3]]
      expect(a[3]).toBeGreaterThanOrEqual(0)
      expect(b[3]).toBeLessThanOrEqual(1)
      expect(b[3]).toBeGreaterThan(a[3])
      expect(m.colors[q][0]).toBe(0)
      expect(m.colors[q + 1][0]).toBe(1)
    }
  })

  it("spans one period over the whole line with period 'whole'", () => {
    const m = lineFlowMesh('x', [straight], { color: '#ffffff', period: 'whole', tail: 1 }) as { colors: number[][]; scalarParameters: { name: string; value: number }[] }
    expect(m.colors[0][3]).toBe(0)
    expect(m.colors[m.colors.length - 2][3]).toBe(1)
    expect(m.scalarParameters).toEqual([{ name: 'Tail', value: 1 }])
  })

  it('marks branch lines in G and passes the colour as a linear vector parameter', () => {
    const m = lineFlowMesh('x', [{ ...straight, minor: true }], { color: '#ff0000', period: 500, dash: 6 }, { z: 30 }) as { colors: number[][]; coordinates: number[][]; vectorParameters: { name: string; value: number[] }[] }
    expect(m.colors.every(c => c[1] === 1)).toBe(true)
    expect(m.coordinates.every(c => c[2] === 30)).toBe(true)
    expect(m.vectorParameters).toEqual([{ name: 'Color', value: [1, 0, 0, 1] }])
  })
})

describe('linearColor', () => {
  it('converts sRGB to linear', () => {
    expect(linearColor('#000000')).toEqual([0, 0, 0, 1])
    expect(linearColor('#808080')[0]).toBeCloseTo(0.216, 2)
  })
})
