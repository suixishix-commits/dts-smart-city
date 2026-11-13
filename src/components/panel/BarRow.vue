<template>
  <div class="bar-row">
    <span class="name">{{ name }}</span>
    <span class="track"><span class="fill" :style="{ width: width + '%', background: color }"></span></span>
    <span class="value">{{ value }}</span>
    <span v-if="note !== undefined" class="note" :style="noteColor ? { color: noteColor } : undefined">{{ note }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: string; value: string | number; percent: number; color?: string; note?: string; noteColor?: string }>(), {
  color: '#4c9aff'
})

/** 进度条宽度，限制在 0–100 */
const width = computed(() => Math.min(100, Math.max(0, props.percent || 0)))
</script>

<style lang="scss" scoped>
.bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: $fs-body;
}
.name {
  width: 72px;
  color: $text;
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
.value {
  width: 28px;
  text-align: right;
  font-weight: 600;
  color: $text-strong;
}
.note {
  width: 48px;
  text-align: right;
  color: $text-muted;
}
</style>
