<template>
  <aside class="traffic-left">
    <PanelCard title="路网运行" :extra="formatHour(hour) + ' · ' + CONGESTION_TEXT[stats.level]">
      <div class="vitals">
        <StatItem label="拥堵指数" :value="stats.index.toFixed(2)" :unit="CONGESTION_TEXT[stats.level]" size="lg" :color="stats.level > 0 ? STATUS_RAMP[stats.level] : undefined" />
        <StatItem label="平均车速" :value="stats.speed.toFixed(1)" unit="km/h" size="lg" />
        <StatItem label="在途车辆" :value="stats.vehicles.toLocaleString()" unit="辆" size="lg" />
        <StatItem label="公交准点率" :value="stats.busOnTime.toFixed(1)" unit="%" size="lg" />
      </div>
    </PanelCard>

    <PanelCard title="24 小时拥堵指数">
      <template #extra>
        <span class="legend"><i class="solid"></i>今日 <i class="dashed"></i>预测</span>
      </template>
      <div class="day-stats">
        <StatItem label="今日峰值" :value="peak.value.toFixed(2)" :unit="formatHour(peak.hour)" :color="STATUS_RAMP[congestionLevel(peak.value)]" />
        <StatItem label="拥堵路段" :value="jammed.count" :unit="'条 / ' + data.segments.length" />
        <StatItem label="拥堵里程" :value="jammed.km.toFixed(1)" unit="km" />
      </div>
      <LineChart :option="chartOption" label="今日路网拥堵指数二十四小时曲线" />
    </PanelCard>

    <PanelCard title="拥堵路段排行" extra="前 6 · 拥堵指数 · 车速 km/h" grow>
      <div class="rows">
        <button v-for="r in ranking" :key="r.id" type="button" class="row" :class="{ active: r.id === activeSegment }" :title="r.name" @click="emit('segment', r.id)">
          <BarRow :name="r.name" :value="r.value" :percent="r.percent" :color="r.color" :note="r.speed" />
        </button>
      </div>
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { congestionAt, congestionLevel, CONGESTION_TEXT, networkPeak, networkSeries, networkStatsAt, rankSegmentsAt } from '@/api/mock/traffic'
import { STATUS_RAMP } from '@/scene/kit'
import type { TrafficData } from '@/types/traffic'
import { computed } from 'vue'

const props = defineProps<{ data: TrafficData; hour: number; nowHour: number; activeSegment: string | null }>()
const emit = defineEmits<{ (e: 'segment', id: string): void }>()

function formatHour(hour: number): string {
  const h = Math.floor(hour)
  return String(h).padStart(2, '0') + ':' + String(Math.round((hour - h) * 60)).padStart(2, '0')
}

const series = computed(() => networkSeries(props.data.segments))
const peak = computed(() => networkPeak(props.data.segments))
const stats = computed(() => networkStatsAt(props.data.segments, props.hour))

/** 所选时刻处于拥堵、严重拥堵的路段数和里程 */
const jammed = computed(() => {
  const list = props.data.segments.filter(s => congestionLevel(congestionAt(s, props.hour)) >= 2)
  return { count: list.length, km: list.reduce((n, s) => n + s.lengthKm, 0) }
})

// 颜色与场景里路段的颜色一致（同一个等级 → STATUS_RAMP 的同一档）
const ranking = computed(() =>
  rankSegmentsAt(props.data.segments, props.hour, 6).map(r => ({
    id: r.segment.id,
    name: r.segment.name,
    value: r.index.toFixed(2),
    percent: Math.round(((r.index - 1) / 2.4) * 100),
    color: STATUS_RAMP[r.level],
    speed: String(Math.round(r.speed))
  }))
)

const chartOption = computed(() => {
  const past = series.value.filter(p => p[0] <= props.nowHour)
  const future = series.value.filter(p => p[0] >= props.nowHour)
  return {
    animation: false,
    grid: { left: 36, right: 8, top: 16, bottom: 24 },
    xAxis: {
      type: 'value', min: 0, max: 24, interval: 6,
      axisLabel: { color: '#8b9aa3', fontSize: 12, formatter: (v: number) => String(v).padStart(2, '0') },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      axisTick: { show: false },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value', min: 1, max: 2.5, interval: 0.5,
      axisLabel: { color: '#8b9aa3', fontSize: 12, formatter: (v: number) => v.toFixed(1) },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }
    },
    series: [
      {
        type: 'line', data: past, showSymbol: false,
        lineStyle: { color: '#4cc4d4', width: 2 },
        markLine: {
          symbol: 'none', silent: true,
          lineStyle: { color: 'rgba(255,255,255,0.5)', type: 'solid', width: 1 },
          label: { color: '#8b9aa3', fontSize: 12, formatter: formatHour(props.hour) },
          data: [{ xAxis: props.hour }]
        }
      },
      {
        type: 'line', data: future, showSymbol: false,
        lineStyle: { color: '#4cc4d4', width: 2, type: 'dashed' },
        markPoint: {
          symbol: 'circle', symbolSize: 8,
          itemStyle: { color: '#10151c', borderColor: '#e8b04f', borderWidth: 2 },
          label: { color: '#eef5f8', fontSize: 12, position: 'top', formatter: '峰值 ' + peak.value.value.toFixed(2) },
          data: [{ coord: [peak.value.hour, peak.value.value] }]
        }
      }
    ]
  }
})
</script>

<style lang="scss" scoped>
.traffic-left {
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
.day-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.rows {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 4px;
  margin: -6px 0;
  // 窗口比 16:9 更高时面板会变长，限制行距不让列表被拉散
  max-height: 320px;
}
.row {
  display: block;
  width: calc(100% + 16px);
  min-height: 40px;
  padding: 0 8px;
  margin: 0 -8px;
  border: 0;
  border-radius: $radius-sm;
  text-align: left;
  font-family: inherit;
  background: transparent;
  cursor: pointer;
  &.active {
    background: rgba(76, 196, 212, 0.14);
  }
  // 路段名比片区名长得多：加宽名称列，放不下时省略（完整名称在 title 里）
  :deep(.name) {
    width: 216px;
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :deep(.value) {
    width: 34px;
  }
  :deep(.note) {
    width: 24px;
  }
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
    &.dashed {
      border-top-style: dashed;
    }
  }
}
</style>
