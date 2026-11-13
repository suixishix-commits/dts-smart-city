/**
 * 视口等比缩放工具（照搬 usecase 的适配方案）。
 *
 * - 样式里的 px 由 postcss-pxtorem 转成 rem，根字号由 index.html 的脚本按视口宽度设置（1920 下 1rem = 10px）。
 * - postcss 碰不到的 JS 数值（ECharts option 的字号/间距/symbolSize/圆角、canvas 文字、内联 style 的 px 等）
 *   统一走 scalePx(设计px)，和根字号同一个倍数，图表和页面缩放一致。
 * - 组件 prop 里写死的 px 字符串（如弹窗 width: '800px'）用 designPxToRem 转成 rem，跟随根字号缩放。
 */

const FALLBACK_WIDTH = 1920
/** 与 postcss-pxtorem 的 rootValue、index.html 里的基准字号保持一致 */
const ROOT_VALUE = 10

/**
 * 当前缩放倍数：跟根字号走（index.html 的适配脚本按视口宽度设置，1920 下 10px），
 * 所以图表和页面在每个分辨率上缩放一致——2K~4K 之间根字号固定 1.25 倍，图表也是 1.25 倍。
 * 拿不到根字号时退回按视口宽度算。
 */
export function getReViewportScale(): number {
  if (typeof window === 'undefined') return 1
  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize)
  if (rootFontSize > 0) return rootFontSize / ROOT_VALUE
  const width = window.innerWidth || document.documentElement?.clientWidth || FALLBACK_WIDTH
  return width / FALLBACK_WIDTH
}

/** 1920 设计 px → 当前视口 px（图表 grid、字号等） */
export function scalePx(px: number): number {
  return Math.round(px * getReViewportScale())
}

/** '800px' / 800 → '80rem'；其它单位（%、vw、vh、rem、calc…）原样返回 */
export function designPxToRem(value: string | number): string {
  if (typeof value === 'number') return `${value / ROOT_VALUE}rem`
  const match = /^\s*(-?\d+(?:\.\d+)?)px\s*$/.exec(value)
  return match ? `${Number(match[1]) / ROOT_VALUE}rem` : value
}

/** ECharts option 里按像素算的尺寸字段：窗口缩放时按倍数重算 */
const SIZE_KEYS = new Set([
  'fontSize',
  'lineHeight',
  'barWidth',
  'barMaxWidth',
  'symbolSize',
  'itemWidth',
  'itemHeight',
  'itemGap',
  'borderRadius',
  'barBorderRadius',
  'borderWidth',
  'shadowBlur',
  'width',
  'padding',
  'margin',
  'distance'
])

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype

const scaleSize = (value: unknown, ratio: number): unknown => {
  if (typeof value === 'number') return Math.round(value * ratio * 10) / 10
  if (Array.isArray(value) && value.every((v) => typeof v === 'number')) return value.map((v) => scaleSize(v, ratio))
  return undefined
}

/**
 * 只含尺寸字段的稀疏补丁：数组按下标对齐（不相关的项给 {}，ECharts 按下标合并时不动它），
 * 数据、渐变对象、函数都不碰，所以合并进去不会重置数据和 dataZoom 的位置。
 */
function sizePatch(value: unknown, ratio: number): unknown {
  if (Array.isArray(value)) {
    const items = value.map((item) => sizePatch(item, ratio))
    return items.some((item) => item !== undefined) ? items.map((item) => item ?? {}) : undefined
  }
  if (!isPlainObject(value)) return undefined
  const patch: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    const scaled = SIZE_KEYS.has(key) ? scaleSize(child, ratio) : sizePatch(child, ratio)
    if (scaled !== undefined) patch[key] = scaled
  }
  return Object.keys(patch).length ? patch : undefined
}

/** grid 等容器上按像素算的定位字段 */
const BOX_KEYS = new Set(['left', 'right', 'top', 'bottom'])

/**
 * 按设计稿 px 写的 ECharts option → 当前视口的 option：复制一份，把尺寸字段乘上缩放倍数。
 * 函数（formatter）、数据原样保留。组件里统一用设计 px 写 option，交给它换算。
 */
export function scaleOptionSizes<T>(option: T, ratio = getReViewportScale(), inGrid = false): T {
  if (Array.isArray(option)) return option.map(item => scaleOptionSizes(item, ratio, inGrid)) as unknown as T
  if (!isPlainObject(option)) return option
  const out: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(option)) {
    if (key === 'data') out[key] = child
    else if (SIZE_KEYS.has(key) || (inGrid && BOX_KEYS.has(key))) out[key] = scaleSize(child, ratio) ?? scaleOptionSizes(child, ratio)
    else out[key] = scaleOptionSizes(child, ratio, key === 'grid')
  }
  return out as T
}

interface ScalableChart {
  setOption: (option: any, notMerge?: boolean) => void
  resize: () => void
  isDisposed: () => boolean
}

const bindings = new WeakMap<ScalableChart, () => void>()

/**
 * setOption 并跟随窗口缩放：记住这次的 option（尺寸是按当时的倍数算的），窗口变化后把尺寸字段
 * 按 新倍数/当时倍数 重算再合并进去，然后 resize。同一个图表再调用会替换掉上一次的绑定，
 * 图表 dispose 后监听自动解除。
 */
export function setScaledOption(chart: ScalableChart, option: object, notMerge?: boolean): void {
  chart.setOption(option, notMerge)
  bindings.get(chart)?.()
  const builtScale = getReViewportScale()
  const onResize = () => {
    if (chart.isDisposed()) {
      unbind()
      return
    }
    const patch = sizePatch(option, getReViewportScale() / builtScale)
    if (patch) chart.setOption(patch)
    chart.resize()
  }
  const unbind = () => {
    window.removeEventListener('resize', onResize)
    bindings.delete(chart)
  }
  window.addEventListener('resize', onResize)
  bindings.set(chart, unbind)
}
