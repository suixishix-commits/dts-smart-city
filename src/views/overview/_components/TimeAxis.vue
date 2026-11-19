<template>
  <div class="time-axis" :class="{ playing, dragging }">
    <button type="button" class="play" :aria-label="playing ? '暂停' : '播放' + subject" @click="togglePlay">
      <svg v-if="!playing" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" /></svg>
    </button>

    <div class="clock">
      <span class="now">{{ label }}</span>
      <span class="mode" :class="{ live: isLive }"><i></i>{{ isLive ? '实时' : playing ? '回放中' : '历史时刻' }}</span>
    </div>

    <!-- 播放倍速：点一下切到下一档 -->
    <button type="button" class="speed" :aria-label="`播放速度 ${rate} 倍，点击切换`" :title="`播放速度（一天约 ${Math.round(24 / SPEED / rate)} 秒）`" @click="nextRate">{{ rate }}×</button>

    <div ref="trackEl" class="track" @pointerdown="onDown" @pointermove="onHover" @pointerleave="hoverX = null">
      <!-- 峰值：轨道上方的小旗，不和下方刻度抢位置 -->
      <span class="peak" :style="{ left: pct(peakHour) }">
        <span class="peak-text">{{ peakLabel }} {{ format(peakHour) }}</span>
      </span>
      <span v-if="nowHour !== undefined" class="live-mark" :style="{ left: pct(nowHour) }" title="当前时刻"></span>

      <span class="rail">
        <span class="fill" :style="{ width: pct(display) }"></span>
      </span>
      <span class="thumb" :style="{ left: pct(display) }"></span>
      <span v-if="hoverX !== null && !dragging" class="ghost" :style="{ left: hoverX * 100 + '%' }">
        <span class="ghost-tip">{{ format(snap(hoverX * 24)) }}</span>
      </span>

      <span class="ticks" aria-hidden="true">
        <i v-for="h in 25" :key="h" :class="{ major: (h - 1) % 6 === 0 }" :style="{ left: pct(h - 1) }"></i>
      </span>
      <span class="labels" aria-hidden="true">
        <span v-for="h in MAJOR" :key="h" :style="{ left: pct(h) }">{{ String(h).padStart(2, '0') }}</span>
      </span>

      <!-- 键盘和读屏用的原生滑块：透明地盖在轨道上 -->
      <input type="range" min="0" max="24" step="0.5" :value="modelValue" aria-label="时刻" :aria-valuetext="format(modelValue)" @input="onInput" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    peakHour: number
    /** 当前真实时刻（小时）；给出时轨道上标出「实时」位置 */
    nowHour?: number
    /** 播放的是什么，用于按钮的无障碍名称 */
    subject?: string
    /** 峰值刻度的文字 */
    peakLabel?: string
  }>(),
  { subject: '人口密度变化', peakLabel: '峰值', nowHour: undefined }
)
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()

const MAJOR = [0, 6, 12, 18, 24]
/** 数据的时间粒度：场景和面板按半小时更新 */
const STEP = 0.5
/** 播放速度：每秒走过的小时数（1 倍时一天约 30 秒） */
const SPEED = 0.8
/** 可选的播放倍速 */
const RATES = [1, 2, 4] as const

function format(hour: number): string {
  const total = Math.round(Math.min(24, Math.max(0, hour)) * 60)
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0')
}
const snap = (h: number) => Math.min(24, Math.max(0, Math.round(h / STEP) * STEP))
const pct = (h: number) => (Math.min(24, Math.max(0, h)) / 24) * 100 + '%'

/**
 * 画面上显示的时刻：播放、拖动时连续变化（分钟一直在走，滑块平滑移动）；
 * 对外只在跨过半小时整点时 emit，场景和面板不会被逐帧刷新。
 */
const display = ref(props.modelValue)
const rate = ref<(typeof RATES)[number]>(1)
function nextRate() {
  rate.value = RATES[(RATES.indexOf(rate.value) + 1) % RATES.length]
}
const playing = ref(false)
const dragging = ref(false)
const hoverX = ref<number | null>(null)
const trackEl = ref<HTMLElement>()

