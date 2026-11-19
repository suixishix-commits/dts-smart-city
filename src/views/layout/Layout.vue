<template>
  <TwinPlayer></TwinPlayer>
  <div id="layout-container" ref="container" :class="{ 'pre-enter': preEnter, 'left-collapsed': collapsed.left, 'right-collapsed': collapsed.right }">
    <!-- 氛围层：屏幕四周压暗，两侧面板落在暗色托底上，中间场景保持通透 -->
    <!-- bare 页面（路由 meta.bare，例如片区热力演示）只有三维场景：不要顶栏、压暗、告警通知和面板把手 -->
    <div v-if="!bare" class="atmosphere" aria-hidden="true"></div>
    <AppHeader v-if="!bare"></AppHeader>
    <router-view />
    <AlarmToast v-if="!bare" />
    <!-- 两侧面板的收起把手：收起后场景几乎整屏，工具栏、图例、时间轴跟着移到边上 -->
    <button
      v-for="side in bare ? [] : SIDES"
      :key="side"
      type="button"
      class="edge-handle"
      :class="[side, { collapsed: collapsed[side] }]"
      :aria-label="(collapsed[side] ? '展开' : '收起') + (side === 'left' ? '左侧' : '右侧') + '面板'"
      :aria-expanded="collapsed[side] ? 'false' : 'true'"
      :title="(collapsed[side] ? '展开' : '收起') + (side === 'left' ? '左侧' : '右侧') + '面板'"
      @click="collapsed[side] = !collapsed[side]"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M7.5 2.5 4 6l3.5 3.5" />
      </svg>
    </button>
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
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

// 模拟实时告警推送（顶部通知 + 城市总览的实时告警列表）
useLiveAlarms()

const container = ref<HTMLElement>()
/** 两侧面板是否收起；切换模块时保持 */
const SIDES = ['left', 'right'] as const
const collapsed = reactive({ left: false, right: false })
const route = useRoute()
const bare = computed(() => !!route.meta.bare)
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
/** 面板收起后场景区离屏幕边的距离：留出把手 */
$scene-edge: 44px;

#layout-container {
  // 场景区左右边界：面板展开时让出面板宽度，收起时只留把手的位置。注册为 <length>（index.scss 的 @property），可以过渡
  --scene-left: #{$page-margin + $panel-width + 24px};
  --scene-right: #{$page-margin + $panel-width + 24px};
  transition:
    --scene-left 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    --scene-right 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  &.left-collapsed {
    --scene-left: #{$scene-edge};
  }
  &.right-collapsed {
    --scene-right: #{$scene-edge};
  }
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
    linear-gradient(0deg, rgba(4, 8, 14, 0.7) 0, rgba(4, 8, 14, 0) 220px),
    linear-gradient(180deg, rgba(4, 8, 14, 0.55) 0, rgba(4, 8, 14, 0) 160px),
    radial-gradient(ellipse 70% 60% at 50% 45%, rgba(4, 8, 14, 0) 60%, rgba(4, 8, 14, 0.35) 100%);
  // 两侧面板下的暗色托底，各自随面板收起淡出
  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 620px;
    transition: opacity 0.4s ease;
  }
  &::before {
    left: 0;
    background: linear-gradient(90deg, rgba(4, 8, 14, 0.78) 0, rgba(4, 8, 14, 0.5) 420px, rgba(4, 8, 14, 0) 620px);
  }
  &::after {
    right: 0;
    background: linear-gradient(270deg, rgba(4, 8, 14, 0.78) 0, rgba(4, 8, 14, 0.5) 420px, rgba(4, 8, 14, 0) 620px);
  }
}
.left-collapsed .atmosphere::before,
.right-collapsed .atmosphere::after {
  opacity: 0.15;
}
// 面板滑出屏幕：用独立的 translate 属性，不和入场动效（GSAP 改 transform）冲突
#layout-container :deep(aside) {
  transition:
    translate 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.3s ease;
}
.left-collapsed :deep(aside[class*='-left']),
.right-collapsed :deep(aside[class*='-right']) {
  opacity: 0;
  pointer-events: none;
}
.left-collapsed :deep(aside[class*='-left']) {
  translate: calc(-100% - #{$page-margin}) 0;
}
.right-collapsed :deep(aside[class*='-right']) {
  translate: calc(100% + #{$page-margin}) 0;
}
.edge-handle {
  position: absolute;
  top: 50%;
  z-index: 5;
  width: 18px;
  height: 56px;
  margin-top: -28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid $border;
  border-radius: $radius-sm;
  color: $text-muted;
  background: $bg-float;
  backdrop-filter: blur(12px);
  cursor: pointer;
  pointer-events: all;
  transition:
    color 0.16s ease,
    background-color 0.16s ease;
  &:hover {
    color: $text-strong;
    background: rgba(76, 154, 255, 0.18);
  }
  svg {
    transition: rotate 0.3s ease;
  }
  // 展开时箭头朝外（点了把面板收出去），收起时朝里
  &.left {
    left: calc(var(--scene-left) - 22px);
  }
  &.right {
    right: calc(var(--scene-right) - 22px);
    svg {
      rotate: 180deg;
    }
  }
  &.left.collapsed svg {
    rotate: 180deg;
  }
  &.right.collapsed svg {
    rotate: 0deg;
  }
}
.pre-enter :deep(aside > .panel-card),
.pre-enter :deep(.time-axis),
.pre-enter :deep(.scene-legend),
.pre-enter :deep(.layer-toggle) {
  opacity: 0;
}
</style>
