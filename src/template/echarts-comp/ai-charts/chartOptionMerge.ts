import type { EChartsCoreOption } from 'echarts'

/**
 * The deep merge and deep clone mechanism for folding an AI chart data fragment into a style template (called by chartTemplates' buildChartOption).
 * Split out of chartTemplates to focus on the single concern of "how an endpoint's data fragment merges into a type template":
 * - deepMerge: objects merge recursively while arrays are replaced wholesale (endpoint data overrides the template default);
 * - mergeChartOption: the xAxis/yAxis/indicator injection rules plus series merging by index;
 * - deepClone: gives the merge an independent copy of the template, so ECharts' setOption cannot mutate the shared constants.
 */

// ── Deep merge: objects merge recursively while arrays are replaced wholesale (endpoint data overrides the template default) ──
type PlainObject = Record<string, unknown>
const isPlainObject = (v: unknown): v is PlainObject =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const deepMerge = (target: unknown, source: unknown): unknown => {
  if (!isPlainObject(target) || !isPlainObject(source)) return source
  const out: PlainObject = { ...target }
  for (const key of Object.keys(source)) {
    out[key] = key in target ? deepMerge(target[key], source[key]) : source[key]
  }
  return out
}

/**
 * The template series an endpoint series is styled from.
 * - The template entry at the same index, when the types agree (or the endpoint gives no type).
 * - Otherwise the first template entry of the endpoint's type: a series beyond the template's own (a second
 *   bar), or one whose type differs from the entry at its index (a bar at barLine's line slot). Without this
 *   such a series fell back to ECharts defaults (a bar lost barWidth and was drawn as a wide flat block) or
 *   took the wrong type's styling. Only the styling is borrowed: the data, name and fill colour are
 *   dropped, so the palette still tells the series apart.
 */
const seriesBase = (tplSeries: unknown[], i: number, item: unknown): PlainObject => {
  const itemType = isPlainObject(item) ? item.type : undefined
  const sameType = (s: unknown): s is PlainObject =>
    isPlainObject(s) && (itemType === undefined || itemType === s.type)
  const own = tplSeries[i]
  if (sameType(own)) return own
  const donor = tplSeries.find(sameType)
  if (!donor) return {}
  const { data: _data, name: _name, ...base } = donor
  if (isPlainObject(base.itemStyle)) {
    const { color: _color, ...itemStyle } = base.itemStyle
    base.itemStyle = itemStyle
  }
  return base
}

/**
 * Deep-merge an endpoint data fragment into a type template:
 * - a string array for xAxis/yAxis is injected as that axis's data; indicator goes into radar.indicator;
 * - series merge by array index (keeping each template entry's styling while injecting the data, with the inner data/links replaced wholesale);
 * - every other field merges recursively for objects and is replaced wholesale for arrays.
 */
export const mergeChartOption = (
  template: EChartsCoreOption,
  fragment: Record<string, unknown>,
): EChartsCoreOption => {
  const tpl = template as PlainObject
  const norm: PlainObject = { ...fragment }
  // A category axis is injected only when the template has that axis; charts with no coordinate system (pie/radar/funnel/graph/sunburst and so on)
  // discard a mistakenly supplied xAxis/yAxis, so ECharts is never given axes out of nowhere and cannot throw an axisBuilder error.
  if (Array.isArray(norm.xAxis)) {
    if (tpl.xAxis) norm.xAxis = { data: norm.xAxis }
    else delete norm.xAxis
  }
  if (Array.isArray(norm.yAxis)) {
    if (tpl.yAxis) norm.yAxis = { data: norm.yAxis }
    else delete norm.yAxis
  }
  if (norm.indicator) {
    norm.radar = { indicator: norm.indicator }
    delete norm.indicator
  }

  const series = norm.series
  delete norm.series

  const merged = deepMerge(template, norm) as PlainObject

  if (Array.isArray(series)) {
    const tplSeries = Array.isArray(template.series) ? (template.series as unknown[]) : []
    // A template usually gives only series[0]'s styling and type; extra series from the endpoint have no type, so the template's type is filled in
    const tplType =
      isPlainObject(tplSeries[0]) && typeof tplSeries[0].type === 'string'
        ? tplSeries[0].type
        : undefined
    merged.series = series.map((item, i) => {
      const one = deepMerge(seriesBase(tplSeries, i, item), item) as PlainObject
      if (tplType && one.type === undefined) one.type = tplType
      return one
    })
  }

  return merged as EChartsCoreOption
}

/** Deep clone: objects and arrays are copied level by level, while functions (stateless formatters and the like) share their references. */
export const deepClone = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(deepClone)
  if (value && typeof value === 'object') {
    const out: PlainObject = {}
    for (const key of Object.keys(value as PlainObject)) {
      out[key] = deepClone((value as PlainObject)[key])
    }
    return out
  }
  return value
}
