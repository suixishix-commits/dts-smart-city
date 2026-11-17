<template>
  <div class="stat-item" :class="{ tile: size === 'lg' }">
    <span class="label">{{ label }}</span>
    <span class="line">
      <span class="value" :class="[size, { tinted: !!color }]" :style="color ? { color } : undefined">{{ shown }}</span>
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
  position: relative;
  padding: 10px 12px;
  border-radius: $radius-sm;
  background:
    radial-gradient(120% 90% at 0% 0%, rgba(76, 154, 255, 0.14), rgba(76, 154, 255, 0) 60%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015));
  box-shadow: inset 0 0 0 1px rgba(143, 192, 255, 0.12);
  // 左侧一截亮边
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 10px;
    bottom: 10px;
    width: 2px;
    border-radius: 1px;
    background: linear-gradient(180deg, rgba(143, 192, 255, 0), $accent-light, rgba(143, 192, 255, 0));
  }
  .label {
    font-size: $fs-aux;
  }
  // 核心数字：白到浅蓝的渐变，带一点辉光（带警示色的数字保持原色）
  .value:not(.tinted) {
    background: linear-gradient(180deg, #ffffff 30%, #9cc8ff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 0 8px rgba(76, 154, 255, 0.35));
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
  font-family: $font-num;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: $text-strong;
  &.md {
    font-size: 26px;
    line-height: 30px;
  }
  &.lg {
    font-size: 32px;
    line-height: 36px;
  }
}
.unit {
  font-size: $fs-aux;
  color: $text-muted;
}
</style>
