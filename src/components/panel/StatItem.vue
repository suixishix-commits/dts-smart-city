<template>
  <div class="stat-item">
    <span class="label">{{ label }}</span>
    <span class="line">
      <span class="value" :class="size" :style="color ? { color } : undefined">{{ value }}</span>
      <span v-if="unit" class="unit">{{ unit }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ label: string; value: string | number; unit?: string; size?: 'md' | 'lg'; color?: string }>(), { size: 'md' })
</script>

<style lang="scss" scoped>
.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
