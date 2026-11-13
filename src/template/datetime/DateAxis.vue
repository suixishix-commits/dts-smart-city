<template>
  <div class="slider-wrap">
    <section class="bar" aria-label="进度模拟时间轴">
      <button type="button" class="play" :title="playing ? '暂停' : '播放'" @click="playing ? stopHandle() : playHandle()">
        <i v-if="playing" class="pause"></i>
        <svg v-else viewBox="0 0 16 16"><path d="M4.667 2.667 13.333 8l-8.666 5.333V2.667Z" fill="#fff" /></svg>
      </button>
      <div class="speed" role="group" aria-label="播放倍速">
        <i class="thumb" :style="{ transform: `translateX(${speedIndex * 4.2}rem)` }"></i>
        <button v-for="(s, i) in SPEEDS" :key="s.label" type="button" :class="{ on: speedIndex === i }" @click="changeSpeedTime(i)">{{ s.label }}</button>
      </div>
      <div class="date">
        <el-date-picker
          v-model="dateValue"
          class="date-pick"
          value-format="YYYY-MM-DD"
          type="date"
          :disabled-date="disabledDate"
          :clearable="false"
          @change="changeDate"
        />
        <small :class="{ future: isFuture }">{{ isFuture ? '未来态势' : '历史态势' }}</small>
      </div>
      <div
        class="track"
        :class="{ dragging }"
        role="slider"
        tabindex="0"
        aria-label="模拟日期"
        :aria-valuemin="0"
        :aria-valuemax="max"
        :aria-valuenow="sliderValue"
        :aria-valuetext="dateValue"
        @pointerdown="down"
        @pointermove="move"
        @pointerleave="hover = null"
        @pointerup="up"
        @pointercancel="up"
        @keydown="key"
      >
        <span class="rail">
          <span class="history" :style="{ width: pct(todayIndex) }"></span>
        </span>
        <span v-for="t in ticks" :key="t.i" class="tick" :class="t.k" :style="{ left: pct(t.i) }"></span>
        <span v-for="t in ticks.filter((x) => x.label)" :key="`l${t.i}`" class="label" :class="{ first: t.i === 0 }" :style="{ left: pct(t.i) }">{{
          t.label
        }}</span>
        <!-- 今天：绿色竖标 -->
        <span class="today" :style="{ left: pct(todayIndex) }"></span>
        <!-- 大事记：黄色竖标，悬停显示 -->
        <span v-for="m in milestones" :key="m.date" class="milestone" :style="{ left: pct(m.index) }"></span>
        <span class="played" :style="{ width: pct(sliderValue) }"></span>
        <span class="head" :style="{ left: pct(sliderValue) }"></span>
        <div v-if="hover" class="card" :style="{ left: pct(hover.index) }">
          <b>{{ hover.date }}</b>
          <span v-if="hover.milestone" class="ms">{{ hover.milestone.name }}</span>
          <span v-else>{{ hover.index <= todayIndex ? '历史态势' : '未来态势' }}</span>
        </div>
      </div>
      <button type="button" class="reset" @click="resetHandle">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.46" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4.667 1.167V3.5M9.333 1.167V3.5M1.75 3.5c0-.644.522-1.167 1.167-1.167h8.166c.645 0 1.167.523 1.167 1.167v8.167c0 .644-.522 1.166-1.167 1.166H2.917a1.167 1.167 0 0 1-1.167-1.166V3.5ZM1.75 5.833h10.5" />
        </svg>
        回到今天
      </button>
    </section>
  </div>
</template>

<script setup>
/**
 * 每天时间轴（IDD 4D 回放条样式）：播放 / 暂停、0.5× / 1× / 2× 倍速、当前日期（可选）、历史 / 未来态势、回到今天；
 * 轨道为整个工期，按月一根刻度（年初长、季度中带标注），今天之前的底轨高亮为历史态势，绿色竖标为今天，
 * 黄色竖标为大事记；悬停浮出日期卡，点击或拖动跳到对应日期，左右方向键逐天（Shift 逐周）。
 */
import dayjs from 'dayjs'

/** 整个工期起止日期 */
const START = '2024-06-28'
const END = '2027-09-01'
/** 倍速：每推进一天的间隔（毫秒） */
const SPEEDS = [
  { label: '0.5×', ms: 3000 },
  { label: '1×', ms: 2000 },
  { label: '2×', ms: 1000 }
]
/** 大事记（演示数据） */
const MILESTONES = [
  { date: '2025-03-15', name: '主体结构封顶' },
  { date: '2026-12-27', name: '竣工验收' }
]

const dayList = Array.from({ length: dayjs(END).diff(dayjs(START), 'day') + 1 }, (_, i) => dayjs(START).add(i, 'day').format('YYYY-MM-DD'))
/** 最大下标 */
const max = dayList.length - 1
const indexOf = (date) => Math.max(0, Math.min(max, dayjs(date).diff(dayjs(START), 'day')))
const pct = (i) => `${(i / max) * 100}%`

const todayIndex = indexOf(dayjs().format('YYYY-MM-DD'))
const milestones = MILESTONES.map((m) => ({ ...m, index: indexOf(m.date) }))