const label = computed(() => format(display.value))
const isLive = computed(() => props.nowHour !== undefined && !playing.value && Math.abs(snap(display.value) - props.nowHour) < 0.01)

/** 最近一次发出（或外部给定）的时刻：每个半小时整点只通知一次，不依赖外部及时回传 */
let sent = props.modelValue
function send(q: number) {
  if (q === sent) return
  sent = q
  emit('update:modelValue', q)
}

// 外部改了时刻（别处设置、或 emit 回来的值）：不在播放 / 拖动时跟上
watch(
  () => props.modelValue,
  v => {
    sent = v
    if (!playing.value && !dragging.value) display.value = v
  }
)

/** 显示值变化时，跨过半小时整点才通知外部 */
function commit(h: number) {
  send(snap(h))
}

// ---- 播放：逐帧连续推进 ----
let frame = 0
let last: number | null = null
function tick(t: number) {
  if (last !== null) {
    let next = display.value + ((t - last) / 1000) * SPEED * rate.value
    if (next >= 24) next = 0
    display.value = next
    // 播放时向下取整到半小时：画面先走到，数据在整点切换
    send(Math.floor(next / STEP) * STEP)
  }
  last = t
  frame = requestAnimationFrame(tick)
}
function togglePlay() {
  playing.value = !playing.value
  cancelAnimationFrame(frame)
  last = null
  if (playing.value) {
    if (display.value >= 24) display.value = 0
    frame = requestAnimationFrame(tick)
  } else {
    // 暂停时吸附到半小时，和数据对齐
    display.value = snap(display.value)
    commit(display.value)
  }
}

