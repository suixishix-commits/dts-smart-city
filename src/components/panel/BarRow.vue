<template>
  <component :is="clickable ? 'button' : 'div'" :type="clickable ? 'button' : undefined" class="bar-row" :class="{ clickable, active }" :aria-pressed="clickable ? active : undefined" @click="clickable && emit('select')">
    <span class="name">{{ name }}</span>
    <span class="track"><span class="fill" :style="{ width: width + '%', background: color }"></span></span>
    <span class="value">{{ value }}</span>
    <span v-if="note !== undefined" class="note" :style="noteColor ? { color: noteColor } : undefined">{{ note }}</span>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: string; value: string | number; percent: number; color?: string; note?: string; noteColor?: string; clickable?: boolean; active?: boolean }>(), {
  color: '#4c9aff'
})
const emit = defineEmits<{ (e: 'select'): void }>()

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
// 可点的行（点了在场景里定位）：整行是按钮，悬停浅底、选中蓝底，左右各让出 8px 的点击余量
.clickable {
  width: calc(100% + 16px);
  min-height: 32px;
  margin: 0 -8px;
  padding: 0 8px;
  border: 0;
  border-radius: $radius-sm;
  font: inherit;
  font-size: $fs-body;
  text-align: left;
  color: inherit;
  background: none;
  cursor: pointer;
  transition: background-color 160ms ease;
  &:hover {
    background: rgba(255, 255, 255, 0.05);
    .name {
      color: $text-strong;
    }
    .fill {
      filter: brightness(1.15);
    }
  }
  &.active {
    background: rgba(76, 154, 255, 0.14);
    .name {
      color: $text-strong;
    }
  }
  &:focus-visible {
    outline: 2px solid $accent-light;
    outline-offset: -2px;
  }
}
.name {
  width: 72px;
  flex-shrink: 0;
  color: $text;
  transition: color 160ms ease;
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
  // 拖动时间轴、数据刷新时进度条平滑伸缩
  transition: width 600ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 300ms ease;
}
.value {
  width: 28px;
  flex-shrink: 0;
  text-align: right;
  font-weight: 600;
  color: $text-strong;
}
.note {
  width: 48px;
  flex-shrink: 0;
  text-align: right;
  color: $text-muted;
}
@media (prefers-reduced-motion: reduce) {
  .fill,
  .clickable,
  .name {
    transition: none;
  }
}
</style>
