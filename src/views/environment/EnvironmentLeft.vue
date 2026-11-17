<template>
  <aside class="environment-left">
    <PanelCard title="空气质量" :extra="'优良天数 ' + data.goodDays.good + '/' + data.goodDays.total + ' · ' + goodDayRatio + '%'">
      <div class="headline">
        <span class="aqi">{{ city.aqi }}</span>
        <span class="headline-text">
          <span class="level"><i class="dot" :style="{ background: airColor(cityLevel) }"></i>AQI · {{ AIR_LEVEL_NAMES[cityLevel] }}</span>
          <span class="primary">首要污染物 {{ primaryName }} · 更新于 {{ formatHour(hour) }}</span>
        </span>
      </div>
      <!-- 六项污染物：全岛均值，超过国标二级限值的用暖色 -->
      <div class="pollutants">
        <div v-for="p in pollutants" :key="p.key" class="pollutant" :title="p.name + ' 二级限值 ' + p.limit + ' ' + p.unit">
          <span class="p-name">{{ p.name }}</span>
          <span class="p-line">
            <span class="p-value" :style="p.over ? { color: COLOR.warn } : undefined">{{ p.value }}</span>
            <span class="p-unit">{{ p.unit }}</span>
          </span>
        </div>
      </div>
    </PanelCard>

    <PanelCard title="监测排名" grow>
      <template #extra>
        <SegmentedTabs :model-value="tab" :options="TABS" label="排名对象" @update:model-value="tab = $event as typeof tab" />
      </template>
      <div class="rank-note">{{ meta.name }}{{ meta.unit ? ' ' + meta.unit : '' }} · 由高到低</div>
      <!-- 监测站点：可点击，飞到站点并打开站点卡片 -->
      <div v-if="tab === 'station'" class="list scroll">
        <button v-for="r in stations" :key="r.station.id" type="button" class="row" :class="{ active: r.station.id === activeStation }" @click="emit('station', r.station.id)">
          <i class="dot" :style="{ background: airColor(r.reading.level) }"></i>
          <span class="main">
            <span class="name">{{ r.station.name }}</span>
            <span class="sub">{{ r.station.districtName }} · {{ r.station.kind }}</span>
          </span>
          <span class="value">{{ r.reading.value }}</span>
          <span class="status" :style="{ color: airColor(r.reading.level) }">{{ AIR_LEVEL_SHORT[r.reading.level] }}</span>
        </button>
      </div>
      <div v-else class="rows">
        <BarRow v-for="r in rankRows" :key="r.id" :name="r.name" :value="r.value" :percent="r.percent" :color="r.color" :note="r.note" :note-color="r.color" />
      </div>
    </PanelCard>

    <PanelCard :title="'24 小时 ' + meta.name">
      <template #extra>
        <span class="chart-legend">全岛均值 <i class="dashed"></i>{{ meta.limitName }} {{ meta.limit }}</span>
      </template>
      <LineChart class="bars" :option="chartOption" :label="meta.name + ' 全岛均值二十四小时柱状图'" />
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import {
  AIR_INDEXES,
  AIR_LEVEL_NAMES,
  AIR_LEVEL_SHORT,
  airLevel,
  aqiOf,
  cityConcentrationsAt,
  cityHourly,
  districtReadingsAt,
  formatHour,
  isOverLimit,
  pollutantName,
  POLLUTANTS,
  stationReadingsAt
} from '@/api/mock/environment'
import { COLOR } from '@/scene/kit'
import type { AirIndex, EnvironmentData } from '@/types/environment'
import { computed, ref } from 'vue'
import { airColor } from './EnvironmentScene'

const props = defineProps<{ data: EnvironmentData; hour: number; index: AirIndex; activeStation: string | null }>()
const emit = defineEmits<{ (e: 'station', id: string): void }>()

const TABS = [
  { key: 'station', name: '站点' },
  { key: 'district', name: '片区' }
] as const
const tab = ref<(typeof TABS)[number]['key']>('station')

const meta = computed(() => AIR_INDEXES.find(i => i.key === props.index) ?? AIR_INDEXES[0])

/** 全岛均值：浓度、AQI、首要污染物 */
const city = computed(() => {
  const c = cityConcentrationsAt(props.data, props.hour)
  return { c, ...aqiOf(c) }
})
const cityLevel = computed(() => airLevel(city.value.aqi))
const primaryName = computed(() => pollutantName(city.value.primary))
const goodDayRatio = computed(() => ((props.data.goodDays.good / props.data.goodDays.total) * 100).toFixed(1))

