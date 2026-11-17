import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/** 能滚动的数字文本：可带负号、千分位逗号和小数，如 "1,203"、"62.4"、"-2.5" */
const NUMERIC = /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/

/** 按目标文本的格式（小数位数、千分位）输出数值 */
export function formatLike(target: string, v: number): string {
  const decimals = target.includes('.') ? target.split('.')[1].length : 0
  const fixed = v.toFixed(decimals)
  if (!target.includes(',')) return fixed
  const [int, frac] = fixed.split('.')
  const sign = int.startsWith('-') ? '-' : ''
  const grouped = int.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return sign + grouped + (frac !== undefined ? '.' + frac : '')
}

export function parseNumeric(s: string): number | null {
  return NUMERIC.test(s) ? Number(s.replace(/,/g, '')) : null
}

const DURATION = 700

function canAnimate(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 数字滚动：首次出现从 0 滚到目标值，之后每次变化从当前显示值滚到新值（缓出，0.7 秒）。
 * 非数字文本（"—"、"良"）直接显示；系统设置了减少动态效果、或没有 matchMedia（单元测试）时不滚动。
 */
export function useCountUp(source: () => string | number): Ref<string> {
  const shown = ref(String(source()))
  let frame = 0
  let current: number | null = null

  const run = (text: string, from: number) => {
    cancelAnimationFrame(frame)
    const to = parseNumeric(text) as number
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      const eased = 1 - Math.pow(1 - t, 3)
      current = from + (to - from) * eased
      shown.value = t < 1 ? formatLike(text, current) : text
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  }

  watch(
    () => String(source()),
    (text, old) => {
      const to = parseNumeric(text)
      if (to === null || !canAnimate()) {
        cancelAnimationFrame(frame)
        current = to
        shown.value = text
        return
      }
      const from = current ?? (old === undefined ? 0 : (parseNumeric(old) ?? 0))
      if (from === to) {
        shown.value = text
        current = to
        return
      }
      run(text, from)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => cancelAnimationFrame(frame))
  return shown
}
