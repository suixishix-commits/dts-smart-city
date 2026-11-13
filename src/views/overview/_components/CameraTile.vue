<template>
  <button type="button" class="camera-tile" :class="{ active }" @click="emit('select', camera.id)">
    <span class="placeholder">视频占位</span>
    <span class="name"><span class="dot" :class="{ off: !camera.online }"></span>{{ camera.id }} {{ camera.name }}</span>
  </button>
</template>

<script setup lang="ts">
import type { Camera } from '@/types/smartCity'

defineProps<{ camera: Camera; active?: boolean }>()
const emit = defineEmits<{ (e: 'select', id: string): void }>()
</script>

<style lang="scss" scoped>
.camera-tile {
  position: relative;
  height: 108px;
  padding: 0;
  border-radius: 4px;
  font-family: inherit;
  color: $text-muted;
  background: $bg-inset;
  border: 1px solid $border-strong;
  cursor: pointer;
  &.active {
    border-color: $accent-light;
  }
}
.placeholder {
  font-size: $fs-aux;
}
.name {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  text-align: left;
  color: $text;
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
