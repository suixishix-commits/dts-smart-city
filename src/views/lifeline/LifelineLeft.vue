<template>
  <aside class="lifeline-left">
    <!-- 运行总览和管网规模：都是系统的「家底」数字，放在同一张卡片里切换 -->
    <PanelCard title="运行总览">
      <template #extra>
        <SegmentedTabs v-model="overviewTab" :options="OVERVIEW_TABS" label="总览视角" />
      </template>
      <div v-if="overviewTab === 'summary'" class="vitals">
        <StatItem label="在线监测点" :value="data.summary.sensors.toLocaleString()" unit="个" size="lg" />
        <StatItem label="今日告警" :value="data.summary.alarmsToday" unit="条" size="lg" :color="LEVEL_COLOR[topLevel]" />
        <StatItem label="设施完好率" :value="data.summary.integrity.toFixed(1)" unit="%" size="lg" />
      </div>
      <template v-else>
        <div class="list-note">合计 {{ data.summary.totalKm.toFixed(1) }} km · 含区域供冷 {{ data.summary.kmBySystem.cooling.toFixed(1) }} km</div>
        <!-- 各系统管线长度占比：环形图（颜色同场景里的管线），中间是总长 -->
        <div class="scale-split">
          <LineChart class="scale-donut" :option="scaleOption" :height="112" :label="SCALE.map(s => s.name + ' ' + data.summary.kmBySystem[s.key].toFixed(1) + ' km').join('，')" />
          <ul class="scale-legend">
            <li v-for="s in SCALE" :key="s.key">
              <i :style="{ background: PIPE_COLOR[s.key] }"></i>
              <span class="s-name">{{ s.name }}</span>
              <b>{{ data.summary.kmBySystem[s.key].toFixed(1) }}</b>
              <span class="s-unit">km</span>
            </li>
          </ul>
        </div>
      </template>
      <div class="list-note time">数据时刻 {{ formatHour(data.hour) }}</div>
    </PanelCard>

    <PanelCard title="分系统状态" extra="关键指标 · 状态">
      <div class="systems">
        <div v-for="s in data.systems" :key="s.key" class="system">
          <i class="swatch" :class="s.key" :style="{ borderTopColor: PIPE_COLOR[s.key] }"></i>
          <span class="main">
            <span class="name">{{ s.name }}</span>
            <span class="sub">{{ s.note }}</span>
          </span>
          <span class="metric">
            <span class="sub">{{ s.metric }}</span>
            <span class="value"
              ><b>{{ s.value }}</b
              >{{ s.unit }}</span
            >
          </span>
          <span class="tag" :style="tagStyle(s.level)">{{ s.status }}</span>
        </div>
      </div>
    </PanelCard>

    <!-- 供水量和压力 / 负荷两条 24 小时曲线，用页签切换 -->
    <PanelCard title="运行趋势" grow>
      <template #extra>
        <SegmentedTabs v-model="trendTab" :options="TREND_TABS" label="趋势指标" />
      </template>
      <template v-if="trendTab === 'supply'">
        <div class="chart-stats">
          <StatItem label="今日累计" :value="data.supply.todayTotal.toFixed(1)" unit="万 m³" />
          <StatItem label="当前供水" :value="currentSupply.toFixed(1)" unit="万 m³/时" />
          <StatItem label="较昨日同时" :value="(supplyDelta > 0 ? '+' : '') + supplyDelta.toFixed(1)" unit="%" />
        </div>
        <span class="legend"><i></i>今日 <i class="yesterday"></i>昨日</span>
        <LineChart class="chart" :option="supplyOption" label="今日与昨日逐时供水量曲线" />
      </template>
      <template v-else>
        <div class="chart-stats">
          <StatItem label="当前出厂压力" :value="waterPressureAt(data.hour).toFixed(2)" unit="MPa" />
          <StatItem label="当前负荷" :value="Math.round(powerLoadAt(data.hour))" unit="MW" />
          <StatItem label="预计晚高峰" :value="peak.value" :unit="'MW · ' + formatHour(peak.hour)" />
        </div>
        <span class="legend"><i class="pressure"></i>压力 MPa <i class="load"></i>负荷 MW</span>
        <LineChart class="chart" :option="chartOption" label="二十四小时供水压力与用电负荷曲线" />
      </template>
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { NUM_FONT } from '@/components/chart/chartTheme'
import { lifelineSeries, powerLoadAt, powerLoadPeak, waterPressureAt } from '@/api/mock/lifeline'
import { COLOR, LEVEL_COLOR } from '@/scene/kit'
import type { LifelineData, PipeSystem } from '@/types/lifeline'
import { computed, ref } from 'vue'
import { PIPE_COLOR } from './LifelineScene'

