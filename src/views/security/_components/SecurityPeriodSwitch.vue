<template>
  <div class="period-switch" role="group" aria-label="统计周期">
    <span class="label">统计周期</span>
    <button v-for="p in PERIODS" :key="p.key" type="button" class="item" :class="{ on: p.key === modelValue }" :aria-pressed="p.key === modelValue ? 'true' : 'false'" @click="emit('update:modelValue', p.key)">
      {{ p.name }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { SecurityPeriod } from '@/types/security'

defineProps<{ modelValue: SecurityPeriod }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: SecurityPeriod): void }>()

const PERIODS: { key: SecurityPeriod; name: string }[] = [
  { key: 'today', name: '今日' },
  { key: 'week', name: '近 7 日' },
  { key: 'month', name: '近 30 日' }
]
</script>

<style lang="scss" scoped>
.period-switch {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  pointer-events: all;
  background: $bg-float;
  border: 1px solid $border;
  border-radius: $radius;
}
.label {
  padding: 0 8px 0 12px;
  font-size: $fs-aux;
  color: $text-muted;
}
.item {
  height: 44px;
  padding: 0 16px;
  border: 0;
  border-radius: $radius-sm;
  font-family: inherit;
  font-size: $fs-body;
  color: $text-muted;
  background: transparent;
  cursor: pointer;
  &.on {
    color: $text-strong;
    background: $accent-soft;
  }
}
</style>
