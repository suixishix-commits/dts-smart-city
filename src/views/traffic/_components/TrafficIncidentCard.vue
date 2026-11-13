<template>
  <div class="traffic-incident-card">
    <div class="head">
      <span class="tag" :style="{ background: INCIDENT_COLOR[incident.type] }">{{ INCIDENT_TEXT[incident.type] }}</span>
      <h3 class="name">{{ incident.title }}</h3>
      <button type="button" class="close" aria-label="关闭" @click="emit('close')">×</button>
    </div>
    <div class="stats">
      <StatItem label="占用车道" :value="incident.lanes" unit="条" />
      <StatItem label="排队长度" :value="incident.queue" unit="m" />
      <StatItem label="发生时间" :value="incident.time" />
    </div>
    <dl class="info">
      <dt>路口</dt>
      <dd>{{ incident.intersectionName }}</dd>
      <dt>道路</dt>
      <dd>{{ incident.roadNames[0] }}、{{ incident.roadNames[1] }}</dd>
      <dt>片区</dt>
      <dd>{{ incident.districtName }}</dd>
      <dt>处置</dt>
      <dd>
        <b>{{ incident.status }}</b> · {{ incident.handling }}
      </dd>
      <dt>摄像头</dt>
      <dd>{{ incident.cameraId }} · 距事件点 {{ incident.cameraDistance }} m</dd>
    </dl>
  </div>
</template>

<script setup lang="ts">
import { INCIDENT_TEXT } from '@/api/mock/traffic'
import type { TrafficIncident } from '@/types/traffic'
import { INCIDENT_COLOR } from '../TrafficScene'

defineProps<{ incident: TrafficIncident }>()
const emit = defineEmits<{ (e: 'close'): void }>()
</script>

<style lang="scss" scoped>
.traffic-incident-card {
  width: 300px;
  box-sizing: border-box;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
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
.tag {
  flex-shrink: 0;
  width: 40px;
  height: 22px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: $bg-page;
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
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.info {
  margin: 0;
  padding-top: 12px;
  border-top: 1px solid $divider;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 8px;
  font-size: $fs-aux;
  line-height: 20px;
  dt {
    color: $text-muted;
  }
  dd {
    margin: 0;
    color: $text;
  }
  b {
    font-weight: 600;
    color: $text-strong;
  }
}
</style>
