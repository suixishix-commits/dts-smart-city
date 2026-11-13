<template>
  <aside class="security-left">
    <PanelCard title="安全态势" extra="今日">
      <div class="vitals">
        <StatItem label="今日警情" :value="todayTotal" unit="起" size="lg" />
        <StatItem label="处置中" :value="activeCount" unit="起" size="lg" :color="activeCount ? COLOR.warn : undefined" />
        <StatItem label="平均到场时间" :value="data.avgArriveMinutes.toFixed(1)" unit="分钟" size="lg" />
        <StatItem label="在线警力" :value="data.onlineForce" unit="人" size="lg" />
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

    <PanelCard title="警情类型分布" :extra="trend.currentName + ' · 占比 · 起数'" grow>
      <div class="rows">
        <BarRow v-for="r in typeRows" :key="r.name" :name="r.name" :value="r.share" :percent="r.percent" :color="COLOR.accent" :note="r.count" />
      </div>
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { dailyIncidents, incidentTrend, isActive, typeDistribution } from '@/api/mock/security'
import { COLOR } from '@/scene/kit'
import type { SecurityData, SecurityPeriod } from '@/types/security'
import { computed } from 'vue'

const props = defineProps<{ data: SecurityData; period: SecurityPeriod; nowHour: number }>()

const todayTotal = computed(() => dailyIncidents(0, props.nowHour))
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
      { name: t.currentName, type: 'line', data: t.current, showSymbol: false, lineStyle: { color: COLOR.accent, width: 2 }, itemStyle: { color: COLOR.accent }, areaStyle: { color: 'rgba(76,154,255,0.12)' } }
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 24px;
}
.trend-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.rows {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  // 窗口比 16:9 更高时面板会变长，限制行距不让列表被拉散
  max-height: 280px;
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
</style>
