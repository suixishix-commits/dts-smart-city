<template>
  <div class="scene-tools-stack">
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
    <!-- 视角控件：俯视 / 斜视、缩放、绕画面中心旋转 -->
    <div class="scene-tools view" role="toolbar" aria-label="视角">
      <!-- 2D / 3D 两个键，当前模式高亮；点另一个才切换 -->
      <button type="button" class="tool text" :class="{ on: topDown }" :aria-pressed="topDown ? 'true' : 'false'" title="俯视（2D）" aria-label="俯视 2D" @click="!topDown && emit('tool', 'topdown')">2D</button>
      <button type="button" class="tool text" :class="{ on: !topDown }" :aria-pressed="topDown ? 'false' : 'true'" title="斜视（3D）" aria-label="斜视 3D" @click="topDown && emit('tool', 'topdown')">3D</button>
      <button v-for="v in VIEW" :key="v.key" type="button" class="tool" :aria-label="v.name" :title="v.name" @click="emit('tool', v.key)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path :d="v.icon" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ active?: string[] }>(), { active: () => [] })
const topDown = computed(() => props.active.includes('topdown'))
const emit = defineEmits<{ (e: 'tool', key: string): void }>()

const TOOLS = [
  { key: 'layers', name: '图层管理', ready: true, icon: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5' },
  { key: 'tour', name: '城市巡航', ready: true, icon: 'M5 3l14 9-14 9V3z' },
  { key: 'measure', name: '测量', ready: true, icon: 'M3 17L17 3l4 4L7 21l-4-4zM7 13l2 2M10 10l2 2M13 7l2 2' },
  { key: 'night', name: '昼夜切换', ready: true, icon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' },
  { key: 'rain', name: '天气模拟', ready: true, icon: 'M7 16h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 9.1 3.5 3.5 0 0 0 7 16zM9 20v1M13 20v1M17 20v1' },
  { key: 'snapshot', name: '截图', ready: true, icon: 'M4 8h3l2-3h6l2 3h3v11H4V8zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z' },
  { key: 'reset', name: '视角复位', ready: true, icon: 'M4 4v6h6M20 20v-6h-6M20 10a8 8 0 0 0-14.9-3M4 14a8 8 0 0 0 14.9 3' },
  { key: 'fullscreen', name: '全屏', ready: true, icon: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' }
]

const VIEW = [
  { key: 'zoomIn', name: '拉近', icon: 'M12 5v14M5 12h14' },
  { key: 'zoomOut', name: '拉远', icon: 'M5 12h14' },
  { key: 'rotateLeft', name: '向左旋转', icon: 'M4 9a8 8 0 1 1 1.6 8.6M4 4v5h5' },
  { key: 'rotateRight', name: '向右旋转', icon: 'M20 9a8 8 0 1 0-1.6 8.6M20 4v5h-5' }
]
</script>

<style lang="scss" scoped>
.scene-tools-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}
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
  &:hover:not(:disabled, .on) {
    color: $text;
    background: rgba(255, 255, 255, 0.05);
  }
  &.text {
    font-family: $font-num;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
}
</style>
