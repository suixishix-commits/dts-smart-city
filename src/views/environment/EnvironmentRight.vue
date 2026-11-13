<template>
  <aside class="environment-right">
    <PanelCard title="监测站点" :extra="meta.name + (meta.unit ? ' ' + meta.unit : '') + ' · 由高到低'" grow>
      <div class="list scroll">
        <button v-for="r in stations" :key="r.station.id" type="button" class="row" :class="{ active: r.station.id === activeStation }" @click="emit('station', r.station.id)">
          <i class="dot" :style="{ background: airColor(r.reading.level) }"></i>
          <span class="main">
            <span class="name">{{ r.station.name }}</span>
            <span class="sub">{{ r.station.districtName }} · {{ r.station.kind }}</span>
          </span>
          <span class="value">{{ r.reading.value }}</span>
          <span class="status" :style="{ color: airColor(r.reading.level) }">{{ AIR_LEVEL_SHORT[r.reading.level] }}</span>
        </button>
      </div>
    </PanelCard>

    <PanelCard title="污染源与投诉" :extra="'共 ' + data.sources.length + ' 处'">
      <div class="list">
        <button v-for="s in sources" :key="s.id" type="button" class="row" :class="{ active: s.id === activeSource }" @click="emit('source', s.id)">
          <LevelTag :level="s.level" />
          <span class="main">
            <span class="name">{{ s.name }}</span>
            <span class="sub">{{ s.type }} · {{ s.districtName }} · {{ s.note }}</span>
          </span>
          <span class="time">{{ s.time }}</span>
        </button>
      </div>
    </PanelCard>

    <PanelCard title="噪声与水质" :extra="'噪声点 ' + data.noisePoints.length + ' · 水质采样点 ' + data.waterSamples.length">
      <div class="noise">
        <StatItem :label="'昼间均值 · 限 ' + NOISE_LIMIT.day" :value="noise.day.toFixed(1)" unit="dB" />
        <StatItem :label="'夜间均值 · 限 ' + NOISE_LIMIT.night" :value="noise.night.toFixed(1)" unit="dB" :color="noise.night > NOISE_LIMIT.night ? COLOR.warn : undefined" />
        <StatItem label="噪声达标率" :value="noise.compliance.toFixed(1)" unit="%" />
      </div>
      <div class="water">
        <BarRow v-for="w in water" :key="w.grade" :name="'近岸 ' + w.name" :value="w.count" :percent="w.percent" :color="WATER_COLORS[w.grade]" :note="w.share" />
      </div>
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { AIR_INDEXES, AIR_LEVEL_SHORT, NOISE_LIMIT, noiseSummary, stationReadingsAt, waterDistribution } from '@/api/mock/environment'
import { COLOR } from '@/scene/kit'
import type { AirIndex, EnvironmentData } from '@/types/environment'
import { computed } from 'vue'
import { airColor, WATER_COLORS } from './EnvironmentScene'

const props = defineProps<{ data: EnvironmentData; hour: number; index: AirIndex; activeStation: string | null; activeSource: string | null }>()
const emit = defineEmits<{ (e: 'station', id: string): void; (e: 'source', id: string): void }>()

const meta = computed(() => AIR_INDEXES.find(i => i.key === props.index) ?? AIR_INDEXES[0])
const stations = computed(() => stationReadingsAt(props.data, props.hour, props.index))
const sources = computed(() => [...props.data.sources].sort((a, b) => a.level - b.level))
const noise = computed(() => noiseSummary(props.data.noisePoints))
const water = computed(() => {
  const total = props.data.waterSamples.length || 1
  return waterDistribution(props.data.waterSamples).map(w => ({ ...w, percent: Math.round((w.count / total) * 100), share: Math.round((w.count / total) * 100) + '%' }))
})
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
.list {
  display: flex;
  flex-direction: column;
  margin-top: -8px;
  &.scroll {
    flex-grow: 1;
    min-height: 0;
    // 让出滚动条的位置，不压住右侧的数值
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
  min-height: 44px;
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
    background: rgba(76, 154, 255, 0.14);
  }
}
.scroll .row {
  margin-right: 0;
}
.dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
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
.sub,
.time {
  font-size: $fs-aux;
  color: $text-muted;
}
.time {
  flex-shrink: 0;
}
.value {
  flex-shrink: 0;
  width: 36px;
  text-align: right;
  font-size: 16px;
  font-weight: 600;
  color: $text-strong;
}
.status {
  flex-shrink: 0;
  width: 32px;
  text-align: right;
  font-size: $fs-aux;
}
.noise {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.water {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid $divider;
}
</style>
