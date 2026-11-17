<template>
  <div v-pop="incident.id" class="incident-card">
    <div class="head">
      <LevelTag :level="incident.level" />
      <h3 class="name">{{ incident.title }}</h3>
      <button type="button" class="close" aria-label="关闭" @click="emit('close')">×</button>
    </div>

    <dl class="meta">
      <div><dt>类型</dt><dd>{{ incident.type }}</dd></div>
      <div><dt>状态</dt><dd :class="{ open: incident.status !== '已办结' }">{{ incident.status }}</dd></div>
      <div class="wide"><dt>地点</dt><dd>{{ incident.place }}</dd></div>
      <div><dt>接警</dt><dd>{{ incident.time }}</dd></div>
      <div><dt>到场用时</dt><dd>{{ incident.arriveMinutes === null ? '未到场' : incident.arriveMinutes + ' 分钟' }}</dd></div>
    </dl>

    <p class="desc">{{ incident.description }}</p>

    <div class="block">
      <div class="block-title">出动力量</div>
      <div v-if="incident.units.length" class="chips">
        <span v-for="u in incident.units" :key="u" class="chip">{{ u }}</span>
      </div>
      <div v-else class="empty">尚未派单</div>
    </div>

    <div class="block">
      <div class="block-title">最近的摄像头</div>
      <div class="cams">
        <button v-for="c in cameras" :key="c.id" type="button" class="cam" @click="emit('camera', c.id)">
          <span class="dot" :class="{ off: !c.online }"></span>
          <span class="cam-id">{{ c.id }}</span>
          <span class="cam-name">{{ c.name }}</span>
        </button>
      </div>
    </div>

    <div class="block">
      <div class="block-title">处置进度</div>
      <ol class="steps">
        <li v-for="s in incident.timeline" :key="s.name" class="step" :class="{ done: s.done }">
          <span class="node"></span>
          <span class="step-name">{{ s.name }}</span>
          <span class="step-time">{{ s.time || '—' }}</span>
        </li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Incident, SecurityCamera } from '@/types/security'

defineProps<{ incident: Incident; cameras: SecurityCamera[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'camera', id: string): void }>()
</script>

<style lang="scss" scoped>
.incident-card {
  width: 304px;
  box-sizing: border-box;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: all;
  background: rgba(17, 22, 30, 0.96);
  border: 1px solid $border-strong;
  border-radius: $radius;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.name {
  flex-grow: 1;
  min-width: 0;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: $text-strong;
}
.close {
  width: 44px;
  height: 44px;
  margin: -10px -12px -10px 0;
  border: 0;
  font-size: 20px;
  color: $text-muted;
  background: none;
  cursor: pointer;
}
.meta {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  font-size: $fs-aux;
  div {
    display: flex;
    gap: 8px;
  }
  .wide {
    grid-column: span 2;
  }
  dt {
    flex-shrink: 0;
    color: $text-muted;
  }
  dd {
    margin: 0;
    color: $text;
    &.open {
      color: $level-2;
    }
  }
}
.desc {
  margin: 0;
  padding: 10px 12px;
  font-size: $fs-aux;
  line-height: 20px;
  color: $text;
  background: $bg-inset;
  border-radius: 4px;
}
.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.block-title {
  font-size: $fs-aux;
  color: $text-muted;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  padding: 3px 8px;
  font-size: 12px;
  color: $text;
  border: 1px solid $border-strong;
  border-radius: 4px;
}
.empty {
  font-size: $fs-aux;
  color: $text-muted;
}
.cams {
  display: flex;
  flex-direction: column;
}
.cam {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 8px;
  margin: 0 -8px;
  border: 0;
  border-radius: 4px;
  font-family: inherit;
  font-size: $fs-aux;
  text-align: left;
  color: $text;
  background: transparent;
  cursor: pointer;
  &:hover {
    background: rgba(76, 154, 255, 0.14);
  }
}
.dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: $ok;
  &.off {
    background: $text-muted;
  }
}
.cam-id {
  flex-shrink: 0;
  color: $text-strong;
}
.cam-name {
  min-width: 0;
  color: $text-muted;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.steps {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}
.step {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: $text-muted;
  // 节点之间的连线
  &::before {
    content: '';
    position: absolute;
    top: 4px;
    right: 50%;
    width: 100%;
    border-top: 2px solid $track;
  }
  &:first-child::before {
    display: none;
  }
  &.done {
    color: $text;
    &::before {
      border-top-color: $accent;
    }
    .node {
      border-color: $accent;
      background: $accent;
    }
  }
}
.node {
  position: relative;
  z-index: 1;
  width: 10px;
  height: 10px;
  box-sizing: border-box;
  border-radius: 50%;
  border: 2px solid #5d6b74;
  background: $bg-page;
}
.step-time {
  color: $text-muted;
}
</style>
