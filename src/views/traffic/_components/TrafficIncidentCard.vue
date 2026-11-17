<template>
  <div class="traffic-incident-card">
    <div class="head">
      <span class="tag" :style="{ background: INCIDENT_COLOR[incident.type] }">{{ INCIDENT_TEXT[incident.type] }}</span>
      <h3 class="name">{{ incident.title }}</h3>
      <button type="button" class="close" aria-label="关闭" @click="emit('close')">×</button>
    </div>
    <div v-if="camera" class="feed-wrap">
      <CameraFeed class="feed" :camera-id="camera.id" :online="camera.online" />
      <div class="feed-caption">
        <span class="feed-name">{{ camera.name }}</span>
        <span class="feed-meta">{{ cameraIndex + 1 }} / {{ incident.cameras.length }} · 距事件点 {{ camera.distance }} m</span>
      </div>
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
    </dl>
    <dl v-if="detourShown && incident.detour" class="info detour">
      <dt>绕行</dt>
      <dd>{{ incident.detour.fromName }} → {{ incident.detour.toName }}</dd>
      <dt>路线</dt>
      <dd>{{ incident.detour.via }}</dd>
      <dt>里程</dt>
      <dd>
        <b>{{ incident.detour.lengthKm.toFixed(1) }} km</b>（原路 {{ incident.detour.directKm.toFixed(1) }} km，多 {{ extraKm }} km）
      </dd>
      <dt>用时</dt>
      <dd>
        <b>约 {{ incident.detour.minutes }} 分钟</b>（原路排队约 {{ incident.detour.directMinutes }} 分钟，{{ saving }}）
      </dd>
    </dl>
    <div class="actions">
      <button type="button" class="primary" :disabled="incident.cameras.length < 2" @click="emit('camera')">查看周边视频</button>
      <button type="button" class="secondary" :class="{ on: detourShown }" :disabled="!incident.detour" :title="incident.detour ? '' : '附近没有可用的平行道路'" @click="emit('detour')">
        {{ detourShown ? '收起绕行' : '绕行方案' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { INCIDENT_TEXT } from '@/api/mock/traffic'
import CameraFeed from '@/components/video/CameraFeed.vue'
import type { TrafficIncident } from '@/types/traffic'
import { computed } from 'vue'
import { INCIDENT_COLOR } from '../TrafficScene'

const props = defineProps<{
  incident: TrafficIncident
  /** 正在看第几路周边摄像头 */
  cameraIndex: number
  /** 场景里是否画着绕行方案 */
  detourShown: boolean
}>()
/** camera：切到下一路周边摄像头；detour：画出 / 收起绕行方案 */
const emit = defineEmits<{ (e: 'close'): void; (e: 'camera'): void; (e: 'detour'): void }>()

const camera = computed(() => props.incident.cameras[props.cameraIndex] ?? props.incident.cameras[0] ?? null)
const extraKm = computed(() => (props.incident.detour ? Math.max(0, props.incident.detour.lengthKm - props.incident.detour.directKm).toFixed(1) : '0'))
/** 绕行比原路排队快多少分钟；不比原路快时如实说明 */
const saving = computed(() => {
  const d = props.incident.detour
  if (!d) return ''
  const n = d.directMinutes - d.minutes
  return n > 0 ? '节省约 ' + n + ' 分钟' : '不比原路快，仅在排队加剧时建议'
})
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
.feed-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.feed {
  height: 140px;
  flex-shrink: 0;
}
.feed-caption {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: $fs-aux;
  color: $text-muted;
}
.feed-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: $text;
}
.feed-meta {
  flex-shrink: 0;
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
// 按设计稿：两个等宽按钮，主按钮实色强调，次按钮描边（与 DetailCard 一致）
.actions {
  display: flex;
  gap: 8px;
  button {
    flex: 1 1 0;
    height: 44px;
    border-radius: $radius-sm;
    font: inherit;
    font-size: $fs-body;
    cursor: pointer;
    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }
  .primary {
    font-weight: 500;
    color: $bg-page;
    background: $accent;
    border: 0;
    &:hover:not(:disabled) {
      background: $accent-light;
    }
  }
  .secondary {
    color: $text;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.2);
    &:hover:not(:disabled),
    &.on {
      border-color: $accent-light;
    }
  }
}
</style>
