import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { arc, area, distinctShade, circleRing, COLOR, column, fence, flowLine, focusView, frustum, heatmap, HEAT_STOPS, LEVEL_COLOR, pin, plainLine, RAMP, rampColor, regionLayer, rgba, ripple, labelWidth, screenOf, staggerLabels, STATUS_RAMP } from '../kit'

describe('rgba', () => {
  it('converts #rrggbb to 0–1 components with alpha 1 by default', () => {
    expect(rgba('#ff0000')).toEqual([1, 0, 0, 1])
    expect(rgba('#000000', 0.5)).toEqual([0, 0, 0, 0.5])
  })

  it('keeps fractional channels', () => {
    const [r, g, b, a] = rgba('#4cc4d4', 0.9)
    expect(r).toBeCloseTo(0x4c / 255)
    expect(g).toBeCloseTo(0xc4 / 255)
    expect(b).toBeCloseTo(0xd4 / 255)
    expect(a).toBe(0.9)
  })
})

describe('rampColor', () => {
  it('picks a band by ratio', () => {
    expect(rampColor(0)).toBe(RAMP[0])
    expect(rampColor(0.5)).toBe(RAMP[3])
    expect(rampColor(0.99)).toBe(RAMP[5])
  })

  it('clamps ratios outside 0–1', () => {
    expect(rampColor(-1)).toBe(RAMP[0])
    expect(rampColor(1)).toBe(RAMP[RAMP.length - 1])
    expect(rampColor(7)).toBe(RAMP[RAMP.length - 1])
  })

  it('accepts another ramp', () => {
    expect(rampColor(0, STATUS_RAMP)).toBe(COLOR.ok)
    expect(rampColor(0.3, STATUS_RAMP)).toBe(COLOR.caution)
    expect(rampColor(1, STATUS_RAMP)).toBe(COLOR.danger)
  })
})

describe('palette', () => {
  it('keeps the four low bands cold and only the top two warm', () => {
    const blueDominant = (hex: string) => parseInt(hex.slice(5, 7), 16) > parseInt(hex.slice(1, 3), 16)
    expect(RAMP.map(blueDominant)).toEqual([true, true, true, true, false, false])
  })

  it('maps alarm level 1 to the danger colour', () => {
    expect(LEVEL_COLOR[1]).toBe(COLOR.danger)
    expect(Object.keys(LEVEL_COLOR)).toEqual(['1', '2', '3', '4'])
  })
})

describe('plainLine', () => {
  const path = [
    [1, 2],
    [3, 4]
  ]

  it('builds a normal glowing line 12 m above ground', () => {
    const l = plainLine({ id: 'l1', groupId: 'g', path, color: '#ff0000', width: 40 })
    expect(l).toMatchObject({ id: 'l1', groupId: 'g', coordinateType: 0, thickness: 40, style: 4, intensity: 1, depthTest: false })
    expect(l.coordinates).toEqual([
      [1, 2, 12],
      [3, 4, 12]
    ])
    expect(l.color).toEqual([1, 0, 0, 1])
  })

  it('honours flow, alpha, height and brightness', () => {
    const l = plainLine({ id: 'l1', path, color: '#ff0000', width: 40, flow: true, alpha: 0.5, height: 4, brightness: 2 })
    expect(l.style).toBe(2)
    expect(l.color[3]).toBe(0.5)
    expect(l.coordinates[0][2]).toBe(4)
    expect(l.intensity).toBe(2)
  })

  it('does not modify the input path', () => {
    plainLine({ id: 'l1', path, color: '#ff0000', width: 40 })
    expect(path[0]).toEqual([1, 2])
  })
})

describe('ripple', () => {
  it('builds a ground ripple with three rings by default', () => {
    const r = ripple({ id: 'r1', groupId: 'g', at: [10, 20], radius: 300, color: '#00ff00' })
    expect(r).toMatchObject({ id: 'r1', groupId: 'g', coordinate: [10, 20, 2], radius: 300, rippleNumber: 3, intensity: 0.8, autoHeight: true })
    expect(r.color).toEqual([0, 1, 0, 0.9])
  })

  it('honours rings and brightness', () => {
    const r = ripple({ id: 'r1', at: [10, 20, 99], radius: 300, color: '#00ff00', rings: 5, brightness: 2 })
    expect(r.rippleNumber).toBe(5)
    expect(r.intensity).toBe(2)
    // 传入的 z 被忽略，统一贴地
    expect(r.coordinate).toEqual([10, 20, 2])
  })
})

