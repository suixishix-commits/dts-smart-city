<template>
  <div class="slider-wrap">
    <section class="tl" aria-label="24 小时时间轴">
      <div class="controls">
        <button type="button" class="play" :title="isShowPlay ? '暂停' : '播放'" @click="isShowPlay ? stopHandle() : playHandle()">
          <i v-if="isShowPlay" class="pause"></i>
          <svg v-else viewBox="0 0 16 16"><path d="M4.667 2.667 13.333 8l-8.666 5.333V2.667Z" fill="#fff" /></svg>
        </button>
        <div class="speed" role="group" aria-label="播放倍速">
          <i class="thumb" :style="{ transform: `translateX(${SPEEDS.indexOf(speedTime) * 4.2}rem)` }"></i>
          <button v-for="v in SPEEDS" :key="v" type="button" :class="{ on: speedTime === v }" @click="changeSpeedTime(v)">{{ v }}×</button>
        </div>
        <p class="time">
          <b>{{ currentTime }}</b><span>/ 24:00:00</span>
        </p>
        <el-date-picker
          v-model="dateValue"
          class="date-pick"
          value-format="YYYY-MM-DD"
          type="date"
          :disabled-date="disabledDate"
          :clearable="false"
          @change="changeDate"
        />
        <p class="readout"><i></i>有数据时段<b>{{ intervalData.length }}</b></p>
        <button type="button" class="reset" @click="resetHandle">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.46" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.25 7A5.25 5.25 0 1 1 10.7 3.3M12.25 1.75v2.92H9.33" />
          </svg>
          回到当前
        </button>
      </div>
      <div
        class="track"
        :class="{ dragging }"
        role="slider"
        tabindex="0"
        aria-label="当前时刻"
        :aria-valuemin="0"
        :aria-valuemax="DAY_SECONDS"
        :aria-valuenow="currentSecond"
        :aria-valuetext="currentTime"
        @pointerdown="down"
        @pointermove="dragging && seekAt($event)"
        @pointerup="up"
        @pointercancel="up"
        @keydown="key"
      >
        <span class="rail">
          <!-- 有历史数据的时段 -->
          <span
            v-for="(item, index) in intervalData"
            :key="index"
            class="block"
            :style="{ left: pct(timeToSecond(item.startTime)), width: pct(Math.max(60, timeToSecond(item.endTime) - timeToSecond(item.startTime))) }"
          ></span>
          <!-- 当天还没到的时段 -->
          <span v-if="isToday" class="future" :style="{ left: pct(nowSecond) }"></span>
        </span>
        <span class="played" :style="{ width: pct(currentSecond) }"></span>
        <span v-for="t in ticks" :key="t.s" class="tick" :class="[t.k, { end: t.s === DAY_SECONDS }]" :style="{ left: pct(t.s) }"></span>
        <span v-for="s in labels" :key="`l${s}`" class="label" :class="{ first: s === 0, end: s === DAY_SECONDS }" :style="{ left: pct(s) }">{{
          secondsToTime(s).slice(0, 5)
        }}</span>
        <span class="head" :style="{ left: pct(currentSecond) }"></span>
      </div>
    </section>
  </div>
</template>

<script setup>
/**
 * 24 小时时间轴（IDD 水动力回放时间轴样式）：播放 / 暂停、1× / 2× / 3× 倍速、当前时刻、日期、有数据时段、回到当前；
 * 轨道上标出有历史数据的时段，当天未到的时段置灰，点击或拖动跳到对应时刻，左右方向键逐分钟。
 * 位置全部按百分比，不量像素，分辨率变化时不用重算。
 */
import dayjs from 'dayjs'

const emit = defineEmits(['changeTime', 'currentTimeFn', 'statusHandle', 'resetHandle', 'clickTime'])

// 用于点击某个对象展示时间轴某个时间段内有历史数据
const props = defineProps({
  curPid: {
    type: String,
    default: ''
  }
})

