/**
 * 场景图层的统一样式：配色和常用对象的构造函数。
 * 所有模块都从这里取颜色和样式，保证五个模块在场景里是同一套视觉语言：
 * 冷色（蓝）表示常态和结构，暖色（琥珀、珊瑚）只留给需要注意的东西。
 */
import { drawLabel, peekLabel, type LabelIcon, type LabelSpec } from './labelImage'
import { beaconMesh } from './pointBeacon'
import type { SceneObjectType } from './SceneApi'
import { registerPin, scheduleHover } from './pinSelection'
import type { SceneEffect } from './ModuleScene'
import { loadLib } from './effects'

/** 与界面设计令牌一致的颜色 */
export const COLOR = {
  accent: '#4c9aff',
  accentLight: '#8fc0ff',
  ice: '#dbe9ff',
  ok: '#51cf66',
  caution: '#ffd43b',
  warn: '#ffa94d',
  danger: '#ff6b6b',
  muted: '#9aa4b2',
  white: '#f3f5f8',
  panel: '#11161e'
} as const

/** 数值分级色带：低 → 高。前四档是蓝，只有最高两档转暖 */
export const RAMP = ['#1d4f91', '#2f6fc4', '#4c9aff', '#8fc0ff', '#ffa94d', '#ff6b6b'] as const
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

/** 定位机位的俯仰角、朝向：朝向与各模块默认机位一致，飞过去画面不打转 */
const FOCUS_PITCH = -42
const FOCUS_YAW = -38

/**
 * 俯瞰某一点的机位 [x, y, z, pitch, yaw]，目标点落在画面正中。五个模块的列表定位、标注点击、巡航都用它，
 * 保证飞过去的角度和远近一致。height 为相机高度：点位默认 1700 米（街区尺度，能看清事件周边的路口和建筑），
 * 范围较大的对象（防护区、长路段、桥）传更高的值。
 */
/** 点位定位的默认相机高度，米 */
export const FOCUS_HEIGHT = 1700