const props = defineProps<{ data: LifelineData }>()

const OVERVIEW_TABS = [
  { key: 'summary', name: '概况' },
  { key: 'scale', name: '管网规模' }
]
const TREND_TABS = [
  { key: 'supply', name: '供水量' },
  { key: 'pressure', name: '压力与负荷' }
]
const overviewTab = ref('summary')

/** 管网规模环形图 */
const scaleOption = computed(() => ({
  title: {
    text: props.data.summary.totalKm.toFixed(0),
    subtext: 'km',
    left: 'center',
    top: '32%',
    itemGap: 0,
    textStyle: { color: '#f3f5f8', fontSize: 20, fontWeight: 600, fontFamily: NUM_FONT },
    subtextStyle: { color: '#9aa4b2', fontSize: 11 }
  },
  series: [
    {
      type: 'pie',
      radius: ['70%', '92%'],
      padAngle: 2,
      itemStyle: { borderRadius: 2 },
      label: { show: false },
      data: SCALE.map(s => ({ name: s.name, value: props.data.summary.kmBySystem[s.key], itemStyle: { color: PIPE_COLOR[s.key], shadowColor: PIPE_COLOR[s.key], shadowBlur: 8 } }))
    }
  ]
}))
const trendTab = ref('supply')

/** 管网规模卡片列出的四张管网 */
const SCALE: { key: PipeSystem; name: string }[] = [
  { key: 'water', name: '供水' },
  { key: 'power', name: '电力' },
  { key: 'gas', name: '燃气' },
  { key: 'drain', name: '排水' }
]

/** 当前（最近一个整点）的供水量，万 m³/时 */
const currentSupply = computed(() => props.data.supply.today[props.data.supply.today.length - 1]?.[1] ?? 0)
/** 今日累计较昨日同一时刻的变化，% */
const supplyDelta = computed(() => {
  const { todayTotal, yesterdaySameTime } = props.data.supply
  return yesterdaySameTime ? ((todayTotal - yesterdaySameTime) / yesterdaySameTime) * 100 : 0
})

const supplyOption = computed(() => {
  const axisLabel = { color: '#9aa4b2', fontSize: 12 }
  return {
    animation: false,
    grid: { left: 32, right: 12, top: 16, bottom: 24 },
    xAxis: {
      type: 'value', min: 0, max: 24, interval: 4,
      axisLabel: { ...axisLabel, formatter: (v: number) => String(v).padStart(2, '0') },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      axisTick: { show: false },
      splitLine: { show: false }
    },
    yAxis: { type: 'value', min: 0, max: 4, interval: 1, axisLabel: { ...axisLabel, formatter: (v: number) => v.toFixed(1) }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } } },
    series: [
      { name: '昨日', type: 'line', data: props.data.supply.yesterday, showSymbol: false, lineStyle: { color: COLOR.muted, width: 1.5, type: 'dashed' } },
      {
        name: '今日',
        type: 'line',
        data: props.data.supply.today,
        showSymbol: false,
        lineStyle: { color: COLOR.accent, width: 2 },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(76,154,255,0.32)' }, { offset: 1, color: 'rgba(76,154,255,0)' }] }
        }
      }
    ]
  }
})

const series = lifelineSeries()
const peak = powerLoadPeak()

function formatHour(hour: number): string {
  const h = Math.floor(hour)
  return String(h).padStart(2, '0') + ':' + String(Math.round((hour - h) * 60)).padStart(2, '0')
}

/** 今日告警里最严重的等级，决定数字的颜色 */
const topLevel = computed(() => Math.min(4, ...props.data.alarms.map(a => a.level)))

function tagStyle(level: number) {
  const color = level === 0 ? COLOR.ok : LEVEL_COLOR[level]
  return { color, borderColor: color }
}

