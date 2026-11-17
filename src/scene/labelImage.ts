/**
 * 场景标注的图片：照 Claude Design 稿的标签样式（深色胶囊 + 1px 浅描边 + 左侧类别圆点或等级小标签），
 * 加一根类别色引线和一个落点，在前端画到 canvas 上转成 PNG，交给 marker.imagePath。
 *
 * 为什么不用 DTS 自带的文字：它的文字底只能是直角色块，引线是硬直线，做不出设计稿的样子；
 * 而且实测 DTS 画的文字和图片不按同一比例缩放。整张画成图片后排版不会变。做法同 dts-effects 的 combo-marker。
 *
 * 尺寸单位是设计稿像素（推流 1920×1080 时 1:1），按推流分辨率乘倍数；画布按至少 2 倍分辨率画，4K 下也清楚。
 * 没有 canvas 的环境（单元测试）返回 null，调用方退回 DTS 文字标注。
 */

/** 图标胶囊左侧的类别图标 */
export type LabelIcon =
  | 'camera'
  | 'air'
  | 'water'
  | 'power'
  | 'gas'
  | 'pump'
  | 'bridge'
  | 'cooling'
  | 'vehicle'
  | 'signal'
  | 'shield'
  | 'person'
  | 'factory'
  | 'hotspot'
  | 'dot'

export interface LabelSpec {
  text: string
  /** 类别色：等级色条 / 小标签 / 图标底 / 引线 / 落点 */
  color: string
  /** 等级、类型、名次的小标签。有它时画「切角数据卡」（告警、事件），没有时画「图标胶囊」（设施、站点） */
  tag?: string
  /** 名称后面加粗显示的数值 */
  value?: string
  /** 图标胶囊的类别图标；默认 dot */
  icon?: LabelIcon
  /** 引线长度，设计稿像素 */
  lead: number
  /** 字号；12 及以下是紧凑标签 */
  fontSize?: number
  /** 重点标注：描边带类别色 */
  emphasis?: boolean
  /** 悬停：描边换成类别色、底色提亮；选中：类别色描边加外发光、底色染一层类别色 */
  variant?: 'normal' | 'hover' | 'selected'
}

export interface LabelImage {
  /** PNG data 地址 */
  url: string
  /** marker.imageSize，推流像素 */
  size: [number, number]
  /** marker.anchors：落点中心对准坐标点 */
  anchor: [number, number]
}

/** 图片四周给投影、选中外发光留的空白 */
const MARGIN = 9
/** 落点光环的横向半径（纵向按透视压扁） */
const RING_R = 9
/** 名称最长宽度，超出截断成「…」 */
const MAX_TEXT = 240
/** 数据卡右上角切角的边长 */
const CHAMFER = 9
const FONT = "'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif"
const NUM_FONT = "'Barlow Semi Condensed', Inter, 'Segoe UI', " + FONT
const INK = '#10151c'

