import { scalePx } from '@/utils/viewportScale'
import { PALETTE, STACKED_GRADIENTS, barGradient, legendBottom, legendTop } from './chartStyles'

/**
 * Adjustments an AI chart's option can only get **after** the endpoint's real data has been merged into its style template
 * (called by chartTemplates' buildChartOption; split out of chartTemplates so the template library stays a pure catalogue of styles).
 *
 * A template carries placeholder data, so anything that depends on how much data actually arrived — how many line points, how many
 * bar categories, what the pie segments add up to — cannot live there and is applied here instead.
 *
 * Size adaptation: the same rule as the templates — inline px in an option are JS numbers postcss-pxtorem cannot reach, so they go
 * through scalePx(designPx) at call time, and the rendering components re-run the whole build on resize to pick up the new scale.
 */

/** White-edged dots are shown only when a line has at most this many points (matching the design); beyond that they are hidden automatically so dense dots do not smear together. */
const LINE_SYMBOL_MAX = 12

/** Maximum characters for a circular chart's legend name: longer names are truncated with … (the legend is only an identifier; the full name is in the hover tooltip). */
const LEGEND_NAME_MAX = 12

/** Integer formatting with thousands separators (used by circular chart legend values); non-integers are left as-is. */
const formatLegendNum = (v: number): string =>
  Number.isInteger(v) ? v.toLocaleString('en-US') : String(v)

type PieDatum = { name?: string; value?: number }

const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

/** Bar-family category charts get horizontal scrolling once they exceed this many categories (below it every bar still fits, so nothing changes). */
const CAT_SCROLL_MIN = 7
/** How many categories the scroll window shows at once: the bars keep their design width instead of being squeezed thinner as categories pile up. */
const CAT_WINDOW = 7
/** The scrollbar's design height and its gap to the plotting area (px, scaled at call time). */
const SLIDER_H = 10
const SLIDER_GAP = 6

/**
 * Bar charts with many categories (e.g. 25 facility types): pin the window to CAT_WINDOW categories and let the rest be
 * reached by dragging the bottom scrollbar, instead of cramming every bar and label into the card's width.
 * - zoomLock keeps the window size fixed, so the scrollbar only pans and the bars never change width;
 * - the slider is the **only** dataZoom here. An `inside` dataZoom is deliberately not used: its RoamController runs a hit test on
 *   every mousemove and, while dragging, calls eventTool.stop() on each move and re-renders the whole chart per event. On this page
 *   (cloud-rendered video stream + map on the same main thread) that high-frequency re-render froze the UI, and the scrollbar covers the same need;
 * - animationDurationUpdate:0 keeps a drag from stacking easing animations — a scrollbar should track the pointer immediately (the 400ms entrance animation is untouched);
 * - the scrollbar sits at the original grid bottom edge (above stackedBar's bottom legend) and the grid is lifted by its height;
 * - the category labels tilt 30° so the visible ones stay legible in a narrow card (hideOverlap still drops any that would collide).
 */
const applyCategoryScroll = (option: Record<string, unknown>, series: unknown[]): void => {
  const hasBar = series.some((s) => isObj(s) && (s.type === 'bar' || s.type === 'pictorialBar'))
  // Respect a dataZoom supplied by the endpoint fragment rather than overriding it
  if (!hasBar || option.dataZoom) return
  const xAxis = Array.isArray(option.xAxis) ? option.xAxis[0] : option.xAxis
  if (!isObj(xAxis) || !Array.isArray(xAxis.data) || xAxis.data.length <= CAT_SCROLL_MIN) return

  const sliderH = scalePx(SLIDER_H)
  const grid: Record<string, unknown> = isObj(option.grid) ? option.grid : {}
  option.grid = grid
  const gridBottom = typeof grid.bottom === 'number' ? grid.bottom : scalePx(8)
  grid.bottom = gridBottom + sliderH + scalePx(SLIDER_GAP)

  if (isObj(xAxis.axisLabel)) xAxis.axisLabel.rotate = 30
  option.animationDurationUpdate = 0

  option.dataZoom = [
    {
      type: 'slider',
      xAxisIndex: 0,
      startValue: 0,
      endValue: CAT_WINDOW - 1,
      zoomLock: true,
      bottom: gridBottom,
      height: sliderH,
      borderColor: 'transparent',
      backgroundColor: 'rgba(255,255,255,0.06)',
      fillerColor: 'rgba(109,181,236,0.35)',
      // With the window locked the resize handles only pan, so they are hidden and the filler alone reads as a scrollbar thumb
      handleStyle: { opacity: 0 },
      showDetail: false,
      // No data shadow: it would draw a second copy of the whole series inside the scrollbar on every update
      showDataShadow: false,
      // brushSelect:false makes the filler itself the drag zone (SliderZoomView: actualMoveZone = filler), so dragging the thumb pans instead of brush-zooming
      brushSelect: false,
    },
  ]
}

/** Gap between the bars of one category in a grouped bar chart (ECharts barGap, relative to the bar width). */
const GROUP_BAR_GAP = '50%'
/** The design height kept under the plotting area for the bottom legend (px, scaled at call time). */
const LEGEND_BOTTOM_H = 24

