<template>
  <aside class="lifeline-left">
    <PanelCard title="运行总览" :extra="'数据时刻 ' + formatHour(data.hour)">
      <div class="vitals">
        <StatItem label="管网总长" :value="data.summary.totalKm.toFixed(1)" unit="km" size="lg" />
        <StatItem label="在线监测点" :value="data.summary.sensors.toLocaleString()" unit="个" size="lg" />
        <StatItem label="今日告警" :value="data.summary.alarmsToday" unit="条" size="lg" :color="LEVEL_COLOR[topLevel]" />
        <StatItem label="设施完好率" :value="data.summary.integrity.toFixed(1)" unit="%" size="lg" />
      </div>
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

    <PanelCard title="24 小时供水压力与用电负荷" grow>
      <template #extra>
        <span class="legend"><i class="pressure"></i>压力 MPa <i class="load"></i>负荷 MW</span>
      </template>
      <div class="chart-stats">
        <StatItem label="当前出厂压力" :value="waterPressureAt(data.hour).toFixed(2)" unit="MPa" />
        <StatItem label="当前负荷" :value="Math.round(powerLoadAt(data.hour))" unit="MW" />
        <StatItem label="预计晚高峰" :value="peak.value" :unit="'MW · ' + formatHour(peak.hour)" />
      </div>
      <LineChart class="chart" :option="chartOption" label="二十四小时供水压力与用电负荷曲线" />
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { lifelineSeries, powerLoadAt, powerLoadPeak, waterPressureAt } from '@/api/mock/lifeline'
import { COLOR, LEVEL_COLOR } from '@/scene/kit'
import type { LifelineData } from '@/types/lifeline'
import { computed } from 'vue'
import { PIPE_COLOR } from './LifelineScene'

const props = defineProps<{ data: LifelineData }>()

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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 24px;
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
.lifeline-left .chart {
  flex-grow: 1;
  height: auto;
  min-height: 176px;
  // 窗口比 16:9 更高时面板会变长，限制图表高度
  max-height: 300px;
}
.legend {
  display: flex;
  align-items: center;
  gap: 6px;
  i {
    display: inline-block;
    width: 12px;
    height: 0;
    margin-left: 6px;
    border-top: 2px solid $accent;
    &.load {
      border-top-color: #bfe3ff;
    }
  }
}
</style>