/** 刻度：每月 1 号一根；年初长（标年份）、季度中（标年-月）、其余短 */
const ticks = (() => {
  const list = []
  let m = dayjs(START).startOf('month').add(1, 'month')
  while (!m.isAfter(dayjs(END))) {
    const i = indexOf(m.format('YYYY-MM-DD'))
    const month = m.month()
    list.push({
      i,
      k: month === 0 ? 'major' : month % 3 === 0 ? 'mid' : '',
      label: month === 0 ? m.format('YYYY') : month % 3 === 0 ? m.format('MM月') : ''
    })
    m = m.add(1, 'month')
  }
  // 起点标注占位宽，离它太近的季度标注去掉，免得挤在一起
  return [{ i: 0, k: 'major', label: dayjs(START).format('YYYY-MM') }, ...list.filter((t) => t.i > 120 && t.i < max - 20)]
})()

const dateValue = ref(dayjs().format('YYYY-MM-DD'))
const sliderValue = ref(todayIndex)
const speedIndex = ref(1)
const playing = ref(false)
const dragging = ref(false)
const hover = ref(null)
let Timer = null

const isFuture = computed(() => sliderValue.value > todayIndex)

const setIndex = (i) => {
  sliderValue.value = Math.max(0, Math.min(max, Math.round(i)))
  dateValue.value = dayList[sliderValue.value]
}

const disabledDate = (current) => current && (current < dayjs(START).valueOf() || current > dayjs(END).valueOf())

// 日期组件手工切换
const changeDate = () => {
  stopHandle()
  setIndex(indexOf(dateValue.value))
  // 下面执行相关逻辑操作
}

const runTimer = () => {
  if (Timer) clearInterval(Timer)
  Timer = setInterval(() => {
    if (sliderValue.value >= max) {
      stopHandle()
      return
    }
    setIndex(sliderValue.value + 1)
    // 下面执行相关逻辑操作
  }, SPEEDS[speedIndex.value].ms)
}

// 播放：在末尾时从头开始
const playHandle = () => {
  if (sliderValue.value >= max) setIndex(0)
  playing.value = true
  runTimer()
}
// 暂停
const stopHandle = () => {
  playing.value = false
  if (Timer) clearInterval(Timer)
  Timer = null
}
// 切换倍速：播放中立即按新速度继续
const changeSpeedTime = (i) => {
  speedIndex.value = i
  if (playing.value) runTimer()
}
// 回到今天
const resetHandle = () => {
  stopHandle()
  setIndex(todayIndex)
}

// ---- 拖动 / 悬停 / 键盘 ----

const indexAt = (e) => {
  const r = e.currentTarget.getBoundingClientRect()
  return Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * max)
}
const down = (e) => {
  if (e.button !== 0) return
  stopHandle()
  dragging.value = true
  // 捕获指针：拖出轨道也能继续拖
  e.currentTarget.setPointerCapture(e.pointerId)
  setIndex(indexAt(e))
}
const move = (e) => {
  const i = indexAt(e)
  if (dragging.value) setIndex(i)
  // 悬停卡：靠近大事记（轨道宽 1% 以内）时显示大事记
  const near = milestones.find((m) => Math.abs(m.index - i) <= max * 0.01)
  hover.value = near ? { index: near.index, date: near.date, milestone: near } : { index: i, date: dayList[i] }
}
const up = () => {
  dragging.value = false
}
const key = (e) => {
  const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
  if (step) setIndex(sliderValue.value + step * (e.shiftKey ? 7 : 1))
  else if (e.key === 'Home') setIndex(0)
  else if (e.key === 'End') setIndex(max)
  else return
  e.preventDefault()
}

onBeforeUnmount(stopHandle)
</script>

<style scoped lang="scss">
@use './timeline-idd' as tl;

.slider-wrap {
  padding: 20px;
}

.bar {
  @include tl.panel;
  @include tl.date-pick;
  flex-direction: row;
  align-items: center;
  height: 64px;
  padding: 0 20px;
}

@include tl.controls;
@include tl.track;

.date {
  display: flex;
  flex: none;
  flex-direction: column;
  margin: 0 8px 0 4px;

  :deep(.date-pick) {
    width: 124px;

    .el-input__wrapper {
      height: 24px;
      padding: 0;
      background: none;
    }

    .el-input__prefix {
      display: none;
    }

    .el-input__inner {
      color: var(--t1);
      font-size: 16px;
      cursor: pointer;
    }
  }

  small {
    color: var(--t1-a55);
    font-size: 12px;
    line-height: 16px;

    &.future {
      color: var(--warn);
    }
  }
}

// 今天之前的底轨为历史态势
.rail .history {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: rgba(113, 166, 255, 0.35);
}

.today,
.milestone {
  position: absolute;
  top: -1px;
  width: 2px;
  height: 16px;
  margin-left: -1px;
  border-radius: 1px;
  pointer-events: none;
}

.today {
  background: var(--ok);
}

.milestone {
  background: var(--warn);
}

// 悬停日期卡：指针上方
.card {
  position: absolute;
  bottom: calc(100% + 10px);
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  background: rgba(35, 37, 39, 0.96);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  transform: translateX(-50%);
  pointer-events: none;

  b {
    color: var(--t1);
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  span {
    color: var(--t1-a65);
    font-size: 12px;

    &.ms {
      color: var(--warn);
    }
  }
}

.reset {
  margin-left: 8px;
}
</style>
