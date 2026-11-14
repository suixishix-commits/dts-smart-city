import { onBeforeUnmount, onMounted } from 'vue'

/** 按 Esc 时执行 handler（用来关闭详情卡片） */
export function useEscape(handler: () => void) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') handler()
  }
  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
}
