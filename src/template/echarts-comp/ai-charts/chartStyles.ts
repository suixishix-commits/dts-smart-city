import { scalePx } from '@/utils/viewportScale'

/**
 * The AI charts' style vocabulary: dark-theme tokens (palette/typography/dividers) plus reusable ECharts style helper factories
 * (axes / legends / tooltips / line segments / gradients) that chartTemplates assembles into each type's template.
 *
 * Size adaptation: the inline px for font sizes, spacing, symbolSize and radii in an option are JS numbers that postcss-pxtorem cannot reach,
 * so they all pass through scalePx(designPx) to map onto the current viewport. Since scalePx depends on the runtime viewport width, any size-bearing helper must be
 * a factory evaluated at call time rather than a module-level constant (which would be computed once at load); rendering components re-run them on resize to pick up the new scale.
 */

export const FONT = 'Manrope, Arial, sans-serif'
export const TEXT = 'rgba(255, 255, 255, 0.75)'
export const SUBTLE = 'rgba(255, 255, 255, 0.45)'
export const SPLIT = 'rgba(255, 255, 255, 0.1)'
// The palette comes from the Figma "full admin component set" accent group (node 14:19) and serves as the AI charts' shared colour system
export const PRIMARY = '#6db5ec'
export const PALETTE = [PRIMARY, '#79d18d', '#cdcf7f', '#fbbf77', '#8b94ec']

// The shared cartesian grid (used by line/bar/scatter/lines and others): containLabel:true folds the axis labels into the bounds,
// keeping the margins consistent across charts; charts needing special margins (barLine's right axis, heatmap's bottom legend) override it by spread.
export const cartGrid = () => ({
  left: scalePx(8),
  right: scalePx(12),
  top: scalePx(24),
  bottom: scalePx(8),
  containLabel: true,
})
export const legendTop = () => ({
  textStyle: { color: SUBTLE, fontFamily: FONT, fontSize: scalePx(12) },
  top: 0,
  type: 'scroll' as const,
})
/** The horizontal bottom legend for multi-series charts such as stackedBar: a colour dot plus the name. */
export const legendBottom = () => ({
  textStyle: { color: SUBTLE, fontFamily: FONT, fontSize: scalePx(12) },
  bottom: 0,
  icon: 'circle',
  itemWidth: scalePx(8),
  itemHeight: scalePx(8),
  itemGap: scalePx(16),
  type: 'scroll' as const,
})
/**
 * The vertical right-hand legend for circular charts (pie/donut/halfDoughnut), matching Figma 263880:22596 / 23064:
 * a colour dot + the name (dimmed) + the value/percentage (white, bold). buildChartOption injects the formatter from the merged real data.
 */
export const pieLegendRight = () => ({
  orient: 'vertical' as const,
  right: scalePx(8),
  top: 'middle',
  icon: 'circle',
  itemWidth: scalePx(8),
  itemHeight: scalePx(8),
  itemGap: scalePx(14),
  type: 'scroll' as const,
  textStyle: {
    color: SUBTLE,
    fontFamily: FONT,
    fontSize: scalePx(14),
    rich: {
      // Two-column layout (matching Region 263880:22506): a fixed-width left-aligned name and a fixed-width right-aligned value, so the values line up on their right edge.
      // Overly long names are truncated to … in the formatter (the legend is only an identifier; the full name is in the hover tooltip).
      name: {
        color: 'rgba(255,255,255,0.4)',
        fontFamily: FONT,
        fontSize: scalePx(14),
        width: scalePx(96),
        align: 'left',
      },
      val: {
        color: '#ffffff',
        fontFamily: FONT,
        fontSize: scalePx(14),
        fontWeight: 600,
        width: scalePx(52),
        align: 'right',
      },
    },
  },
})

export const darkCat = (data: (string | number)[]) => ({
  type: 'category' as const,
  data,
  axisLabel: { color: SUBTLE, fontSize: scalePx(10), fontFamily: FONT },
  axisLine: { lineStyle: { color: SPLIT } },
  axisTick: { show: false },
})

export const darkVal = (extra: Record<string, unknown> = {}) => ({
  type: 'value' as const,
  axisLabel: { color: SUBTLE, fontSize: scalePx(10), fontFamily: FONT },
  splitLine: { lineStyle: { color: SPLIT, type: 'dashed' as const } },
  axisLine: { show: false },
  ...extra,
})

