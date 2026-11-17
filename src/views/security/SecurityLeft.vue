<template>
  <aside class="security-left">
    <!-- 今日事件的概况和处置流程（漏斗）放在同一张卡片里切换 -->
    <PanelCard title="今日事件">
      <template #extra>
        <SegmentedTabs v-model="eventTab" :options="EVENT_TABS" label="今日事件视角" />
      </template>
      <div v-if="eventTab === 'flow'" class="list-note">占上报 · 处置时限 {{ EVENT_TIME_LIMIT }} 分钟</div>
      <div v-if="eventTab === 'flow'" class="flow">
        <div v-for="(f, i) in flow" :key="f.name" class="step">
          <span class="bar" :style="{ background: COLOR.accent, opacity: FLOW_OPACITY[i] }"></span>
          <span class="step-name">{{ f.name }}</span>
          <span class="step-value">{{ f.count }}</span>
          <span class="step-rate">{{ (f.rate * 100).toFixed(1) }}%</span>
        </div>
      </div>
      <div v-else class="vitals">
        <StatItem label="上报" :value="summary.reported" />
        <StatItem label="处置中" :value="summary.active" />
        <StatItem label="已办结" :value="summary.closed" />
        <StatItem label="超时" :value="summary.overdue" :color="COLOR.warn" />
      </div>
      <div v-if="eventTab === 'summary'" class="force">
        <span>在办警情 <b :style="activeCount ? { color: COLOR.warn } : undefined">{{ activeCount }}</b> 起</span>
        <span>平均到场 <b>{{ data.avgArriveMinutes.toFixed(1) }}</b> 分钟</span>
        <span>在线警力 <b>{{ data.onlineForce }}</b> 人</span>
      </div>
    </PanelCard>

    <PanelCard title="警情趋势">
      <template #extra>
        <span class="legend"><i class="solid"></i>{{ trend.currentName }} <i class="dashed"></i>{{ trend.previousName }}</span>
      </template>
      <div class="trend-stats">
        <StatItem :label="trend.currentName + '合计'" :value="currentTotal" unit="起" />
        <StatItem :label="trend.previousName + '同期'" :value="previousTotal" unit="起" />
        <StatItem label="变化" :value="changeText" :color="change > 0 ? COLOR.warn : COLOR.ok" />
      </div>
      <LineChart :option="chartOption" :label="trend.currentName + '警情数量趋势，对比' + trend.previousName" />
    </PanelCard>

    <!-- 类型分布和部门效率：都是对警情的统计分析 -->
    <PanelCard title="警情分析" grow>
      <template #extra>
        <SegmentedTabs v-model="statTab" :options="STAT_TABS" label="分析视角" />
      </template>
      <div v-if="statTab === 'type'" class="list-note">{{ trend.currentName }} · 占比 · 起数</div>
      <div v-else class="list-note">平均处置时长 · 分钟 · 超 {{ DEPT_WARN_MINUTES }} 标黄</div>
      <div v-if="statTab === 'type'" class="rows">
        <BarRow v-for="r in typeRows" :key="r.name" :name="r.name" :value="r.share" :percent="r.percent" :color="COLOR.accent" :note="r.count" />
      </div>
      <div v-else class="rows">
        <BarRow
          v-for="d in data.eventStats.departments"
          :key="d.department"
          :name="d.department"
          :value="d.avgMinutes"
          :percent="(d.avgMinutes / DEPT_SCALE) * 100"
          :color="d.avgMinutes > DEPT_WARN_MINUTES ? COLOR.warn : COLOR.accent"
          :note="d.events + ' 件'"
        />
      </div>
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { DEPT_WARN_MINUTES, EVENT_TIME_LIMIT, incidentTrend, isActive, typeDistribution } from '@/api/mock/security'
import { COLOR } from '@/scene/kit'
import type { SecurityData, SecurityPeriod } from '@/types/security'
import { computed, ref } from 'vue'

const props = defineProps<{ data: SecurityData; period: SecurityPeriod; nowHour: number }>()

