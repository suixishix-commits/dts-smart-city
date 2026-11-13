<template>
  <div ref="el" class="line-chart" role="img" :aria-label="label"></div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts'
import { scaleOptionSizes } from '@/utils/viewportScale'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ option: Record<string, any>; label: string }>()
const el = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

let observer: ResizeObserver | null = null

/** option 按设计稿 px 书写，这里换算成当前视口的尺寸 */
const render = () => chart?.setOption(scaleOptionSizes(props.option), true)

onMounted(() => {
  chart = echarts.init(el.value as HTMLElement)
  render()
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