describe('pin', () => {
  it('carries the business id as JSON user data, falling back to the object id', () => {
    expect(JSON.parse(pin({ id: 'hotspot-h1', groupId: 'sc_hotspot', at: [1, 2], text: 'A', userId: 'h1' }).userData)).toEqual({ id: 'h1' })
    expect(JSON.parse(pin({ id: 'p1', groupId: 'sc_x', at: [1, 2], text: 'A' }).userData)).toEqual({ id: 'p1' })
  })

  it('is a text-only label on a dark plate with a lead line', () => {
    const p = pin({ id: 'p1', groupId: 'sc_x', at: [1, 2, 50], text: '标注' })
    expect(p).toMatchObject({ groupId: 'sc_x', coordinate: [1, 2, 0], text: '标注', imagePath: '', imageSize: [0, 0], showLine: true, lineSize: [2, 36], fontSize: 13, priority: 0, autoHeight: true })
    expect(p.textBackgroundColor).toEqual(rgba(COLOR.panel, 0.88))
    expect(p.lineColor).toEqual(rgba(COLOR.accent, 0.95))
  })

  it('honours colour, line height, font size and priority', () => {
    const p = pin({ id: 'p1', groupId: 'sc_x', at: [1, 2], text: 'A', color: COLOR.danger, lineHeight: 56, fontSize: 11, priority: 10 })
    expect(p.lineColor).toEqual(rgba(COLOR.danger, 0.95))
    expect(p.lineSize).toEqual([2, 56])
    expect(p.fontSize).toBe(11)
    expect(p.priority).toBe(10)
  })
})

describe('arc', () => {
  it('is a 25-point solid polyline that starts and ends exactly at the two points, 10 m above ground', () => {
    const a = arc({ id: 'a1', groupId: 'g', from: [0, 0], to: [1000, 0], color: '#0000ff' })
    expect(a.coordinates).toHaveLength(25)
    expect(a.coordinates[0]).toEqual([0, 0, 10])
    expect(a.coordinates[24]).toEqual([1000, 0, 10])
    expect(a).toMatchObject({ id: 'a1', groupId: 'g', coordinateType: 0, color: [0, 0, 1, 1], style: 4, thickness: 30, intensity: 1, depthTest: false })
    // 不再带迁徙线的参数
    expect(a).not.toHaveProperty('lineThickness')
    expect(a).not.toHaveProperty('bendDegree')
  })

  it('bends sideways (to the right of the direction of travel) and lifts in the middle', () => {
    const a = arc({ id: 'a1', from: [0, 0], to: [1000, 0], color: '#0000ff' })
    const mid = a.coordinates[12]
    // 默认 bend 0.35：侧弯 = 1000 × 0.35 × 0.6，顶点高度 = 10 + 1000 × 0.35 × 0.5
    expect(mid[0]).toBeCloseTo(500)
    expect(mid[1]).toBeCloseTo(-210)
    expect(mid[2]).toBeCloseTo(185)
    // 中点最高，两端最低；所有中间点都离开直线
    for (const p of a.coordinates.slice(1, 24)) {
      expect(p[2]).toBeGreaterThan(10)
      expect(p[2]).toBeLessThanOrEqual(mid[2])
      expect(p[1]).toBeLessThan(0)
    }
  })

  it('honours width, bend and brightness, clamping the brightness to 0.5–1.2', () => {
    const a = arc({ id: 'a1', from: [0, 0], to: [1000, 0], color: '#0000ff', width: 50, bend: 0.6, brightness: 1 })
    expect(a.thickness).toBe(50)
    expect(a.intensity).toBe(1)
    expect(a.coordinates[12][1]).toBeCloseTo(-360)
    expect(a.coordinates[12][2]).toBeCloseTo(310)
    expect(arc({ id: 'a1', from: [0, 0], to: [1, 1], color: '#0000ff', brightness: 9 }).intensity).toBe(1.2)
    expect(arc({ id: 'a1', from: [0, 0], to: [1, 1], color: '#0000ff', brightness: 0.1 }).intensity).toBe(0.5)
  })

  it('stays a finite flat line when both points coincide', () => {
    const a = arc({ id: 'a1', from: [5, 5], to: [5, 5], color: '#0000ff' })
    expect(a.coordinates).toHaveLength(25)
    for (const p of a.coordinates) expect(p).toEqual([5, 5, 10])
  })
})

