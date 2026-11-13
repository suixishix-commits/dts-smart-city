import type { EChartsCoreOption } from 'echarts'
import type { AiAssistantChart } from './types'
import { mergeChartOption, deepClone } from './chartOptionMerge'
import { applyDynamicStyles } from './chartDynamicStyles'
import { scalePx } from '@/utils/viewportScale'
import {
  PALETTE,
  PRIMARY,
  FONT,
  TEXT,
  SUBTLE,
  SPLIT,
  cartGrid,
  legendTop,
  legendBottom,
  pieLegendRight,
  darkCat,
  darkVal,
  darkTooltip,
  BLUE_GRAD,
  BLUE_AREA,
  PANEL_BG,
  BLUE_RAMP,
  BAR_TRACK,
  STACKED_GRADIENTS,
  stackedSeg,
  reCatAxis,
  reValAxis,
  reLine,
} from './chartStyles'

/**
 * Single source for the AI charts' style template library + deep data merge (shared by the AI assistant and the chartsView preview page).
 *
 * Design: one **style template** per built-in ECharts type (dark theme, fixed palette/axes/tooltip, with placeholder default data).
 * The tokens and style helpers the templates reuse live in ./chartStyles, and the adjustments that can only be made once the
 * real data has been merged in (category scrolling, legend formatters) live in ./chartDynamicStyles.
 * The endpoint only sends a data fragment `{ type, ...data }` (see docs/ai/chart-data-contract.md),
 * and buildChartOption takes the matching template and deep-merges the fragment into it before rendering:
 * - ordinary fields: objects merge recursively, **arrays are replaced wholesale** (endpoint data overrides the template default);
 * - `series`: merged by array index (keeping each template series' styling while injecting the endpoint's data);
 * - a string array for `xAxis`/`yAxis` is injected as that axis's data; `indicator` is injected into radar.indicator.
 * Unsupported types return null (the frontend renders nothing).
 *
 * Size adaptation: font sizes, spacing, symbolSize, corner radii and inline tooltip px in an ECharts option are all JS numbers that postcss-pxtorem
 * cannot reach. They all go through scalePx(designPx) to map onto the current viewport, exactly as the RealEstate business charts do (SupplyLineChart / chartTooltip).
 * Because scalePx depends on the runtime viewport width, the templates and any size-bearing helper must be factories evaluated at call time,
 * not module-level constants (which would be computed once at load); rendering components must re-run buildChartOption on resize to recompute.
 */

// nestedPie, a double-ring pie (styled to match Figma 263880:22657 "Dimension Score"), with three generic placeholder dimensions.
// ratio = the inner ring sector's share; the outer ring is split into equal short segments by that share (separated by panel-coloured hairlines) to read as a segmented tick arc.
// color: the bright main ring; soft: the semi-transparent dark wedge from the centre; dim: the dark outer tick ring
const NESTED_DIMS = [
  {
    name: 'Dimension 1',
    ratio: 0.45,
    color: '#5b9fd6',
    soft: 'rgba(91,159,214,0.16)',
    dim: 'rgba(91,159,214,0.5)',
  },
  {
    name: 'Dimension 2',
    ratio: 0.35,
    color: '#79d18d',
    soft: 'rgba(121,209,141,0.16)',
    dim: 'rgba(121,209,141,0.5)',
  },
  {
    name: 'Dimension 3',
    ratio: 0.2,
    color: '#cdcf7f',
    soft: 'rgba(205,207,127,0.16)',
    dim: 'rgba(205,207,127,0.5)',
  },
]
const NESTED_OUTER_TICKS = 24 // Total outer-ring tick segments, allocated across dimensions by share
const nestedOuterTicks = () =>
  NESTED_DIMS.flatMap((d) =>
    Array.from({ length: Math.max(2, Math.round(d.ratio * NESTED_OUTER_TICKS)) }, () => ({
      value: 1,
      name: d.name,
      itemStyle: { color: d.dim },
    })),
  )