/** A number as the tooltip prints it: at most two decimals (`74.45201501290171` → `74.45`); integers and strings pass through. */
const fmtTipNumber = (v: number | string): string =>
  typeof v === 'number' && !Number.isInteger(v) ? String(Math.round(v * 100) / 100) : String(v)

/** Tooltip row value formatting: arrays (such as a scatter point's [x,y]) are joined with commas, numbers are rounded to two decimals. */
const fmtTipValue = (v: number | number[] | string | undefined): string =>
  Array.isArray(v) ? v.map(fmtTipNumber).join(', ') : v == null ? '' : fmtTipNumber(v)

/** The shared tooltip row: a colour dot + the name (left) …… the value (right, bold), matching RealEstate's chartTooltipRows (with inline px through scalePx). */
const tooltipRow = (color: string, label: string, value: string): string =>
  `<div style="display:flex;align-items:center;justify-content:space-between;gap:${scalePx(24)}px;line-height:1;padding:${scalePx(4)}px 0;">` +
  `<span style="display:flex;align-items:center;gap:${scalePx(12)}px;font-size:${scalePx(14)}px;color:rgba(255,255,255,0.7);">` +
  `<span style="display:inline-block;width:${scalePx(7)}px;height:${scalePx(7)}px;border-radius:50%;background:${color};"></span>${label}</span>` +
  `<span style="font-size:${scalePx(16)}px;font-weight:600;color:#ffffff;">${value}</span></div>`

type TooltipFmtParam = {
  color?: string | { colorStops?: { color: string }[] }
  seriesName?: string
  name?: string
  value?: number | number[] | string
}

/** The tooltip dot's colour: a gradient fill (the bars) is an object CSS cannot take, so its last stop stands in. */
const tipDotColor = (color: TooltipFmtParam['color']): string => {
  if (typeof color === 'string') return color
  const stops = color?.colorStops
  return stops?.[stops.length - 1]?.color ?? '#ffffff'
}

/**
 * The AI module's shared tooltip (used by every chart). It matches RealEstate's business charts (chartTooltipBox + chartTooltipRows):
 * a vertically graded glass background + a 5px blur + 12px corners, with rows of "colour dot + name …… value"; axis triggers add a vertical dashed line.
 * Inline pixels do not go through the CSS rem pipeline, so they all pass through scalePx; the formatter runs on every hover and therefore scales to the current viewport automatically.
 */
export const darkTooltip = (trigger: 'axis' | 'item' = 'item'): Record<string, unknown> => ({
  trigger,
  confine: true,
  backgroundColor: 'transparent',
  borderWidth: 0,
  padding: 0,
  textStyle: { color: '#ffffff', fontFamily: FONT, fontSize: scalePx(12) },
  extraCssText:
    // The glass panel matches Figma's "Region" 263880:22506: a translucent BG/300 #35435aee + a 20px backdrop blur + a 1px white stroke #ffffff1a
    'background:#35435aee;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:none;' +
    `border:1px solid #ffffff1a;border-radius:${scalePx(12)}px;padding:${scalePx(8)}px ${scalePx(16)}px;`,
  ...(trigger === 'axis'
    ? {
        axisPointer: {
          type: 'line',
          lineStyle: { color: 'rgba(255,255,255,0.3)', type: 'dashed' },
        },
      }
    : {}),
  formatter: (params: TooltipFmtParam | TooltipFmtParam[]): string => {
    const arr = Array.isArray(params) ? params : [params]
    const rows = arr
      .map((p) =>
        tooltipRow(
          tipDotColor(p.color),
          (trigger === 'axis' ? p.seriesName || p.name : p.name || p.seriesName) ?? '',
          fmtTipValue(p.value),
        ),
      )
      .join('')
    return `<div style="display:flex;flex-direction:column;gap:${scalePx(12)}px;">${rows}</div>`
  },
})

