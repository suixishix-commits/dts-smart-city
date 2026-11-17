<template>
  <div v-if="visible" ref="root" class="splash" role="status" aria-live="polite" :aria-label="stage">
    <div class="glow" aria-hidden="true"></div>
    <div class="grid" aria-hidden="true"></div>
    <div class="center">
      <svg ref="logo" class="logo" viewBox="0 0 96 96" aria-hidden="true">
        <defs>
          <linearGradient id="splash-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#8fc0ff" />
            <stop offset="1" stop-color="#4c9aff" />
          </linearGradient>
        </defs>
        <path class="ring" d="M48 6 84 27v42L48 90 12 69V27z" fill="none" stroke="url(#splash-g)" stroke-width="2.5" stroke-linejoin="round" />
        <path class="ring inner" d="M48 22 70 35v26L48 74 26 61V35z" fill="none" stroke="rgba(143,192,255,0.45)" stroke-width="1.5" stroke-linejoin="round" />
        <path class="core" d="M48 34 60 41v14L48 62 36 55V41z" fill="url(#splash-g)" />
      </svg>
      <h1 class="title">
        <span v-for="(ch, i) in TITLE" :key="i" class="ch">{{ ch }}</span>
      </h1>
      <p class="sub">CITY DIGITAL TWIN · 阿布扎比主岛</p>
      <div class="bar"><span ref="fill" class="fill"></span></div>
      <p class="stage">{{ stage }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import store from '@/stores'
import { reducedMotion } from '@/utils/motion'
import gsap from 'gsap'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * 开场加载画面：品牌图形描边画出、标题逐字浮现、进度条推进；场景连上（或连接失败、超时）后进度补满，整体放大淡出。
 */
const TITLE = '智慧城市数字孪生平台'
/** 最短停留，毫秒：开场动画至少完整播一遍 */
const MIN_MS = 1800
/** 最长停留，毫秒：场景一直连不上也不挡住界面 */
const MAX_MS = 12000

/** done：开始淡出时抛出，界面的入场动效接着播（两段动画衔接，不重叠也不留空档） */
const emit = defineEmits<{ (e: 'done'): void }>()
const visible = ref(true)
const root = ref<HTMLElement>()
const logo = ref<SVGElement>()
const fill = ref<HTMLElement>()
const progress = ref(0)

const stage = computed(() => (progress.value < 35 ? '正在加载城市数据…' : progress.value < 80 ? '正在连接渲染场景…' : progress.value < 100 ? '正在构建场景图层…' : '准备就绪'))

let intro: gsap.core.Timeline | null = null
let creep: gsap.core.Tween | null = null
let timer = 0
const startedAt = performance.now()
let leaving = false

function leave() {
  if (leaving || !visible.value) return
  leaving = true
  creep?.kill()
  const wait = Math.max(0, MIN_MS - (performance.now() - startedAt))
  window.setTimeout(() => {
    if (reducedMotion() || !root.value) {
      visible.value = false
      emit('done')
      return
    }
    const tl = gsap.timeline({ onComplete: () => (visible.value = false) })
    tl.to(progress, { value: 100, duration: 0.45, ease: 'power2.out', onUpdate: paint })
    tl.add(() => emit('done'), '+=0.15')
    tl.to(root.value, { opacity: 0, scale: 1.06, filter: 'blur(10px)', duration: 0.7, ease: 'power2.in' }, '<')
    // 兜底：页面在后台或浏览器限帧时逐帧动画几乎不走，2.5 秒后直接跳到结尾，不让加载画面一直挡着界面
    window.setTimeout(() => {
      if (visible.value) tl.progress(1)
    }, 2500)
  }, wait)
}

function paint() {
  if (fill.value) fill.value.style.width = progress.value + '%'
}

onMounted(async () => {
  await nextTick()
  timer = window.setTimeout(leave, MAX_MS)
  if (reducedMotion()) {
    progress.value = 60
    paint()
  } else if (root.value && logo.value) {
    const rings = logo.value.querySelectorAll<SVGPathElement>('.ring')
    rings.forEach(r => {
      const len = r.getTotalLength?.() ?? 300
      r.style.strokeDasharray = String(len)
      r.style.strokeDashoffset = String(len)
    })
    intro = gsap.timeline()
    intro.to(rings, { strokeDashoffset: 0, duration: 1.1, stagger: 0.2, ease: 'power2.inOut' })
    intro.fromTo(logo.value.querySelector('.core'), { scale: 0, transformOrigin: '50% 50%', opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2.5)' }, 0.6)
    intro.fromTo(root.value.querySelectorAll('.ch'), { y: 18, opacity: 0, filter: 'blur(4px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.5, stagger: 0.05, ease: 'power3.out' }, 0.35)
    intro.fromTo(root.value.querySelectorAll('.sub, .bar, .stage'), { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.08 }, 0.8)
    // 场景连上之前，进度缓慢逼近 85%
    creep = gsap.to(progress, { value: 85, duration: 6, ease: 'power1.out', onUpdate: paint })
  }
  if (store.dtsStore.sceneState !== 'connecting') leave()
})

watch(
  () => store.dtsStore.sceneState,
  s => {
    if (s !== 'connecting') leave()
  }
)

onBeforeUnmount(() => {
  window.clearTimeout(timer)
  intro?.kill()
  creep?.kill()
})
</script>

<style lang="scss" scoped>
.splash {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;
  background: #070b12;
  overflow: hidden;
}
.glow {
  position: absolute;
  inset: -20%;
  background:
    radial-gradient(40% 35% at 50% 46%, rgba(76, 154, 255, 0.22), rgba(76, 154, 255, 0) 70%),
    radial-gradient(70% 60% at 50% 120%, rgba(76, 154, 255, 0.12), rgba(76, 154, 255, 0) 70%);
}
// 透视网格地面
.grid {
  position: absolute;
  left: -50%;
  right: -50%;
  bottom: -10%;
  height: 55%;
  background-image:
    linear-gradient(rgba(76, 154, 255, 0.14) 1px, transparent 1px),
    linear-gradient(90deg, rgba(76, 154, 255, 0.14) 1px, transparent 1px);
  background-size: 64px 64px;
  transform: perspective(600px) rotateX(62deg);
  transform-origin: 50% 100%;
  mask-image: linear-gradient(0deg, #000 10%, transparent 90%);
  animation: grid-flow 6s linear infinite;
}
@keyframes grid-flow {
  to {
    background-position: 0 64px;
  }
}
.center {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.logo {
  width: 96px;
  height: 96px;
  filter: drop-shadow(0 0 16px rgba(76, 154, 255, 0.7));
}
.title {
  margin: 8px 0 0;
  display: flex;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: 6px;
  color: #f3f5f8;
  text-shadow: 0 0 18px rgba(76, 154, 255, 0.55);
}
.sub {
  margin: 0;
  font-family: $font-num;
  font-size: 13px;
  letter-spacing: 4px;
  color: rgba(143, 192, 255, 0.75);
}
.bar {
  width: 320px;
  height: 3px;
  margin-top: 18px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.fill {
  display: block;
  width: 0;
  height: 100%;
  background: linear-gradient(90deg, rgba(76, 154, 255, 0.3), #4c9aff, #cfe3ff);
  box-shadow: 0 0 12px rgba(76, 154, 255, 0.9);
}
.stage {
  margin: 0;
  font-size: 13px;
  color: $text-muted;
}
@media (prefers-reduced-motion: reduce) {
  .grid {
    animation: none;
  }
}
</style>
