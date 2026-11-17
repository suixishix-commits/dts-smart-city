<template>
  <TwinPlayer></TwinPlayer>
  <div id="layout-container" ref="container" :class="{ 'pre-enter': preEnter }">
    <!-- 氛围层：屏幕四周压暗，两侧面板落在暗色托底上，中间场景保持通透 -->
    <div class="atmosphere" aria-hidden="true"></div>
    <AppHeader></AppHeader>
    <router-view />
    <AlarmToast />
    <LoadingSplash @done="onSplashDone" />
    <!-- 地理底数据来自 OpenStreetMap（ODbL 要求署名） -->
    <a class="attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">地图数据 © OpenStreetMap contributors</a>
  </div>
</template>

<script setup lang="ts">
import AlarmToast from '@/components/panel/AlarmToast.vue'
import LoadingSplash from '@/components/panel/LoadingSplash.vue'
import { useLiveAlarms } from '@/composables/useLiveAlarms'
import { installRipple, panelsEnter } from '@/utils/motion'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

// 模拟实时告警推送（顶部通知 + 城市总览的实时告警列表）
useLiveAlarms()

const container = ref<HTMLElement>()
const route = useRoute()
let uninstall: (() => void) | null = null

/** 等模块的两侧面板渲染出来（模块要先加载数据），再播放入场动效；最多等 3 秒 */
function enterWhenReady() {
  const start = performance.now()
  const step = () => {
    const root = container.value
    if (!root) return
    if (root.querySelector('aside .panel-card')) {
      // 入场动效先把面板设成起始状态（同步），再去掉预隐藏，中间不会露出一帧
      panelsEnter(root)
      preEnter.value = false
    } else if (performance.now() - start < 3000) requestAnimationFrame(step)
    else preEnter.value = false // 兜底：面板一直没出来也要撤掉预隐藏
  }
  requestAnimationFrame(step)
}

/** 开场加载画面还在时不播入场：等它开始淡出再播，两段动画衔接 */
let splashing = true
/** 入场前先把面板藏起来，免得加载画面淡出时面板先整个露出、再被入场动效藏起重播 */
const preEnter = ref(true)
function onSplashDone() {
  splashing = false
  enterWhenReady()
}

onMounted(() => {
  if (container.value) uninstall = installRipple(container.value)
})
watch(
  () => route.path,
  () => {
    if (!splashing) enterWhenReady()
  }
)
onBeforeUnmount(() => uninstall?.())
</script>

<style scoped lang="scss">
#layout-container {
  position: absolute;
  /* 窗口很小时由 index.html 的适配脚本给出 --ui-scale（<1），界面整体缩小；平时为 1，不起作用 */
  width: calc(100% / var(--ui-scale, 1));
  height: calc(100% / var(--ui-scale, 1));
  transform: scale(var(--ui-scale, 1));
  transform-origin: 0 0;
  z-index: 1;
  pointer-events: none;
}
.attribution {
  position: absolute;
  left: $page-margin;
  bottom: 4px;
  font-size: 11px;
  line-height: 16px;
  color: $text-muted;
  text-decoration: none;
  opacity: 0.7;
  pointer-events: all;
  &:hover {
    opacity: 1;
    text-decoration: underline;
  }
}
.atmosphere {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(4, 8, 14, 0.78) 0, rgba(4, 8, 14, 0.5) 420px, rgba(4, 8, 14, 0) 620px),
    linear-gradient(270deg, rgba(4, 8, 14, 0.78) 0, rgba(4, 8, 14, 0.5) 420px, rgba(4, 8, 14, 0) 620px),
    linear-gradient(0deg, rgba(4, 8, 14, 0.7) 0, rgba(4, 8, 14, 0) 220px),
    linear-gradient(180deg, rgba(4, 8, 14, 0.55) 0, rgba(4, 8, 14, 0) 160px),
    radial-gradient(ellipse 70% 60% at 50% 45%, rgba(4, 8, 14, 0) 60%, rgba(4, 8, 14, 0.35) 100%);
}
.pre-enter :deep(aside > .panel-card),
.pre-enter :deep(.time-axis),
.pre-enter :deep(.scene-legend),
.pre-enter :deep(.layer-toggle) {
  opacity: 0;
}
</style>
