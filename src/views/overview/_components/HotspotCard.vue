<template>
  <div class="hotspot-card">
    <div class="head">
      <span class="no">{{ rank }}</span>
      <h3 class="name">{{ hotspot.name }}</h3>
      <button type="button" class="close" aria-label="关闭" @click="emit('close')">×</button>
    </div>
    <button type="button" class="video" :aria-label="'定位摄像头 ' + current.id" title="点击画面定位摄像头" @click="emit('locate', current.id)">
      <CameraFeed class="feed" :camera-id="current.id" :online="current.online" />
    </button>
    <div class="stats">
      <StatItem label="热度" :value="hotspot.heat" />
      <StatItem label="现场人数" :value="people" />
      <StatItem label="周边摄像头" :value="hotspot.nearbyCameras" unit="路" />
    </div>
    <dl v-if="expanded" class="info">
      <dt>事件类型</dt>
      <dd>{{ hotspot.type }}</dd>
      <dt>所在片区</dt>
      <dd>{{ districtName }}</dd>
      <dt>当前画面</dt>
      <dd>{{ current.id }} {{ current.name }}（{{ cameraIndex + 1 }} / {{ cameras.length }}）</dd>
      <dt>活跃度</dt>
      <dd>{{ activityText }}</dd>
      <dt>处置建议</dt>
      <dd>{{ advice }}</dd>
    </dl>
    <div class="actions">
      <button type="button" class="primary" :disabled="cameras.length < 2" @click="next">切换摄像头</button>
      <button type="button" class="secondary" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? '收起详情' : '事件详情' }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { hotspotActivityAt } from '@/api/mock/population'
import CameraFeed from '@/components/video/CameraFeed.vue'
import type { Camera, Hotspot } from '@/types/smartCity'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  hotspot: Hotspot
  rank: number
  /** 周边摄像头，按距离从近到远；第一路是热点的关联摄像头 */
  cameras: Camera[]
  /** 当前画面的摄像头 id */
  cameraId: string | null
  districtName: string
  hour: number
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'camera', id: string): void; (e: 'locate', id: string): void }>()

const expanded = ref(false)
watch(
  () => props.hotspot.id,
  () => (expanded.value = false)
)

const cameraIndex = computed(() => Math.max(0, props.cameras.findIndex(c => c.id === props.cameraId)))
const current = computed<Camera>(() => props.cameras[cameraIndex.value] ?? { id: props.hotspot.cameraId, name: '', position: props.hotspot.position, online: true, featured: false })

/** 切到下一路周边摄像头（只换画面和高亮，不移动相机） */
function next() {
  if (props.cameras.length < 2) return
  emit('camera', props.cameras[(cameraIndex.value + 1) % props.cameras.length].id)
}

const activity = computed(() => hotspotActivityAt(props.hotspot, props.hour))
const activityText = computed(() => `${Math.round(activity.value * 100)}%（所选时刻）`)
const advice = computed(() => (props.hotspot.heat >= 90 ? '增派警力疏导，开放临时通道，每 15 分钟通报客流' : props.hotspot.heat >= 75 ? '关注客流变化，周边路口加强指挥' : '常态巡查'))

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
  position: relative;
  height: 140px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  cursor: pointer;
  &:focus-visible {
    outline: 2px solid $accent-light;
    outline-offset: 2px;
  }
}
.feed {
  position: absolute;
  inset: 0;
}
.info {
  margin: 0;
  padding-top: 12px;
  border-top: 1px solid $divider;
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
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
}
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
      cursor: default;
      opacity: 0.5;
    }
    &:focus-visible {
      outline: 2px solid $accent-light;
      outline-offset: 2px;
    }
  }
  .primary {
    font-weight: 500;
    color: $bg-page;
    background: $accent;
    border: 0;
  }
  .secondary {
    color: $text;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
</style>
