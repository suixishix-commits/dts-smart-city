/**
 * 场景图层的统一样式：配色和常用对象的构造函数。
 * 所有模块都从这里取颜色和样式，保证五个模块在场景里是同一套视觉语言：
 * 冷色（蓝）表示常态和结构，暖色（琥珀、珊瑚）只留给需要注意的东西。
 */
import type { SceneEffect } from './ModuleScene'
import { loadLib } from './effects'

/** 与界面设计令牌一致的颜色 */
export const COLOR = {
  accent: '#4c9aff',
  accentLight: '#7cc4ff',
  ice: '#bfe3ff',
  ok: '#51cf66',
  caution: '#ffd43b',
  warn: '#ffa94d',
  danger: '#ff6b6b',
  muted: '#9aa4b2',
  white: '#f3f5f8',
  panel: '#11161e'
} as const

/** 数值分级色带：低 → 高。前四档是蓝，只有最高两档转暖 */
export const RAMP = ['#2b5f9e', '#3b7fc4', '#4c9aff', '#7fb8ff', '#ffb454', '#ff7a59'] as const
/** 告警等级色：1 级最严重 */
export const LEVEL_COLOR: Record<number, string> = { 1: COLOR.danger, 2: COLOR.warn, 3: COLOR.caution, 4: '#74a9ff' }
/** 状态色：畅通/正常 → 拥堵/异常 */
export const STATUS_RAMP = [COLOR.ok, COLOR.caution, COLOR.warn, COLOR.danger] as const

/** '#rrggbb' → [r, g, b, a]（0–1），DTS 原生对象的颜色格式 */
export function rgba(hex: string, alpha = 1): number[] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).concat(alpha)
}

/** 按 0–1 的比例从色带里取一档 */
export function rampColor(t: number, ramp: readonly string[] = RAMP): string {
  const i = Math.min(ramp.length - 1, Math.max(0, Math.floor(t * ramp.length)))
  return ramp[i]
}

const FAR: [number, number] = [1, 1000000]
const z = (p: number[], h: number) => [p[0], p[1], h]

export interface FlowLineOptions {
  id: string
  groupId?: string
  /** 投影坐标折线 [[x, y], …] */
  path: number[][]
  color: string
  /** 线宽，米。城市级俯视下主干路 60–90、次要 30–50 才看得清 */
  width: number
  /** pulse 粒子流里隔一段跑过一个亮脉冲；particles 粒子流；dash 流动虚线；arrow 追逐箭头 */
  style?: 'pulse' | 'particles' | 'dash' | 'arrow'
  brightness?: number
  /** 流速，0 静止 */
  speed?: number
  /** 粒子/虚线间距，米 */
  spacing?: number
  /** 沿点序反方向流动 */
  reverse?: boolean
  /** 离地高度，米 */
  height?: number
}

/** 各样式相对 width 的线宽比例：用粗细而不是花纹来区分线的主次 */
const LINE_SCALE = { pulse: 1, arrow: 1, particles: 0.8, dash: 0.6 } as const

/**
 * 城市级俯视下的发光线：道路、管线、路线都用它。返回 polyline.add 的参数。
 *
 * 实测结论（相机距离 8–10 公里）：效果总包的流动线材质和 DTS 内置的流动、箭头、虚线样式在这个距离上只剩一条
 * 若隐若现的细线，多点长线上几乎看不见；只有内置的实线样式能稳定地画出清晰的发光线。所以这里统一用实线，
 * 靠颜色、粗细、亮度区分类别；动态感交给波纹、点阵流光和飞线。style / speed / spacing / reverse 保留给调用方表达语义，
 * 目前只有 style 影响粗细。
 */
export function flowLine(o: FlowLineOptions): { id: string } {
  const style = o.style ?? 'particles'
  return {
    id: o.id,
    groupId: o.groupId,
    coordinates: o.path.map(p => z(p, o.height ?? 12)),
    coordinateType: 0,
    color: rgba(o.color, style === 'dash' ? 0.85 : 1),
    style: 4, // PolylineStyle.Normal
    thickness: Math.max(10, o.width * LINE_SCALE[style]),
    intensity: Math.min(3, Math.max(0.8, o.brightness ?? 2.4)),
    depthTest: false,
    range: FAR
  } as { id: string }
}

/** 保留的入口：流动线已不依赖适配库，调用它没有副作用 */
export async function prepareFlowLines(): Promise<void> {}

/** 普通发光实线（DTS 内置样式），不依赖效果总包 */
export function plainLine(o: { id: string; groupId?: string; path: number[][]; color: string; width: number; brightness?: number; height?: number; flow?: boolean; alpha?: number }) {
  return {
    id: o.id,
    groupId: o.groupId,
    coordinates: o.path.map(p => z(p, o.height ?? 12)),
    coordinateType: 0,
    color: rgba(o.color, o.alpha ?? 1),
    style: o.flow ? 2 : 4, // PolylineStyle.Flow / Normal
    thickness: o.width,
    intensity: o.brightness ?? 1,
    flowRate: 0.4,
    depthTest: false,
    range: FAR
  }
}

