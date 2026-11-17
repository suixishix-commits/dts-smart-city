/**
 * 通用流光线（UE 材质 LineFlow V1，dts-effect-kit/projects/SmartCityFx_20261117/Build/line）：
 * 管网、巡逻路线、绕行路线、车辆尾迹等所有沿路的线都用它，替代 DTS 自带的平面发光线。
 *
 * customMesh 丝带，没有 UV，用顶点颜色带数据（RGB 只能放 0/1，A 是线性 8 位值）：
 * R = 横向 0/1，G = 1 表示支线（按 MinorDim 压暗），A = 一个流动周期内的相位（0→1，沿折线方向）。
 * 颜色和动效参数按图层用 vectorParameters / scalarParameters 覆盖，一个材质出所有线型：
 * 细实线芯 + 柔光；可选虚线（Dash）、流动光点（Light / Speed）、呼吸（Breath，告警）、尾部渐隐（Tail，轨迹）。
 */
import { cumulative, frameAt, roadQuads } from './trafficFlow'

export const LINE_FLOW_MATERIAL = '/JC_CustomAssets/LineFlow/MI_LineFlow_V1_FX'

export interface FlowPath {
  id: string
  /** 投影坐标折线 [[x, y], …] */
  path: number[][]
  /** 丝带宽度，米（线芯只占中间一小段，其余是柔光） */
  width: number
  /** 支线：亮度按材质的 MinorDim 压低 */
  minor?: boolean
}

export interface LineFlowStyle {
  /** 线色，#rrggbb（sRGB） */
  color: string
  /** 一个流动周期的长度，米；'whole' 表示整条线一个周期（尾迹：A 从起点 0 到终点 1） */
  period: number | 'whole'
  brightness?: number
  opacity?: number
  /** 每秒走过的周期数；光点沿折线方向流动 */
  speed?: number
  /** 流动光点强度，0 不画光点 */
  light?: number
  /** 光点长度占周期的比例 */
  lightLen?: number
  /** 每个周期的虚线段数，0 为实线 */
  dash?: number
  /** 呼吸幅度 0–1 */
  breath?: number
  /** 尾部渐隐 0–1（配合 period: 'whole'） */
  tail?: number
  /** 柔光强度 */
  glow?: number
  /** 线芯占半宽的比例 */
  coreWidth?: number
}

const r2 = (v: number) => Math.round(v * 100) / 100
const r3 = (v: number) => Math.round(v * 1000) / 1000

/** sRGB #rrggbb → 线性 RGBA（材质的向量参数是线性值） */
export function linearColor(hex: string): number[] {
  const h = hex.replace('#', '')
  const lin = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return r3(c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  }
  return [lin(0), lin(2), lin(4), 1]
}

const SCALARS: [keyof LineFlowStyle, string][] = [
  ['brightness', 'Brightness'],
  ['opacity', 'Opacity'],
  ['speed', 'Speed'],
  ['light', 'Light'],
  ['lightLen', 'LightLen'],
  ['dash', 'Dash'],
  ['breath', 'Breath'],
  ['tail', 'Tail'],
  ['glow', 'Glow'],
  ['coreWidth', 'CoreWidth']
]

/**
 * 一组线的 customMesh（同一图层一个网格，同样式）。lines 为空时返回 null。
 * z：离地高度，米（材质关了深度测试，只影响透视下的位置）。
 */
export function lineFlowMesh(id: string, lines: FlowPath[], style: LineFlowStyle, o: { groupId?: string; z?: number } = {}): ({ id: string } & Record<string, unknown>) | null {
  const z = o.z ?? 12
  const coordinates: number[][] = []
  const colors: number[][] = []
  const indices: number[] = []
  for (const line of lines) {
    if (line.path.length < 2) continue
    const cum = cumulative(line.path)
    const L = cum[cum.length - 1]
    if (L <= 0.5) continue
    const whole = style.period === 'whole'
    const period = whole ? L : (style.period as number)
    const half = line.width / 2
    const minor = line.minor ? 1 : 0
    for (const q of roadQuads(cum, whole ? L * 2 : period)) {
      const base = coordinates.length
      const k = whole ? 0 : Math.floor(q.d0 / period + 1e-6)
      for (const [d, side] of [
        [q.d0, 0],
        [q.d0, 1],
        [q.d1, 1],
        [q.d1, 0]
      ] as const) {
        const { p, n } = frameAt(line.path, cum, d)
        const s = side ? half : -half
        coordinates.push([r2(p[0] + n[0] * s), r2(p[1] + n[1] * s), z])
        colors.push([side, minor, 0, r3(Math.min(1, Math.max(0, d / period - k)))])
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }
  if (indices.length === 0) return null
  const scalarParameters = SCALARS.flatMap(([key, name]) => (style[key] !== undefined ? [{ name, value: style[key] as number }] : []))
  return {
    id,
    groupId: o.groupId,
    coordinateType: 0,
    coordinates,
    colors,
    indices,
    color: [1, 1, 1, 1],
    createCollision: false,
    material: LINE_FLOW_MATERIAL,
    scalarParameters,
    vectorParameters: [{ name: 'Color', value: linearColor(style.color) }]
  }
}
