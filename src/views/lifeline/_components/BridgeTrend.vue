<template>
  <div class="bridge-trend">
    <div class="head">
      <h3 class="name">伸缩缝位移 · 今日</h3>
      <span class="now"
        >当前 <b :style="{ color: over ? COLOR.caution : undefined }">{{ latest }}</b> mm</span
      >
    </div>
    <LineChart class="chart" :option="option" :label="name + '今日伸缩缝位移曲线'" />
    <p class="note">阈值 {{ limit }} mm · 今日最大 {{ peak }} mm{{ over ? ' · 已超限' : '' }}</p>
  </div>
</template>

<script setup lang="ts">
import { COLOR } from '@/scene/kit'
import { computed } from 'vue'

const props = defineProps<{ name: string; points: [number, number][]; limit: number }>()

const latest = computed(() => props.points[props.points.length - 1]?.[1] ?? 0)
const peak = computed(() => Math.max(0, ...props.points.map(p => p[1])))
const over = computed(() => peak.value > props.limit)

const option = computed(() => {
  const axisLabel = { color: '#9aa4b2', fontSize: 12 }
  return {
    animation: false,
    grid: { left: 32, right: 12, top: 16, bottom: 22 },
    xAxis: {
      type: 'value', min: 0, max: 24, interval: 6,
      axisLabel: { ...axisLabel, formatter: (v: number) => String(v).padStart(2, '0') },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      axisTick: { show: false },
      splitLine: { show: false }
    },
    yAxis: { type: 'value', min: 0, max: 60, interval: 20, axisLabel, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } } },
    series: [
      {
        name: '伸缩缝位移',
        type: 'line',
        data: props.points,
        showSymbol: false,
        lineStyle: { color: COLOR.accent, width: 2 },
        markLine: {
          symbol: 'none', silent: true,
          lineStyle: { color: COLOR.caution, type: 'dashed', width: 1 },
          label: { color: COLOR.caution, fontSize: 12, formatter: '阈值' },
          data: [{ yAxis: props.limit }]
        }
      }
    ]
  }
})
</script>

<style lang="scss" scoped>
.bridge-trend {
  width: 300px;
  box-sizing: border-box;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: all;
  background: rgba(17, 22, 30, 0.96);
  border: 1px solid $border-strong;
  border-radius: $radius;
}
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.name {
  margin: 0;
  font-size: $fs-body;
  font-weight: 600;
  color: $text-strong;
}
.now {
  font-size: $fs-aux;
  color: $text-muted;
  b {
    font-size: 16px;
    color: $text-strong;
  }
}
.bridge-trend .chart {
  height: 140px;
}
.note {
  margin: 0;
  font-size: $fs-aux;
  color: $text-muted;
}
</style>
