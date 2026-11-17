<template>
  <aside class="overview-left">
    <PanelCard title="城市体征">
      <div class="vitals">
        <StatItem v-for="v in data.vitals" :key="v.label" :label="v.label" :value="v.value" :unit="v.unit" size="lg" />
      </div>
    </PanelCard>

    <PanelCard title="人口密度峰值变化">
      <template #extra>
        <span class="legend"><i class="solid"></i>今日 <i class="dashed"></i>预测 <i class="solid muted"></i>昨日</span>
      </template>
      <div class="pop-stats">
        <StatItem label="所选时刻在岛" :value="current.toFixed(1)" unit="万人" />
        <StatItem label="预计峰值" :value="peak.value.toFixed(1)" :unit="'万 · ' + formatHour(peak.hour)" />
        <StatItem label="最高密度" :value="maxDensity.toFixed(1)" unit="万人/km²" color="#ffa94d" />
      </div>
      <LineChart :option="chartOption" label="今日在岛人口二十四小时曲线" />
    </PanelCard>

    <PanelCard title="片区人口密度" extra="前 8 · 万人/km² · 较 1 小时前" grow>
      <!-- 横向渐变柱：颜色同场景里的密度色带；点柱子下钻到片区 -->
      <LineChart class="density" :option="densityOption" :height="330" label="密度最高的 8 个片区及较 1 小时前的变化" @select="onDensity" />
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { NUM_FONT, TEXT_FONT } from '@/components/chart/chartTheme'
import { districtDensityAt, islandPopulationAt, populationPeak, populationSeries, populationSeriesYesterday } from '@/api/mock/population'
import { rampColor } from '@/scene/kit'
import type { OverviewData } from '@/types/smartCity'
import { computed } from 'vue'

const props = defineProps<{ data: OverviewData; hour: number; nowHour: number; activeDistrict?: string | null }>()
const emit = defineEmits<{ (e: 'district', id: string): void }>()

const peak = populationPeak()
const series = populationSeries()
const yesterday = populationSeriesYesterday()

function formatHour(hour: number): string {
  const h = Math.floor(hour)
  return String(h).padStart(2, '0') + ':' + String(Math.round((hour - h) * 60)).padStart(2, '0')
}

const current = computed(() => islandPopulationAt(props.hour))

const densityRows = computed(() => {
  const rows = props.data.districts.map(d => {
    const v = districtDensityAt(d, props.hour)
    const before = districtDensityAt(d, Math.max(0, props.hour - 1))
    return { id: d.id, name: d.name, v, delta: v - before }
  })
  rows.sort((a, b) => b.v - a.v)
  const max = rows.length ? rows[0].v : 1
  // 面板只列密度最高的 8 个片区；颜色与场景里片区的色带一致
  return rows.slice(0, 8).map(r => ({
    id: r.id,
    name: r.name,
    value: r.v.toFixed(1),
    percent: Math.round((r.v / max) * 100),
    color: rampColor(r.v / 2.8),
    // 变化不到 0.005 时显示「持平」，不出现 -0.00
    delta: Math.abs(r.delta) < 0.005 ? '持平' : (r.delta > 0 ? '+' : '') + r.delta.toFixed(2),
    deltaColor: r.delta > 0.005 ? '#ffa94d' : '#9aa4b2'
  }))
})

/** 片区人口密度：横向柱状图，从上到下由高到低；右侧标签是读数和较 1 小时前的变化 */
const densityOption = computed(() => {
  const rows = [...densityRows.value].reverse()
  const active = props.activeDistrict
  return {
    grid: { left: 78, right: 16, top: 4, bottom: 4 },
    tooltip: { show: false },
    xAxis: { type: 'value', max: Math.max(...densityRows.value.map(r => Number(r.value)), 0.1) * 1.3, show: false },
    yAxis: {
      type: 'category',
      data: rows.map(r => r.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#e6eaf0', fontSize: 14, fontFamily: TEXT_FONT }
    },
    series: [
      {
        type: 'bar',
        barWidth: 10,
        // 柱子背后的浅色轨道
        showBackground: true,
        backgroundStyle: { color: 'rgba(255,255,255,0.05)', borderRadius: 5 },
        data: rows.map(r => ({
          value: Number(r.value),
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: r.color + '40' }, { offset: 1, color: r.color }] },
            borderRadius: 5,
            shadowColor: r.color,
            shadowBlur: r.id === active ? 14 : 6,
            opacity: active && r.id !== active ? 0.4 : 1
          },
          label: {
            show: true,
            position: 'right',
            distance: 10,
            formatter: `{v|${r.value}}  {d|${r.delta}}`,
            rich: {
              v: { color: '#f3f5f8', fontSize: 16, fontWeight: 600, fontFamily: NUM_FONT },
              d: { color: r.deltaColor, fontSize: 13, fontFamily: NUM_FONT }
            }
          }
        }))
      }
    ]
  }
})

function onDensity(item: { dataIndex: number }) {
  const row = [...densityRows.value].reverse()[item.dataIndex]
  if (row) emit('district', row.id)
}

const maxDensity = computed(() => Math.max(...props.data.districts.map(d => districtDensityAt(d, props.hour)), 0))

const chartOption = computed(() => {
  const past = series.filter(p => p[0] <= props.nowHour)
  const future = series.filter(p => p[0] >= props.nowHour)
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
      type: 'value', min: 50, max: 100, interval: 25,
      axisLabel: { color: '#9aa4b2', fontSize: 12 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }
    },
    series: [
      // 昨日放在最底层，灰色细线作对比
      { type: 'line', data: yesterday, showSymbol: false, silent: true, lineStyle: { color: '#5f6b7a', width: 1.5 }, z: 1 },
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
          label: { color: '#f3f5f8', fontSize: 12, position: 'top', formatter: '峰值 ' + peak.value },
          data: [{ coord: [peak.hour, peak.value] }]
        }
      }
    ]
  }
})
</script>

<style lang="scss" scoped>
.overview-left {
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
.pop-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.density {
  flex-grow: 1;
  min-height: 0;
  cursor: pointer;
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
    &.muted {
      border-top-color: #5f6b7a;
    }
  }
}
</style>
