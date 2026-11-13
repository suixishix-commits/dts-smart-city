<template>
  <div ref="chartRef" class="ai-chart"></div>
</template>

<script setup lang="ts">
/**
 * usecase AI 模块图表样式的通用渲染容器：option 完全由 buildChartOption 按类型生成，容器只负责 init / resize / dispose。
 * 尺寸走 scalePx，resize 时重算 option，4K/2K 下字号、间距随视口等比缩放。
 */
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { buildChartOption } from './chartTemplates'
import type { AiAssistantChart } from './types'

const props = defineProps({
  // 图表类型（line / bar / pie …）
  type: {
    type: String,
    required: true
  },
  // 数据片段，不传则用模板自带的占位数据
  data: {
    type: Object,
    default: () => ({})
  },
  // 环形图分段描边色，需与容器背景一致，否则分段缝隙显成黑线
  panelBg: {
    type: String,
    default: 'rgb(13, 14, 14)'
  }
})

const chartRef = ref<HTMLDivElement | null>(null)
const instance = shallowRef<ECharts | null>(null)
let resizeObserver: ResizeObserver | null = null

const render = () => {
  if (!instance.value) return
  const chart: AiAssistantChart = { ...props.data, type: props.type }
  const option = buildChartOption(chart, props.panelBg)
  if (!option) return
  try {
    instance.value.setOption(option, true)
  } catch (error) {
    console.error('[AiChart] 图表渲染失败:', error)
  }
}

// 先重算 option（scalePx 按新视口取值），再按新容器尺寸 resize
const resize = () => {
  render()
  instance.value?.resize()
}

onMounted(() => {
  if (!chartRef.value) return
  instance.value = markRaw(echarts.init(chartRef.value))
  render()
  window.addEventListener('resize', resize)
  // 监听容器自身尺寸：弹窗展开动画期间初始化时容器还没撑开，撑开后要跟着 resize
  resizeObserver = new ResizeObserver(() => nextTick(() => instance.value?.resize()))
  resizeObserver.observe(chartRef.value)
})

watch(() => [props.type, props.data], render)

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  resizeObserver?.disconnect()
  resizeObserver = null
  instance.value?.dispose()
  instance.value = null
})
</script>

<style scoped lang="scss">
.ai-chart {
  width: 100%;
  height: 100%;
}
</style>
