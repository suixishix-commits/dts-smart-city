<template>
  <header class="app-header">
    <h1 class="title">智慧城市数字孪生平台</h1>
    <nav class="nav" aria-label="模块导航">
      <template v-for="m in modules" :key="m.path">
        <router-link v-if="m.ready" :to="m.path" class="tab" active-class="active">{{ m.name }}</router-link>
        <!-- 未上线的模块不是链接：键盘也不能激活，不会跳到不存在的路由 -->
        <span v-else class="tab disabled" aria-disabled="true">{{ m.name }}</span>
      </template>
    </nav>
    <div class="meta">
      <span v-if="sceneState === 'failed'" class="chip scene-failed" role="status">场景未连接</span>
      <span v-else-if="sceneState === 'connecting'" class="chip" role="status">场景连接中…</span>
      <span class="chip">
        <span>晴 29℃</span>
        <i class="sep"></i>
        <span>阿布扎比主岛</span>
      </span>
      <span class="chip">
        <span>{{ date }}</span>
        <i class="sep"></i>
        <span class="clock">{{ clock }}</span>
      </span>
    </div>
  </header>
</template>

<script setup lang="ts">
import store from '@/stores'
import dayjs from 'dayjs'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const modules = [
  { name: '城市总览', path: '/overview', ready: true },
  { name: '智慧交通', path: '/traffic', ready: true },
  { name: '公共安全', path: '/security', ready: true },
  { name: '生态环境', path: '/environment', ready: true },
  { name: '城市生命线', path: '/lifeline', ready: true }
]

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const now = ref(dayjs())
const date = computed(() => `${now.value.format('YYYY-MM-DD')} ${WEEK[now.value.day()]}`)
const clock = computed(() => now.value.format('HH:mm:ss'))
const sceneState = computed(() => store.dtsStore.sceneState)

let timer = 0
onMounted(() => {
  timer = window.setInterval(() => (now.value = dayjs()), 1000)
})
onBeforeUnmount(() => window.clearInterval(timer))
</script>

<style lang="scss" scoped>
.app-header {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 10;
  width: 100%;
  height: $titleHeight + 12px;
  box-sizing: border-box;
  padding: 0 $page-margin;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  pointer-events: none;
  // 顶部压一层渐暗，让标题和导航在亮的影像上也读得清
  background: linear-gradient(to bottom, rgba(7, 11, 16, 0.72), rgba(7, 11, 16, 0));
}
.title {
  margin: 0;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: 2px;
  color: $text-strong;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}
.nav {
  display: flex;
  gap: 4px;
  padding: 5px;
  pointer-events: all;
  border-radius: $radius-pill;
  @include glass($bg-float);
}
.tab {
  display: flex;
  align-items: center;
  height: 38px;
  padding: 0 20px;
  font-size: 15px;
  text-decoration: none;
  color: $text-muted;
  border-radius: $radius-pill;
  transition:
    color 0.15s,
    background 0.15s;
  &:hover {
    color: $text-strong;
    background: rgba(221, 244, 250, 0.08);
  }
  &.active {
    font-weight: 600;
    color: #06262b;
    background: $accent;
    box-shadow: 0 6px 14px rgba(76, 196, 212, 0.3);
  }
  &.disabled {
    cursor: default;
    opacity: 0.5;
  }
  &:focus-visible {
    outline: 2px solid $accent-light;
    outline-offset: 2px;
  }
}
.meta {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: all;
}
.chip {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 16px;
  font-size: $fs-aux;
  color: $text;
  border-radius: $radius-pill;
  @include glass($bg-float);
}
.sep {
  width: 1px;
  height: 12px;
  background: $border-strong;
}
.clock {
  font-size: 15px;
  font-weight: 600;
  color: $text-strong;
}
.scene-failed {
  color: $level-2;
}
</style>
