<template>
  <button type="button" class="camera-tile" :class="{ active }" @click="emit('select', camera.id)">
    <CameraFeed class="feed" :camera-id="camera.id" :online="camera.online" compact />
    <span class="name"><span class="dot" :class="{ off: !camera.online }"></span>{{ camera.id }} {{ camera.name }}</span>
  </button>
</template>

<script setup lang="ts">
import CameraFeed from '@/components/video/CameraFeed.vue'
import type { Camera } from '@/types/smartCity'

defineProps<{ camera: Camera; active?: boolean }>()
const emit = defineEmits<{ (e: 'select', id: string): void }>()
</script>

<style lang="scss" scoped>
.camera-tile {
  position: relative;
  height: 92px;
  padding: 0;
  border-radius: 4px;
  font-family: inherit;
  color: $text-muted;
  background: $bg-inset;
  border: 1px solid $border-strong;
  overflow: hidden;
  cursor: pointer;
  &.active {
    border-color: $accent-light;
  }
}
.feed {
  position: absolute;
  inset: 0;
  border-radius: 3px;
}
.name {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 0;
  padding: 14px 0 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  text-align: left;
  color: $text;
  // 名字压在画面上，底部加一道渐暗保证读得清
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0));
  margin: 0 -8px;
  padding-left: 8px;
  padding-right: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
</style>
