import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adaptRegionHeat, simplify, type RegionHeatResponse } from '@/api/regionHeat'
import { aed, magnitudeRange, PALETTES, rampColorAt, rampPosition, title, fieldColors, gaussianBlur } from '../HeatDemoScene'

const sample: RegionHeatResponse = JSON.parse(readFileSync('public/data/heatmap-demo/region-heat.json', 'utf-8'))

describe('region heat API adapter', () => {
  it('turns the API response into regions with numeric values and outer rings', () => {
    const d = adaptRegionHeat(sample)
    expect(d.regions).toHaveLength(101)
    expect(d.min).toBe(-1.375e10)
    expect(d.max).toBe(1.25e9)
    const first = d.regions.find(r => r.code === '500')!
    expect(first.value).toBe(1.25e9)
    expect(first.center).toEqual([53.80446001718397, 24.22459346900004])
    expect(first.rings.length).toBeGreaterThan(0)
    expect(first.rings[0].length).toBeGreaterThan(3)
  })

  it('handles MultiPolygon and falls back to the data range without minValue / maxValue', () => {
    const d = adaptRegionHeat({
      code: 200,
      data: {
        regions: [
          { regionCode: 'a', regionName: 'A', value: '2E+8', center: { x: 0, y: 0 } },
          { regionCode: 'b', regionName: 'B', value: -5, center: { x: 1, y: 1 } }
        ],
        geometry: {
          features: [
            { properties: { regionCode: 'a' }, geometry: { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]], [[[2, 2], [3, 2], [3, 3], [2, 2]]]] } },
            { properties: { regionCode: 'b' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } }
          ]
        }
      }
    })
    expect(d.regions.find(r => r.code === 'a')!.rings).toHaveLength(2)
    expect([d.min, d.max]).toEqual([-5, 2e8])
  })

  it('rejects a failed response', () => {
    expect(() => adaptRegionHeat({ code: 500, msg: 'boom', data: null as never })).toThrow('boom')
  })

  it('simplifies a dense straight edge to its corners', () => {
    const line = Array.from({ length: 50 }, (_, i) => [i * 0.001, 0])
    expect(simplify([...line, [0.049, 0.01]])).toEqual([[0, 0], [0.049, 0], [0.049, 0.01]])
  })
})

describe('heat demo colouring', () => {
  it('colours by magnitude, low to high across the ramp, and leaves zero uncoloured', () => {
    const range = magnitudeRange([{ value: -1.375e10 }, { value: 5e7 }, { value: 0 }, { value: 1.25e9 }])
    expect(range).toEqual([5e7, 1.375e10])
    expect(rampPosition(0, range)).toBeNull()
    expect(rampPosition(-1.375e10, range)).toBe(1)
    expect(rampPosition(5e7, range)).toBe(0)
  })

  it('makes the highest values the hot end of the ramp (green to red: red)', () => {
    const warm = PALETTES.find(p => p.key === 'warm')!
    expect(rampColorAt(warm.ramp, 1)).toBe('#ed1f0f')
    expect(rampColorAt(warm.ramp, 0)).toBe('#a8e633')
    expect(rampColorAt(['#000000', '#ffffff'], 0.5)).toBe('#808080')
  })

  it('offers the three customer palettes', () => {
    expect(PALETTES.map(p => p.key)).toEqual(['warm', 'ocean', 'risk'])
  })

  it('formats names and amounts by magnitude', () => {
    expect(title('AL REEM EAST ISLAND')).toBe('Al Reem East Island')
    expect(aed(-1.195e10)).toBe('119.5 亿迪拉姆')
    expect(aed(5e7)).toBe('5000 万迪拉姆')
  })
})

describe('heat field palette', () => {
  it('fills the six material colour slots for every palette, warm running green to red', () => {
    for (const p of PALETTES) expect(fieldColors(p)).toHaveLength(6)
    const warm = fieldColors(PALETTES[0])
    expect(warm[0]).toBe('#73cc40')
    expect(warm[5]).toBe('#eb2400')
  })
})

describe('district names', () => {
  it('shows Chinese names and falls back to the English one', async () => {
    const { districtZh } = await import('../names')
    expect(districtZh('ZAYED PORT')).toBe('扎耶德港')
    expect(districtZh('AL REEM EAST ISLAND')).toBe('东里姆岛')
    expect(districtZh('NEW PLACE')).toBe('New Place')
  })

  it('has a Chinese name for every district in the sample', async () => {
    const { DISTRICT_ZH } = await import('../names')
    const missing = adaptRegionHeat(sample).regions.filter(r => !DISTRICT_ZH[r.name])
    expect(missing.map(r => r.name)).toEqual([])
  })
})

describe('heat blur', () => {
  it('spreads a hot cell smoothly and keeps the total', () => {
    const src = new Float32Array(21 * 21)
    src[10 * 21 + 10] = 1
    const out = gaussianBlur(src, 21, 21, 2)
    const total = out.reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 3)
    expect(out[10 * 21 + 10]).toBeGreaterThan(out[10 * 21 + 12])
    expect(out[10 * 21 + 12]).toBeGreaterThan(out[10 * 21 + 15])
  })
})
