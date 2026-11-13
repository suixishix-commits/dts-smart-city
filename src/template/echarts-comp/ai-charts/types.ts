/**
 * 图表数据（照搬 usecase AI 模块的 AiAssistantChart）：type 为图表类型，其余为数据片段
 * （series / xAxis / yAxis / indicator / visualMap 等），由 buildChartOption 深合并进该类型的样式模板。
 * 支持的类型见 chartTemplates 的 SUPPORTED_CHART_TYPES。
 */
export interface AiAssistantChart {
  type: string
  [key: string]: unknown
}
