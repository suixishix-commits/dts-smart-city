import gsap from 'gsap'
import type { Directive } from 'vue'

/**
 * GSAP 动效：面板入场、弹窗弹出、点击水波纹。
 * 统一节奏：入场 0.6–0.8 秒、缓出（expo / back）；交互反馈 0.3–0.5 秒。系统设置了「减少动态效果」时全部跳过。
 */

/**
 * 兜底：页面在后台或浏览器限帧时逐帧动画几乎不走，元素会停在起始状态（透明、偏移）。
 * 到时间还没播完就直接跳到结尾，内容不会被藏住。
 */
function finishLater(anim: gsap.core.Animation, ms: number): void {
  window.setTimeout(() => {
    if (anim.progress() < 1) anim.progress(1)
  }, ms)
}

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 模块面板入场：两侧卡片从外侧依次滑入（模糊到清晰），四角角标展开，标题光带横扫；底部浮层从下方浮起。
 * root 是模块的根元素（各模块 Main 的容器）。
 */
export function panelsEnter(root: HTMLElement): gsap.core.Timeline | null {
  if (reducedMotion()) return null
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
  const left = root.querySelectorAll<HTMLElement>('aside[class$="-left"] > .panel-card')
  const right = root.querySelectorAll<HTMLElement>('aside[class$="-right"] > .panel-card')
  const cards = [...left, ...right]
  tl.fromTo(left, { x: -48, opacity: 0, filter: 'blur(6px)' }, { x: 0, opacity: 1, filter: 'blur(0px)', duration: 0.8, stagger: 0.09, clearProps: 'filter,transform,opacity' }, 0)
  tl.fromTo(right, { x: 48, opacity: 0, filter: 'blur(6px)' }, { x: 0, opacity: 1, filter: 'blur(0px)', duration: 0.8, stagger: 0.09, clearProps: 'filter,transform,opacity' }, 0)
  // 角标从 0 展开
  const corners = cards.flatMap(c => [...c.querySelectorAll<HTMLElement>(':scope > .corner')])
  tl.fromTo(corners, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, stagger: 0.02, ease: 'back.out(2)', clearProps: 'transform,opacity' }, 0.25)
  // 标题光带从左往右扫过
  const heads = cards.map(c => c.querySelector<HTMLElement>(':scope > .head')).filter((h): h is HTMLElement => !!h)
  tl.fromTo(heads, { backgroundSize: '0% 1px, 0% 100%' }, { backgroundSize: '100% 1px, 100% 100%', duration: 0.9, stagger: 0.09, ease: 'power2.out', clearProps: 'backgroundSize' }, 0.15)
  // 底部浮层：时间轴、图例、图层开关、工具栏
  const docks = root.querySelectorAll<HTMLElement>('.time-axis, .scene-legend, .layer-toggle, .scene-tools')
  tl.fromTo(docks, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.07, clearProps: 'transform,opacity' }, 0.3)
  finishLater(tl, 2500)
  return tl
}

/** 弹窗弹出：从略小、略模糊的状态弹性展开，一道扫光划过 */
export function popIn(el: HTMLElement, light = false): void {
  if (reducedMotion()) return
  gsap.killTweensOf(el)
  if (light) {
    // 卡片已经开着、只是换了内容：轻一点的切换
    finishLater(gsap.fromTo(el, { y: -6, opacity: 0.4 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out', clearProps: 'transform,opacity' }), 1200)
  } else {
    finishLater(
      gsap.fromTo(
        el,
        { scale: 0.92, y: -10, opacity: 0, filter: 'blur(8px)', transformOrigin: '50% 0%' },
        { scale: 1, y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.55, ease: 'back.out(1.6)', clearProps: 'transform,opacity,filter' }
      ),
      1200
    )
  }
  sweep(el)
}

/** 一道斜向扫光从左往右划过元素 */
function sweep(el: HTMLElement): void {
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
  const shine = document.createElement('span')
  shine.setAttribute('aria-hidden', 'true')
  Object.assign(shine.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    borderRadius: 'inherit',
    overflow: 'hidden',
    zIndex: '5'
  })
  const bar = document.createElement('span')
  Object.assign(bar.style, {
    position: 'absolute',
    top: '-20%',
    bottom: '-20%',
    width: '40%',
    left: '-50%',
    background: 'linear-gradient(100deg, rgba(143,192,255,0) 0%, rgba(143,192,255,0.18) 45%, rgba(255,255,255,0.28) 50%, rgba(143,192,255,0.18) 55%, rgba(143,192,255,0) 100%)',
    transform: 'skewX(-18deg)'
  })
  shine.appendChild(bar)
  el.appendChild(shine)
  gsap.to(bar, { left: '120%', duration: 0.9, ease: 'power2.inOut', delay: 0.1, onComplete: () => shine.remove() })
}

/**
 * v-pop：挂在弹窗卡片的根元素上。出现时弹出；绑定值变了（换了一条记录）时轻量切换。
 * 用法：<div class="detail-card" v-pop="detail.title">
 */
export const vPop: Directive<HTMLElement, unknown> = {
  mounted(el) {
    popIn(el)
  },
  updated(el, binding) {
    if (binding.value !== binding.oldValue) popIn(el, true)
  }
}

/** 可点击元素：点下时从点击位置扩散一圈水波纹 */
const RIPPLE_TARGETS = ['aside .panel-card button', '.segmented .seg', '.layer-toggle button', '.scene-tools button', '.detail-card button', '.alarm-toast button', '.base-layers button', '.app-header .tab'].join(',')

export function installRipple(root: HTMLElement): () => void {
  const onDown = (e: PointerEvent) => {
    if (reducedMotion() || e.button !== 0) return
    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(RIPPLE_TARGETS)
    if (!target) return
    const rect = target.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2.2
    if (getComputedStyle(target).position === 'static') target.style.position = 'relative'
    // 水波纹放在一层裁剪容器里，不改按钮自身的 overflow（页签下方的发光线等不会被裁掉）
    const clip = document.createElement('span')
    clip.setAttribute('aria-hidden', 'true')
    Object.assign(clip.style, { position: 'absolute', inset: '0', overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none' })
    const dot = document.createElement('span')
    dot.setAttribute('aria-hidden', 'true')
    Object.assign(dot.style, {
      position: 'absolute',
      left: e.clientX - rect.left - size / 2 + 'px',
      top: e.clientY - rect.top - size / 2 + 'px',
      width: size + 'px',
      height: size + 'px',
      borderRadius: '50%',
      pointerEvents: 'none',
      background: 'radial-gradient(circle, rgba(143,192,255,0.35) 0%, rgba(76,154,255,0.18) 40%, rgba(76,154,255,0) 70%)'
    })
    clip.appendChild(dot)
    target.appendChild(clip)
    gsap.fromTo(dot, { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, duration: 0.6, ease: 'power2.out', onComplete: () => clip.remove() })
  }
  root.addEventListener('pointerdown', onDown)
  return () => root.removeEventListener('pointerdown', onDown)
}