describe('focusView', () => {
  const tan42 = Math.tan((42 * Math.PI) / 180)
  const yaw = (-38 * Math.PI) / 180

  it('looks down at the point from 1700 m by default, pitch -42 and yaw -38', () => {
    const v = focusView([1000, 2000])
    const d = 1700 / tan42
    expect(v).toHaveLength(5)
    expect(v[0]).toBeCloseTo(1000 - Math.cos(yaw) * d)
    expect(v[1]).toBeCloseTo(2000 + Math.sin(yaw) * d)
    expect(v.slice(2)).toEqual([1700, -42, -38])
  })

  it('moves the camera further back as the height grows, keeping the point at screen centre', () => {
    const p = [1000, 2000, 80]
    const low = focusView(p, 2400)
    const high = focusView(p, 3600)
    expect(high[2]).toBe(3600)
    // 水平距离 = 高度 / tan(42°)，与目标点的 z 无关
    expect(Math.hypot(low[0] - p[0], low[1] - p[1])).toBeCloseTo(2400 / tan42)
    expect(Math.hypot(high[0] - p[0], high[1] - p[1])).toBeCloseTo(3600 / tan42)
    // 相机始终在目标点的同一个方位
    expect((high[0] - p[0]) / (low[0] - p[0])).toBeCloseTo(1.5)
    expect((high[1] - p[1]) / (low[1] - p[1])).toBeCloseTo(1.5)
  })
})

describe('column', () => {
  it('is a hexagonal prism: six vertices at the given radius around the centre', () => {
    const c = column({ id: 'c1', groupId: 'g', at: [100, 200], radius: 50, height: 300, color: '#ff0000' })
    expect(c.coordinates).toHaveLength(6)
    for (const v of c.coordinates) {
      expect(Math.hypot(v[0] - 100, v[1] - 200)).toBeCloseTo(50)
      expect(v[2]).toBe(2)
    }
    expect(c.coordinates[0][0]).toBeCloseTo(150)
    expect(c.coordinates[0][1]).toBeCloseTo(200)
    expect(c).toMatchObject({ id: 'c1', groupId: 'g', height: 300, generateTop: true, generateSide: true, generateBottom: false })
    expect(c.color).toEqual([1, 0, 0, 0.85])
  })

  it('never has a height below 1 m', () => {
    expect(column({ id: 'c1', at: [0, 0], radius: 50, height: 0, color: '#ff0000' }).height).toBe(1)
    expect(column({ id: 'c1', at: [0, 0], radius: 50, height: -20, color: '#ff0000', alpha: 0.4 }).color[3]).toBe(0.4)
  })
})

describe('area', () => {
  const ring = [
    [0, 0],
    [10, 0],
    [10, 10]
  ]

  it('builds a translucent fill with a solid outline', () => {
    const a = area({ id: 'a1', groupId: 'g', ring, color: '#ff0000' })
    expect(a.coordinates).toEqual([
      [0, 0, 6],
      [10, 0, 6],
      [10, 10, 6]
    ])
    expect(a.color).toEqual([1, 0, 0, 0.18])
    expect(a.frameColor).toEqual([1, 0, 0, 0.9])
    expect(a).toMatchObject({ id: 'a1', groupId: 'g', frameThickness: 12, depthTest: false })
  })

  it('honours fill, frame and frame width', () => {
    const a = area({ id: 'a1', ring, color: '#ff0000', fill: 0.3, frame: 0.5, frameWidth: 20 })
    expect(a.color[3]).toBe(0.3)
    expect(a.frameColor[3]).toBe(0.5)
    expect(a.frameThickness).toBe(20)
  })
})

describe('circleRing', () => {
  it('returns 48 points on the circle by default, without repeating the first', () => {
    const ring = circleRing([100, 200], 500)
    expect(ring).toHaveLength(48)
    for (const p of ring) expect(Math.hypot(p[0] - 100, p[1] - 200)).toBeCloseTo(500)
    expect(ring[0]).toEqual([600, 200])
    expect(ring[47]).not.toEqual(ring[0])
  })

  it('honours the segment count', () => {
    const ring = circleRing([0, 0], 10, 4)
    expect(ring).toHaveLength(4)
    expect(ring[1][0]).toBeCloseTo(0)
    expect(ring[1][1]).toBeCloseTo(10)
    expect(ring[2][0]).toBeCloseTo(-10)
  })
})