const chartOption = computed(() => {
  const now = props.data.hour
  const axisLabel = { color: '#9aa4b2', fontSize: 12 }
  // 实线是今日实测，虚线是预测
  const line = (name: string, points: [number, number][], color: string, yAxisIndex: number) => [
    { name, type: 'line', yAxisIndex, data: points.filter(p => p[0] <= now), showSymbol: false, lineStyle: { color, width: 2 } },
    { name: name + '（预测）', type: 'line', yAxisIndex, data: points.filter(p => p[0] >= now), showSymbol: false, lineStyle: { color, width: 2, type: 'dashed' } }
  ]
  const [pressure, pressureNext] = line('供水压力', series.pressure, COLOR.accent, 0)
  const [load, loadNext] = line('用电负荷', series.load, COLOR.ice, 1)
  return {
    animation: false,
    grid: { left: 40, right: 44, top: 20, bottom: 24 },
    xAxis: {
      type: 'value', min: 0, max: 24, interval: 6,
      axisLabel: { ...axisLabel, formatter: (v: number) => String(v).padStart(2, '0') },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      axisTick: { show: false },
      splitLine: { show: false }
    },
    yAxis: [
      { type: 'value', min: 0.2, max: 0.4, interval: 0.05, axisLabel: { ...axisLabel, formatter: (v: number) => v.toFixed(2) }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } } },
      { type: 'value', min: 400, max: 1200, interval: 200, axisLabel, splitLine: { show: false } }
    ],
    series: [
      {
        ...pressure,
        markLine: {
          symbol: 'none', silent: true,
          lineStyle: { color: 'rgba(255,255,255,0.5)', type: 'solid', width: 1 },
          label: { color: '#9aa4b2', fontSize: 12, formatter: formatHour(now) },
          data: [{ xAxis: now }]
        }
      },
      pressureNext,
      load,
      {
        ...loadNext,
        markPoint: {
          symbol: 'circle', symbolSize: 8,
          itemStyle: { color: '#10151c', borderColor: COLOR.ice, borderWidth: 2 },
          label: { color: '#f3f5f8', fontSize: 12, position: 'top', formatter: '峰值 ' + peak.value },
          data: [{ coord: [peak.hour, peak.value] }]
        }
      }
    ]
  }
})
</script>

<style lang="scss" scoped>
.lifeline-left {
  position: absolute;
  left: $page-margin;
  top: $panel-top;
  width: $panel-width;
  height: calc(100% - #{$panel-top} - #{$page-margin});
  display: flex;
  flex-direction: column;
  gap: $panel-gap;
}
.vitals {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.scale {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.scale-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.systems {
  display: flex;
  flex-direction: column;
  margin-top: -8px;
}
.system {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  border-top: 1px solid $divider;
}
.swatch {
  flex-shrink: 0;
  width: 16px;
  height: 0;
  border-top: 3px solid $accent;
  // 电力和燃气在场景里是流动虚线
  &.power,
  &.gas {
    border-top-style: dashed;
  }
}
.main,
.metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.main {
  flex-grow: 1;
  min-width: 0;
}
.metric {
  flex-shrink: 0;
  width: 132px;
}
.name {
  font-size: $fs-body;
  color: $text-strong;
}
.sub {
  font-size: $fs-aux;
  color: $text-muted;
}
.value {
  font-size: $fs-aux;
  color: $text-muted;
  b {
    margin-right: 4px;
    font-size: 18px;
    font-weight: 600;
    color: $text-strong;
  }
}
.tag {
  flex-shrink: 0;
  width: 44px;
  height: 22px;
  box-sizing: border-box;
  border: 1px solid $ok;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}
.chart-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
// 左栏有四张卡片，内容超出时面板整体滚动，图表固定高度
.lifeline-left .chart {
  height: 160px;
}
.legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin: -6px 0 -16px;
  font-size: $fs-aux;
  color: $text-muted;
  i {
    display: inline-block;
    width: 12px;
    height: 0;
    margin-left: 6px;
    border-top: 2px solid $accent;
    &.load {
      border-top-color: #dbe9ff;
    }
    &.yesterday {
      border-top: 2px dashed #9aa4b2;
    }
  }
}
.list-note {
  margin-top: -6px;
  font-size: $fs-aux;
  color: $text-muted;
  &.time {
    margin: -6px 0 0;
    text-align: right;
  }
}
.scale-split {
  display: flex;
  align-items: center;
  gap: 16px;
  .scale-donut {
    width: 112px;
    flex-shrink: 0;
  }
}
.scale-legend {
  flex-grow: 1;
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
  li {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: $fs-aux;
    color: $text-muted;
  }
  i {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    align-self: center;
  }
  .s-name {
    flex-grow: 1;
  }
  b {
    font-family: $font-num;
    font-size: 16px;
    font-weight: 600;
    color: $text-strong;
  }
}
</style>
