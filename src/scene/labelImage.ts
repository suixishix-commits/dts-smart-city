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

export interface LabelSpec {
  text: string
  /** 类别色：圆点 / 小标签底色 / 引线 / 落点 */
  color: string
  /** 左侧彩色小标签（等级、类型、名次）；没有时画圆点 */
  tag?: string
  /** 名称后面加粗显示的数值 */
  value?: string
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
/** 落点外圈半径 */
const HALO_R = 7
/** 名称最长宽度，超出截断成「…」 */
const MAX_TEXT = 240
const FONT = "'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif"
const NUM_FONT = "Inter, 'Segoe UI', " + FONT
const INK = '#10151c'

export interface LabelLayout {
  /** 胶囊高 */
  pillH: number
  /** 胶囊宽 */
  pillW: number
  /** 左内边距（到圆点或小标签） */
  padL: number
  /** 圆点直径 */
  dot: number
  /** 小标签宽高（没有小标签时宽为 0） */
  tagW: number
  tagH: number
  /** 名称起点 x（相对胶囊左边） */
  textX: number
  /** 数值起点 x（相对胶囊左边） */
  valueX: number
  /** 整张图宽高 */
  width: number
  height: number
  /** 落点中心 y */
  groundY: number
}

/**
 * 标签排版（纯计算，便于测试）：各段宽度由调用方量好传进来。
 * 胶囊高 = 字号 × 2 + 2（13 号字 28 高，同设计稿），左边是圆点或小标签，名称后面跟数值。
 */
export function labelLayout(o: { fontSize: number; textW: number; tagTextW?: number; valueW?: number; lead: number }): LabelLayout {
  const pillH = o.fontSize * 2 + 2
  const compact = o.fontSize <= 12
  const hasTag = o.tagTextW !== undefined
  const dot = compact ? 6 : 8
  const tagH = pillH - 10
  const tagW = hasTag ? Math.ceil((o.tagTextW as number) + 12) : 0
  const padL = hasTag ? 5 : compact ? 8 : 10
  const textX = padL + (hasTag ? tagW + 7 : dot + 6)
  const valueX = textX + o.textW + 8
  const end = o.valueW !== undefined ? valueX + o.valueW : textX + o.textW
  const pillW = Math.ceil(end + (compact ? 9 : 12))
  const width = Math.max(pillW, HALO_R * 2) + MARGIN * 2
  const groundY = MARGIN + pillH + o.lead
  return { pillH, pillW, padL, dot, tagW, tagH, textX, valueX, width, height: groundY + HALO_R + 2, groundY }
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
  return JSON.stringify([spec.text, spec.color, spec.tag, spec.value, spec.lead, spec.fontSize ?? 13, !!spec.emphasis, spec.variant ?? 'normal', scale])
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
  const left = cx - L.pillW / 2
  const top = MARGIN
  const midY = top + L.pillH / 2

  // 引线：从胶囊底边到落点，上淡下浓
  if (spec.lead > 0) {
    const line = g.createLinearGradient(0, top + L.pillH, 0, L.groundY)
    line.addColorStop(0, alpha(spec.color, 0.35))
    line.addColorStop(1, alpha(spec.color, 0.95))
    g.fillStyle = line
    g.fillRect(cx - 0.75, top + L.pillH, 1.5, spec.lead)
  }
  // 落点：浅色外圈 + 实心点（深色描边把点和底图分开）；选中时外圈更亮
  g.beginPath()
  g.arc(cx, L.groundY, HALO_R, 0, Math.PI * 2)
  g.fillStyle = alpha(spec.color, variant === 'selected' ? 0.45 : 0.22)
  g.fill()
  g.beginPath()
  g.arc(cx, L.groundY, 3.5, 0, Math.PI * 2)
  g.fillStyle = spec.color
  g.fill()
  g.lineWidth = 1.5
  g.strokeStyle = INK
  g.stroke()

  // 胶囊：投影（选中时是类别色外发光）+ 深色底 + 1px 描边
  g.save()
  g.shadowColor = variant === 'selected' ? alpha(spec.color, 0.7) : 'rgba(0,0,0,0.35)'
  g.shadowBlur = variant === 'selected' ? 10 : 6
  g.shadowOffsetY = variant === 'selected' ? 0 : 2
  roundRect(g, left, top, L.pillW, L.pillH, L.pillH / 2)
  g.fillStyle = variant === 'normal' ? 'rgba(17,22,30,0.94)' : 'rgba(26,34,46,0.97)'
  g.fill()
  g.restore()
  if (variant === 'selected') {
    roundRect(g, left, top, L.pillW, L.pillH, L.pillH / 2)
    g.fillStyle = alpha(spec.color, 0.18)
    g.fill()
  }
  roundRect(g, left + 0.5, top + 0.5, L.pillW - 1, L.pillH - 1, (L.pillH - 1) / 2)
  g.lineWidth = variant === 'selected' ? 1.5 : 1
  g.strokeStyle = variant === 'normal' ? (spec.emphasis ? alpha(spec.color, 0.65) : 'rgba(255,255,255,0.16)') : alpha(spec.color, variant === 'selected' ? 1 : 0.9)
  g.stroke()

  g.textBaseline = 'middle'
  // 左侧：小标签（类别色底、深色字）或圆点
  if (spec.tag !== undefined) {
    roundRect(g, left + L.padL, midY - L.tagH / 2, L.tagW, L.tagH, L.tagH / 2)
    g.fillStyle = spec.color
    g.fill()
    g.font = tagFont
    g.fillStyle = INK
    g.textAlign = 'center'
    g.fillText(spec.tag, left + L.padL + L.tagW / 2, midY + 0.5)
  } else {
    g.beginPath()
    g.arc(left + L.padL + L.dot / 2, midY, L.dot / 2, 0, Math.PI * 2)
    g.fillStyle = spec.color
    g.fill()
  }
  g.textAlign = 'left'
  g.font = textFont
  g.fillStyle = variant === 'normal' ? '#e6eaf0' : '#ffffff'
  g.fillText(text, left + L.textX, midY + 0.5)
  if (spec.value !== undefined) {
    g.font = valueFont
    g.fillStyle = '#ffffff'
    g.fillText(spec.value, left + L.valueX, midY + 0.5)
  }

  const out: LabelImage = {
    url: canvas.toDataURL('image/png'),
    size: [Math.round(L.width * scale), Math.round(L.height * scale)],
    anchor: [-(L.width / 2) * scale, L.groundY * scale]
  }
  cache.set(key, out)
  return out
}