/**
 * A bar or barLine chart carrying several bar series (e.g. existing vs pipeline per category) is drawn as grouped bars:
 * - each bar series gets its own gradient from STACKED_GRADIENTS (blue, green, khaki…), so the bars of one
 *   category read apart instead of all coming out in the template's blue;
 * - no background track: one track per bar doubles the columns and crowds the group;
 * - a bottom dot legend names the colours, as stackedBar does; the grid is lifted to make room for it.
 */
const applyGroupedBars = (option: Record<string, unknown>, series: unknown[]): void => {
  const bars = series.filter((s): s is Record<string, unknown> => isObj(s) && s.type === 'bar')
  if (bars.length < 2) return
  bars.forEach((s, i) => {
    const [top, bottom] = STACKED_GRADIENTS[i % STACKED_GRADIENTS.length]!
    s.showBackground = false
    s.barGap = GROUP_BAR_GAP
    s.itemStyle = { ...(isObj(s.itemStyle) ? s.itemStyle : {}), color: barGradient(top, bottom) }
  })
  const grid: Record<string, unknown> = isObj(option.grid) ? option.grid : {}
  option.grid = grid
  const gridBottom = typeof grid.bottom === 'number' ? grid.bottom : scalePx(8)
  grid.bottom = gridBottom + scalePx(LEGEND_BOTTOM_H)
  option.legend = legendBottom()
}

/**
 * pictorialBar series overlap by default (ECharts' pictorialBar barGap is -100%), so a second series hid
 * behind the first and shared its colour. Several series are set side by side, each in its palette colour.
 */
const applyGroupedPictorial = (series: unknown[]): void => {
  if (series.length < 2) return
  series.forEach((s, i) => {
    if (!isObj(s) || s.type !== 'pictorialBar') return
    s.barGap = GROUP_BAR_GAP
    s.itemStyle = {
      ...(isObj(s.itemStyle) ? s.itemStyle : {}),
      color: PALETTE[i % PALETTE.length],
    }
  })
}

/**
 * stackedBar's template rounds the top of its 4th segment only, so a stack with fewer series ended in a
 * square-topped middle segment. The last series takes the round top instead.
 */
const roundStackTop = (series: unknown[]): void => {
  const last = series[series.length - 1]
  if (series.length < 2 || !isObj(last) || !isObj(last.itemStyle)) return
  const r = scalePx(6)
  last.itemStyle.borderRadius = [r, r, 0, 0]
}

/**
 * Post-merge adjustments based on the real runtime data (unavailable at template time, hence this pass):
 * - line: show white-edged dots when the point count is at most LINE_SYMBOL_MAX (matching the design), otherwise hide them (showSymbol:false) so they do not smear;
 * - bar-family charts: enable horizontal scrolling when there are too many categories (see applyCategoryScroll);
 * - circular charts (pie/donut/halfDoughnut): inject a right-hand legend formatter giving "name + percentage (pie/donut) / value (halfDoughnut)",
 *   computed from the merged real data (pie-family charts have no fixed legend.data, so the name the formatter receives is each segment's name).
 */
export const applyDynamicStyles = (option: Record<string, unknown>, type: string): void => {
  const series = option.series
  if (!Array.isArray(series)) return
  for (const s of series) {
    if (s && typeof s === 'object' && (s as { type?: string }).type === 'line') {
      const data = (s as { data?: unknown[] }).data
      ;(s as { showSymbol?: boolean }).showSymbol =
        !Array.isArray(data) || data.length <= LINE_SYMBOL_MAX
    }
  }
  if (type === 'bar' || type === 'barLine') applyGroupedBars(option, series)
  if (type === 'pictorialBar') applyGroupedPictorial(series)
  if (type === 'stackedBar') roundStackTop(series)
  applyCategoryScroll(option, series)
  // Several series in a template without a legend (e.g. line): add one, or the colours have no names
  // (ECharts' default legend icon is a fixed 25×14 px, so the icon size is scaled here too)
  if (series.length > 1 && !option.legend)
    option.legend = {
      ...legendTop(),
      icon: 'circle',
      itemWidth: scalePx(8),
      itemHeight: scalePx(8),
    }
  if (type !== 'pie' && type !== 'donut' && type !== 'halfDoughnut') return
  const pie = series[0] as { data?: PieDatum[] } | undefined
  const legend = option.legend as Record<string, unknown> | undefined
  if (!pie || !Array.isArray(pie.data) || !legend) return
  const items = pie.data
  const total = items.reduce((sum, d) => sum + (Number(d?.value) || 0), 0)
  legend.formatter = (name: string): string => {
    const item = items.find((d) => d?.name === name)
    if (!item) return name
    const value = Number(item.value) || 0
    const display =
      type === 'halfDoughnut'
        ? formatLegendNum(value)
        : `${total ? Math.round((value / total) * 100) : 0}%`
    const label = name.length > LEGEND_NAME_MAX ? `${name.slice(0, LEGEND_NAME_MAX)}…` : name
    return `{name|${label}}{val|${display}}`
  }
}