// ── RealEstate business-chart styling (consistent with Sale / Rent / Supply), reused by bar / stackedBar / stackedLine /
//    barLine / donut / halfDoughnut ───────────────────────────────────────
/** The blue bar gradient (accent; used by single bars, the top segment of a stack, and combination bars). */
export const BLUE_GRAD = {
  type: 'linear' as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: '#a5d2eb' },
    { offset: 1, color: '#4786c9' },
  ],
}
/** The area chart's vertical gradient fill (accent; semi-transparent at the top fading to almost clear at the bottom). */
export const BLUE_AREA = {
  type: 'linear' as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: 'rgba(109,181,236,0.45)' },
    { offset: 1, color: 'rgba(109,181,236,0.02)' },
  ],
}
/** The gap colour between ring/half-ring segments = the panel background (matching SaleChartPropertyType, producing hairline gaps with rounded ends). */
export const PANEL_BG = 'rgb(33,43,59)'
/** donut's single-hue blue scale (matching Figma 263880:22596; dark→light = largest→smallest share). */
export const BLUE_RAMP = ['#497fab', '#5b9fd6', '#7cb2de', '#9dc5e6', '#adcfeb']
/** The bars' light background track colour (matching RealEstate's ReStackedBars). */
export const BAR_TRACK = 'rgba(255,255,255,0.08)'
/** A vertical (top→bottom) linear gradient, used to fill each stacked-bar segment. */
export const barGradient = (top: string, bottom: string) => ({
  type: 'linear' as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: top },
    { offset: 1, color: bottom },
  ],
})
/** Per-segment stacked-bar gradients (light→dark), ordered to match PALETTE; taken from the Rent / Sale business charts. A fixed-length tuple, so indexing yields a definite type. */
export const STACKED_GRADIENTS = [
  ['#a5d2eb', '#4786c9'], // Blue
  ['#a9e3b8', '#79d18d'], // Green
  ['#e3e3cc', '#cdcf7f'], // Khaki
  ['#fdd9ad', '#fbbf77'], // Orange
  ['#c2c7f4', '#8b94ec'], // Violet
] as const
/**
 * A single stacked-bar segment (matching Rent's "Total Rent Value by Year" / ReStackedBars):
 * a vertical gradient fill + rounded corners only at the whole bar's outer ends (round base on the bottom segment, round top on the top one, square in between) + a 2px transparent stroke all round,
 * so the background track shows through between segments as a gap and the sides inset to reveal it too.
 */
export const stackedSeg = (
  gradient: readonly [string, string],
  pos: 'bottom' | 'middle' | 'top',
) => {
  const r = scalePx(6)
  const radius: [number, number, number, number] =
    pos === 'top' ? [r, r, 0, 0] : pos === 'bottom' ? [0, 0, r, r] : [0, 0, 0, 0]
  return {
    color: barGradient(gradient[0], gradient[1]),
    borderRadius: radius,
    borderColor: 'transparent',
    borderWidth: scalePx(2),
  }
}
/** RealEstate axis label styling (font size through scalePx, matching SupplyLineChart). */
const reAxisLabel = () => ({
  color: 'rgba(255,255,255,0.5)',
  fontSize: scalePx(12),
  fontFamily: FONT,
})
/** Maximum characters for a category label: longer ones (such as English building names) are truncated with an ellipsis, with the full name in the hover tooltip. */
const CAT_LABEL_MAX = 10
export const reCatAxis = (data: (string | number)[], extra: Record<string, unknown> = {}) => ({
  type: 'category' as const,
  data,
  axisLabel: {
    ...reAxisLabel(),
    // interval:0 makes every label a candidate and hideOverlap then hides those that collide: a few short labels (years) all show,
    // while many long category names (building names, say) space themselves out instead of smearing together
    interval: 0,
    hideOverlap: true,
    formatter: (v: string | number) =>
      typeof v === 'string' && v.length > CAT_LABEL_MAX ? `${v.slice(0, CAT_LABEL_MAX)}…` : `${v}`,
  },
  axisLine: { show: false },
  axisTick: { show: false },
  ...extra,
})
export const reValAxis = (extra: Record<string, unknown> = {}) => ({
  type: 'value' as const,
  axisLabel: { ...reAxisLabel() },
  splitLine: {
    show: true,
    // The 1px hairline divider stays in pixels and is not scaled (matching SupplyLineChart's splitLine)
    lineStyle: { color: 'rgba(255,255,255,0.1)', width: 1, type: 'dashed' as const },
  },
  axisLine: { show: false },
  axisTick: { show: false },
  ...extra,
})
/** Supply & Demand style line segments (white-edged dots + a 2px line, sizes through scalePx); reused by stacked and combination lines, with stack enabled per template as needed. */
export const reLine = (data: number[], extra: Record<string, unknown> = {}) => ({
  type: 'line' as const,
  smooth: false,
  symbol: 'circle' as const,
  symbolSize: scalePx(6),
  data,
  lineStyle: { width: scalePx(2) },
  itemStyle: { borderColor: '#ffffff', borderWidth: scalePx(1) },
  ...extra,
})