const pollutants = computed(() =>
  POLLUTANTS.map(p => {
    const v = city.value.c[p.key]
    return { ...p, value: p.key === 'co' ? v.toFixed(1) : v, over: isOverLimit(p.key, v) }
  })
)

const stations = computed(() => stationReadingsAt(props.data, props.hour, props.index))

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

const hourly = computed(() => cityHourly(props.data, props.index))

/** 逐小时柱状图：柱子按等级着色（和场景片区同色），虚线为限值，竖线和高亮柱为所选时刻 */
const chartOption = computed(() => {
  const limit = meta.value.limit
  const top = Math.max(limit, ...hourly.value.map(p => p.value))
  const max = Math.ceil((top * 1.15) / 50) * 50
  const current = Math.min(23, Math.floor(props.hour))
  return {
    animation: false,
    grid: { left: 36, right: 8, top: 20, bottom: 24 },
    xAxis: {
      type: 'category',
      data: hourly.value.map(p => String(p.hour).padStart(2, '0')),
      axisLabel: { color: '#9aa4b2', fontSize: 12, interval: 3 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value', min: 0, max, interval: max / 3,
      axisLabel: { color: '#9aa4b2', fontSize: 12 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }
    },
    series: [
      {
        type: 'bar',
        barWidth: '60%',
        data: hourly.value.map(p => ({
          value: p.value,
          itemStyle: { color: airColor(p.level), opacity: p.hour === current ? 1 : 0.6, borderRadius: [2, 2, 0, 0] }
        })),
        markLine: {
          symbol: 'none', silent: true,
          data: [
            { yAxis: limit, lineStyle: { color: COLOR.warn, type: 'dashed', width: 1 }, label: { show: false } },
            // 所选时刻：竖线 + 读数
            {
              xAxis: current,
              lineStyle: { color: 'rgba(255,255,255,0.5)', type: 'solid', width: 1 },
              label: { color: '#f3f5f8', fontSize: 12, position: 'end', formatter: formatHour(props.hour) + '  ' + hourly.value[current].value }
            }
          ]
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
.headline {
  display: flex;
  align-items: center;
  gap: 16px;
}
.aqi {
  font-size: 48px;
  font-weight: 600;
  line-height: 56px;
  color: $text-strong;
}
.headline-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.level {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  color: $text;
}
.primary {
  font-size: $fs-aux;
  color: $text-muted;
}
.pollutants {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 16px;
}
.pollutant {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 12px;
  border-top: 1px solid $divider;
}
.p-name {
  font-size: $fs-aux;
  color: $text-muted;
}
.p-line {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.p-value {
  font-size: 20px;
  font-weight: 600;
  color: $text-strong;
}
.p-unit {
  font-size: 12px;
  color: $text-muted;
}
.rank-note {
  margin-top: -8px;
  font-size: $fs-aux;
  color: $text-muted;
}
.list {
  display: flex;
  flex-direction: column;
  &.scroll {
    flex-grow: 1;
    min-height: 0;
    // 让出滚动条的位置，不压住右侧的数值
    margin-right: -8px;
    padding-right: 8px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: $border-strong transparent;
  }
}
.row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 4px 8px;
  margin: 0 0 0 -8px;
  border: 0;
  border-top: 1px solid $divider;
  border-radius: $radius-sm;
  text-align: left;
  font-family: inherit;
  color: $text;
  background: transparent;
  cursor: pointer;
  &.active {
    background: rgba(76, 154, 255, 0.14);
  }
}
.dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.row .dot {
  width: 10px;
  height: 10px;
}
.main {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.name {
  font-size: $fs-body;
  color: $text-strong;
}
.name,
.sub {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub {
  font-size: $fs-aux;
  color: $text-muted;
}
.value {
  flex-shrink: 0;
  width: 36px;
  text-align: right;
  font-size: 16px;
  font-weight: 600;
  color: $text-strong;
}
.status {
  flex-shrink: 0;
  width: 32px;
  text-align: right;
  font-size: $fs-aux;
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
// 多写一层选择器，压过 LineChart 自带的高度
.environment-left .bars {
  height: 200px;
}
</style>