export function focusView(p: number[], height = FOCUS_HEIGHT): number[] {
  const d = height / Math.tan((-FOCUS_PITCH * Math.PI) / 180)
  const yaw = (FOCUS_YAW * Math.PI) / 180
  return [p[0] - Math.cos(yaw) * d, p[1] + Math.sin(yaw) * d, height, FOCUS_PITCH, FOCUS_YAW]
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
 * 发光线的亮度范围。实测：亮度超过 1 左右再叠上泛光，线芯会被冲成白色，绿黄橙红、蓝紫都分不出来；
 * 所以上限压在 1.2，主次靠线宽区分，亮度只做微调。
 */
const LINE_INTENSITY: [number, number] = [0.5, 1.2]
const lineIntensity = (brightness: number) => Math.min(LINE_INTENSITY[1], Math.max(LINE_INTENSITY[0], brightness))

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
    intensity: lineIntensity(o.brightness ?? 1),
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

/** 分级点位的亮度（V3 材质默认 1.5；泛光会放大它，0.9 时细线清楚、颜色不发白） */
const BEACON_BRIGHTNESS = 0.9

/**
 * 告警 / 事件点的地面效果：分级点位材质包（cityBase.beacons）可用时，整层合成一个 customMesh——
 * 一级光柱 + 信标、二三级短光柱、四级只有地面光环；不可用时退回 DTS 自带的扩散波纹（颜色、半径同以前）。
 */
export function alarmPoints(o: {
  id: string
  groupId: string
  beacons: boolean
  points: { id: string; at: number[]; level: 1 | 2 | 3 | 4; color: string; radius: number; brightness?: number }[]
}): { type: SceneObjectType; objects: { id: string }[] } {
  if (o.beacons) {
    const mesh = beaconMesh(o.id, o.points.map(p => ({ at: p.at, level: p.level })), { brightness: BEACON_BRIGHTNESS })
    return { type: 'customMesh', objects: mesh ? [mesh as { id: string }] : [] }
  }
  return { type: 'radiationPoint', objects: o.points.map(p => ripple({ id: o.id + '-' + p.id, groupId: o.groupId, at: p.at, radius: p.radius, color: p.color, brightness: p.brightness })) }
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

/**
 * 标注按优先级分档显示（相机高度，米）：重点（≥ 10）始终显示；一般（3–9）默认机位（约 9600 米）就能看到；
 * 次要（< 3，摄像头编号、巡逻单位、状态正常的设施）拉近到 6000 米以下才出现，免得全城视角下挤成一片。
 */
export const LABEL_TIERS = { normal: 11000, minor: 6000 } as const
export function labelTier(priority: number): { viewHeightRange?: number[]; rangeRatio?: number } {
  if (priority >= 10) return {}
  return { viewHeightRange: [1, priority >= 3 ? LABEL_TIERS.normal : LABEL_TIERS.minor], rangeRatio: 0.01 }
}

/**
 * 场景标注：设计稿的胶囊标签 + 类别色引线 + 落点，画成图片（见 labelImage）。userData 里带业务 id，点击事件按 groupId 派发。
 * tag 是左侧的彩色小标签（等级、类型、名次），value 是名称后面加粗的数值；lineHeight 是引线长度。
 */
export function pin(o: { id: string; groupId: string; at: number[]; text: string; color?: string; userId?: string; lineHeight?: number; fontSize?: number; priority?: number; tag?: string; value?: string; icon?: LabelIcon }) {
  const color = o.color ?? COLOR.accent
  const base = {
    id: o.id,
    groupId: o.groupId,
    userData: JSON.stringify({ id: o.userId ?? o.id }),
    coordinate: z(o.at, 0),
    coordinateType: 0,
    range: FAR,
    fixedSize: true,
    useTextAnimation: false,
    autoHeight: true,
    // 不交给引擎避让：displayMode 0 / 1 / 4 会把挤在一起的标注聚合成粗糙的计数方块。疏密改由相机高度分档控制
    displayMode: 2,
    priority: o.priority ?? 0,
    occlusionCull: false,
    ...labelTier(o.priority ?? 0)
  }
  // 按设计稿画成图片标注（胶囊 + 引线 + 落点）；没有 canvas 时退回 DTS 文字标注
  const spec: LabelSpec = { text: o.text, color, tag: o.tag, value: o.value, icon: o.icon, lead: o.lineHeight ?? 36, fontSize: o.fontSize, emphasis: (o.priority ?? 0) >= 10 }
  const img = drawLabel(spec)
  if (img) {
    // 悬停图和普通图同尺寸，锚点不变。画过的直接用；没画过的先用普通图，空闲时补画（见 pinSelection.scheduleHover）
    registerPin(o.id, o.userId ?? o.id, spec, img.url)
    const hover = peekLabel({ ...spec, variant: 'hover' })
    if (!hover) scheduleHover(o.id, spec)
    return { ...base, text: '', imagePath: img.url, imageSize: img.size, hoverImagePath: (hover ?? img).url, hoverImageSize: img.size, anchors: img.anchor, showLine: false }
  }
  return {
    ...base,
    imagePath: '',
    imageSize: [0, 0],
    text: [o.tag !== undefined ? `${o.tag} · ${o.text}` : o.text, o.value].filter(t => t !== undefined).join('  '),
    textRange: FAR,
    textOffset: [0, 0],
    textBackgroundColor: rgba(COLOR.panel, 0.88),
    fontSize: o.fontSize ?? 13,
    fontColor: rgba(COLOR.white),
    fontOutlineSize: 0,
    showLine: true,
    lineSize: [2, o.lineHeight ?? 36],
    lineColor: rgba(color, 0.95),
    lineOffset: [0, 0]
  }
}

/**
 * 相互靠近的标注错开引线高度，免得文字框叠成一团：按传入顺序，每个标注取 radius 米内已排好的标注没用过的最低一档。
 * points 为投影坐标，返回每个标注的 lineHeight。
 */
export function staggerHeights(points: number[][], base: number, step: number, radius: number): number[] {
  const heights: number[] = []
  points.forEach((p, i) => {
    const used = new Set(points.slice(0, i).flatMap((q, j) => (Math.hypot(p[0] - q[0], p[1] - q[1]) < radius ? [heights[j]] : [])))
    let h = base
    while (used.has(h)) h += step
    heights.push(h)
  })
  return heights
}

/** 飞线的分段数 */
const ARC_STEPS = 24

/**
 * 两点之间的弧线（区域间联系、调度）。返回 polyline.add 的参数。
 *
 * 实测：DTS 的迁徙线对象（odline）在 8–10 公里的相机距离上画不出来，所以用实线折线自己算弧形。
 * 弧线同时向侧面弯、向上抬：只向上抬的话，走向和视线一致的飞线从斜俯视看过去是一条直线。
 * bend 为弯曲程度（侧弯 = 长度 × bend × 0.6，顶点高度 = 长度 × bend × 0.5）；coordinates 首尾就是 from / to。
 */
export function arc(o: { id: string; groupId?: string; from: number[]; to: number[]; color: string; width?: number; bend?: number; brightness?: number }) {
  const bend = o.bend ?? 0.35
  const dx = o.to[0] - o.from[0]
  const dy = o.to[1] - o.from[1]
  const length = Math.hypot(dx, dy)
  // 行进方向的右手边
  const side = length ? [dy / length, -dx / length] : [0, 0]
  const coordinates = Array.from({ length: ARC_STEPS + 1 }, (_, i) => {
    const t = i / ARC_STEPS
    const k = 4 * t * (1 - t) // 0 → 1 → 0 的抛物线
    return [o.from[0] + dx * t + side[0] * length * bend * 0.6 * k, o.from[1] + dy * t + side[1] * length * bend * 0.6 * k, 10 + length * bend * 0.5 * k]
  })
  return {
    id: o.id,
    groupId: o.groupId,
    coordinates,
    coordinateType: 0,
    color: rgba(o.color),
    style: 4, // PolylineStyle.Normal
    thickness: o.width ?? 30,
    intensity: lineIntensity(o.brightness ?? 1),
    depthTest: false,
    range: FAR
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
/** 热力色带：深蓝（透明）→ 蓝 → 青 → 黄 → 橙 → 红。图例取 alpha > 0 的几档 */
export const HEAT_STOPS: { value: number; color: string; alpha: number }[] = [
  { value: 0, color: RAMP[0], alpha: 0 },
  { value: 0.35, color: RAMP[0], alpha: 0.16 },
  { value: 0.55, color: RAMP[1], alpha: 0.28 },
  { value: 0.68, color: '#38c6d9', alpha: 0.38 },
  { value: 0.8, color: COLOR.caution, alpha: 0.5 },
  { value: 0.9, color: RAMP[4], alpha: 0.6 },
  { value: 1, color: RAMP[5], alpha: 0.7 }
]

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
    // 普通混合；低值近乎透明、中值是低透明度的冷色，只有高值才出现暖色：近景下城市和光效不会被一整片黄色盖住
    opacityMode: 1,
    opacityRange: [0.04, 0.62],
    blur: 0.9,
    blendMode: 0,
    light: false,
    colors: {
      gradient: true,
      invalidColor: [0, 0, 0, 0],
      colorStops: o.stops ?? HEAT_STOPS.map(s => ({ value: s.value, color: rgba(s.color, s.alpha) }))
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
 * 点阵流光的亮度档：效果库预设按夜景调，白天的亮影像上点阵、发光描边和泛光叠在一起会把片区冲成一片白。
 * 这里把点阵亮度减半、关掉描边泛白、收窄外发光，让片区在白天读成「有色描边 + 淡点阵」，夜里也不会太暗。
 */
const REGION_TONE = { lineIntensity: 1, lineWhiten: 0, glowIntensity: 0.5, glowOpacity: 0.08, spillIntensity: 0.1, flowIntensity: 1.6 } as const

/**
 * 点阵流光图层（效果总包）：一组区域各用一种颜色，淡底色 + 内部图案 + 发光描边 + 沿边界跑的流光。
 * 整层只有一个场景对象。regions 的 ring 是投影坐标；相邻区域的公共边要用同一组顶点（geo.json 的片区满足）。
 * 需要效果总包已挂载。
 */
export async function regionLayer(id: string, regions: { id: string; color: string; ring: number[][] }[], style: RegionStyle = {}): Promise<SceneEffect & { setColors(colors: Record<string, string>): Promise<void> }> {
  const lib = await loadLib('region-dot-flow')
  const preset = lib.PRESETS[style.pattern ?? 'dots']
  const scale = style.scale ?? 3
  const full = { ...lib.DEFAULT_STYLE, ...preset, ...REGION_TONE, dotSpacingM: preset.dotSpacingM * scale, dotSizeM: preset.dotSizeM * scale, dotIntensity: preset.dotIntensity * 0.5, baseOpacity: style.fill ?? 0.1 }
  const build = (colors?: Record<string, string>) =>
    lib.create(__xapi, { id, groundZ: 3, style: full, regions: regions.map(r => ({ id: r.id, color: colors?.[r.id] ?? r.color, rings: [r.ring.map(p => [p[0], p[1]])] })) })
  await build()
  let current: Record<string, string> = Object.fromEntries(regions.map(r => [r.id, r.color]))
  let removed = false
  let visible = true
  return {
    show: () => {
      visible = true
      return __xapi.customObject.showByGroupId(id)
    },
    hide: () => {
      visible = false
      return __xapi.customObject.hideByGroupId(id)
    },
    remove: () => {
      removed = true
      return lib.remove(__xapi, id)
    },
    /** 换色（数值变化时）。颜色没变或图层已删除则不发指令 */
    async setColors(colors) {
      const changed = Object.keys(colors).some(k => colors[k] !== current[k])
      if (!changed || removed) return
      current = { ...current, ...colors }
      // setColors 返回 false 表示要重建；图层在库里已不存在（例如被别处清掉）时也重建
      let ok = false
      try {
        ok = await lib.setColors(__xapi, id, colors)
      } catch (e) {
        console.warn('[regionLayer] 换色失败，重建图层', e)
      }
      if (removed) return
      if (!ok) {
        try {
          await build(current)
        } catch (e) {
          console.warn('[regionLayer] 重建图层失败', e)
          return
        }
      }
      // 换色或重建会让对象重新显示；图层关着时再藏回去
      if (!visible) await __xapi.customObject.hideByGroupId(id)
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