/** 类别图标：24×24 网格里的 SVG 路径，fill 实心、stroke 描线 */
const ICONS: Record<Exclude<LabelIcon, 'dot'>, { d: string; mode: 'fill' | 'stroke' }> = {
  camera: { d: 'M3 8h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM16 11l5-3v8l-5-3z', mode: 'fill' },
  air: { d: 'M3 9h10a3 3 0 1 0-3-3M3 13h14a3 3 0 1 1-3 3M3 17h7', mode: 'stroke' },
  water: { d: 'M12 3c0 0-6.5 7.5-6.5 11.5a6.5 6.5 0 0 0 13 0C18.5 10.5 12 3 12 3z', mode: 'fill' },
  power: { d: 'M13.5 2 5 13.5h6L10 22l9-12h-6.5z', mode: 'fill' },
  gas: { d: 'M12 2c1.5 4 5.5 6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.5 1.5-4.5 2.5-6 .5 2 1.5 3.5 3 4 0-3-1-6 0-9z', mode: 'fill' },
  pump: { d: 'M12 7a5 5 0 1 1 0 10a5 5 0 1 1 0-10zM12 2v3M12 19v3M2 12h3M19 12h3', mode: 'stroke' },
  bridge: { d: 'M2 17h20M4 17c0-6 16-6 16 0M8 13v4M12 12v5M16 13v4', mode: 'stroke' },
  cooling: { d: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5', mode: 'stroke' },
  vehicle: { d: 'M4.5 10 6.4 5.6A1.5 1.5 0 0 1 7.8 4.7h8.4a1.5 1.5 0 0 1 1.4.9l1.9 4.4h.5a1 1 0 0 1 1 1V17h-2v1.6a1 1 0 0 1-1 1h-1.2a1 1 0 0 1-1-1V17H8.2v1.6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V17H3v-6a1 1 0 0 1 1-1zM7 10h10l-1.4-3.4H8.4zM6.5 13.5a1.2 1.2 0 1 0 0 .01zM17.5 13.5a1.2 1.2 0 1 0 0 .01z', mode: 'fill' },
  signal: { d: 'M9 3h6a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM12 6.5v.01M12 12v.01M12 17.5v.01', mode: 'stroke' },
  shield: { d: 'M12 2 20 5v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z', mode: 'fill' },
  person: { d: 'M12 3.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7zM5 20.5c0-4.5 3-7 7-7s7 2.5 7 7z', mode: 'fill' },
  factory: { d: 'M3 20.5V10l5 3v-3l5 3V5h4v15.5zM18 5h2v15.5h-2z', mode: 'fill' },
  hotspot: { d: 'M12 2l3 7 7.5.6-5.7 4.9 1.8 7.5L12 18l-6.6 4 1.8-7.5L1.5 9.6 9 9z', mode: 'fill' }
}

export interface LabelLayout {
  /** 卡片 / 胶囊的高和宽 */
  boxH: number
  boxW: number
  /** 左内边距（到小标签或图标） */
  padL: number
  /** 小标签宽高（数据卡） */
  tagW: number
  tagH: number
  /** 图标直径（胶囊） */
  icon: number
  /** 名称起点 x（相对卡片左边） */
  textX: number
  /** 数值起点 x（相对卡片左边） */
  valueX: number
  /** 整张图宽高 */
  width: number
  height: number
  /** 落点中心 y */
  groundY: number
  /** 卡片样式 */
  kind: 'card' | 'pill'
}

/**
 * 标注排版（纯计算，便于测试）：各段宽度由调用方量好传进来。
 * 有小标签：切角数据卡，高 = 字号 × 2 + 8（13 号字 34 高）；没有：图标胶囊，高 = 字号 × 2 + 10（13 号字 36 高）。
 */
export function labelLayout(o: { fontSize: number; textW: number; tagTextW?: number; valueW?: number; lead: number }): LabelLayout {
  const compact = o.fontSize <= 12
  const kind = o.tagTextW !== undefined ? 'card' : 'pill'
  const boxH = o.fontSize * 2 + (kind === 'card' ? 8 : 10)
  const tagH = boxH - 14
  const tagW = kind === 'card' ? Math.ceil((o.tagTextW as number) + 12) : 0
  const icon = kind === 'pill' ? boxH - 8 : 0
  const padL = kind === 'card' ? 11 : 4
  const textX = padL + (kind === 'card' ? tagW + 8 : icon + 8)
  const valueX = textX + o.textW + 10
  const end = o.valueW !== undefined ? valueX + o.valueW : textX + o.textW
  const boxW = Math.ceil(end + (kind === 'card' ? CHAMFER + 6 : compact ? 12 : 14))
  const width = Math.max(boxW, RING_R * 2) + MARGIN * 2
  const groundY = MARGIN + boxH + o.lead
  return { boxH, boxW, padL, tagW, tagH, icon, textX, valueX, width, height: groundY + RING_R + 2, groundY, kind }
}

/** 显示倍数：按推流画面分辨率，min(宽 / 1920, 高 / 1080)，拿不到时为 1 */
export function streamScale(): number {
  const video = typeof document === 'undefined' ? null : (document.querySelector('video') as HTMLVideoElement | null)
  if (!video || !video.videoWidth || !video.videoHeight) return 1
  return Math.min(video.videoWidth / 1920, video.videoHeight / 1080)
}

let probe: CanvasRenderingContext2D | null | undefined
function probeContext(): CanvasRenderingContext2D | null {
  if (probe === undefined) probe = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  return probe
}

const cache = new Map<string, LabelImage>()

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`
}

/** 超过 max 宽度时末尾截断成「…」 */
function fit(g: CanvasRenderingContext2D, s: string, max: number): string {
  if (g.measureText(s).width <= max) return s
  let t = s
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

function cacheKey(spec: LabelSpec, scale: number): string {
  return JSON.stringify([spec.text, spec.color, spec.tag, spec.value, spec.icon, spec.lead, spec.fontSize ?? 13, !!spec.emphasis, spec.variant ?? 'normal', scale])
}

/** 已经画过的标注；没画过返回 null（不画） */
export function peekLabel(spec: LabelSpec, scale = streamScale()): LabelImage | null {
  return cache.get(cacheKey(spec, scale)) ?? null
}

/**
 * 画一张标注；同样的内容只画一次。没有 canvas 时返回 null。
 * 一张约 2–3 毫秒（主要是 PNG 编码），随时间轴变化的图层每个时刻都要重画，所以：
 * 画布倍率只取推流倍数的 1.25 倍、不低于 1.5（文字仍清楚，像素比固定 2 倍少四成）；悬停图由 kit.pin 延后到空闲时画。
 */
export function drawLabel(spec: LabelSpec, scale = streamScale()): LabelImage | null {
  const g0 = probeContext()
  if (!g0) return null
  const fontSize = spec.fontSize ?? 13
  const dpr = Math.max(1.5, scale * 1.25)
  const variant = spec.variant ?? 'normal'
  const key = cacheKey(spec, scale)
  const hit = cache.get(key)
  if (hit) return hit

  const textFont = `500 ${fontSize}px ${FONT}`
  const valueFont = `600 ${fontSize}px ${NUM_FONT}`
  const tagFont = `700 ${fontSize - 2}px ${FONT}`
  g0.font = textFont
  const text = fit(g0, spec.text, MAX_TEXT)
  const textW = g0.measureText(text).width
  g0.font = valueFont
  const valueW = spec.value !== undefined ? g0.measureText(spec.value).width : undefined
  g0.font = tagFont
  const tagTextW = spec.tag !== undefined ? g0.measureText(spec.tag).width : undefined
  const L = labelLayout({ fontSize, textW, tagTextW, valueW, lead: spec.lead })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(L.width * dpr)
  canvas.height = Math.round(L.height * dpr)
  const g = canvas.getContext('2d') as CanvasRenderingContext2D
  g.scale(dpr, dpr)
  const cx = L.width / 2
  const left = cx - L.boxW / 2
  const top = MARGIN
  const midY = top + L.boxH / 2
  const lit = variant !== 'normal'

  drawLeader(g, spec, L, cx, top, variant)
  if (L.kind === 'card') drawCard(g, spec, L, left, top, lit, variant)
  else drawPill(g, spec, L, left, top, lit, variant)

  g.textBaseline = 'middle'
  if (L.kind === 'card' && spec.tag !== undefined) {
    // 等级小标签：类别色底、深色字
    roundRect(g, left + L.padL, midY - L.tagH / 2, L.tagW, L.tagH, 3)
    g.fillStyle = spec.color
    g.fill()
    g.font = tagFont
    g.fillStyle = INK
    g.textAlign = 'center'
    g.fillText(spec.tag, left + L.padL + L.tagW / 2, midY + 0.5)
  } else if (L.kind === 'pill') {
    drawIcon(g, spec, left + L.padL + L.icon / 2, midY, L.icon)
  }
  g.textAlign = 'left'
  g.font = textFont
  g.fillStyle = lit ? '#ffffff' : '#eef2f7'
  g.fillText(text, left + L.textX, midY + 0.5)
  if (spec.value !== undefined) {
    g.font = valueFont
    g.fillStyle = mix(spec.color, '#ffffff', 0.45)
    g.fillText(spec.value, left + L.valueX, midY + 1)
  }

  const out: LabelImage = {
    url: canvas.toDataURL('image/png'),
    size: [Math.round(L.width * scale), Math.round(L.height * scale)],
    anchor: [-(L.width / 2) * scale, L.groundY * scale]
  }
  cache.set(key, out)
  return out
}

/** 两个 #rrggbb 按比例混合（t 是第二个颜色的比例） */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t)
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}

/** 引线 + 落点：引线上淡下浓；落点是透视压扁的光环加实心点，数据卡的引线顶端有菱形节点 */
function drawLeader(g: CanvasRenderingContext2D, spec: LabelSpec, L: LabelLayout, cx: number, top: number, variant: string) {
  const from = top + L.boxH
  if (spec.lead > 0) {
    const line = g.createLinearGradient(0, from, 0, L.groundY)
    line.addColorStop(0, alpha(spec.color, 0.25))
    line.addColorStop(1, alpha(spec.color, 0.95))
    g.save()
    g.shadowColor = alpha(spec.color, 0.5)
    g.shadowBlur = 2
    g.fillStyle = line
    g.fillRect(cx - 0.75, from, 1.5, spec.lead)
    g.restore()
    if (L.kind === 'card') {
      g.beginPath()
      g.moveTo(cx, from + 1)
      g.lineTo(cx + 3.5, from + 4.5)
      g.lineTo(cx, from + 8)
      g.lineTo(cx - 3.5, from + 4.5)
      g.closePath()
      g.fillStyle = mix(spec.color, '#ffffff', 0.35)
      g.fill()
    }
  }
  g.beginPath()
  g.ellipse(cx, L.groundY, RING_R, RING_R * 0.42, 0, 0, Math.PI * 2)
  g.fillStyle = alpha(spec.color, variant === 'selected' ? 0.35 : 0.14)
  g.fill()
  g.lineWidth = 1
  g.strokeStyle = alpha(spec.color, 0.65)
  g.stroke()
  g.beginPath()
  g.ellipse(cx, L.groundY, 3, 1.6, 0, 0, Math.PI * 2)
  g.fillStyle = mix(spec.color, '#ffffff', 0.5)
  g.fill()
}

/** 切角数据卡：右上角切角加亮边，左侧等级色条，底色从等级色渐隐到深色 */
function drawCard(g: CanvasRenderingContext2D, spec: LabelSpec, L: LabelLayout, x: number, y: number, lit: boolean, variant: string) {
  const w = L.boxW
  const h = L.boxH
  const shape = () => {
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + w - CHAMFER, y)
    g.lineTo(x + w, y + CHAMFER)
    g.lineTo(x + w, y + h)
    g.lineTo(x, y + h)
    g.closePath()
  }
  g.save()
  g.shadowColor = variant === 'selected' ? alpha(spec.color, 0.75) : 'rgba(0,0,0,0.45)'
  g.shadowBlur = variant === 'selected' ? 12 : 8
  g.shadowOffsetY = variant === 'selected' ? 0 : 3
  shape()
  g.fillStyle = lit ? 'rgba(22,30,42,0.98)' : 'rgba(13,18,27,0.95)'
  g.fill()
  g.restore()
  shape()
  const tint = g.createLinearGradient(x, 0, x + w, 0)
  tint.addColorStop(0, alpha(spec.color, lit ? 0.3 : 0.18))
  tint.addColorStop(0.55, alpha(spec.color, 0.06))
  tint.addColorStop(1, alpha(spec.color, 0))
  g.fillStyle = tint
  g.fill()
  shape()
  g.lineWidth = 1
  g.strokeStyle = alpha(spec.color, lit ? 0.95 : spec.emphasis ? 0.6 : 0.4)
  g.stroke()
  g.fillStyle = spec.color
  g.fillRect(x, y, 3, h)
  g.save()
  g.shadowColor = spec.color
  g.shadowBlur = 6
  g.beginPath()
  g.moveTo(x + w - CHAMFER - 1, y)
  g.lineTo(x + w, y + CHAMFER + 1)
  g.lineWidth = 2
  g.strokeStyle = mix(spec.color, '#ffffff', 0.4)
  g.stroke()
  g.restore()
}

/** 图标胶囊：深色胶囊，类别色细描边 */
function drawPill(g: CanvasRenderingContext2D, spec: LabelSpec, L: LabelLayout, x: number, y: number, lit: boolean, variant: string) {
  g.save()
  g.shadowColor = variant === 'selected' ? alpha(spec.color, 0.75) : 'rgba(0,0,0,0.45)'
  g.shadowBlur = variant === 'selected' ? 12 : 8
  g.shadowOffsetY = variant === 'selected' ? 0 : 3
  roundRect(g, x, y, L.boxW, L.boxH, L.boxH / 2)
  g.fillStyle = lit ? 'rgba(22,30,42,0.98)' : 'rgba(13,18,27,0.94)'
  g.fill()
  g.restore()
  if (variant === 'selected') {
    roundRect(g, x, y, L.boxW, L.boxH, L.boxH / 2)
    g.fillStyle = alpha(spec.color, 0.16)
    g.fill()
  }
  roundRect(g, x + 0.5, y + 0.5, L.boxW - 1, L.boxH - 1, (L.boxH - 1) / 2)
  g.lineWidth = 1
  g.strokeStyle = alpha(spec.color, lit ? 0.95 : spec.emphasis ? 0.6 : 0.38)
  g.stroke()
}

/** 胶囊左侧的圆形图标：类别色淡底、类别色细圈、类别色图形（不用实心亮色圆，场景里点多时不刺眼） */
function drawIcon(g: CanvasRenderingContext2D, spec: LabelSpec, cx: number, cy: number, size: number) {
  const r = size / 2
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.fillStyle = alpha(spec.color, 0.18)
  g.fill()
  g.beginPath()
  g.arc(cx, cy, r - 0.75, 0, Math.PI * 2)
  g.lineWidth = 1.2
  g.strokeStyle = alpha(spec.color, 0.75)
  g.stroke()
  const glyph = mix(spec.color, '#ffffff', 0.3)
  const icon = spec.icon && spec.icon !== 'dot' ? ICONS[spec.icon] : null
  if (!icon || typeof Path2D === 'undefined') {
    g.beginPath()
    g.arc(cx, cy, r * 0.3, 0, Math.PI * 2)
    g.fillStyle = glyph
    g.fill()
    return
  }
  // 24×24 网格的图形缩放到圆里约六成大小
  const k = (size * 0.62) / 24
  g.save()
  g.translate(cx - 12 * k, cy - 12 * k)
  g.scale(k, k)
  const path = new Path2D(icon.d)
  if (icon.mode === 'fill') {
    g.fillStyle = glyph
    // 奇偶规则：车窗、镜头这类内部子路径镂空
    g.fill(path, 'evenodd')
  } else {
    g.lineWidth = 2.2
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.strokeStyle = glyph
    g.stroke(path)
  }
  g.restore()
}