// ── Style templates for the built-in types (with placeholder default data; overridden once the AI's data is merged) ──
// Factory functions: each call recomputes sizes with scalePx for the current viewport, so these must be functions rather than constants (see the file header).
// panelBg: the stroke colour of the gaps between segments in circular charts; it must match the container's background so the gaps blend instead of reading as black lines.
// /chartsView uses the default PANEL_BG (a dark card); the AI dialog passes its own lighter card background.
const createChartTemplates = (panelBg: string = PANEL_BG): Record<string, EChartsCoreOption> => ({
  // line, an area line chart — matching the RealEstate business chart style (clean axes + a 2px accent line + a vertical blue area gradient).
  // The point count varies (the AI may send dozens), so the persistent symbols are hidden (showSymbol:false) to stop dense dots smearing together; they appear on hover only.
  line: {
    backgroundColor: 'transparent',
    animationDuration: 400,
    color: PALETTE,
    grid: cartGrid(),
    tooltip: darkTooltip('axis'),
    legend: legendTop(),
    xAxis: reCatAxis(['2019', '2020', '2021', '2022', '2023', '2024', '2025'], {
      boundaryGap: false,
    }),
    yAxis: reValAxis(),
    series: [
      reLine([11, 8, 13, 16, 19, 21, 18], {
        smooth: true,
        areaStyle: { color: BLUE_AREA },
      }),
    ],
  },
  // bar, a single-series bar chart — matching RealEstate's "Total Sale Volume by Year": blue gradient rounded bars + a light background track (showBackground)
  bar: {
    backgroundColor: 'transparent',
    animationDuration: 400,
    color: PALETTE,
    grid: cartGrid(),
    tooltip: darkTooltip('axis'),
    xAxis: reCatAxis(['2019', '2020', '2021', '2022', '2023', '2024', '2025']),
    yAxis: reValAxis(),
    series: [
      {
        type: 'bar',
        data: [820, 640, 910, 530, 470, 760, 880],
        barWidth: scalePx(12),
        showBackground: true,
        backgroundStyle: { color: 'rgba(255,255,255,0.1)' },
        itemStyle: {
          borderRadius: [scalePx(12), scalePx(12), scalePx(12), scalePx(12)],
          color: BLUE_GRAD,
        },
      },
    ],
  },
  // stackedBar — matching Rent's "Total Rent Value by Year" / ReStackedBars: a vertical gradient per segment + rounded corners only at the whole bar's ends + transparent gaps between segments + a light background track + a bottom legend
  stackedBar: {
    backgroundColor: 'transparent',
    animationDuration: 400,
    color: PALETTE,
    grid: { ...cartGrid(), bottom: scalePx(32) }, // Leave room at the bottom for the legend
    tooltip: darkTooltip('axis'),
    legend: legendBottom(),
    xAxis: reCatAxis(['Group A', 'Group B', 'Group C']),
    yAxis: reValAxis(),
    series: [
      {
        // Bottom segment: enable the background track (full column height, shared by all segments) and round the base
        name: 'Series 1',
        type: 'bar',
        stack: 'stacked',
        data: [150, 180, 150],
        barWidth: scalePx(12),
        showBackground: true,
        backgroundStyle: { color: BAR_TRACK },
        itemStyle: stackedSeg(STACKED_GRADIENTS[0], 'bottom'),
      },
      {
        name: 'Series 2',
        type: 'bar',
        stack: 'stacked',
        data: [30, 30, 0],
        barWidth: scalePx(12),
        itemStyle: stackedSeg(STACKED_GRADIENTS[1], 'middle'),
      },
      {
        name: 'Series 3',
        type: 'bar',
        stack: 'stacked',
        data: [30, 40, 0],
        barWidth: scalePx(12),
        itemStyle: stackedSeg(STACKED_GRADIENTS[3], 'middle'),
      },
      {
        // Top segment: round the top
        name: 'Series 4',
        type: 'bar',
        stack: 'stacked',
        data: [110, 200, 120],
        barWidth: scalePx(12),
        itemStyle: stackedSeg(STACKED_GRADIENTS[4], 'top'),
      },
    ],
  },
  // stackedLine — matching the "Supply & Demand" line style (white-edged dots + a 2px line) with stack applied
  stackedLine: {
    backgroundColor: 'transparent',
    animationDuration: 400,
    color: PALETTE,
    grid: cartGrid(),
    tooltip: darkTooltip('axis'),
    xAxis: reCatAxis(['2019', '2020', '2021', '2022', '2023', '2024', '2025'], {
      boundaryGap: false,
    }),
    yAxis: reValAxis(),
    series: [
      reLine([120, 132, 101, 134, 90, 130, 120], { stack: 'total' }),
      reLine([60, 72, 71, 74, 56, 80, 70], { stack: 'total' }),
    ],
  },
  // barLine, a combined bar and line chart — the business design language: blue gradient bars (left Y axis) + a Supply&Demand line (right Y axis). series[0]=bars, series[1]=line
  barLine: {
    backgroundColor: 'transparent',
    animationDuration: 400,
    color: PALETTE,
    grid: { ...cartGrid(), right: scalePx(40) }, // The second Y axis on the right needs more room
    tooltip: darkTooltip('axis'),
    xAxis: reCatAxis(['2019', '2020', '2021', '2022', '2023', '2024', '2025']),
    yAxis: [reValAxis(), reValAxis({ position: 'right', splitLine: { show: false } })],
    series: [
      {
        name: 'Series 1',
        type: 'bar',
        yAxisIndex: 0,
        data: [820, 640, 910, 530, 470, 760, 880],
        barWidth: scalePx(12),
        showBackground: true,
        backgroundStyle: { color: 'rgba(255,255,255,0.08)' },
        itemStyle: {
          borderRadius: [scalePx(6), scalePx(6), scalePx(6), scalePx(6)],
          color: BLUE_GRAD,
        },
      },
      reLine([6.2, 5.8, 6.6, 6.1, 5.9, 6.8, 7.0], { name: 'Series 2', yAxisIndex: 1 }),
    ],
  },
  pie: {
    backgroundColor: 'transparent',
    color: PALETTE,
    tooltip: darkTooltip('item'),
    legend: pieLegendRight(),
    series: [
      {
        type: 'pie',
        radius: ['56%', '64%'], // A thin ring (8% band, matching donut); the centre shifts left to avoid encroaching on the legend
        center: ['25%', '50%'],
        label: { show: false },
        labelLine: { show: false },
        // Rounded ends + panel-coloured hairline gaps, handled the same way as "Sales Transactions by Property Type"
        itemStyle: { borderRadius: scalePx(4), borderColor: panelBg, borderWidth: scalePx(2) },
        data: [
          { name: 'Category A', value: 48 },
          { name: 'Category B', value: 22 },
          { name: 'Category C', value: 15 },
          { name: 'Category D', value: 9 },
          { name: 'Category E', value: 6 },
        ],
      },
    ],
  },
  // donut, a full ring — styled to match Figma's "Sector share" (263880:22596): a single-hue blue scale + rounded ends + panel-coloured hairline gaps + a right-hand legend with percentages
  donut: {
    backgroundColor: 'transparent',
    color: BLUE_RAMP,
    tooltip: darkTooltip('item'),
    legend: pieLegendRight(),
    series: [
      {
        type: 'pie',
        radius: ['56%', '64%'], // A thin ring (8% band); the outer radius and centre match pie so the legend is not encroached on
        center: ['25%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        // Rounded ends + panel-coloured hairline gaps; the stroke width matches pie (2px) so the visible band reads the same thickness as the other circular charts
        itemStyle: { borderRadius: scalePx(4), borderColor: panelBg, borderWidth: scalePx(2) },
        data: [
          { name: 'Category A', value: 61 },
          { name: 'Category B', value: 19 },
          { name: 'Category C', value: 10 },
          { name: 'Category D', value: 8 },
          { name: 'Category E', value: 2 },
        ],
      },
    ],
  },
  // halfDoughnut, a half ring — matching Figma's "Sales Transactions by Property Type" (263880:23064):
  // a 180° top half ring + rounded ends + panel-coloured hairline gaps; the centre shows the largest segment's share and name (data-driven, so it updates automatically when the AI changes the data); the right-hand legend shows values
  halfDoughnut: {
    backgroundColor: 'transparent',
    color: PALETTE,
    tooltip: darkTooltip('item'),
    legend: pieLegendRight(),
    series: [
      {
        type: 'pie',
        radius: ['58%', '66%'], // A thin ring (8% band, matching donut); the centre shifts left to avoid encroaching on the legend
        center: ['26%', '58%'],
        startAngle: 180,
        endAngle: 0,
        clockwise: true,
        avoidLabelOverlap: false,
        // Centre label: only the first segment (agreed to be the largest, sent in descending order by the backend) renders "share% + name"; the others return an empty string
        label: {
          show: true,
          position: 'center',
          formatter: (p: { dataIndex: number; percent?: number; name: string }) =>
            p.dataIndex === 0 ? `{pct|${Math.round(p.percent ?? 0)}%}\n{lab|${p.name}}` : '',
          rich: {
            pct: {
              fontSize: scalePx(22),
              fontWeight: 600,
              color: '#ffffff',
              fontFamily: FONT,
              lineHeight: scalePx(26),
            },
            lab: {
              fontSize: scalePx(12),
              color: 'rgba(255,255,255,0.7)',
              fontFamily: FONT,
              lineHeight: scalePx(16),
            },
          },
        },
        labelLine: { show: false },
        itemStyle: { borderRadius: scalePx(4), borderColor: panelBg, borderWidth: scalePx(2) },
        data: [
          { name: 'Category A', value: 9639 },
          { name: 'Category B', value: 5041 },
        ],
      },
    ],
  },
  // nestedPie — matching Figma 263880:22656 "Dimension Score": dark wedges (spreading from the centre) + a bright outer main ring (Current Score) + a dark outer tick arc (LIV Target) + a centre dot, no legend, centred
  nestedPie: {
    backgroundColor: 'transparent',
    tooltip: darkTooltip('item'),
    series: [
      {
        // 1) Dark wedges: the three dimensions spread from the centre, semi-transparent dark with panel-coloured radial dividers
        type: 'pie',
        radius: ['0%', '46%'],
        center: ['50%', '50%'],
        label: { show: false },
        labelLine: { show: false },
        silent: true,
        itemStyle: { borderColor: panelBg, borderWidth: scalePx(2) },
        data: NESTED_DIMS.map((d) => ({
          name: d.name,
          value: d.ratio * 100,
          itemStyle: { color: d.soft },
        })),
      },
      {
        // 2) Bright main ring: the bright per-dimension arc outside the wedges (Current Score), with the same 8% band as the other circular charts
        type: 'pie',
        radius: ['46%', '54%'],
        center: ['50%', '50%'],
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderRadius: scalePx(4), borderColor: panelBg, borderWidth: scalePx(2) },
        data: NESTED_DIMS.map((d) => ({
          name: d.name,
          value: d.ratio * 100,
          itemStyle: { color: d.color },
        })),
      },
      {
        // 3) Outer segmented tick arc (the dark LIV Target track: several equal short segments per dimension with rounded ends, reading as ticks)
        type: 'pie',
        radius: ['62%', '70%'],
        center: ['50%', '50%'],
        label: { show: false },
        labelLine: { show: false },
        silent: true,
        itemStyle: { borderRadius: scalePx(2), borderColor: panelBg, borderWidth: scalePx(2) },
        data: nestedOuterTicks(),
      },
      {
        // 4) Centre dot
        type: 'pie',
        radius: ['0%', '5%'],
        center: ['50%', '50%'],
        label: { show: false },
        labelLine: { show: false },
        silent: true,
        itemStyle: { color: 'rgba(255,255,255,0.25)', borderWidth: 0 },
        data: [{ value: 1 }],
      },
    ],
  },
  scatter: {
    backgroundColor: 'transparent',
    color: PALETTE,
    // Scatter radii can push past the plotting area, so scale:true on the axes leaves padding at both ends to keep the outermost points inside; the margins match the other charts
    grid: cartGrid(),
    tooltip: darkTooltip('item'),
    legend: legendTop(),
    xAxis: darkVal({ scale: true }),
    yAxis: darkVal({ scale: true }),
    series: [
      {
        type: 'scatter',
        symbolSize: scalePx(10),
        data: [
          [60, 820],
          [85, 1180],
          [120, 1620],
          [165, 2300],
          [210, 2890],
          [240, 3050],
        ],
      },
    ],
  },
  radar: {
    backgroundColor: 'transparent',
    color: PALETTE,
    tooltip: darkTooltip('item'),
    radar: {
      indicator: [
        { name: 'Metric A', max: 100 },
        { name: 'Metric B', max: 100 },
        { name: 'Metric C', max: 100 },
        { name: 'Metric D', max: 100 },
        { name: 'Metric E', max: 100 },
      ],
      axisName: { color: SUBTLE, fontSize: scalePx(10) },
      splitLine: { lineStyle: { color: SPLIT } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: SPLIT } },
    },
    series: [
      {
        type: 'radar',
        symbolSize: scalePx(4),
        areaStyle: { color: 'rgba(109,181,236,0.3)' },
        data: [{ value: [80, 70, 90, 60, 75], name: 'Series 1' }],
      },
    ],
  },
  funnel: {
    backgroundColor: 'transparent',
    color: PALETTE,
    tooltip: darkTooltip('item'),
    series: [
      {
        type: 'funnel',
        left: '10%',
        right: '10%',
        top: scalePx(16),
        bottom: scalePx(12),
        label: { color: '#fff', fontSize: scalePx(10) },
        data: [
          { name: 'Stage 1', value: 100 },
          { name: 'Stage 2', value: 80 },
          { name: 'Stage 3', value: 55 },
          { name: 'Stage 4', value: 30 },
        ],
      },
    ],
  },
  heatmap: {
    backgroundColor: 'transparent',
    grid: { ...cartGrid(), bottom: scalePx(40) }, // Leave room at the bottom for the visualMap
    tooltip: darkTooltip('item'),
    xAxis: {
      type: 'category',
      data: ['12a', '6a', '12p', '6p'],
      axisLabel: { color: SUBTLE, fontSize: scalePx(9) },
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      axisLabel: { color: SUBTLE, fontSize: scalePx(9) },
      splitArea: { show: true },
    },
    visualMap: {
      min: 0,
      max: 10,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      textStyle: { color: SUBTLE },
      inRange: { color: ['#13314d', '#6db5ec', '#cae3f3'] },
    },
    series: [
      {
        type: 'heatmap',
        label: { show: false },
        data: [
          [0, 0, 3],
          [1, 0, 5],
          [2, 0, 8],
          [3, 0, 4],
          [0, 1, 6],
          [1, 1, 2],
          [2, 1, 9],
          [3, 1, 7],
          [0, 2, 1],
          [1, 2, 8],
          [2, 2, 5],
          [3, 2, 3],
          [0, 3, 7],
          [1, 3, 4],
          [2, 3, 6],
          [3, 3, 9],
          [0, 4, 2],
          [1, 4, 6],
          [2, 4, 3],
          [3, 4, 8],
        ],
      },
    ],
  },
  pictorialBar: {
    backgroundColor: 'transparent',
    color: PALETTE,
    grid: cartGrid(),
    tooltip: darkTooltip('axis'),
    xAxis: darkCat(['A', 'B', 'C', 'D', 'E']),
    yAxis: darkVal(),
    series: [
      {
        type: 'pictorialBar',
        symbol: 'roundRect',
        symbolRepeat: true,
        symbolSize: [scalePx(12), scalePx(6)],
        symbolMargin: scalePx(2),
        itemStyle: { color: PRIMARY },
        data: [5, 8, 6, 9, 4],
      },
    ],
  },
  lines: {
    backgroundColor: 'transparent',
    grid: cartGrid(),
    xAxis: darkVal({ min: 0, max: 10 }),
    yAxis: darkVal({ min: 0, max: 10 }),
    series: [
      {
        type: 'lines',
        coordinateSystem: 'cartesian2d',
        lineStyle: { color: PRIMARY, width: scalePx(2), curveness: 0.2 },
        effect: {
          show: true,
          period: 4,
          trailLength: 0.3,
          symbol: 'arrow',
          symbolSize: scalePx(6),
          color: '#cae3f3',
        },
        data: [
          {
            coords: [
              [1, 1],
              [4, 5],
            ],
          },
          {
            coords: [
              [4, 5],
              [7, 2],
            ],
          },
          {
            coords: [
              [7, 2],
              [9, 8],
            ],
          },
        ],
      },
    ],
  },
  graph: {
    backgroundColor: 'transparent',
    tooltip: darkTooltip('item'),
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        // repulsion / edgeLength are force-directed layout parameters (not pixel sizes), so they do not go through scalePx
        force: { repulsion: 70, edgeLength: 40 },
        label: { show: true, color: TEXT, fontSize: scalePx(9) },
        lineStyle: { color: SPLIT },
        itemStyle: { color: PRIMARY },
        data: [
          { name: 'Hub', value: 20, symbolSize: scalePx(34) },
          { name: 'A', value: 10, symbolSize: scalePx(20) },
          { name: 'B', value: 12, symbolSize: scalePx(22) },
          { name: 'C', value: 8, symbolSize: scalePx(18) },
          { name: 'D', value: 6, symbolSize: scalePx(16) },
        ],
        links: [
          { source: 'Hub', target: 'A' },
          { source: 'Hub', target: 'B' },
          { source: 'Hub', target: 'C' },
          { source: 'A', target: 'D' },
          { source: 'B', target: 'C' },
        ],
      },
    ],
  },
  sunburst: {
    backgroundColor: 'transparent',
    color: PALETTE,
    tooltip: darkTooltip('item'),
    series: [
      {
        type: 'sunburst',
        radius: [0, '92%'],
        label: { color: '#fff', fontSize: scalePx(9) },
        data: [
          {
            name: 'Group A',
            children: [
              { name: 'Item 1', value: 30 },
              { name: 'Item 2', value: 18 },
            ],
          },
          {
            name: 'Group B',
            children: [
              { name: 'Item 3', value: 14 },
              { name: 'Item 4', value: 10 },
            ],
          },
        ],
      },
    ],
  },
})

