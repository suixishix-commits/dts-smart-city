<template>
  <div class="layer-toggle" role="group" aria-label="图层开关">
    <button
      v-for="l in layers"
      :key="l.key"
      type="button"
      class="item"
      :class="{ on: modelValue.includes(l.key) }"
      :aria-pressed="modelValue.includes(l.key) ? 'true' : 'false'"
      @click="toggle(l.key)"
    >
      {{ l.name }}
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ layers: { key: string; name: string }[]; modelValue: string[] }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void; (e: 'change', key: string, visible: boolean): void }>()

function toggle(key: string) {
  const on = props.modelValue.includes(key)
  emit('update:modelValue', on ? props.modelValue.filter(k => k !== key) : [...props.modelValue, key])
  emit('change', key, !on)
}
</script>

<style lang="scss" scoped>
.layer-toggle {
  display: flex;
  gap: 4px;
  padding: 4px;
  pointer-events: all;
  background: $bg-float;
  border: 1px solid $border;
  border-radius: $radius;
}
.item {
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
    color: $text-strong;
    background: $accent-soft;
  }
}
</style>
