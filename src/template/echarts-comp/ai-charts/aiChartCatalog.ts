/**
 * EchartsUI 面板里 usecase AI 图表样式的目录：按面板分组列出每种类型。
 * 面板选项的 value 为 `${AI_CHART_PREFIX}${type}`，Main.vue 据此打开对应图表弹窗。
 */
export const AI_CHART_PREFIX = 'AI图表-'

export interface AiChartCatalogItem {
  type: string
  name: string
  // 面板分组标题（柱状图 / 折线图 / 雷达图 / 饼环图 / 综合图）
  group: string
}

export const AI_CHART_CATALOG: AiChartCatalogItem[] = [
  { type: 'bar', name: '基础柱状', group: '柱状图' },
  { type: 'stackedBar', name: '堆叠柱状', group: '柱状图' },
  { type: 'pictorialBar', name: '象形柱', group: '柱状图' },
  { type: 'line', name: '基础折线', group: '折线图' },
  { type: 'stackedLine', name: '堆叠折线', group: '折线图' },
  { type: 'radar', name: '雷达图', group: '雷达图' },
  { type: 'pie', name: '饼图', group: '饼环图' },
  { type: 'donut', name: '环形图', group: '饼环图' },
  { type: 'halfDoughnut', name: '半环图', group: '饼环图' },
  { type: 'nestedPie', name: '双层环', group: '饼环图' },
  { type: 'sunburst', name: '旭日图', group: '饼环图' },
  { type: 'barLine', name: '柱线组合', group: '综合图' },
  { type: 'scatter', name: '散点图', group: '综合图' },
  { type: 'funnel', name: '漏斗图', group: '综合图' },
  { type: 'heatmap', name: '热力图', group: '综合图' },
  { type: 'lines', name: '路径图', group: '综合图' },
  { type: 'graph', name: '关系图', group: '综合图' }
]

/** 面板选项：同组的 AI 图表追加在原有选项之后 */
export function aiChartOptionsOf(group: string) {
  return AI_CHART_CATALOG.filter((item) => item.group === group).map((item) => ({
    name: item.name,
    checked: false,
    value: `${AI_CHART_PREFIX}${item.type}`
  }))
}

export function findAiChart(value: string): AiChartCatalogItem | undefined {
  if (!value.startsWith(AI_CHART_PREFIX)) return undefined
  const type = value.slice(AI_CHART_PREFIX.length)
  return AI_CHART_CATALOG.find((item) => item.type === type)
}
