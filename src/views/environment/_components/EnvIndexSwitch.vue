<template>
  <div class="index-switch" role="radiogroup" aria-label="着色指标">
    <button v-for="o in AIR_INDEXES" :key="o.key" type="button" class="item" :class="{ on: o.key === modelValue }" role="radio" :aria-checked="o.key === modelValue ? 'true' : 'false'" @click="emit('update:modelValue', o.key)">
      {{ o.name }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { AIR_INDEXES } from '@/api/mock/environment'
import type { AirIndex } from '@/types/environment'

defineProps<{ modelValue: AirIndex }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: AirIndex): void }>()
</script>

<style lang="scss" scoped>
.index-switch {
  display: flex;
  gap: 4px;
  padding: 4px;
  pointer-events: all;
  background: $bg-float;
  border: 1px solid $border;
  border-radius: $radius;
}
.item {
  min-width: 64px;
  height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: $radius-sm;
  font-family: inherit;
  font-size: $fs-body;
  color: $text-muted;
  background: transparent;
  cursor: pointer;
  &.on {
    font-weight: 600;
    color: $text-strong;
    background: $accent-soft;
  }
}
</style>