describe('heatmap', () => {
  const points = [
    { id: 'a', at: [100, 200], radius: 300, value: 1 },
    { id: 'b', at: [900, -50], radius: 500, value: 9 },
    { id: 'c', at: [400, 600], radius: 100, value: -2 }
  ]

  it('pads the bounding box by the largest radius plus 200 m', () => {
    const h = heatmap({ id: 'h', groupId: 'g', points, range: [0, 4] })
    expect(h.bbox).toEqual([100 - 700, -50 - 700, -50, 900 + 700, 600 + 700, 300])
  })

  it('uses the given vertical range', () => {
    const h = heatmap({ id: 'h', points, range: [0, 4], z: [-10, 80] })
    expect(h.bbox[2]).toBe(-10)
    expect(h.bbox[5]).toBe(80)
  })

  it('clamps heat values into the range', () => {
    const h = heatmap({ id: 'h', points, range: [0, 4] })
    expect(h.range).toEqual([0, 4])
    expect(h.data.map(d => d.heatValue)).toEqual([1, 4, 0])
  })

  it('writes one flat data point per input point', () => {
    const h = heatmap({ id: 'h', groupId: 'g', points, range: [0, 4] })
    expect(h).toMatchObject({ id: 'h', groupId: 'g' })
    expect(h.data[0]).toEqual({ id: 'a', coordinate: [100, 200, 0], radius: 300, heatValue: 1 })
    expect(h.data).toHaveLength(3)
  })

  it('has a transparent lowest colour stop by default and accepts custom stops', () => {
    const stops = heatmap({ id: 'h', points, range: [0, 4] }).colors.colorStops
    expect(stops[0].color[3]).toBe(0)
    expect(stops.map(s => s.value)).toEqual(HEAT_STOPS.map(s => s.value))
    // 只有高值才出现暖色：中段透明度压低，城市和光效不被盖住
    expect(stops.find(s => s.value === 0.55)?.color[3]).toBeLessThan(0.35)
    const custom = [{ value: 0, color: [0, 0, 0, 0] }]
    expect(heatmap({ id: 'h', points, range: [0, 4], stops: custom }).colors.colorStops).toBe(custom)
  })
})

describe('flowLine', () => {
  const path = [
    [1, 2],
    [3, 4]
  ]
  const line = (o: Partial<Parameters<typeof flowLine>[0]> = {}) => flowLine({ id: 'f1', path, color: '#4c9aff', width: 50, ...o }) as Record<string, any>

  it('builds a solid glowing line 12 m above ground that needs no effect library', () => {
    const l = line({ groupId: 'g' })
    expect(l).toMatchObject({ id: 'f1', groupId: 'g', coordinateType: 0, style: 4, depthTest: false, range: [1, 1000000] })
    expect(l.coordinates).toEqual([
      [1, 2, 12],
      [3, 4, 12]
    ])
    expect(l.color).toEqual(rgba('#4c9aff'))
  })

  it('expresses the style through thickness: pulse and arrow full width, particles 80%, dash 60%', () => {
    expect(line({ style: 'pulse' }).thickness).toBe(50)
    expect(line({ style: 'arrow' }).thickness).toBe(50)
    expect(line({ style: 'particles' }).thickness).toBe(40)
    expect(line({ style: 'dash' }).thickness).toBe(30)
    // 默认是 particles
    expect(line().thickness).toBe(40)
  })

  it('never draws a line thinner than 10 m', () => {
    expect(line({ width: 8, style: 'dash' }).thickness).toBe(10)
  })

  it('makes dashed lines slightly transparent', () => {
    expect(line({ style: 'dash' }).color[3]).toBe(0.85)
    expect(line({ style: 'pulse' }).color[3]).toBe(1)
  })

  it('clamps the brightness to 0.5–1.2 (above that bloom washes the colour white) and defaults to 1', () => {
    expect(line().intensity).toBe(1)
    expect(line({ brightness: 9 }).intensity).toBe(1.2)
    expect(line({ brightness: 0.1 }).intensity).toBe(0.5)
    expect(line({ brightness: 0.8 }).intensity).toBe(0.8)
  })

  it('honours the height and accepts speed, spacing and reverse without changing the object', () => {
    expect(line({ height: 30 }).coordinates[0]).toEqual([1, 2, 30])
    expect(line({ speed: 0.3, spacing: 160, reverse: true })).toEqual(line())
  })

  it('does not modify the input path', () => {
    line()
    expect(path).toEqual([
      [1, 2],
      [3, 4]
    ])
  })
})

