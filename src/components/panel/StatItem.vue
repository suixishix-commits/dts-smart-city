<template>
  <div class="stat-item" :class="{ tile: size === 'lg' }">
    <span class="label">{{ label }}</span>
    <span class="line">
      <span class="value" :class="size" :style="color ? { color } : undefined">{{ shown }}</span>
      <span v-if="unit" class="unit">{{ unit }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { useCountUp } from '@/composables/useCountUp'

const props = withDefaults(defineProps<{ label: string; value: string | number; unit?: string; size?: 'md' | 'lg'; color?: string }>(), { size: 'md' })
/** 数值变化时滚动过渡（拖动时间轴、数据刷新） */
const shown = useCountUp(() => props.value)
</script>

<style lang="scss" scoped>
.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
// 大号指标（卡片里的核心数字）：内嵌小卡片，淡底细描边，数字更醒目
.tile {
  padding: 10px 12px;
  border-radius: $radius-sm;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  .label {
    font-size: $fs-aux;
  }
}
.label {
  font-size: $fs-body;
  color: $text-muted;
}
.line {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.value {
  font-weight: 600;
  color: $text-strong;
  &.md {
    font-size: 24px;
    line-height: 30px;
  }
  &.lg {
    font-size: 28px;
    line-height: 34px;
  }
}
.unit {
  font-size: $fs-aux;
  color: $text-muted;
}
</style>
