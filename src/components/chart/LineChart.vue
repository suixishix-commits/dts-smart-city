<template>
  <div ref="el" class="line-chart" role="img" :aria-label="label" :style="height ? { height: height / 10 + 'rem' } : undefined"></div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts'
import { scaleOptionSizes } from '@/utils/viewportScale'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { enhanceOption } from './chartTheme'
import { withTooltip } from './chartTooltip'

/**
 * ECharts 图表（名字沿用 LineChart，折线、柱状、环形、玫瑰图都用它）。
 * option 按设计稿 px 书写；统一视觉（发光、渐变、数字字体）和悬停提示在这里补上。
 * 首次出现播放绘制动画；之后数据变化平滑过渡（不整张重画）。点击数据项时抛出 select。
 */
const props = defineProps<{ option: Record<string, any>; label: string; /** 高度，设计稿 px；默认 176 */ height?: number }>()
const emit = defineEmits<{ (e: 'select', item: { name: string; dataIndex: number; seriesIndex: number }): void }>()
const el = ref<HTMLElement>()
let chart: echarts.ECharts | null = null
let observer: ResizeObserver | null = null
let drawn = false

function build() {
  // 各面板以前为了避免拖时间轴时整张重播而关掉了动画；现在更新走过渡，统一打开
  const { animation: _ignored, ...rest } = props.option
  return scaleOptionSizes(withTooltip(enhanceOption(rest)))
}

/** 首次整张绘制；之后只替换系列，数值平滑过渡 */
function render() {
  if (!chart) return
  if (!drawn) {
    chart.setOption(build(), true)
    drawn = true
  } else {
    chart.setOption(build(), { replaceMerge: ['series'] })
  }
}

onMounted(() => {
  chart = echarts.init(el.value as HTMLElement)
  render()
  chart.on('click', p => emit('select', { name: String(p.name ?? ''), dataIndex: p.dataIndex ?? -1, seriesIndex: p.seriesIndex ?? -1 }))
  // 容器尺寸变化（窗口缩放、根字号变化、面板伸缩）时重算字号并重排
  observer = new ResizeObserver(() => {
    render()
    chart?.resize()
  })
  observer.observe(el.value as HTMLElement)
})

watch(() => props.option, render, { deep: true })

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  chart?.dispose()
  chart = null
})
</script>

<style lang="scss" scoped>
.line-chart {
  width: 100%;
  height: 176px;
}
</style>
