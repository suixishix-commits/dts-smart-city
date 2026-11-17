<template>
  <header class="app-header">
    <h1 class="title">
      <svg class="logo" viewBox="0 0 28 28" aria-hidden="true">
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#8fc0ff" />
            <stop offset="1" stop-color="#4c9aff" />
          </linearGradient>
        </defs>
        <path d="M14 2.5 24 8.25v11.5L14 25.5 4 19.75V8.25z" fill="none" stroke="url(#logo-g)" stroke-width="1.8" stroke-linejoin="round" />
        <path d="M14 8.5 19 11.4v5.2L14 19.5 9 16.6v-5.2z" fill="url(#logo-g)" opacity="0.9" />
      </svg>
      智慧城市数字孪生平台
    </h1>
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
// 按设计稿：64px 实色顶栏，标题居左，模块导航用下划线页签，右侧天气、地点、日期时间是纯文字
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
  background: linear-gradient(180deg, rgba(10, 14, 20, 0.92), rgba(12, 17, 24, 0.78));
  backdrop-filter: blur(16px) saturate(150%);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  // 底边：中间亮、两头淡的渐变细线
  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1px;
    background: linear-gradient(90deg, rgba(76, 154, 255, 0), rgba(76, 154, 255, 0.55) 30%, rgba(143, 192, 255, 0.55) 70%, rgba(76, 154, 255, 0));
  }
}
.title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: $text-strong;
  white-space: nowrap;
}
.logo {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  filter: drop-shadow(0 0 6px rgba(76, 154, 255, 0.5));
}
.nav {
  display: flex;
  align-items: center;
  gap: 4px;
}
// 页签：胶囊形，悬停浅底；当前模块是蓝色浅底 + 底部发光短线
.tab {
  position: relative;
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 18px;
  box-sizing: border-box;
  border-radius: $radius-sm;
  font-size: 16px;
  text-decoration: none;
  color: $text-muted;
  transition:
    color 0.15s,
    background-color 0.15s;
  &:hover {
    color: $text-strong;
    background: rgba(255, 255, 255, 0.05);
  }
  &.active {
    font-weight: 600;
    color: $text-strong;
    background: rgba(76, 154, 255, 0.16);
    &::after {
      content: '';
      position: absolute;
      left: 50%;
      bottom: -14px;
      width: 28px;
      height: 2px;
      border-radius: 1px;
      transform: translateX(-50%);
      background: $accent-light;
      box-shadow: 0 0 10px 1px rgba(76, 154, 255, 0.8);
    }
  }
  &.disabled {
    cursor: default;
    opacity: 0.5;
  }
  &:focus-visible {
    outline: 2px solid $accent-light;
    outline-offset: -2px;
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
.chip {
  display: flex;
  align-items: center;
  gap: 24px;
}
.sep {
  display: none;
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
