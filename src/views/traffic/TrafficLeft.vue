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

    <!-- 两条 24 小时曲线放在同一张卡片里，用页签切换 -->
    <PanelCard title="路网趋势">
      <template #extra>
        <SegmentedTabs v-model="trend" :options="TREND_TABS" label="趋势指标" />
      </template>
      <template v-if="trend === 'index'">
        <div class="day-stats">
          <StatItem label="今日峰值" :value="peak.value.toFixed(2)" :unit="formatHour(peak.hour)" :color="STATUS_RAMP[congestionLevel(peak.value)]" />
          <StatItem label="拥堵路段" :value="jammed.count" :unit="'条 / ' + data.segments.length" />
          <StatItem label="拥堵里程" :value="jammed.km.toFixed(1)" unit="km" />
        </div>
        <span class="legend"><i class="solid"></i>今日 <i class="dashed"></i>预测</span>
        <LineChart :option="chartOption" label="今日路网拥堵指数二十四小时曲线" />
      </template>
      <template v-else>
        <div class="day-stats">
          <StatItem :label="formatHour(nowFlowHour) + ' 车流'" :value="flowNow.toLocaleString()" unit="辆/时" />
          <StatItem label="较昨日同时" :value="(flowDiff >= 0 ? '+' : '') + flowDiff.toFixed(1)" unit="%" />
          <StatItem label="今日峰值" :value="flowPeak.value.toLocaleString()" :unit="formatHour(flowPeak.hour)" />
        </div>
        <span class="legend"><i class="solid"></i>今日 <i class="dashed"></i>预测 <i class="past"></i>昨日</span>
        <LineChart :option="flowOption" label="今日与昨日分时车流量折线图" />
      </template>
    </PanelCard>

    <!-- 拥堵路段和重点车辆共用一张卡片：都是「点了在场景里定位」的清单 -->
    <PanelCard :title="focus === 'segment' ? '拥堵路段排行' : '重点车辆'" grow>
      <template #extra>
        <SegmentedTabs v-model="focus" :options="FOCUS_TABS" label="清单" />
      </template>
      <div v-if="focus === 'segment'" class="list-note">前 6 · 拥堵指数 · 车速 km/h</div>
      <div v-else class="list-note">{{ vehicles.length }} 辆 · {{ formatHour(hour) }} 位置</div>
      <div v-if="focus === 'segment'" class="rows">
        <button v-for="r in ranking" :key="r.id" type="button" class="row" :class="{ active: r.id === activeSegment }" :title="r.name" @click="emit('segment', r.id)">
          <BarRow :name="r.name" :value="r.value" :percent="r.percent" :color="r.color" :note="r.speed" />
        </button>
      </div>
      <div v-else class="vehicles">
        <button v-for="v in vehicles" :key="v.id" type="button" class="vehicle" :class="{ active: v.id === activeVehicle }" :title="v.route + '，' + v.status" @click="emit('vehicle', v.id)">
          <i class="dot" :style="{ background: v.color }"></i>
          <span class="v-main">
            <span class="v-name">{{ v.name }}</span>
            <span class="v-sub">{{ v.where }}</span>
          </span>
          <span class="v-speed">{{ v.speed }}<small> km/h</small></span>
        </button>
      </div>
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { congestionAt, congestionLevel, CONGESTION_TEXT, networkPeak, networkSeries, networkStatsAt, rankSegmentsAt, vehicleStateAt } from '@/api/mock/traffic'
import { COLOR, STATUS_RAMP } from '@/scene/kit'
import type { TrafficData } from '@/types/traffic'
import { computed, ref, watch } from 'vue'
import { VEHICLE_COLOR } from './TrafficScene'

const props = defineProps<{ data: TrafficData; hour: number; nowHour: number; activeSegment: string | null; activeVehicle: string | null }>()
const emit = defineEmits<{ (e: 'segment', id: string): void; (e: 'vehicle', id: string): void }>()

const TREND_TABS = [
  { key: 'index', name: '拥堵指数' },
  { key: 'flow', name: '车流量' }
]
const FOCUS_TABS = [
  { key: 'segment', name: '拥堵路段' },
  { key: 'vehicle', name: '重点车辆' }
]
const trend = ref('index')
const focus = ref('segment')
// 在场景里点了车辆（或别处选中了车辆）时切到车辆清单，选中路段时切回路段
watch(
  () => props.activeVehicle,
  id => {
    if (id) focus.value = 'vehicle'
  }
)
watch(
  () => props.activeSegment,
  id => {
    if (id) focus.value = 'segment'
  }
)

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

/** 重点车辆列表：颜色与场景里的车辆标注一致，位置和车速跟随所选时刻 */
const vehicles = computed(() =>
  props.data.vehicles.map(v => {
    const st = vehicleStateAt(v, props.data.segments, props.hour)
    return { id: v.id, name: v.name, route: v.route, status: v.status, color: VEHICLE_COLOR[v.kind], speed: st.speed, where: st.segmentName + ' · ' + st.heading }
  })
)

