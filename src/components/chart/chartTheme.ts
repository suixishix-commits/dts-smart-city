/**
 * 图表统一视觉：各面板只写数据和基本样式，这里补上大屏的质感——
 * 坐标轴数字用数字字体；折线加发光、实线系列自动配渐变面积；柱子用渐变填充、圆角和微光；
 * 首次出现时有绘制动画。各图表自己写了的字段优先，这里只补没写的。
 */

/** 图表里的数字字体（canvas 绘制，必须写明字体名，不能用 inherit） */
export const NUM_FONT = "'Barlow Semi Condensed', Inter, 'Microsoft YaHei', sans-serif"
/** 图表里的中文文字字体 */
export const TEXT_FONT = "Inter, 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif"

/** ECharts 的 option 片段：结构由各图表自己定，这里只按字段名读写 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ECharts option 是任意嵌套的配置对象
type Obj = Record<string, any>

/** '#rrggbb' → rgba() */
export function fade(hex: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`
}

/** 竖直渐变（ECharts 的 linear 渐变对象） */
export function vGradient(top: string, bottom: string): Obj {
  return { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: top }, { offset: 1, color: bottom }] }
}
/** 水平渐变 */
export function hGradient(left: string, right: string): Obj {
  return { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: left }, { offset: 1, color: right }] }
}

function axisFont(axis: unknown): unknown {
  if (!axis) return axis
  const list = Array.isArray(axis) ? axis : [axis]
  const out = list.map((a: Obj) => ({ ...a, axisLabel: { fontFamily: NUM_FONT, ...(a.axisLabel ?? {}) } }))
  return Array.isArray(axis) ? out : out[0]
}

function seriesColor(s: Obj): string | undefined {
  const c = s.lineStyle?.color ?? s.itemStyle?.color ?? s.color
  return typeof c === 'string' ? c : undefined
}

/** 灰色、静默的参考线（昨日、上周同期）：保持细线，不加发光和面积 */
function isReference(s: Obj, color: string | undefined): boolean {
  return !!s.silent || !color || /^#(5f6b7a|9aa4b2|6b7685)$/i.test(color)
}

function enhanceSeries(s: Obj, horizontalBar: boolean, primary: boolean): Obj {
  const color = seriesColor(s)
  if (s.type === 'line') {
    const dashed = s.lineStyle?.type === 'dashed' || s.lineStyle?.type === 'dotted'
    const out: Obj = { smooth: 0.35, ...s }
    if (color && !dashed && !isReference(s, color)) {
      out.lineStyle = { shadowColor: fade(color, 0.6), shadowBlur: 10, shadowOffsetY: 4, ...(s.lineStyle ?? {}) }
      // 主数据（第一条实线）没写面积时补一层从线色渐隐到透明的面积
      if (primary && !s.areaStyle) out.areaStyle = { color: vGradient(fade(color, 0.28), fade(color, 0)) }
    }
    return out
  }
  if (s.type === 'bar' && color && typeof s.itemStyle?.color !== 'object') {
    const radius = horizontalBar ? [0, 3, 3, 0] : [3, 3, 0, 0]
    return {
      barMaxWidth: 14,
      ...s,
      itemStyle: {
        borderRadius: radius,
        shadowColor: fade(color, 0.45),
        shadowBlur: 8,
        ...(s.itemStyle ?? {}),
        color: horizontalBar ? hGradient(fade(color, 0.35), color) : vGradient(color, fade(color, 0.25))
      }
    }
  }
  return s
}

/** 补上统一视觉 */
export function enhanceOption<T extends Obj>(option: T): T {
  const yIsCategory = (Array.isArray(option.yAxis) ? option.yAxis[0] : option.yAxis)?.type === 'category'
  const list: Obj[] = Array.isArray(option.series) ? option.series : []
  const primaryIndex = list.findIndex(s => s.type === 'line' && s.lineStyle?.type !== 'dashed' && !isReference(s, seriesColor(s)))
  // 每个系列补稳定的 id：数据更新时 ECharts 按 id 认出是同一条，平滑过渡，而不是删掉重画
  const series = Array.isArray(option.series) ? list.map((s, i) => ({ id: 's' + i, ...enhanceSeries(s, yIsCategory, i === primaryIndex) })) : option.series
  return {
    animationDuration: 900,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 500,
    ...option,
    // 时间轴拖动时数据频繁更新：保留更新过渡，但首次绘制动画只播一次（由 LineChart 控制 notMerge）
    xAxis: axisFont(option.xAxis),
    yAxis: axisFont(option.yAxis),
    series
  }
}