/** 贴地扩散波纹：事件点、预警范围 */
export function ripple(o: { id: string; groupId?: string; at: number[]; radius: number; color: string; rings?: number; brightness?: number }) {
  return {
    id: o.id,
    groupId: o.groupId,
    coordinate: z(o.at, 2),
    coordinateType: 0,
    radius: o.radius,
    rippleNumber: o.rings ?? 3,
    color: rgba(o.color, 0.9),
    intensity: o.brightness ?? 0.8,
    autoHeight: true
  }
}

/** 文字标注（深色底牌 + 细牵引线）。userData 里带业务 id，点击事件按 groupId 派发 */
export function pin(o: { id: string; groupId: string; at: number[]; text: string; color?: string; userId?: string; lineHeight?: number; fontSize?: number; priority?: number }) {
  const accent = rgba(o.color ?? COLOR.accent, 0.95)
  return {
    id: o.id,
    groupId: o.groupId,
    userData: JSON.stringify({ id: o.userId ?? o.id }),
    coordinate: z(o.at, 0),
    coordinateType: 0,
    range: FAR,
    imagePath: '',
    imageSize: [0, 0],
    fixedSize: true,
    text: o.text,
    useTextAnimation: false,
    textRange: FAR,
    textOffset: [0, 0],
    textBackgroundColor: rgba(COLOR.panel, 0.88),
    fontSize: o.fontSize ?? 13,
    fontColor: rgba(COLOR.white),
    fontOutlineSize: 0,
    showLine: true,
    lineSize: [2, o.lineHeight ?? 36],
    lineColor: accent,
    lineOffset: [0, 0],
    autoHeight: true,
    // 重点标注（priority ≥ 10）始终显示；其余交给引擎做避让，挤在一起时自动隐去一部分，放大后再出现
    displayMode: (o.priority ?? 0) >= 10 ? 2 : 4,
    priority: o.priority ?? 0,
    occlusionCull: false
  }
}

/** 两点之间的抛物线飞线（区域间联系、调度） */
export function arc(o: { id: string; groupId?: string; from: number[]; to: number[]; color: string; width?: number; bend?: number; brightness?: number }) {
  return {
    id: o.id,
    groupId: o.groupId,
    coordinates: [z(o.from, 10), z(o.to, 10)],
    coordinateType: 0,
    color: rgba(o.color),
    intensity: o.brightness ?? 3,
    flowRate: 0.6,
    bendDegree: o.bend ?? 0.35,
    tiling: 1,
    lineThickness: o.width ?? 30,
    flowPointSizeScale: (o.width ?? 30) * 2,
    labelSizeScale: 260,
    lineShape: 1,
    lineStyle: 2,
    flowShape: 1,
    startPointShape: 0,
    endPointShape: 1,
    startLabelShape: 1,
    endLabelShape: 1
  }
}

/** 立体柱（六棱柱）：用高度表达数值。at 为柱心，radius / height 单位米 */
export function column(o: { id: string; groupId?: string; at: number[]; radius: number; height: number; color: string; alpha?: number }) {
  const ring = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i
    return [o.at[0] + Math.cos(a) * o.radius, o.at[1] + Math.sin(a) * o.radius, 2]
  })
  return {
    id: o.id,
    groupId: o.groupId,
    coordinates: ring,
    coordinateType: 0,
    color: rgba(o.color, o.alpha ?? 0.85),
    height: Math.max(1, o.height),
    intensity: 1.4,
    style: 2, // Polygon3DStyle.Gradual：自下而上渐变
    tillingX: 0,
    tillingY: 0,
    generateTop: true,
    generateSide: true,
    generateBottom: false
  }
}

/** 贴地范围面：半透明填充 + 描边 */
export function area(o: { id: string; groupId?: string; ring: number[][]; color: string; fill?: number; frame?: number; frameWidth?: number }) {
  return {
    id: o.id,
    groupId: o.groupId,
    coordinates: o.ring.map(p => z(p, 6)),
    coordinateType: 0,
    range: FAR,
    color: rgba(o.color, o.fill ?? 0.18),
    frameColor: rgba(o.color, o.frame ?? 0.9),
    frameThickness: o.frameWidth ?? 12,
    intensity: 1,
    style: 0,
    depthTest: false
  }
}

/** 以 at 为圆心、radius 米为半径的圆环顶点（用于范围面、缓冲区） */
export function circleRing(at: number[], radius: number, segments = 48): number[][] {
  return Array.from({ length: segments }, (_, i) => {
    const a = (Math.PI * 2 * i) / segments
    return [at[0] + Math.cos(a) * radius, at[1] + Math.sin(a) * radius]
  })
}

