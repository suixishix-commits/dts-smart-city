<template>
  <div class="camera-feed" :class="{ compact }">
    <video v-if="streamUrl && online" class="media" :src="streamUrl" autoplay muted loop playsinline></video>
    <canvas v-else ref="canvas" class="media" aria-hidden="true"></canvas>
    <div class="osd" :class="{ off: !online }">
      <span class="osd-id">{{ cameraId }}</span>
      <span v-if="online" class="osd-rec" :class="{ replay: replayMinutes > 0 }"><i></i>{{ replayMinutes > 0 ? 'REPLAY' : streamUrl ? 'LIVE' : 'SIM' }}</span>
      <span class="osd-time">{{ time }}</span>
    </div>
    <span v-if="!online" class="no-signal">信号中断</span>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createFeedScene, drawNoSignal, type FeedScene } from './feedScene'

const props = withDefaults(
  defineProps<{
    cameraId: string
    online?: boolean
    compact?: boolean
    /** 历史回放：画面时间往前推多少分钟（0 为实时）。回放时右上角标 REPLAY，时间水印显示回放时刻 */
    replayMinutes?: number
  }>(),
  { online: true, compact: false, replayMinutes: 0 }
)

/**
 * 摄像头画面。public/config/smart-city.js 的 cameraStreams 里配置了这路摄像头的视频地址（mp4 / webm）就直接播放；
 * 没配置时画一段按摄像头编号固定的模拟路口画面（车流、行人），右上角标 SIM，和真实画面区分开。离线摄像头显示「信号中断」。
 */
const streamUrl = computed<string>(() => gVar?.smartCity?.cameraStreams?.[props.cameraId] ?? '')

const canvas = ref<HTMLCanvasElement | null>(null)
const stamp = () => dayjs().subtract(props.replayMinutes, 'minute').format('YYYY-MM-DD HH:mm:ss')
const time = ref(stamp())
/** 模拟画面的帧率：监控画面 12 帧足够，省 CPU */
const FPS = 12

let scene: FeedScene | null = null
let raf = 0
let last = 0
let resize: ResizeObserver | null = null

function fit() {
  const el = canvas.value
  if (!el) return
  const ratio = Math.min(2, window.devicePixelRatio || 1)
  el.width = Math.max(1, Math.round(el.clientWidth * ratio))
  el.height = Math.max(1, Math.round(el.clientHeight * ratio))
  scene = props.online ? createFeedScene(props.cameraId, el.width, el.height) : null
  if (!props.online) drawNoSignal(el)
}

function frame(now: number) {
  raf = requestAnimationFrame(frame)
  if (now - last < 1000 / FPS || document.hidden) return
  last = now
  time.value = stamp()
  const el = canvas.value
  if (!el) return
  // 回放时画面时间也往前推，车流和实时画面不同
  if (scene) scene.draw(el, now / 1000 - props.replayMinutes * 60)
  else if (!props.online) drawNoSignal(el, now / 1000)
}

function start() {
  cancelAnimationFrame(raf)
  resize?.disconnect()
  resize = null
  if (!canvas.value) {
    // 播放真实视频时只走时钟
    raf = requestAnimationFrame(frame)
    return
  }
  fit()
  resize = new ResizeObserver(fit)
  resize.observe(canvas.value)
  raf = requestAnimationFrame(frame)
}

onMounted(start)
watch(() => [props.cameraId, props.online, streamUrl.value], () => requestAnimationFrame(start))
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  resize?.disconnect()
})
</script>

<style lang="scss" scoped>
.camera-feed {
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background: #0b0f14;
}
.media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.osd {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  &.off {
    color: $text-muted;
  }
}
.osd-time {
  margin-left: auto;
}
.osd-rec {
  display: flex;
  align-items: center;
  gap: 4px;
  i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: $level-1;
  }
  &.replay i {
    border-radius: 0;
    background: $level-3;
  }
}
.compact .osd {
  font-size: 10px;
  .osd-id {
    display: none;
  }
}
.no-signal {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $fs-aux;
  color: $text-muted;
}
</style>