const DAY_SECONDS = 24 * 60 * 60
/** 倍速：每秒推进的秒数 */
const SPEEDS = [1, 2, 3]
/** 刻度每 30 分钟一根，整点更长，每 2 小时一个标注 */
const LABEL_STEP = 2 * 3600
const ticks = Array.from({ length: DAY_SECONDS / 1800 + 1 }, (_, i) => ({
  s: i * 1800,
  k: (i * 1800) % LABEL_STEP === 0 ? 'major' : i % 2 === 0 ? 'mid' : ''
}))
const labels = Array.from({ length: DAY_SECONDS / LABEL_STEP + 1 }, (_, i) => i * LABEL_STEP)

const speedTime = ref(1)
const dateValue = ref(dayjs().format('YYYY-MM-DD'))
const today = ref(dayjs().format('YYYY-MM-DD'))
const isShowPlay = ref(true)
const timeData = ref([]) // 历史轨迹 list
const intervalData = ref([])
const currentSecond = ref(0)
const currentTime = ref('00:00:00')
const nowSecond = ref(0)
const dragging = ref(false)
const view = reactive({
  hisStartTime: '',
  hisEndTime: ''
})
let Timer = null

const isToday = computed(() => dateValue.value === today.value)
const pct = (s) => `${(s / DAY_SECONDS) * 100}%`

// 时间转秒数
const timeToSecond = (time) => {
  const t = dayjs(time)
  return t.hour() * 3600 + t.minute() * 60 + t.second()
}
// 秒数转时分秒
const secondsToTime = (seconds) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return [hours, minutes, secs].map((v) => String(v).padStart(2, '0')).join(':')
}

/** 当天不能跳到还没到的时刻 */
const clampSecond = (s) => Math.max(0, Math.min(isToday.value ? nowSecond.value : DAY_SECONDS, Math.round(s)))

const setSecond = (s) => {
  currentSecond.value = clampSecond(s)
  currentTime.value = secondsToTime(currentSecond.value)
}

// 处理时间，形成间隔在五分钟内的新时间对象
const filteredTimes = () => {
  intervalData.value = []
  const times = timeData.value.map((item) => new Date(item.lastTime)).sort((a, b) => a - b)
  if (!times.length) return
  const result = []
  let startTime = times[0]
  let endTime = times[0]
  for (let i = 1; i < times.length; i++) {
    if ((times[i] - endTime) / 60000 <= 5) {
      endTime = times[i]
    } else {
      result.push({ startTime, endTime })
      startTime = endTime = times[i]
    }
  }
  result.push({ startTime, endTime })
  intervalData.value = result.map((item) => ({
    startTime: dayjs(item.startTime).format('YYYY-MM-DD HH:mm:ss'),
    endTime: dayjs(item.endTime).format('YYYY-MM-DD HH:mm:ss')
  }))
}

// 获取历史轨迹数据（用于在时间轴上绘制时间区块），演示数据
const getHistory = () => {
  const day = dayjs().format('YYYY-MM-DD')
  const demo = ['8:00:09', '8:03:09', '8:05:09', '8:07:09', '8:09:09', '8:11:09', '8:13:09', '8:16:09', '8:19:09', '8:22:09', '8:25:09', '8:28:09', '8:31:09']
  timeData.value = [...demo, '13:10:00', '13:14:00', '13:18:00', '13:21:00', '17:40:00', '17:44:00'].map((t) => ({ lastTime: `${day} ${t}` }))
  filteredTimes()
}

// ---- 播放 ----

const tick = () => {
  nowSecond.value = timeToSecond(new Date())
  if (!isShowPlay.value || dragging.value) return
  const next = currentSecond.value + speedTime.value
  // 当天播到当前时刻就跟着实时走；其它日期播到末尾停下
  if (!isToday.value && next >= DAY_SECONDS) {
    setSecond(DAY_SECONDS)
    stopHandle()
    return
  }
  setSecond(next)
}

const startTimer = () => {
  if (Timer) clearInterval(Timer)
  Timer = setInterval(tick, 1000)
}

// 恢复
const playHandle = () => {
  isShowPlay.value = true
}
// 暂停
const stopHandle = () => {
  isShowPlay.value = false
}

