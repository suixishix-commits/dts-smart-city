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
      <span v-if="sceneState === 'failed'" class="scene-failed" role="status">场景未连接</span>
      <span v-else-if="sceneState === 'connecting'" role="status">场景连接中…</span>
      <span>晴 29℃</span>
      <span>阿布扎比主岛</span>
      <span>{{ date }}</span>
      <span class="clock">{{ clock }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import store from '@/stores'
import dayjs from 'dayjs'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const modules = [
  { name: '城市总览', path: '/overview', ready: true },
  { name: '智慧交通', path: '/traffic', ready: false },
  { name: '公共安全', path: '/security', ready: false },
  { name: '生态环境', path: '/environment', ready: false },
  { name: '城市生命线', path: '/lifeline', ready: false }
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
  height: $titleHeight;
  box-sizing: border-box;
  padding: 0 $page-margin;
  display: flex;
  align-items: center;
  gap: 48px;
  pointer-events: all;
  background: rgba(16, 21, 28, 0.94);
  border-bottom: 1px solid $border;
}
.title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
  color: $text-strong;
}
.nav {
  display: flex;
  align-self: stretch;
  gap: 8px;
}
.tab {
  display: flex;
  align-items: center;
  padding: 0 16px;
  font-size: 16px;
  text-decoration: none;
  color: $text-muted;
  border-top: 2px solid transparent;
  border-bottom: 2px solid transparent;
  &.active {
    font-weight: 600;
    color: $text-strong;
    border-bottom-color: $accent;
  }
  &.disabled {
    cursor: default;
    opacity: 0.5;
  }
}
.meta {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: $fs-body;
  color: $text-muted;
}
.clock {
  font-size: 18px;
  font-weight: 500;
  color: $text;
}
.scene-failed {
  color: $level-2;
}
</style>
