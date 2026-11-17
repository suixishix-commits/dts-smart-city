<template>
  <aside class="environment-right">
    <PanelCard title="近岸海域水质" :extra="'监测点 ' + data.waterSamples.length + ' 个 · 按二类考核'">
      <div class="water-head">
        <span class="rate">{{ water.rate.toFixed(1) }}</span>
        <span class="rate-unit">% 达标率</span>
      </div>
      <!-- 分段条和采样点颜色与场景里水质标注一致：一类、二类、三类、四类 -->
      <div class="stack" aria-hidden="true">
        <span v-for="g in gradeShares" :key="g.grade" :style="{ width: g.share + '%', background: WATER_COLORS[g.grade] }"></span>
      </div>
      <div class="counts">
        <div v-for="c in counts" :key="c.name" class="count">
          <span class="count-name"><i :style="{ background: c.color }"></i>{{ c.name }}</span>
          <span class="count-value">{{ c.value }}</span>
        </div>
      </div>
      <div class="points">
        <button v-for="w in data.waterSamples" :key="w.id" type="button" class="point" :class="{ active: w.id === activeWater }" :title="w.name" @click="emit('water', w.id)">
          <i class="dot" :style="{ background: WATER_COLORS[w.grade] }"></i>
          <span class="point-id">{{ w.id }}</span>
          <span class="point-grade" :style="w.grade >= 3 ? { color: WATER_COLORS[w.grade] } : undefined">{{ WATER_GRADE_NAMES[w.grade] }}</span>
        </button>
      </div>
    </PanelCard>

    <PanelCard title="噪声监测" :extra="'dB(A) / 限值 · 干线达标率 ' + noise.compliance.toFixed(1) + '%'">
      <!-- 各功能区昼、夜两根柱；短横线是限值，超标的柱子用警示色 -->
      <LineChart :option="noiseOption" :height="150" label="各功能区昼间、夜间噪声与限值，dB(A)" />
    </PanelCard>

    <PanelCard title="超标告警" :extra="'当前 ' + alarms.length + ' 条 · 待处置 ' + pending" grow>
      <div class="list scroll">
        <button v-for="a in alarms" :key="a.id" type="button" class="row" :class="{ active: a.id === activeAlarm, done: a.status === '已办结' }" @click="emit('alarm', a.id)">
          <LevelTag :level="a.level" />
          <span class="main">
            <span class="name">{{ a.title }}</span>
            <span class="sub">{{ KIND_NAMES[a.kind] }} · {{ a.note }}</span>
          </span>
          <span class="side">
            <span class="time">{{ a.time }}</span>
            <span class="state" :style="{ color: STATUS_COLOR[a.status] }">{{ a.status }}</span>
          </span>
        </button>
      </div>
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { NUM_FONT, TEXT_FONT } from '@/components/chart/chartTheme'
import { noiseSummary, noiseZoneRows, WATER_GRADE_NAMES, waterDistribution, waterSummary, type NoiseZoneRow } from '@/api/mock/environment'
import { COLOR } from '@/scene/kit'
import type { AlarmKind, EnvAlarm, EnvironmentData } from '@/types/environment'
import { computed } from 'vue'
import { STATUS_COLOR } from './details'
import { WATER_COLORS } from './EnvironmentScene'

const props = defineProps<{ data: EnvironmentData; alarms: EnvAlarm[]; activeWater: string | null; activeAlarm: string | null }>()
const emit = defineEmits<{ (e: 'water', id: string): void; (e: 'alarm', id: string): void }>()

const KIND_NAMES: Record<AlarmKind, string> = { station: '监测站', source: '污染源', water: '水质' }

const water = computed(() => waterSummary(props.data.waterSamples))
const gradeShares = computed(() => {
  const total = props.data.waterSamples.length || 1
  return waterDistribution(props.data.waterSamples).map(g => ({ grade: g.grade, share: (g.count / total) * 100 }))
})
const counts = computed(() => [
  { name: '一类', value: water.value.grade1, color: WATER_COLORS[1] },
  { name: '二类', value: water.value.grade2, color: WATER_COLORS[2] },
  { name: '超标', value: water.value.over, color: WATER_COLORS[4] }
])

