<template>
  <aside class="traffic-right">
    <PanelCard title="交通事件" :extra="'今日 ' + data.incidentsToday + ' 起 · 未办结 ' + data.incidents.length">
      <div class="list">
        <button v-for="i in data.incidents" :key="i.id" type="button" class="row" :class="{ active: i.id === activeIncident }" @click="emit('incident', i.id)">
          <span class="tag" :style="{ background: INCIDENT_COLOR[i.type] }">{{ INCIDENT_TEXT[i.type] }}</span>
          <span class="main">
            <span class="name">{{ i.title }} · {{ i.status }}</span>
            <span class="sub">{{ i.intersectionName }}</span>
          </span>
          <span class="time">{{ i.time }}</span>
        </button>
      </div>
    </PanelCard>

    <PanelCard title="信号路口" :extra="'共 ' + data.signals.length + ' 个 · 手动放行 ' + manualCount">
      <!-- 控制方式：左边环形图（中间是路口总数），右边三项计数 -->
      <div class="signal-split">
        <LineChart class="donut" :option="signalOption" :height="104" :label="CONTROL_KEYS.map(k => k + ' ' + counts[k]).join('，')" />
      <div class="counts">
        <div v-for="k in CONTROL_KEYS" :key="k" class="count">
          <span class="label"><i :style="{ background: CONTROL_COLOR[k] }"></i>{{ k }}</span>
          <span class="num">{{ counts[k] }}</span>
        </div>
      </div>
      </div>
      <div class="list">
        <button v-for="s in abnormal" :key="s.id" type="button" class="row compact" :class="{ active: s.id === activeSignal }" :title="s.name + '：' + SIGNAL_TEXT[s.status] + '，' + s.note" @click="emit('signal', s.id)">
          <i class="state" :style="{ background: SIGNAL_COLOR[s.status] }"></i>
          <span class="name grow">{{ s.name }}</span>
          <span class="time">{{ s.note }}</span>
        </button>
      </div>
    </PanelCard>

    <!-- 客流和停车放在同一张卡片里，用页签切换 -->
    <PanelCard title="公共交通" grow>
      <template #extra>
        <SegmentedTabs v-model="transitTab" :options="TRANSIT_TABS" label="公共交通指标" />
      </template>
      <div class="transit-line">
        <span>公交准点率 <b>{{ transit.onTime.toFixed(1) }}</b>%</span>
        <span>在线公交 <b>{{ transit.buses }}</b> 辆</span>
        <span>客运量 <b>{{ transit.passengers.toFixed(1) }}</b> 万人次</span>
      </div>
      <template v-if="transitTab === 'modes'">
        <div class="list-note">分方式客流 · 今日累计 {{ modesTotal.toFixed(1) }} 万人次</div>
        <LineChart :option="modesOption" :height="150" label="各公共交通方式今日累计客流，万人次" />
      </template>
      <template v-else>
        <div class="list-note">停车场占用率 · 余位</div>
        <LineChart :option="parkingOption" :height="150" label="各停车场占用率与余位" />
      </template>
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { NUM_FONT, TEXT_FONT } from '@/components/chart/chartTheme'
import { INCIDENT_TEXT, parkingOccupancyAt, signalControlCount, transitModesAt, transitStatsAt } from '@/api/mock/traffic'
import { COLOR } from '@/scene/kit'
import type { SignalControl, TrafficData } from '@/types/traffic'
import { computed, ref } from 'vue'
import { INCIDENT_COLOR, SIGNAL_COLOR, SIGNAL_TEXT } from './TrafficScene'

const props = defineProps<{ data: TrafficData; hour: number; activeIncident: string | null; activeSignal: string | null }>()
const emit = defineEmits<{ (e: 'incident', id: string): void; (e: 'signal', id: string): void }>()

const TRANSIT_TABS = [
  { key: 'modes', name: '客流' },
  { key: 'parking', name: '停车' }
]
const transitTab = ref('modes')

const CONTROL_KEYS: SignalControl[] = ['自适应', '定时', '离线']
/** 按设计稿：自适应用强调色，定时用中性灰，离线与场景里的离线信号同色 */
const CONTROL_COLOR: Record<SignalControl, string> = { 自适应: COLOR.accent, 定时: COLOR.muted, 离线: SIGNAL_COLOR.offline }

const counts = computed(() => signalControlCount(props.data.signals))
const manualCount = computed(() => props.data.signals.filter(s => s.status === 'manual').length)
/** 异常路口：离线的排在手动控制前面 */
const abnormal = computed(() => props.data.signals.filter(s => s.status !== 'normal').sort((a, b) => (a.status === b.status ? 0 : a.status === 'offline' ? -1 : 1)))

const transit = computed(() => transitStatsAt(props.data.segments, props.hour))

/** 各公共交通方式今日累计客流；进度条以全天公交客流为满格，与设计稿一致 */
const modes = computed(() => {
  const list = transitModesAt(props.data.segments, props.hour)
  const full = transitModesAt(props.data.segments, 24)[0].value || 1
  return list.map(m => ({ ...m, percent: Math.round((m.value / full) * 100) }))
})
const modesTotal = computed(() => modes.value.reduce((n, m) => n + m.value, 0))