const EVENT_TABS = [
  { key: 'summary', name: '概况' },
  { key: 'flow', name: '处置流程' }
]
const STAT_TABS = [
  { key: 'type', name: '类型分布' },
  { key: 'dept', name: '部门效率' }
]
const eventTab = ref('summary')
const statTab = ref('type')

const summary = computed(() => props.data.eventStats.summary)
const flow = computed(() => props.data.eventStats.flow)
/** 漏斗四步的色条透明度，越往后越淡 */
const FLOW_OPACITY = [1, 0.8, 0.6, 0.45]
/** 部门效率条的满格，分钟 */
const DEPT_SCALE = 60
const activeCount = computed(() => props.data.incidents.filter(isActive).length)

const trend = computed(() => incidentTrend(props.period, props.nowHour))
/** 本期已有数据的点数：今日只到当前小时，对比期取同样长度才可比 */
const comparable = computed(() => trend.value.current.filter(v => v !== null).length)
const currentTotal = computed(() => trend.value.current.reduce<number>((n, v) => n + (v ?? 0), 0))
const previousTotal = computed(() => (props.period === 'today' ? trend.value.previous.slice(0, comparable.value) : trend.value.previous).reduce((n, v) => n + v, 0))
const change = computed(() => (previousTotal.value ? (currentTotal.value - previousTotal.value) / previousTotal.value : 0))
const changeText = computed(() => (change.value >= 0 ? '+' : '') + (change.value * 100).toFixed(1) + '%')

const typeRows = computed(() => {
  const rows = typeDistribution(props.period, props.nowHour)
  const total = rows.reduce((n, r) => n + r.count, 0) || 1
  const max = Math.max(...rows.map(r => r.count), 1)
  return rows.map(r => ({ name: r.type, share: Math.round((r.count / total) * 100) + '%', percent: Math.round((r.count / max) * 100), count: String(r.count) }))
})

const chartOption = computed(() => {
  const t = trend.value
  // 横轴标签：今日每 6 小时一个，近 7 日每天一个，近 30 日每 5 天一个
  const interval = props.period === 'today' ? 5 : props.period === 'week' ? 0 : 4
  return {
    animation: false,
    grid: { left: 36, right: 16, top: 16, bottom: 24 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(17,22,30,0.96)',
      borderColor: 'rgba(255,255,255,0.14)',
      textStyle: { color: '#e6eaf0', fontSize: 12 }
    },
    xAxis: {
      type: 'category',
      data: t.labels,
      boundaryGap: false,
      axisLabel: { color: '#9aa4b2', fontSize: 12, interval },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitNumber: 3,
      axisLabel: { color: '#9aa4b2', fontSize: 12 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }
    },
    series: [
      { name: t.previousName, type: 'line', data: t.previous, showSymbol: false, lineStyle: { color: COLOR.muted, width: 1.5, type: 'dashed' }, itemStyle: { color: COLOR.muted } },
      { name: t.currentName, type: 'line', data: t.current, showSymbol: false, lineStyle: { color: COLOR.accent, width: 2 }, itemStyle: { color: COLOR.accent }, areaStyle: { color: 'rgba(76,196,212,0.12)' } }
    ]
  }
})
</script>

<style lang="scss" scoped>
.security-left {
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.force {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid $divider;
  font-size: 12px;
  color: $text-muted;
  white-space: nowrap;
  b {
    font-size: $fs-body;
    font-weight: 600;
    color: $text-strong;
  }
}
.flow {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.step {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bar {
  height: 4px;
  border-radius: 2px;
}
.step-name,
.step-rate {
  font-size: 12px;
  color: $text-muted;
}
.step-name {
  font-size: $fs-body;
}
.step-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 28px;
  color: $text-strong;
}
.trend-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
      border-top: 2px dashed $text-muted;
    }
  }
}
.list-note {
  margin: -8px 0 -4px;
  font-size: $fs-aux;
  color: $text-muted;
}
</style>