const noise = computed(() => noiseSummary(props.data.noisePoints))
/** 功能区昼、夜两行合成一组 */
const zones = computed(() => {
  const groups = new Map<string, NoiseZoneRow[]>()
  for (const r of noiseZoneRows(props.data)) groups.set(r.name, [...(groups.get(r.name) ?? []), r])
  return [...groups].map(([name, rows]) => ({ name, rows }))
})

const NIGHT_COLOR = '#8fc0ff'

const noiseOption = computed(() => {
  const list = zones.value
  const periodRow = (rows: NoiseZoneRow[], period: string) => rows.find(r => r.period === period)
  const bar = (period: string, color: string) => ({
    name: period === '昼' ? '昼间' : '夜间',
    type: 'bar',
    barWidth: 12,
    barGap: '30%',
    color,
    label: { show: true, position: 'top', fontSize: 11, fontFamily: NUM_FONT, color: '#e6eaf0', formatter: (p: { value: number }) => p.value.toFixed(1) },
    data: list.map(z => {
      const r = periodRow(z.rows, period)
      return r ? { value: r.db, itemStyle: r.over ? { color: COLOR.warn } : undefined } : null
    })
  })
  // 限值：每根柱子上方一条短横线
  const limits = (period: string, offset: number) => ({
    name: (period === '昼' ? '昼间' : '夜间') + '限值',
    type: 'scatter',
    symbol: 'rect',
    symbolSize: [16, 2],
    symbolOffset: [offset, 0],
    itemStyle: { color: 'rgba(255,255,255,0.75)' },
    z: 5,
    data: list.map(z => periodRow(z.rows, period)?.limit ?? null)
  })
  return {
    grid: { left: 8, right: 8, top: 26, bottom: 22 },
    xAxis: { type: 'category', data: list.map(z => z.name), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } }, axisTick: { show: false }, axisLabel: { color: '#9aa4b2', fontSize: 12, fontFamily: TEXT_FONT } },
    yAxis: { type: 'value', min: 30, show: false, splitLine: { show: false } },
    series: [bar('昼', COLOR.accent), bar('夜', NIGHT_COLOR), limits('昼', -8), limits('夜', 8)]
  }
})

const pending = computed(() => props.alarms.filter(a => a.status === '待处置').length)
</script>

<style lang="scss" scoped>
.environment-right {
  position: absolute;
  right: $page-margin;
  top: $panel-top;
  width: $panel-width;
  height: calc(100% - #{$panel-top} - #{$page-margin});
  display: flex;
  flex-direction: column;
  gap: $panel-gap;
}
.water-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.rate {
  font-size: 30px;
  font-weight: 600;
  line-height: 36px;
  color: $text-strong;
}
.rate-unit {
  font-size: $fs-body;
  color: $text-muted;
}
.stack {
  display: flex;
  height: 8px;
  gap: 2px;
  border-radius: 4px;
  overflow: hidden;
  span:empty {
    min-width: 0;
  }
}
.counts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.count {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.count-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: $fs-body;
  color: $text-muted;
  i {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }
}
.count-value {
  font-size: 22px;
  font-weight: 600;
  color: $text-strong;
}
.points {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.point {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 6px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  font: inherit;
  font-size: $fs-aux;
  color: $text;
  background: $bg-inset;
  cursor: pointer;
  &.active {
    border-color: $accent;
    background: rgba(76, 154, 255, 0.14);
  }
}
.point-grade {
  color: $text-muted;
}
.noise {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.zone {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: $fs-body;
}
.zone-name {
  flex-shrink: 0;
  width: 64px;
  color: $text;
  white-space: nowrap;
}
.period {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.period-name,
.period-limit {
  flex-shrink: 0;
  font-size: 12px;
  color: $text-muted;
}
.period-limit {
  width: 18px;
  text-align: right;
}
.track {
  flex-grow: 1;
  height: 6px;
  border-radius: 3px;
  background: $track;
}
.fill {
  display: block;
  height: 6px;
  border-radius: 3px;
}
.period-value {
  flex-shrink: 0;
  width: 34px;
  text-align: right;
  font-weight: 600;
  color: $text-strong;
}
.list {
  display: flex;
  flex-direction: column;
  margin-top: -8px;
  &.scroll {
    flex-grow: 1;
    min-height: 0;
    // 让出滚动条的位置，不压住右侧的时间
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
  min-height: 56px;
  padding: 6px 8px;
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
  &.done .name {
    color: $text-muted;
  }
}
.dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
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
.side {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: $fs-aux;
}
.time {
  color: $text-muted;
}
</style>