/** 信号控制方式环形图：中间是路口总数 */
const signalOption = computed(() => ({
  title: {
    text: String(props.data.signals.length),
    subtext: '路口',
    left: 'center',
    top: '30%',
    itemGap: 2,
    textStyle: { color: '#f3f5f8', fontSize: 22, fontWeight: 600, fontFamily: NUM_FONT },
    subtextStyle: { color: '#9aa4b2', fontSize: 11 }
  },
  series: [
    {
      type: 'pie',
      radius: ['68%', '90%'],
      center: ['50%', '50%'],
      padAngle: 3,
      itemStyle: { borderRadius: 3 },
      label: { show: false },
      emphasis: { scale: true, scaleSize: 4 },
      data: CONTROL_KEYS.map(k => ({ name: k, value: counts.value[k], itemStyle: { color: CONTROL_COLOR[k], shadowColor: CONTROL_COLOR[k], shadowBlur: 8 } }))
    }
  ]
}))

/** 分方式客流：竖向渐变柱，柱顶标数值 */
const modesOption = computed(() => ({
  grid: { left: 8, right: 8, top: 22, bottom: 22 },
  xAxis: {
    type: 'category',
    data: modes.value.map(m => m.name),
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
    axisTick: { show: false },
    axisLabel: { color: '#9aa4b2', fontSize: 12, fontFamily: TEXT_FONT }
  },
  yAxis: { type: 'value', show: false, splitLine: { show: false } },
  series: [
    {
      name: '今日累计',
      type: 'bar',
      barWidth: 22,
      color: COLOR.accent,
      label: { show: true, position: 'top', color: '#f3f5f8', fontSize: 14, fontWeight: 600, fontFamily: NUM_FONT, formatter: (p: { value: number }) => p.value.toFixed(1) },
      data: modes.value.map(m => Number(m.value.toFixed(1)))
    }
  ]
}))

const parkings = computed(() =>
  props.data.parkings.map(p => {
    const rate = parkingOccupancyAt(p, props.hour)
    return {
      id: p.id,
      name: p.name,
      value: Math.round(rate * 100) + '%',
      percent: Math.round(rate * 100),
      // 接近满位才用暖色
      color: rate >= 0.9 ? COLOR.danger : rate >= 0.75 ? COLOR.warn : COLOR.accent,
      free: Math.round(p.capacity * (1 - rate)).toLocaleString()
    }
  })
)

/** 停车场占用率：横向柱，接近满位转暖色；标签是占用率和余位 */
const parkingOption = computed(() => {
  const list = [...parkings.value].reverse()
  return {
    grid: { left: 92, right: 96, top: 4, bottom: 4 },
    xAxis: { type: 'value', min: 0, max: 100, show: false },
    yAxis: { type: 'category', data: list.map(p => p.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#e6eaf0', fontSize: 13, fontFamily: TEXT_FONT, width: 84, overflow: 'truncate' } },
    series: [
      {
        name: '占用率',
        type: 'bar',
        barWidth: 8,
        showBackground: true,
        backgroundStyle: { color: 'rgba(255,255,255,0.05)', borderRadius: 4 },
        data: list.map(p => ({
          value: p.percent,
          itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: p.color + '40' }, { offset: 1, color: p.color }] }, borderRadius: 4, shadowColor: p.color, shadowBlur: 6 },
          label: { show: true, position: 'right', formatter: `{v|${p.value}} {f|余 ${p.free}}`, rich: { v: { color: '#f3f5f8', fontSize: 14, fontWeight: 600, fontFamily: NUM_FONT }, f: { color: '#9aa4b2', fontSize: 11 } } }
        }))
      }
    ]
  }
})
</script>

<style lang="scss" scoped>
.traffic-right {
  position: absolute;
  right: $page-margin;
  top: $panel-top;
  width: $panel-width;
  height: calc(100% - #{$panel-top} - #{$page-margin});
  display: flex;
  flex-direction: column;
  gap: $panel-gap;
}
.list {
  display: flex;
  flex-direction: column;
  margin-top: -8px;
  margin-bottom: -6px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 42px;
  padding: 3px 8px;
  margin: 0 -8px;
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
  &.compact {
    min-height: 36px;
    padding: 2px 8px;
  }
}
.tag {
  flex-shrink: 0;
  width: 40px;
  height: 22px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: $bg-page;
}
.state {
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.name.grow {
  flex-grow: 1;
  min-width: 0;
}
.sub,
.time {
  font-size: $fs-aux;
  color: $text-muted;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.time {
  flex-shrink: 0;
}
.signal-split {
  display: flex;
  align-items: center;
  gap: 16px;
  .donut {
    width: 104px;
    flex-shrink: 0;
  }
  .counts {
    flex-grow: 1;
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
  gap: 2px;
  .label {
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
  .num {
    font-size: 22px;
    font-weight: 600;
    line-height: 28px;
    color: $text-strong;
  }
}
.modes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  :deep(.name) {
    width: 72px;
    flex-shrink: 0;
  }
  :deep(.value) {
    width: 36px;
  }
}
.transit {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.parkings {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  max-height: 130px;
  // 地标名比片区名长：加宽名称列
  :deep(.name) {
    width: 116px;
    flex-shrink: 0;
    white-space: nowrap;
  }
  :deep(.value) {
    width: 40px;
  }
}
.list-note {
  margin-bottom: -8px;
  font-size: $fs-aux;
  color: $text-muted;
}
// 公交的三个指标收成一行，给下面的清单留出高度
.transit-line {
  display: flex;
  justify-content: space-between;
  padding: 5px 12px;
  border-radius: $radius-sm;
  font-size: $fs-aux;
  color: $text-muted;
  background: rgba(255, 255, 255, 0.04);
  b {
    margin: 0 2px 0 4px;
    font-size: 16px;
    font-weight: 600;
    color: $text-strong;
  }
}
</style>