/**
 * 依赖效果库的三个构造函数：适配库用挂在 window 上的替身（loadLib 发现全局对象已存在就不再插入脚本），
 * 只验证 kit 传给适配库的参数和返回的 show / hide / remove，不测效果库本身。
 */
describe('效果库图层（适配库为替身）', () => {
  const w = window as any
  const regionLib = {
    PRESETS: { dots: { dotSpacingM: 10, dotSizeM: 2, dotIntensity: 1, preset: 'dots' }, hatch: { dotSpacingM: 20, dotSizeM: 4, dotIntensity: 0.8, preset: 'hatch' } },
    DEFAULT_STYLE: { glow: 1, baseOpacity: 0.5 },
    create: vi.fn(async (..._args: any[]) => {}),
    remove: vi.fn(async (..._args: any[]) => {}),
    setColors: vi.fn(async (..._args: any[]) => true)
  }
  const fenceLib = { create: vi.fn(async (..._args: any[]) => {}), remove: vi.fn(async (..._args: any[]) => {}) }
  const frustumLib = { create: vi.fn(async (..._args: any[]) => {}), remove: vi.fn(async (..._args: any[]) => {}) }
  const customObject = { showByGroupId: vi.fn(async (_id: string) => {}), hideByGroupId: vi.fn(async (_id: string) => {}) }
  const xapi = { customObject }

  const regions = [
    { id: 'a', color: '#111111', ring: [[0, 0, 9], [10, 0, 9], [10, 10, 9]] },
    { id: 'b', color: '#222222', ring: [[10, 0], [20, 0], [20, 10]] }
  ]

  beforeAll(() => {
    w.RegionDotFlow = regionLib
    w.ElectronicFence = fenceLib
    w.ViewFrustum = frustumLib
    vi.stubGlobal('__xapi', xapi)
  })

  afterAll(() => {
    delete w.RegionDotFlow
    delete w.ElectronicFence
    delete w.ViewFrustum
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    regionLib.setColors.mockResolvedValue(true)
  })

  describe('regionLayer', () => {
    it('creates one layer for all regions with the scaled preset and 2D rings', async () => {
      await regionLayer('layer', regions, { pattern: 'hatch', scale: 2, fill: 0.08 })
      expect(regionLib.create).toHaveBeenCalledTimes(1)
      const [api, o] = regionLib.create.mock.calls[0]
      expect(api).toBe(xapi)
      expect(o.id).toBe('layer')
      // 点阵亮度减半、关掉描边泛白、收窄外发光（白天影像上不发白）
      expect(o.style).toEqual({ glow: 1, preset: 'hatch', dotSpacingM: 40, dotSizeM: 8, dotIntensity: 0.4, baseOpacity: 0.08, lineIntensity: 1, lineWhiten: 0, glowIntensity: 0.5, glowOpacity: 0.08, spillIntensity: 0.1, flowIntensity: 1.6 })
      // 每个片区一个互不相同的颜色（独占调色板槽位，之后换色不用重建）
      expect(o.regions).toEqual([
        { id: 'a', color: distinctShade('#111111', 0), rings: [[[0, 0], [10, 0], [10, 10]]] },
        { id: 'b', color: distinctShade('#222222', 1), rings: [[[10, 0], [20, 0], [20, 10]]] }
      ])
    })

    it('defaults to the dots pattern at scale 3 with a 0.1 fill', async () => {
      await regionLayer('layer', regions)
      expect(regionLib.create.mock.calls[0][1].style).toMatchObject({ preset: 'dots', dotSpacingM: 30, dotSizeM: 6, baseOpacity: 0.1 })
    })

    it('shows, hides and removes the whole layer by its id', async () => {
      const layer = await regionLayer('layer', regions)
      await layer.hide()
      await layer.show()
      await layer.remove()
      expect(customObject.hideByGroupId).toHaveBeenCalledWith('layer')
      expect(customObject.showByGroupId).toHaveBeenCalledWith('layer')
      expect(regionLib.remove).toHaveBeenCalledWith(xapi, 'layer')
    })

    it('sends no command when the colours did not change', async () => {
      const layer = await regionLayer('layer', regions)
      await layer.setColors({ a: '#111111', b: '#222222' })
      expect(regionLib.setColors).not.toHaveBeenCalled()
    })

    it('recolours in place when a colour changed, and remembers the new colours', async () => {
      const layer = await regionLayer('layer', regions)
      await layer.setColors({ a: '#aaaaaa', b: '#222222' })
      expect(regionLib.setColors).toHaveBeenCalledTimes(1)
      expect(regionLib.setColors).toHaveBeenCalledWith(xapi, 'layer', { a: '#aaaaaa', b: '#222222' })
      expect(regionLib.create).toHaveBeenCalledTimes(1)
      await layer.setColors({ a: '#aaaaaa' })
      expect(regionLib.setColors).toHaveBeenCalledTimes(1)
    })

    it('rebuilds the layer with the current colours when the library cannot recolour in place', async () => {
      regionLib.setColors.mockResolvedValue(false)
      const layer = await regionLayer('layer', regions)
      await layer.setColors({ b: '#bbbbbb' })
      expect(regionLib.create).toHaveBeenCalledTimes(2)
      expect(regionLib.create.mock.calls[1][1].regions.map((r: any) => r.color)).toEqual([distinctShade('#111111', 0), distinctShade('#bbbbbb', 1)])
    })

    it('sends nothing while switched off and applies the latest colours when shown again (no show-then-hide flash)', async () => {
      const layer = await regionLayer('layer', regions)
      await layer.hide()
      await layer.setColors({ a: '#aaaaaa' })
      await layer.setColors({ a: '#cccccc', b: '#dddddd' })
      expect(regionLib.setColors).not.toHaveBeenCalled()
      expect(customObject.hideByGroupId).toHaveBeenCalledTimes(1)
      await layer.show()
      expect(regionLib.setColors).toHaveBeenCalledTimes(1)
      expect(regionLib.setColors).toHaveBeenCalledWith(xapi, 'layer', { a: '#cccccc', b: '#dddddd' })
      // 换色在显示之前，显示后不再隐藏
      expect(regionLib.setColors.mock.invocationCallOrder[0]).toBeLessThan(customObject.showByGroupId.mock.invocationCallOrder[0])
      expect(customObject.hideByGroupId).toHaveBeenCalledTimes(1)
    })
  })

  describe('fence', () => {
    it('creates a rising fence 120 m high by default and removes it through the library', async () => {
      const f = await fence('fence-1', [[0, 0, 5], [10, 0, 5], [10, 10, 5]])
      expect(fenceLib.create).toHaveBeenCalledWith(xapi, { id: 'fence-1', coordinates: [[0, 0], [10, 0], [10, 10]], heightM: 120, groundZ: 3, mode: 'rise', style: {} })
      await f.hide()
      await f.show()
      await f.remove()
      expect(customObject.hideByGroupId).toHaveBeenCalledWith('fence-1')
      expect(customObject.showByGroupId).toHaveBeenCalledWith('fence-1')
      expect(fenceLib.remove).toHaveBeenCalledWith(xapi, 'fence-1')
    })

    it('honours height and colour', async () => {
      await fence('fence-1', [[0, 0], [10, 0], [10, 10]], { height: 60, color: COLOR.danger })
      expect(fenceLib.create.mock.calls[0][1]).toMatchObject({ heightM: 60, style: { color: COLOR.danger, edgeColor: COLOR.danger } })
    })
  })

  describe('frustum', () => {
    it('creates a view cone with default field of view and range', async () => {
      const f = await frustum('cam-1', [0, 0, 30], [100, 100, 0])
      expect(frustumLib.create).toHaveBeenCalledWith(xapi, { id: 'cam-1', position: [0, 0, 30], target: [100, 100, 0], hfovDeg: 60, vfovDeg: 34, rangeM: 900, collision: false, duration: 1.2 })
      await f.hide()
      await f.show()
      await f.remove()
      expect(customObject.hideByGroupId).toHaveBeenCalledWith('cam-1')
      expect(customObject.showByGroupId).toHaveBeenCalledWith('cam-1')
      expect(frustumLib.remove).toHaveBeenCalledWith(xapi, 'cam-1')
    })

    it('honours field of view and range', async () => {
      await frustum('cam-1', [0, 0, 30], [100, 100, 0], { hfov: 90, vfov: 50, range: 400 })
      expect(frustumLib.create.mock.calls[0][1]).toMatchObject({ hfovDeg: 90, vfovDeg: 50, rangeM: 400 })
    })
  })
})

