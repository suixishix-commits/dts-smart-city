<template>
  <div class="scene-tools" role="toolbar" aria-label="场景工具">
    <button
      v-for="t in TOOLS"
      :key="t.key"
      type="button"
      class="tool"
      :class="{ on: active.includes(t.key) }"
      :aria-label="t.name"
      :aria-pressed="active.includes(t.key) ? 'true' : 'false'"
      :title="t.ready ? t.name : t.name + '（后续版本）'"
      :disabled="!t.ready"
      @click="emit('tool', t.key)"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path :d="t.icon" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ active?: string[] }>(), { active: () => [] })
const emit = defineEmits<{ (e: 'tool', key: string): void }>()

const TOOLS = [
  { key: 'layers', name: '图层管理', ready: false, icon: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5' },
  { key: 'tour', name: '城市巡航', ready: false, icon: 'M5 3l14 9-14 9V3z' },
  { key: 'measure', name: '测量', ready: false, icon: 'M3 17L17 3l4 4L7 21l-4-4zM7 13l2 2M10 10l2 2M13 7l2 2' },
  { key: 'night', name: '昼夜切换', ready: true, icon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' },
  { key: 'rain', name: '天气模拟', ready: true, icon: 'M7 16h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 9.1 3.5 3.5 0 0 0 7 16zM9 20v1M13 20v1M17 20v1' },
  { key: 'snapshot', name: '截图', ready: false, icon: 'M4 8h3l2-3h6l2 3h3v11H4V8zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z' },
  { key: 'reset', name: '视角复位', ready: true, icon: 'M4 4v6h6M20 20v-6h-6M20 10a8 8 0 0 0-14.9-3M4 14a8 8 0 0 0 14.9 3' },
  { key: 'fullscreen', name: '全屏', ready: true, icon: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' }
]
</script>

<style lang="scss" scoped>
.scene-tools {
  width: 52px;
  box-sizing: border-box;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: all;
  background: $bg-float;
  border: 1px solid $border;
  border-radius: $radius;
}
.tool {
  width: 44px;
  height: 44px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: $radius-sm;
  color: $text-muted;
  background: transparent;
  cursor: pointer;
  &.on {
    color: $text-strong;
    background: $accent-soft;
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
</style>
