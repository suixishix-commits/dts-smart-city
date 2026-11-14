<template>
  <aside class="environment-left">
    <PanelCard title="环境质量" :extra="'首要污染物 ' + primaryName + ' · 优良片区 ' + goodDistricts + ' / ' + data.districts.length">
      <div class="stats">
        <StatItem label="空气质量指数 AQI" :value="city.aqi" :unit="AIR_LEVEL_NAMES[cityLevel]" size="lg" :color="airColor(cityLevel)" />
        <StatItem label="PM2.5" :value="city.c.pm25" unit="μg/m³" size="lg" />
        <StatItem label="PM10" :value="city.c.pm10" unit="μg/m³" size="lg" />
        <StatItem label="优良天数比例" :value="goodDayRatio" :unit="'% · 本月 ' + data.goodDays.good + '/' + data.goodDays.total" size="lg" />
      </div>
      <div class="others">
        <span v-for="p in others" :key="p.name" class="other">
          <span class="other-name">{{ p.name }}</span>
          <span class="other-value">{{ p.value }}</span>
          <span class="other-unit">{{ p.unit }}</span>
        </span>
      </div>
    </PanelCard>

    <PanelCard title="24 小时趋势">
      <template #extra>
        <span class="chart-legend">{{ meta.name }} 全岛均值 <i class="dashed"></i>{{ meta.limitName }} {{ meta.limit }}</span>
      </template>
      <LineChart :option="chartOption" :label="meta.name + ' 全岛均值二十四小时曲线'" />
    </PanelCard>

    <PanelCard title="片区排名" :extra="'最差 6 个 · ' + meta.name + (meta.unit ? ' ' + meta.unit : '')" grow>
      <div class="rows">
        <BarRow v-for="r in rankRows" :key="r.id" :name="r.name" :value="r.value" :percent="r.percent" :color="r.color" :note="r.note" :note-color="r.color" />
      </div>
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { AIR_INDEXES, AIR_LEVEL_NAMES, AIR_LEVEL_SHORT, airLevel, aqiOf, cityConcentrationsAt, citySeries, districtReadingsAt, pollutantName, readingOf } from '@/api/mock/environment'
import type { AirIndex, EnvironmentData } from '@/types/environment'
import { computed } from 'vue'
import { airColor } from './EnvironmentScene'

const props = defineProps<{ data: EnvironmentData; hour: number; index: AirIndex }>()

const meta = computed(() => AIR_INDEXES.find(i => i.key === props.index) ?? AIR_INDEXES[0])

/** 全岛均值：浓度、AQI、首要污染物 */
const city = computed(() => {
  const c = cityConcentrationsAt(props.data, props.hour)
  return { c, ...aqiOf(c) }
})
const cityLevel = computed(() => airLevel(city.value.aqi))
const primaryName = computed(() => pollutantName(city.value.primary))
const goodDistricts = computed(() => districtReadingsAt(props.data, props.hour, 'aqi').filter(d => d.reading.level <= 1).length)
const goodDayRatio = computed(() => ((props.data.goodDays.good / props.data.goodDays.total) * 100).toFixed(1))

const others = computed(() => [
  { name: 'O₃', value: city.value.c.o3, unit: 'μg/m³' },
  { name: 'NO₂', value: city.value.c.no2, unit: 'μg/m³' },
  { name: 'SO₂', value: city.value.c.so2, unit: 'μg/m³' },
  { name: 'CO', value: city.value.c.co.toFixed(1), unit: 'mg/m³' }
])

/** 最差的 6 个片区；颜色与场景里片区的等级色一致 */
const rankRows = computed(() =>
  districtReadingsAt(props.data, props.hour, props.index)
    .slice(0, 6)
    .map(d => ({
      id: d.id,
      name: d.name,
      value: d.reading.value,
      // 进度条按分指数画，200（中度污染上限）为满格
      percent: Math.round((d.reading.index / 200) * 100),
      color: airColor(d.reading.level),
      note: AIR_LEVEL_SHORT[d.reading.level]
    }))
)

function formatHour(hour: number): string {
  const h = Math.floor(hour)
  return String(h).padStart(2, '0') + ':' + String(Math.round((hour - h) * 60)).padStart(2, '0')
}

const series = computed(() => citySeries(props.data, props.index))

const chartOption = computed(() => {
  const limit = meta.value.limit
  const top = Math.max(limit, ...series.value.map(p => p[1]))
  const max = Math.ceil((top * 1.15) / 50) * 50
  const now = readingOf(city.value.c, props.index)
  return {
    animation: false,
    grid: { left: 36, right: 12, top: 20, bottom: 24 },
    xAxis: {
      type: 'value', min: 0, max: 24, interval: 6,
      axisLabel: { color: '#8b9aa3', fontSize: 12, formatter: (v: number) => String(v).padStart(2, '0') },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      axisTick: { show: false },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value', min: 0, max, interval: max / 2,
      axisLabel: { color: '#8b9aa3', fontSize: 12 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }
    },
    series: [
      {
        type: 'line', data: series.value, showSymbol: false, smooth: 0.3,
        lineStyle: { color: '#4cc4d4', width: 2 },
        areaStyle: { color: 'rgba(76,196,212,0.12)' },
        markLine: {
          symbol: 'none', silent: true,
          data: [
            // 国标限值：虚线
            { yAxis: limit, lineStyle: { color: '#e8b04f', type: 'dashed', width: 1 }, label: { color: '#e8b04f', fontSize: 12, position: 'insideEndTop', formatter: meta.value.limitName + ' ' + limit } },
            // 所选时刻：竖线
            { xAxis: props.hour, lineStyle: { color: 'rgba(255,255,255,0.5)', type: 'solid', width: 1 }, label: { color: '#8b9aa3', fontSize: 12, formatter: formatHour(props.hour) } }
          ]
        },
        markPoint: {
          symbol: 'circle', symbolSize: 8, silent: true,
          itemStyle: { color: '#10151c', borderColor: airColor(now.level), borderWidth: 2 },
          label: { color: '#eef5f8', fontSize: 12, position: props.hour > 20 ? 'left' : 'right', formatter: String(now.value) },
          data: [{ coord: [props.hour, now.value] }]
        }
      }
    ]
  }
})
</script>

<style lang="scss" scoped>
.environment-left {
  position: absolute;
  left: $page-margin;
  top: $panel-top;
  width: $panel-width;
  height: calc(100% - #{$panel-top} - #{$page-margin});
  display: flex;
  flex-direction: column;
  gap: $panel-gap;
}
.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 24px;
}
.others {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid $divider;
}
.other {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.other-name,
.other-unit {
  font-size: $fs-aux;
  color: $text-muted;
}
.other-unit {
  font-size: 12px;
}
.other-value {
  font-size: 18px;
  font-weight: 600;
  color: $text-strong;
}
.chart-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  i {
    display: inline-block;
    width: 14px;
    height: 0;
    margin-left: 6px;
    border-top: 2px dashed $level-2;
  }
}
.rows {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  // 窗口比 16:9 更高时面板会变长，限制行距不让列表被拉散
  max-height: 320px;
  // 片区名最长 6 个字（拉斯阿赫达尔），通用件默认宽度放不下
  :deep(.name) {
    width: 88px;
    white-space: nowrap;
  }
}
</style>