/** 分时车流量：今日实线画到当前整点，之后是预测虚线；昨日全天作对照 */
const nowFlowHour = computed(() => Math.min(24, Math.floor(props.nowHour)))
const flowNow = computed(() => props.data.flow.today[nowFlowHour.value])
const flowDiff = computed(() => {
  const y = props.data.flow.yesterday[nowFlowHour.value]
  return y ? ((flowNow.value - y) / y) * 100 : 0
})
const flowPeak = computed(() => props.data.flow.today.reduce((a, v, h) => (v > a.value ? { hour: h, value: v } : a), { hour: 0, value: 0 }))

const flowOption = computed(() => {
  const today = props.data.flow.today.map((v, h) => [h, v])
  const now = nowFlowHour.value
  const k = (v: number) => (v >= 1000 ? Math.round(v / 1000) + 'k' : String(v))
  return {
    animation: false,
    grid: { left: 36, right: 8, top: 24, bottom: 24 },
    xAxis: {
      type: 'value', min: 0, max: 24, interval: 4,
      axisLabel: { color: '#9aa4b2', fontSize: 12, formatter: (v: number) => String(v).padStart(2, '0') },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      axisTick: { show: false },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value', min: 0, splitNumber: 4,
      axisLabel: { color: '#9aa4b2', fontSize: 12, formatter: k },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }
    },
    series: [
      {
        type: 'line', data: props.data.flow.yesterday.map((v, h) => [h, v]), showSymbol: false,
        lineStyle: { color: COLOR.muted, width: 2, opacity: 0.6 }
      },
      {
        type: 'line', data: today.filter(p => p[0] >= now), showSymbol: false,
        lineStyle: { color: COLOR.accent, width: 2, type: 'dashed' }
      },
      {
        type: 'line', data: today.filter(p => p[0] <= now), showSymbol: false,
        lineStyle: { color: COLOR.accent, width: 2 },
        markPoint: {
          symbol: 'circle', symbolSize: 8,
          itemStyle: { color: COLOR.accent },
          label: { color: '#f3f5f8', fontSize: 13, fontWeight: 600, position: 'top', formatter: flowNow.value.toLocaleString() + ' 辆/时' },
          data: [{ coord: [now, flowNow.value] }]
        }
      }
    ]
  }
})

const chartOption = computed(() => {
  const past = series.value.filter(p => p[0] <= props.nowHour)
  const future = series.value.filter(p => p[0] >= props.nowHour)
  return {
    animation: false,
    grid: { left: 36, right: 8, top: 16, bottom: 24 },
    xAxis: {
      type: 'value', min: 0, max: 24, interval: 6,
      axisLabel: { color: '#9aa4b2', fontSize: 12, formatter: (v: number) => String(v).padStart(2, '0') },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      axisTick: { show: false },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value', min: 1, max: 2.5, interval: 0.5,
      axisLabel: { color: '#9aa4b2', fontSize: 12, formatter: (v: number) => v.toFixed(1) },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }
    },
    series: [
      {
        type: 'line', data: past, showSymbol: false,
        lineStyle: { color: '#4c9aff', width: 2 },
        markLine: {
          symbol: 'none', silent: true,
          lineStyle: { color: 'rgba(255,255,255,0.5)', type: 'solid', width: 1 },
          label: { color: '#9aa4b2', fontSize: 12, formatter: formatHour(props.hour) },
          data: [{ xAxis: props.hour }]
        }
      },
      {
        type: 'line', data: future, showSymbol: false,
        lineStyle: { color: '#4c9aff', width: 2, type: 'dashed' },
        markPoint: {
          symbol: 'circle', symbolSize: 8,
          itemStyle: { color: '#10151c', borderColor: '#ffa94d', borderWidth: 2 },
          label: { color: '#f3f5f8', fontSize: 12, position: 'top', formatter: '峰值 ' + peak.value.value.toFixed(2) },
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
  gap: 8px;
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
    background: rgba(76, 154, 255, 0.14);
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
    &.dashed {
      border-top-style: dashed;
    }
    &.past {
      border-top-color: $text-muted;
      opacity: 0.6;
    }
  }
}
.list-note {
  margin-top: -8px;
  font-size: $fs-aux;
  color: $text-muted;
}
.vehicles {
  display: flex;
  flex-direction: column;
  margin: -6px 0;
}
.vehicle {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 2px 8px;
  margin: 0 -8px;
  border: 0;
  border-top: 1px solid $divider;
  border-radius: $radius-sm;
  text-align: left;
  font-family: inherit;
  color: $text;
  background: transparent;
  cursor: pointer;
  &:first-child {
    border-top: 0;
  }
  &.active {
    background: rgba(76, 154, 255, 0.14);
  }
  .dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
}
.v-main {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.v-name {
  font-size: $fs-body;
  color: $text-strong;
}
.v-sub {
  font-size: $fs-aux;
  color: $text-muted;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.v-speed {
  flex-shrink: 0;
  font-size: $fs-body;
  font-weight: 600;
  color: $text-strong;
  small {
    font-size: $fs-aux;
    font-weight: 400;
    color: $text-muted;
  }
}
</style>
