<template>
  <Transition name="toast">
    <div v-if="shown" :key="shown.id" class="alarm-toast" :class="'lv' + shown.level" role="status" aria-live="polite" @mouseenter="hold = true" @mouseleave="hold = false">
      <span class="pulse" aria-hidden="true"></span>
      <LevelTag :level="shown.level" />
      <span class="main">
        <span class="title">{{ shown.title }}</span>
        <span class="sub">新告警 · {{ shown.module }} · {{ shown.area }} · {{ shown.time }}</span>
      </span>
      <button type="button" class="view" @click="view">查看</button>
      <button type="button" class="close" aria-label="关闭" @click="shown = null">×</button>
      <span class="timer" :style="{ animationPlayState: hold ? 'paused' : 'running', animationDuration: SHOW_MS + 'ms' }" @animationend="shown = null"></span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import store from '@/stores'
import type { Alarm } from '@/types/smartCity'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LevelTag from './LevelTag.vue'

/** 通知停留时间，毫秒；鼠标停在通知上时暂停计时 */
const SHOW_MS = 8000

const router = useRouter()
const shown = ref<Alarm | null>(null)
const hold = ref(false)

watch(
  () => store.alarmStore.latest,
  alarm => {
    if (alarm) shown.value = alarm
  }
)

/** 查看：到城市总览选中这条告警（飞到所在片区、打开详情卡片） */
function view() {
  if (!shown.value) return
  store.alarmStore.pending = shown.value.id
  shown.value = null
  router.push('/overview')
}
</script>

<style lang="scss" scoped>
// 场景区左上、工具栏右侧：不挡右边的详情卡片（right: 480px，宽 300）
.alarm-toast {
  position: absolute;
  top: $panel-top;
  left: $page-margin + $panel-width + 24px + 52px + 16px;
  width: 520px;
  box-sizing: border-box;
  padding: 12px 8px 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  pointer-events: all;
  background: $bg-float;
  border: 1px solid $border-strong;
  border-radius: $radius;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
  --tone: #{$accent};
  &.lv1 {
    --tone: #ff6b6b;
  }
  &.lv2 {
    --tone: #ffa94d;
  }
  &.lv3 {
    --tone: #ffd43b;
  }
  &.lv4 {
    --tone: #74a9ff;
  }
}
// 左侧呼吸的状态点，提示这是刚到的消息
.pulse {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--tone);
  box-shadow: 0 0 0 0 var(--tone);
  animation: pulse 1.6s ease-out infinite;
}
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--tone) 70%, transparent);
  }
  100% {
    box-shadow: 0 0 0 10px color-mix(in srgb, var(--tone) 0%, transparent);
  }
}
.main {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.title {
  font-size: 15px;
  font-weight: 600;
  color: $text-strong;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub {
  font-size: $fs-aux;
  color: $text-muted;
}
.view {
  flex-shrink: 0;
  height: 36px;
  padding: 0 16px;
  border: 0;
  border-radius: $radius-sm;
  font: inherit;
  font-size: $fs-body;
  font-weight: 500;
  color: #10151c;
  background: $accent;
  cursor: pointer;
  &:hover {
    background: $accent-light;
  }
}
.close {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: 0;
  font-size: 18px;
  color: $text-muted;
  background: none;
  cursor: pointer;
  &:hover {
    color: $text-strong;
  }
}
.view:focus-visible,
.close:focus-visible {
  outline: 2px solid $accent-light;
  outline-offset: 2px;
}
// 底边的倒计时进度条：走完自动收起
.timer {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 100%;
  background: var(--tone);
  transform-origin: left;
  animation: countdown linear forwards;
}
@keyframes countdown {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 260ms ease,
    transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-16px);
}
@media (prefers-reduced-motion: reduce) {
  .pulse {
    animation: none;
  }
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
