<template>
  <div class="station-card">
    <div class="head">
      <i class="dot" :style="{ background: color }"></i>
      <h3 class="name">{{ station.name }}</h3>
      <button type="button" class="close" aria-label="关闭" @click="emit('close')">×</button>
    </div>
    <div class="sub">{{ station.districtName }} · {{ station.kind }} · {{ formatHour(hour) }}</div>

    <div class="summary">
      <span class="aqi" :style="{ color }">{{ air.aqi }}</span>
      <span class="summary-text">
        <span class="level" :style="{ color }">AQI · {{ AIR_LEVEL_NAMES[level] }}</span>
        <span class="primary">首要污染物 {{ pollutantName(air.primary) }}</span>
      </span>
    </div>

    <div class="pollutants">
      <div v-for="p in pollutants" :key="p.key" class="pollutant" :class="{ primary: p.key === air.primary }">
        <span class="p-name">{{ p.name }}</span>
        <span class="p-value" :class="{ over: p.over }">{{ p.value }}</span>
        <span class="p-limit">限值 {{ p.limit }}</span>
      </div>
    </div>
    <div class="unit-note">单位 μg/m³，CO 为 mg/m³；限值为国标二级</div>

    <div class="trend-head">
      <span>{{ meta.name }} 24 小时趋势</span>
      <span>{{ meta.limitName }} {{ meta.limit }}</span>
    </div>
    <LineChart class="trend" :option="chartOption" :label="station.name + ' ' + meta.name + ' 二十四小时曲线'" />

    <p class="advice">{{ healthAdvice(level) }}</p>
  </div>
</template>

<script setup lang="ts">
import { AIR_INDEXES, AIR_LEVEL_NAMES, airLevel, aqiOf, concentrationsAt, healthAdvice, pollutantName, POLLUTANTS, readingOf, stationSeries } from '@/api/mock/environment'
import type { AirIndex, EnvStation } from '@/types/environment'
import { computed } from 'vue'
import { airColor } from '../EnvironmentScene'

const props = defineProps<{ station: EnvStation; hour: number; index: AirIndex }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const meta = computed(() => AIR_INDEXES.find(i => i.key === props.index) ?? AIR_INDEXES[0])
const conc = computed(() => concentrationsAt(props.station, props.hour))
const air = computed(() => aqiOf(conc.value))
const level = computed(() => airLevel(air.value.aqi))
const color = computed(() => airColor(level.value))

const pollutants = computed(() =>
  POLLUTANTS.map(p => ({ ...p, value: p.key === 'co' ? conc.value.co.toFixed(1) : conc.value[p.key], over: conc.value[p.key] > p.limit }))
)

function formatHour(hour: number): string {
  const h = Math.floor(hour)
  return String(h).padStart(2, '0') + ':' + String(Math.round((hour - h) * 60)).padStart(2, '0')
}

const chartOption = computed(() => {
  const series = stationSeries(props.station, props.index)
  const limit = meta.value.limit
  const max = Math.ceil((Math.max(limit, ...series.map(p => p[1])) * 1.15) / 50) * 50
  const now = readingOf(conc.value, props.index)
  return {
    animation: false,
    grid: { left: 32, right: 8, top: 10, bottom: 20 },
    xAxis: {
      type: 'value', min: 0, max: 24, interval: 6,
      axisLabel: { color: '#8b9aa3', fontSize: 11, formatter: (v: number) => String(v).padStart(2, '0') },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      axisTick: { show: false },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value', min: 0, max, interval: max / 2,
      axisLabel: { color: '#8b9aa3', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }
    },
    series: [
      {
        type: 'line', data: series, showSymbol: false, smooth: 0.3,
        lineStyle: { color: '#4cc4d4', width: 2 },
        markLine: {
          symbol: 'none', silent: true, label: { show: false },
          data: [
            { yAxis: limit, lineStyle: { color: '#e8b04f', type: 'dashed', width: 1 } },
            { xAxis: props.hour, lineStyle: { color: 'rgba(255,255,255,0.5)', type: 'solid', width: 1 } }
          ]
        },
        markPoint: {
          symbol: 'circle', symbolSize: 8, silent: true,
          itemStyle: { color: '#10151c', borderColor: airColor(now.level), borderWidth: 2 },
          label: { show: false },
          data: [{ coord: [props.hour, now.value] }]
        }
      }
    ]
  }
})
</script>

<style lang="scss" scoped>
.station-card {
  width: 300px;
  box-sizing: border-box;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: all;
  background: rgba(17, 22, 30, 0.96);
  border: 1px solid $border-strong;
  border-radius: $radius;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.name {
  flex-grow: 1;
  font-size: 15px;
  font-weight: 600;
  color: $text-strong;
}
.close {
  width: 44px;
  height: 44px;
  margin: -10px -12px -10px 0;
  border: 0;
  font-size: 20px;
  color: $text-muted;
  background: none;
  cursor: pointer;
}
.sub {
  margin-top: -8px;
  font-size: $fs-aux;
  color: $text-muted;
}
.summary {
  display: flex;
  align-items: center;
  gap: 12px;
}
.aqi {
  font-size: 40px;
  font-weight: 600;
  line-height: 44px;
}
.summary-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.level {
  font-size: $fs-body;
  font-weight: 600;
}
.primary {
  font-size: $fs-aux;
  color: $text-muted;
}
.pollutants {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.pollutant {
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: $bg-inset;
  &.primary {
    border-color: $border-strong;
  }
}
.p-name {
  font-size: 12px;
  color: $text-muted;
}
.p-value {
  font-size: 18px;
  font-weight: 600;
  color: $text-strong;
  &.over {
    color: $level-2;
  }
}
.p-limit {
  font-size: 11px;
  white-space: nowrap;
  color: $text-muted;
}
.trend-head {
  display: flex;
  justify-content: space-between;
  font-size: $fs-aux;
  color: $text-muted;
}
.unit-note {
  margin-top: -6px;
  font-size: 12px;
  color: $text-muted;
}
// 多写一层选择器，压过 LineChart 自带的高度
.station-card .trend {
  height: 104px;
  margin-top: -6px;
}
.advice {
  margin: 0;
  padding-top: 10px;
  font-size: $fs-aux;
  line-height: 20px;
  color: $text;
  border-top: 1px solid $divider;
}
</style>
