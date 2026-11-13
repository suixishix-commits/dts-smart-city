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
      <i class="dot" aria-hidden="true"></i>{{ l.name }}
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
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: $radius-sm;
  font-family: inherit;
  font-size: $fs-body;
  color: $text-muted;
  background: transparent;
  cursor: pointer;
  .dot {
    width: 8px;
    height: 8px;
    box-sizing: border-box;
    border-radius: 50%;
    border: 1.5px solid #6b7685;
  }
  &.on {
    color: $text-strong;
    .dot {
      border-color: $accent;
      background: $accent;
    }
  }
}
</style>