describe('screenOf', () => {
  const camera = [225780, 2698610, 9600, -38, -38]

  it('puts the point the camera looks at in the middle of the screen', () => {
    const [x, y] = focusTarget(camera)
    const s = screenOf(camera, [x, y, 0]) as number[]
    expect(s[0]).toBeCloseTo(960, 0)
    expect(s[1]).toBeCloseTo(540, 0)
  })

  it('maps right of the view direction to the right of the screen and farther to higher', () => {
    const [x, y] = focusTarget(camera)
    const right = screenOf(camera, [x + 616, y - 788, 0]) as number[]
    const far = screenOf(camera, [x + 788, y + 616, 0]) as number[]
    expect(right[0]).toBeGreaterThan(1000)
    expect(far[1]).toBeLessThan(530)
  })

  it('returns null behind the camera', () => {
    expect(screenOf(camera, [camera[0] - 5000, camera[1] - 4000, 20000])).toBeNull()
  })
})

/** 机位视线和地面的交点（focusView 的逆运算） */
function focusTarget(c: number[]): number[] {
  const d = c[2] / Math.tan((-c[3] * Math.PI) / 180)
  const yaw = (c[4] * Math.PI) / 180
  return [c[0] + Math.cos(yaw) * d, c[1] - Math.sin(yaw) * d]
}

