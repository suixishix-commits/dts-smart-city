<template>
  <div class="base-layers" role="group" aria-label="底图图层">
    <div class="title">底图图层</div>
    <label v-for="item in ITEMS" :key="item.key" class="item">
      <input type="checkbox" :checked="state[item.key]" @change="emit('change', item.key, ($event.target as HTMLInputElement).checked)" />
      <span class="name">{{ item.name }}</span>
      <span class="hint">{{ item.hint }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
type Key = 'roads' | 'ambience' | 'cloud'
defineProps<{ state: Record<Key, boolean> }>()
const emit = defineEmits<{ (e: 'change', key: Key, on: boolean): void }>()

const ITEMS: { key: Key; name: string; hint: string }[] = [
  { key: 'roads', name: '路网流光', hint: '主干路与支路' },
  { key: 'ambience', name: '黄昏底图', hint: '关闭后显示影像原色' },
  { key: 'cloud', name: '云层', hint: '' }
]
</script>

<style lang="scss" scoped>
.base-layers {
  width: 240px;
  box-sizing: border-box;
  padding: 12px 16px;
  pointer-events: all;
  background: $bg-float;
  border: 1px solid $border;
  border-radius: $radius;
}
.title {
  margin-bottom: 8px;
  font-size: $fs-body;
  font-weight: 600;
  color: $text-strong;
}
.item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  font-size: $fs-body;
  color: $text;
  cursor: pointer;
  input {
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: $accent;
  }
}
.hint {
  margin-left: auto;
  font-size: $fs-aux;
  color: $text-muted;
}
</style>