/** 平面热力图（内置对象）。points 的 value 须在 range 内；只画陆地上的点才不会漫到海里 */
export function heatmap(o: { id: string; groupId?: string; points: { id: string; at: number[]; radius: number; value: number }[]; range: [number, number]; z?: [number, number]; stops?: { value: number; color: number[] }[] }) {
  const xs = o.points.map(p => p.at[0])
  const ys = o.points.map(p => p.at[1])
  const pad = Math.max(...o.points.map(p => p.radius)) + 200
  const [minZ, maxZ] = o.z ?? [-50, 300]
  return {
    id: o.id,
    groupId: o.groupId,
    bbox: [Math.min(...xs) - pad, Math.min(...ys) - pad, minZ, Math.max(...xs) + pad, Math.max(...ys) + pad, maxZ],
    range: o.range,
    data: o.points.map(p => ({ id: p.id, coordinate: [p.at[0], p.at[1], 0], radius: p.radius, heatValue: Math.min(o.range[1], Math.max(o.range[0], p.value)) })),
    style: 0,
    textureSize: 1024,
    opacityMode: 1,
    opacityRange: [0, 0.6],
    blur: 0.9,
    blendMode: 1,
    light: false,
    colors: {
      gradient: true,
      invalidColor: [0, 0, 0, 0],
      colorStops: o.stops ?? [
        { value: 0, color: rgba('#2b5f9e', 0) },
        { value: 0.3, color: rgba('#3b7fc4', 0.35) },
        { value: 0.55, color: rgba('#4c9aff', 0.5) },
        { value: 0.75, color: rgba('#e8a33d', 0.6) },
        { value: 1, color: rgba('#e8603c', 0.7) }
      ]
    },
    updateTime: 0.8
  }
}

export interface RegionStyle {
  /** dots 点阵 / glimmer 微光点阵 / hatch 斜纹 / honeycomb 蜂巢 / contour 轮廓流线 / grid 微栅格 */
  pattern?: 'dots' | 'glimmer' | 'hatch' | 'honeycomb' | 'contour' | 'grid'
  /** 图案缩放。预设按「1 像素约 4 米」调，城市级俯视用 3 左右 */
  scale?: number
  /** 底色不透明度 0–0.5 */
  fill?: number
}

/**
 * 点阵流光图层（效果总包）：一组区域各用一种颜色，淡底色 + 内部图案 + 发光描边 + 沿边界跑的流光。
 * 整层只有一个场景对象。regions 的 ring 是投影坐标；相邻区域的公共边要用同一组顶点（geo.json 的片区满足）。
 * 需要效果总包已挂载。
 */
export async function regionLayer(id: string, regions: { id: string; color: string; ring: number[][] }[], style: RegionStyle = {}): Promise<SceneEffect & { setColors(colors: Record<string, string>): Promise<void> }> {
  const lib = await loadLib('region-dot-flow')
  const preset = lib.PRESETS[style.pattern ?? 'dots']
  const scale = style.scale ?? 3
  const full = { ...lib.DEFAULT_STYLE, ...preset, dotSpacingM: preset.dotSpacingM * scale, dotSizeM: preset.dotSizeM * scale, baseOpacity: style.fill ?? 0.1 }
  const build = (colors?: Record<string, string>) =>
    lib.create(__xapi, { id, groundZ: 3, style: full, regions: regions.map(r => ({ id: r.id, color: colors?.[r.id] ?? r.color, rings: [r.ring.map(p => [p[0], p[1]])] })) })
  await build()
  let current: Record<string, string> = Object.fromEntries(regions.map(r => [r.id, r.color]))
  return {
    show: () => __xapi.customObject.showByGroupId(id),
    hide: () => __xapi.customObject.hideByGroupId(id),
    remove: () => lib.remove(__xapi, id),
    /** 换色（数值变化时）。颜色没变则不发指令 */
    async setColors(colors) {
      const changed = Object.keys(colors).some(k => colors[k] !== current[k])
      if (!changed) return
      current = { ...current, ...colors }
      // setColors 返回 false 表示要重建
      if (!(await lib.setColors(__xapi, id, colors))) await build(current)
    }
  }
}

/** 电子围栏（效果总包）：贴地轮廓提亮后升起半透明幕墙。ring 为闭合轮廓的投影坐标（首尾不用重复） */
export async function fence(id: string, ring: number[][], o: { height?: number; color?: string } = {}): Promise<SceneEffect> {
  const lib = await loadLib('electronic-fence')
  await lib.create(__xapi, { id, coordinates: ring.map(p => [p[0], p[1]]), heightM: o.height ?? 120, groundZ: 3, mode: 'rise', style: o.color ? { color: o.color, edgeColor: o.color } : {} })
  return {
    show: () => __xapi.customObject.showByGroupId(id),
    hide: () => __xapi.customObject.hideByGroupId(id),
    remove: () => lib.remove(__xapi, id)
  }
}

/** 摄像头视域（效果总包）：从镜头长出的半透明视锥。position 镜头 [x, y, z]，target 瞄准点 [x, y, z] */
export async function frustum(id: string, position: number[], target: number[], o: { hfov?: number; vfov?: number; range?: number } = {}): Promise<SceneEffect> {
  const lib = await loadLib('view-frustum')
  await lib.create(__xapi, { id, position, target, hfovDeg: o.hfov ?? 60, vfovDeg: o.vfov ?? 34, rangeM: o.range ?? 900, collision: false, duration: 1.2 })
  return {
    show: () => __xapi.customObject.showByGroupId(id),
    hide: () => __xapi.customObject.hideByGroupId(id),
    remove: () => lib.remove(__xapi, id)
  }
}