// ---- 拖动：滑块完全跟手，松手吸附 ----
function hourAt(clientX: number): number {
  const r = (trackEl.value as HTMLElement).getBoundingClientRect()
  return (Math.min(Math.max(clientX - r.left, 0), r.width) / (r.width || 1)) * 24
}
function onDown(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  if (playing.value) togglePlay()
  dragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  const move = (ev: PointerEvent) => {
    display.value = hourAt(ev.clientX)
    commit(display.value)
  }
  const up = () => {
    dragging.value = false
    display.value = snap(display.value)
    commit(display.value)
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  move(e)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
function onHover(e: PointerEvent) {
  if (!trackEl.value) return
  hoverX.value = hourAt(e.clientX) / 24
}

/** 键盘（方向键）改的原生滑块 */
function onInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  display.value = v
  send(v)
}

onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<style lang="scss" scoped>
.time-axis {
  height: 64px;
  box-sizing: border-box;
  padding: 0 24px 0 12px;
  display: flex;
  align-items: center;
  gap: 16px;
  pointer-events: all;
  user-select: none;
}
// 播放键：圆形渐变，播放时外圈呼吸
.play {
  position: relative;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  color: #0b1220;
  background: linear-gradient(180deg, $accent-light, $accent);
  box-shadow:
    0 4px 14px rgba(76, 154, 255, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
  cursor: pointer;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease;
  svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }
  &:hover {
    transform: scale(1.06);
    box-shadow:
      0 6px 18px rgba(76, 154, 255, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.45);
  }
  &:active {
    transform: scale(0.96);
  }
  &:focus-visible {
    outline: 2px solid $accent-light;
    outline-offset: 3px;
  }
}
.playing .play::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1.5px solid rgba(143, 192, 255, 0.6);
  animation: breathe 1.6s ease-out infinite;
}
@keyframes breathe {
  from {
    transform: scale(0.92);
    opacity: 1;
  }
  to {
    transform: scale(1.25);
    opacity: 0;
  }
}
.speed {
  flex-shrink: 0;
  width: 36px;
  height: 24px;
  padding: 0;
  border: 1px solid $border;
  border-radius: $radius-sm;
  font-family: $font-num;
  font-size: 13px;
  font-weight: 600;
  color: $text;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition:
    color 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease;
  &:hover {
    color: $text-strong;
    border-color: $accent;
    background: $accent-soft;
  }
}
.clock {
  flex-shrink: 0;
  width: 72px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.now {
  font-size: 22px;
  font-weight: 600;
  line-height: 26px;
  letter-spacing: 0.5px;
  color: $text-strong;
  font-variant-numeric: tabular-nums;
}
.mode {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: $text-muted;
  i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: $text-muted;
  }
  &.live {
    color: #69db7c;
    i {
      background: #51cf66;
      box-shadow: 0 0 0 3px rgba(81, 207, 102, 0.2);
    }
  }
}
.track {
  position: relative;
  flex-grow: 1;
  align-self: stretch;
  cursor: pointer;
  touch-action: none;
}
// 轨道在上 1/3 处，下面是刻度和小时
.rail {
  position: absolute;
  left: 0;
  right: 0;
  top: 26px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.09);
}
.fill {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, rgba(76, 154, 255, 0.35), $accent 60%, $accent-light);
  box-shadow: 0 0 10px rgba(76, 154, 255, 0.55);
  transition: width 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.thumb {
  position: absolute;
  top: 28px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  box-shadow:
    0 0 0 3px rgba(76, 154, 255, 0.9),
    0 0 14px 2px rgba(76, 154, 255, 0.65);
  transition:
    left 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 160ms ease;
  pointer-events: none;
}
// 播放、拖动时逐帧更新，去掉过渡才跟手
.playing,
.dragging {
  .fill,
  .thumb {
    transition: none;
  }
}
.dragging .thumb,
.track:hover .thumb {
  transform: translate(-50%, -50%) scale(1.2);
}
.ticks i {
  position: absolute;
  top: 34px;
  width: 1px;
  height: 4px;
  background: rgba(255, 255, 255, 0.16);
  &.major {
    height: 7px;
    background: rgba(255, 255, 255, 0.35);
  }
}
.labels span {
  position: absolute;
  top: 43px;
  transform: translateX(-50%);
  font-size: 11px;
  line-height: 14px;
  color: $text-muted;
  font-variant-numeric: tabular-nums;
}
.peak {
  position: absolute;
  top: 6px;
  width: 0;
  height: 18px;
  border-left: 1.5px dashed rgba(255, 169, 77, 0.8);
  pointer-events: none;
  &::after {
    content: '';
    position: absolute;
    left: -4.5px;
    top: 15px;
    width: 7px;
    height: 7px;
    background: #ffa94d;
    transform: rotate(45deg);
    box-shadow: 0 0 8px rgba(255, 169, 77, 0.8);
  }
}
.peak-text {
  position: absolute;
  left: 6px;
  top: -4px;
  font-size: 11px;
  line-height: 14px;
  white-space: nowrap;
  color: #ffc078;
}
.live-mark {
  position: absolute;
  top: 22px;
  width: 2px;
  height: 12px;
  margin-left: -1px;
  border-radius: 1px;
  background: #51cf66;
  box-shadow: 0 0 6px rgba(81, 207, 102, 0.8);
  pointer-events: none;
}
// 悬停位置的竖线和时刻提示
.ghost {
  position: absolute;
  top: 18px;
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.45);
  pointer-events: none;
}
.ghost-tip {
  position: absolute;
  bottom: 22px;
  left: 0;
  transform: translateX(-50%);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 14px;
  white-space: nowrap;
  color: $text-strong;
  background: rgba(10, 14, 20, 0.92);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}
input[type='range'] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  pointer-events: none;
  &:focus-visible + * {
    outline: none;
  }
}
// 键盘聚焦到滑块时，滑块外圈加粗提示
.track:focus-within .thumb {
  box-shadow:
    0 0 0 3px $accent-light,
    0 0 16px 3px rgba(76, 154, 255, 0.8);
}
@media (prefers-reduced-motion: reduce) {
  .fill,
  .thumb,
  .play {
    transition: none;
  }
  .playing .play::after {
    animation: none;
  }
}
</style>