const disabledDate = (current) => current && current > dayjs().endOf('day')

// 监听日期变化
const changeDate = () => {
  setSecond(isToday.value ? nowSecond.value : 0)
}
// 切换倍速
const changeSpeedTime = (val) => {
  speedTime.value = val
}

const resetInit = () => {
  dateValue.value = dayjs().format('YYYY-MM-DD')
  nowSecond.value = timeToSecond(new Date())
  setSecond(nowSecond.value)
}

// 重置按钮：回到今天的当前时刻并继续播放
const resetHandle = () => {
  resetInit()
  playHandle()
  emit('resetHandle')
}

defineExpose({
  stopHandle,
  resetInit
})

// ---- 拖动 / 点击 / 键盘 ----

/** 按指针位置跳到对应时刻 */
const seekAt = (e) => {
  const r = e.currentTarget.getBoundingClientRect()
  setSecond((Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * DAY_SECONDS))
}
const down = (e) => {
  if (e.button !== 0) return
  dragging.value = true
  // 捕获指针：拖出轨道也能继续拖
  e.currentTarget.setPointerCapture(e.pointerId)
  seekAt(e)
}
const up = () => {
  if (!dragging.value) return
  dragging.value = false
  emit('clickTime', currentTime.value, currentSecond.value)
}
/** 左右方向键逐分钟（Shift 逐小时），Home / End 到头尾 */
const key = (e) => {
  const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
  if (step) setSecond(currentSecond.value + step * (e.shiftKey ? 3600 : 60))
  else if (e.key === 'Home') setSecond(0)
  else if (e.key === 'End') setSecond(DAY_SECONDS)
  else return
  e.preventDefault()
  emit('clickTime', currentTime.value, currentSecond.value)
}

// 监听 id 变化（用于点击某个人员时候显示时间轴对应时间色块）
watch(
  () => props.curPid,
  (newVal) => {
    intervalData.value = []
    if (newVal != '') {
      view.hisStartTime = dateValue.value + ' 00:00:00'
      view.hisEndTime = isToday.value ? dayjs().format('YYYY-MM-DD HH:mm:ss') : dateValue.value + ' 23:59:59'
      getHistory()
    }
  }
)

watch(currentTime, () => {
  // 拖动中不抛出，松手时抛 clickTime
  if (!dragging.value) emit('currentTimeFn', currentTime.value, currentSecond.value)
})
watch(isShowPlay, () => emit('statusHandle', isShowPlay.value))
watch(dateValue, () => emit('changeTime', dateValue.value))

onMounted(() => {
  resetInit()
  startTimer()
  // 演示：加载历史轨迹色块
  getHistory()
})

onBeforeUnmount(() => {
  if (Timer) clearInterval(Timer)
  Timer = null
})
</script>

<style lang="scss" scoped>
@use './timeline-idd' as tl;

.slider-wrap {
  padding: 20px;
}

.tl {
  @include tl.panel;
  @include tl.date-pick;
  height: 100px;
}

@include tl.controls;
@include tl.track;

.time {
  display: flex;
  flex: none;
  gap: 4px;
  align-items: baseline;
  margin: 0 9px;
  font-variant-numeric: tabular-nums;

  b {
    min-width: 72px;
    color: var(--t1);
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
  }

  span {
    color: var(--t1-a55);
    font-size: 12px;
    line-height: 16px;
  }
}

.readout {
  display: flex;
  flex: none;
  gap: 6px;
  align-items: center;
  height: 20px;
  margin: 0 0 0 auto;
  padding-left: 16px;
  border-left: 1px solid rgba(var(--t1-rgb), 0.1);
  color: var(--t1-a65);
  font-size: 12px;
  line-height: 16px;

  i {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: rgba(113, 166, 255, 0.85);
  }

  b {
    color: var(--t1);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}

// 有数据时段：底轨里的蓝色块；当天未到的时段：斜纹置灰
.rail {
  .block {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(113, 166, 255, 0.85);
  }

  .future {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(135deg, rgba(var(--t1-rgb), 0.1) 0 3px, transparent 3px 6px);
  }
}
</style>
