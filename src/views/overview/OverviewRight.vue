<template>
  <aside class="overview-right">
    <PanelCard title="城市热点事件" extra="热度 · 现场人数">
      <div class="list">
        <button v-for="(h, i) in hotspots" :key="h.id" type="button" class="row" :class="{ active: h.id === activeHotspot }" @click="emit('hotspot', h.id)">
          <span class="no" :class="heatClass(h.heat)">{{ i + 1 }}</span>
          <span class="main">
            <span class="name">{{ h.name }}</span>
            <span class="sub">{{ h.type }} · {{ districtName(h.districtId) }}</span>
          </span>
          <span class="heat">{{ h.heat }}</span>
          <span class="people">{{ h.people.toLocaleString() }}</span>
        </button>
      </div>
    </PanelCard>

    <PanelCard title="重点摄像头" :extra="'在线 ' + onlineCount + ' / ' + data.cameras.length">
      <div class="cams">
        <CameraTile v-for="c in featured" :key="c.id" :camera="c" :active="c.id === activeCamera" @select="emit('camera', $event)" />
      </div>
    </PanelCard>

    <PanelCard title="实时告警" :extra="'共 ' + alarmTotal + ' 条'" grow>
      <div class="list">
        <div v-for="a in alarms" :key="a.id" class="row static">
          <LevelTag :level="a.level" />
          <span class="main">
            <span class="name">{{ a.title }}</span>
            <span class="sub">{{ a.module }} · {{ a.area }}</span>
          </span>
          <span class="time">{{ a.time }}</span>
        </div>
      </div>
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import store from '@/stores'
import type { OverviewData } from '@/types/smartCity'
import { computed } from 'vue'

const props = defineProps<{ data: OverviewData; activeHotspot: string | null; activeCamera: string | null }>()
const emit = defineEmits<{ (e: 'hotspot', id: string): void; (e: 'camera', id: string): void }>()

const hotspots = computed(() => [...props.data.hotspots].sort((a, b) => b.heat - a.heat))
const featured = computed(() => props.data.cameras.filter(c => c.featured).slice(0, 4))
const onlineCount = computed(() => props.data.cameras.filter(c => c.online).length)
const alarms = computed(() => store.alarmStore.top(4))
const alarmTotal = computed(() => store.alarmStore.total)

function districtName(id: string): string {
  return props.data.districts.find(d => d.id === id)?.name ?? ''
}
function heatClass(heat: number): string {
  return heat >= 90 ? 'hot' : heat >= 75 ? 'warm' : 'mild'
}
</script>

<style lang="scss" scoped>
.overview-right {
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
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 6px 8px;
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
  &.static {
    cursor: default;
  }
}
.no {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $fs-aux;
  font-weight: 700;
  color: $bg-page;
  &.hot {
    background: $level-1;
  }
  &.warm {
    background: $level-2;
  }
  &.mild {
    background: $level-3;
  }
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
.sub,
.time,
.people {
  font-size: $fs-aux;
  color: $text-muted;
}
.heat {
  flex-shrink: 0;
  width: 28px;
  text-align: right;
  font-size: 16px;
  font-weight: 600;
  color: $text-strong;
}
.people {
  flex-shrink: 0;
  width: 56px;
  text-align: right;
}
.cams {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
</style>