/** Supported chart types (= the template library's keys). The keys do not depend on size, so one call to the factory is enough. */
export const SUPPORTED_CHART_TYPES = Object.keys(createChartTemplates())

/**
 * Build an ECharts option for a chart type: take the type's template and deep-merge the endpoint's data fragment (the merge mechanism is in chartOptionMerge),
 * then apply runtime adjustments based on the merged real data (see applyDynamicStyles). Unsupported types return null (callers render nothing).
 * createChartTemplates() recomputes template sizes for the current viewport at call time (scalePx), so re-running this function after a resize yields the new scaling.
 * @param panelBg The stroke colour for the gaps between circular chart segments; pass the container's background. Defaults to PANEL_BG (/chartsView's dark card). The AI dialog passes its own lighter card background so the gaps blend instead of reading as black lines.
 */
export const buildChartOption = (
  chart: AiAssistantChart,
  panelBg?: string,
): EChartsCoreOption | null => {
  const template = createChartTemplates(panelBg)[chart.type]
  if (!template) return null
  const { type: _type, ...fragment } = chart
  // deepClone as a safeguard: the templates' palettes/gradients (PALETTE / BLUE_GRAD etc.) are shared top-level references, and ECharts setOption
  // mutates the option it is given (filling in the coordinate system and so on), so cloning before merging keeps those shared references from being polluted (this once made pie throw by mixing in xAxis).
  const option = mergeChartOption(
    deepClone(template) as EChartsCoreOption,
    fragment as Record<string, unknown>,
  ) as Record<string, unknown>
  applyDynamicStyles(option, chart.type)
  return option as EChartsCoreOption
}
