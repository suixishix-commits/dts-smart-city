<template>
  <div class="time-axis">
    <button type="button" class="play" :aria-label="playing ? '暂停' : '播放' + subject" @click="togglePlay">
      <svg v-if="!playing" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4l14 8-14 8V4z" /></svg>
      <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
    </button>
    <span class="now">{{ label }}</span>
    <div class="track">
      <input type="range" min="0" max="24" step="0.5" :value="modelValue" aria-label="时刻" @input="onInput" />
      <span class="peak" :style="{ left: (peakHour / 24) * 100 + '%' }">{{ peakLabel }} {{ format(peakHour) }}</span>
      <div class="ticks"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

const props = withDefaults(defineProps<{ modelValue: number; peakHour: number; /** 播放的是什么，用于按钮的无障碍名称 */ subject?: string; /** 峰值刻度的文字 */ peakLabel?: string }>(), { subject: '人口密度变化', peakLabel: '峰值' })
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()

const STEP = 0.5
const INTERVAL = 800

function format(hour: number): string {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
}

const label = computed(() => format(props.modelValue))
const playing = ref(false)
let timer = 0

function onInput(e: Event) {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
}

function togglePlay() {
  playing.value = !playing.value
  window.clearInterval(timer)
  if (playing.value) {
    timer = window.setInterval(() => {
      const next = props.modelValue + STEP
      emit('update:modelValue', next > 24 ? 0 : next)
    }, INTERVAL)
  }
}

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<style lang="scss" scoped>
.time-axis {
  height: 60px;
  box-sizing: border-box;
  padding: 0 16px 0 8px;
  display: flex;
  align-items: center;
  gap: 16px;
  pointer-events: all;
  background: $bg-float;
  border: 1px solid $border;
  border-radius: $radius;
}
.play {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: $radius-sm;
  color: $text-strong;
  background: $accent-soft;
  cursor: pointer;
}
.now {
  flex-shrink: 0;
  width: 56px;
  font-size: 18px;
  font-weight: 600;
  color: $text-strong;
}
.track {
  position: relative;
  flex-grow: 1;
  height: 44px;
  input {
    width: 100%;
    height: 24px;
    margin: 0;
    accent-color: $accent;
    cursor: pointer;
  }
}
.peak {
  position: absolute;
  top: 24px;
  transform: translateX(-50%);
  padding-top: 2px;
  font-size: 12px;
  white-space: nowrap;
  color: $level-2;
  border-left: 2px solid $level-2;
  padding-left: 4px;
}
.ticks {
  position: absolute;
  left: 0;
  right: 0;
  top: 26px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: $text-muted;
  pointer-events: none;
}
</style>
