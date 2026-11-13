<template>
  <div ref="el" class="line-chart" role="img" :aria-label="label"></div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ option: Record<string, any>; label: string }>()
const el = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const resize = () => chart?.resize()

onMounted(() => {
  chart = echarts.init(el.value as HTMLElement)
  chart.setOption(props.option)
  window.addEventListener('resize', resize)
})

watch(
  () => props.option,
  option => chart?.setOption(option, true),
  { deep: true }
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
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
