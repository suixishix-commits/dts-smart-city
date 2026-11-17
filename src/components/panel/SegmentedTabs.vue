<template>
  <span ref="track" class="segmented" role="tablist" :aria-label="label" @keydown="onKey">
    <span class="thumb" :style="thumbStyle" aria-hidden="true"></span>
    <button
      v-for="o in options"
      :key="o.key"
      :ref="el => setItem(o.key, el as HTMLElement | null)"
      type="button"
      role="tab"
      class="seg"
      :class="{ on: o.key === modelValue }"
      :aria-selected="o.key === modelValue ? 'true' : 'false'"
      :tabindex="o.key === modelValue ? 0 : -1"
      @click="emit('update:modelValue', o.key)"
    >
      {{ o.name }}
    </button>
  </span>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/** 分段页签：深色轨道上一块滑动的高亮底。卡片标题右侧切换同一张卡片里的不同视图 */
const props = defineProps<{ options: readonly { key: string; name: string }[]; modelValue: string; label: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', key: string): void }>()

const track = ref<HTMLElement>()
const items = new Map<string, HTMLElement>()
const box = ref({ left: 0, width: 0 })

function setItem(key: string, el: HTMLElement | null) {
  if (el) items.set(key, el)
  else items.delete(key)
}

function measure() {
  const el = items.get(props.modelValue)
  if (el) box.value = { left: el.offsetLeft, width: el.offsetWidth }
}

const thumbStyle = computed(() => ({ transform: `translateX(${box.value.left}px)`, width: box.value.width + 'px', opacity: box.value.width ? 1 : 0 }))

/** 左右方向键在页签间切换 */
function onKey(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  const i = props.options.findIndex(o => o.key === props.modelValue)
  const next = props.options[(i + (e.key === 'ArrowRight' ? 1 : props.options.length - 1)) % props.options.length]
  emit('update:modelValue', next.key)
  nextTick(() => items.get(next.key)?.focus())
}

let observer: ResizeObserver | null = null
onMounted(() => {
  measure()
  // 根字号变化（窗口缩放）时页签宽度会变
  if (typeof ResizeObserver !== 'undefined' && track.value) {
    observer = new ResizeObserver(measure)
    observer.observe(track.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())
watch(() => props.modelValue, () => nextTick(measure))
</script>

<style lang="scss" scoped>
.segmented {
  position: relative;
  display: inline-flex;
  padding: 2px;
  border-radius: $radius-sm;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}
.thumb {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  border-radius: 5px;
  background: linear-gradient(180deg, rgba(76, 154, 255, 0.34), rgba(76, 154, 255, 0.22));
  box-shadow:
    inset 0 0 0 1px rgba(143, 192, 255, 0.35),
    0 2px 8px rgba(76, 154, 255, 0.25);
  transition:
    transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1),
    width 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.seg {
  position: relative;
  height: 26px;
  padding: 0 12px;
  border: 0;
  border-radius: 5px;
  font: inherit;
  font-size: $fs-aux;
  white-space: nowrap;
  color: $text-muted;
  background: transparent;
  cursor: pointer;
  transition: color 160ms ease;
  &:hover {
    color: $text;
  }
  &.on {
    font-weight: 500;
    color: $text-strong;
  }
  &:focus-visible {
    outline: 2px solid $accent-light;
    outline-offset: 1px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .thumb {
    transition: none;
  }
}
</style>
