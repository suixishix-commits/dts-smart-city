<template>
  <div class="hotspot-card">
    <div class="head">
      <span class="no">{{ rank }}</span>
      <h3 class="name">{{ hotspot.name }}</h3>
      <button type="button" class="close" aria-label="关闭" @click="emit('close')">×</button>
    </div>
    <div class="video">
      <span>{{ hotspot.cameraId }} 现场画面占位</span>
      <span>接入摄像头视频流</span>
    </div>
    <div class="stats">
      <StatItem label="热度" :value="hotspot.heat" />
      <StatItem label="现场人数" :value="people" />
      <StatItem label="周边摄像头" :value="hotspot.nearbyCameras" unit="路" />
    </div>
    <button type="button" class="primary" @click="emit('camera', hotspot.cameraId)">定位摄像头</button>
  </div>
</template>

<script setup lang="ts">
import type { Hotspot } from '@/types/smartCity'
import { computed } from 'vue'

const props = defineProps<{ hotspot: Hotspot; rank: number }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'camera', id: string): void }>()

const people = computed(() => (props.hotspot.people >= 10000 ? (props.hotspot.people / 10000).toFixed(1) + ' 万' : props.hotspot.people.toLocaleString()))
</script>

<style lang="scss" scoped>
.hotspot-card {
  width: 280px;
  box-sizing: border-box;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: all;
  background: rgba(17, 22, 30, 0.96);
  border: 1px solid $border-strong;
  border-radius: $radius;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.no {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $fs-aux;
  font-weight: 700;
  color: $bg-page;
  background: $level-1;
}
.name {
  flex-grow: 1;
  font-size: 15px;
  font-weight: 600;
  color: $text-strong;
}
.close {
  width: 44px;
  height: 44px;
  margin: -10px -12px -10px 0;
  border: 0;
  font-size: 20px;
  color: $text-muted;
  background: none;
  cursor: pointer;
}
.video {
  height: 140px;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: $fs-aux;
  color: $text-muted;
  background: $bg-inset;
  border: 1px dashed rgba(255, 255, 255, 0.2);
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.primary {
  height: 44px;
  border: 0;
  border-radius: $radius-sm;
  font-family: inherit;
  font-size: $fs-body;
  font-weight: 500;
  color: $bg-page;
  background: $accent;
  cursor: pointer;
}
</style>
