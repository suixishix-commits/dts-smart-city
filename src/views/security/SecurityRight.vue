<template>
  <aside class="security-right">
    <PanelCard title="实时警情" :extra="'在办 ' + activeCount + ' / 共 ' + incidents.length">
      <div class="list">
        <button v-for="i in incidents" :key="i.id" type="button" class="row" :class="{ active: i.id === activeIncident }" @click="emit('incident', i.id)">
          <LevelTag :level="i.level" />
          <span class="main">
            <span class="name">{{ i.title }}</span>
            <span class="sub">{{ i.type }} · {{ i.place }}</span>
          </span>
          <span class="side">
            <span class="status" :class="{ open: i.status !== '已办结' }">{{ i.status }}</span>
            <span class="time">{{ i.time }}</span>
          </span>
        </button>
      </div>
    </PanelCard>

    <PanelCard title="重点防护区" :extra="'驻守 ' + guardTotal + ' 人'">
      <div class="list">
        <button v-for="z in data.zones" :key="z.id" type="button" class="row" :class="{ active: z.id === activeZone }" @click="emit('zone', z.id)">
          <span class="guard">{{ GUARD_TEXT[z.guardLevel] }}</span>
          <span class="main">
            <span class="name">{{ z.name }}</span>
            <span class="sub">驻守 {{ z.guards }} 人 · 周边摄像头 {{ z.cameras }} 路</span>
          </span>
          <span class="status" :class="{ open: z.status !== '正常' }">{{ z.status }}</span>
        </button>
      </div>
    </PanelCard>

    <PanelCard title="视频巡查" :extra="'在线率 ' + onlineRate + '% · ' + onlineCount + ' / ' + data.cameras.length" grow>
      <div class="cams">
        <CameraTile v-for="c in featured" :key="c.id" :camera="c" :active="c.id === activeCamera" @select="emit('camera', $event)" />
      </div>
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { isActive } from '@/api/mock/security'
import type { SecurityData } from '@/types/security'
import type { Camera } from '@/types/smartCity'
import CameraTile from '@/views/overview/_components/CameraTile.vue'
import { computed } from 'vue'

const props = defineProps<{ data: SecurityData; activeIncident: string | null; activeZone: string | null; activeCamera: string | null }>()
const emit = defineEmits<{ (e: 'incident', id: string): void; (e: 'zone', id: string): void; (e: 'camera', id: string): void }>()

const GUARD_TEXT: Record<number, string> = { 1: '一级', 2: '二级', 3: '三级' }

/** 在办的排前面，同状态按等级从重到轻 */
const incidents = computed(() => [...props.data.incidents].sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || a.level - b.level))
const activeCount = computed(() => props.data.incidents.filter(isActive).length)
const guardTotal = computed(() => props.data.zones.reduce((n, z) => n + z.guards, 0))
const onlineCount = computed(() => props.data.cameras.filter(c => c.online).length)
const onlineRate = computed(() => (props.data.cameras.length ? ((onlineCount.value / props.data.cameras.length) * 100).toFixed(1) : '0.0'))
/** 离在办警情最近的 4 路摄像头，转成 CameraTile 要的结构 */
const featured = computed<Camera[]>(() =>
  props.data.featuredCameraIds.flatMap(id => {
    const c = props.data.cameras.find(x => x.id === id)
    return c ? [{ ...c, featured: true }] : []
  })
)
</script>

<style lang="scss" scoped>
.security-right {
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
  min-height: 44px;
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
    background: rgba(76, 196, 212, 0.14);
  }
}
.guard {
  flex-shrink: 0;
  width: 40px;
  height: 22px;
  box-sizing: border-box;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: $accent-light;
  border: 1px solid $accent;
}
.main {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.name {
  font-size: $fs-body;
  color: $text-strong;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub {
  font-size: 12px;
  color: $text-muted;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.side {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}
.status,
.time {
  flex-shrink: 0;
  font-size: 12px;
  color: $text-muted;
}
.status.open {
  color: $level-2;
}
.cams {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
</style>
