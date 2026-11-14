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

    <PanelCard title="信号路口" :extra="'共 ' + data.signals.length + ' 个'">
      <div class="split" role="img" :aria-label="'正常 ' + counts.normal + '，离线 ' + counts.offline + '，手动控制 ' + counts.manual">
        <span v-for="s in SIGNAL_KEYS" :key="s" :style="{ flexGrow: counts[s], background: SIGNAL_COLOR[s] }"></span>
      </div>
      <div class="counts">
        <div v-for="s in SIGNAL_KEYS" :key="s" class="count">
          <span class="label"><i :style="{ background: SIGNAL_COLOR[s] }"></i>{{ SIGNAL_TEXT[s] }}</span>
          <span class="num">{{ counts[s] }}</span>
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

    <PanelCard title="公共交通与停车" extra="停车场占用率 · 余位" grow>
      <div class="transit">
        <StatItem label="公交准点率" :value="transit.onTime.toFixed(1)" unit="%" />
        <StatItem label="今日客运量" :value="transit.passengers.toFixed(1)" unit="万人次" />
        <StatItem label="在线公交" :value="transit.buses" unit="辆" />
      </div>
      <div class="parkings">
        <BarRow v-for="p in parkings" :key="p.id" :name="p.name" :value="p.value" :percent="p.percent" :color="p.color" :note="p.free" />
      </div>
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { INCIDENT_TEXT, parkingOccupancyAt, transitStatsAt } from '@/api/mock/traffic'
import { COLOR } from '@/scene/kit'
import type { SignalStatus, TrafficData } from '@/types/traffic'
import { computed } from 'vue'
import { INCIDENT_COLOR, SIGNAL_COLOR, SIGNAL_TEXT } from './TrafficScene'

const props = defineProps<{ data: TrafficData; hour: number; activeIncident: string | null; activeSignal: string | null }>()
const emit = defineEmits<{ (e: 'incident', id: string): void; (e: 'signal', id: string): void }>()

const SIGNAL_KEYS: SignalStatus[] = ['normal', 'offline', 'manual']

const counts = computed(() => {
  const n: Record<SignalStatus, number> = { normal: 0, offline: 0, manual: 0 }
  props.data.signals.forEach(s => n[s.status]++)
  return n
})
/** 异常路口：离线的排在手动控制前面 */
const abnormal = computed(() => props.data.signals.filter(s => s.status !== 'normal').sort((a, b) => (a.status === b.status ? 0 : a.status === 'offline' ? -1 : 1)))

const transit = computed(() => transitStatsAt(props.data.segments, props.hour))

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
  min-height: 48px;
  padding: 4px 8px;
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
    background: rgba(76, 196, 212, 0.14);
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
.split {
  display: flex;
  gap: 2px;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  span {
    // 数量为 0 的状态不占宽度；很少的也至少留一小段能看见
    flex-basis: 0;
    min-width: 6px;
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
</style>