describe('focusView leftPx', () => {
  it('puts the target that many pixels left of the screen centre', () => {
    const p = [230000, 2705000]
    const at = screenOf(focusView(p, 4000, 170), [p[0], p[1], 0]) as number[]
    expect(at[0]).toBeCloseTo(960 - 170, -1)
    expect(Math.abs(at[1] - 540)).toBeLessThan(5)
  })
})

describe('staggerLabels', () => {
  const camera = [225780, 2698610, 9600, -38, -38]
  const c = focusTarget(camera)
  // 屏幕横向是东南方向 (0.616, -0.788)，纵深是东北方向 (0.788, 0.616)
  const right = (m: number) => [c[0] + 0.616 * m, c[1] - 0.788 * m]
  const deep = (m: number) => [c[0] + 0.788 * m, c[1] + 0.616 * m]

  it('keeps labels that do not overlap on screen at the base height', () => {
    expect(staggerLabels([{ at: c, width: 160 }, { at: right(6000), width: 160 }, { at: deep(4000), width: 160 }], 56, 34, { camera })).toEqual([56, 56, 56])
  })

  it('raises a label that would cover an earlier one on screen', () => {
    expect(staggerLabels([{ at: c, width: 160 }, { at: right(1500), width: 160 }], 56, 34, { camera })).toEqual([56, 90])
  })

  it('takes the next free level when two lower ones are taken', () => {
    expect(staggerLabels([{ at: c, width: 160 }, { at: right(700), width: 160 }, { at: right(1400), width: 160 }], 56, 34, { camera })).toEqual([56, 90, 124])
  })

  it('keeps fixed labels where they are and moves the others around them', () => {
    // 固定的在 90：另一个的 56 档和它上下错开一档，不重叠
    expect(staggerLabels([{ at: c, width: 160, lead: 90 }, { at: right(700), width: 160 }], 56, 34, { camera })).toEqual([90, 56])
    // 固定的占了 56，移动的让到 90
    expect(staggerLabels([{ at: c, width: 160, lead: 56 }, { at: right(700), width: 160 }], 56, 34, { camera })).toEqual([56, 90])
  })

  it('estimates wider boxes for longer text', () => {
    expect(labelWidth('多车追尾', { tag: '事故' })).toBeGreaterThan(labelWidth('追尾'))
    expect(labelWidth('ABC')).toBeLessThan(labelWidth('一二三'))
  })
})

describe('distinctShade', () => {
  it('gives every index up to 64 its own colour within 3/255 per channel', () => {
    const base = '#4c9aff'
    const shades = Array.from({ length: 64 }, (_, i) => distinctShade(base, i))
    expect(new Set(shades).size).toBe(64)
    expect(shades[0]).toBe(base)
    const ch = (h: string) => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16))
    for (const s of shades) ch(s).forEach((v, k) => expect(Math.abs(v - ch(base)[k])).toBeLessThanOrEqual(3))
  })
})
