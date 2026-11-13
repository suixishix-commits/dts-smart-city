<template>
  <!--
    MultiColLayout —— 多列自适应布局容器

    ≥ 2560px（物理像素）：横向多列排列，不可垂直滚动
    < 2560px：单列堆叠，可垂直滚动

    用法：
      <MultiColLayout :cols="[{ padding: '1rem 0.6rem' }, {}]">
        <template #col-0><MyPanel /></template>
        <template #col-1><MyPanel /></template>
      </MultiColLayout>
  -->
  <div class="multi-col-layout" :class="layoutClass">
    <div v-for="(col, i) in cols" :key="i" class="col-item" :style="colStyle(col)">
      <slot :name="`col-${i}`"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface ColConfig {
  padding?: string // 列内边距，如 '1rem 0.6rem'
}

const props = withDefaults(defineProps<{
  cols: ColConfig[]
  breakpoint?: number  // 切换断点，默认 2560（物理像素）
  autoWrap?: boolean   // 是否自适应换行，默认 true；false 时始终多列横排
}>(), {
  autoWrap: true
})

const isWide = ref(false)

const layoutClass = computed(() =>
  (props.autoWrap ?? true) && !isWide.value ? 'layout-col' : 'layout-row'
)

function checkWidth() {
  const bp = props.breakpoint ?? 2560
  isWide.value = window.innerWidth * window.devicePixelRatio >= bp
}

onMounted(() => {
  checkWidth()
  window.addEventListener('resize', checkWidth)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkWidth)
})

function colStyle(col: ColConfig): Record<string, string> {
  return col.padding ? { padding: col.padding } : {}
}
</script>

<style lang="scss" scoped>
.multi-col-layout {
  pointer-events: all;
  box-sizing: border-box;
}

// 宽屏：横向排列，不滚动，高度撑满父容器
.layout-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  height: 100%;
  overflow: hidden;

  .col-item {
    height: 100%;
    flex-shrink: 0;
    box-sizing: border-box;
    overflow: hidden;
  }
}

// 窄屏：单列堆叠，垂直滚动
.layout-col {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  align-items: flex-start;

  &::-webkit-scrollbar { width: 0.3rem; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: transparent; border-radius: 0.2rem; }
  &:hover::-webkit-scrollbar-thumb { background: rgba(96, 228, 255, 0.2); }

  .col-item {
    flex-shrink: 0;
    box-sizing: border-box;
    min-height: 100%;
  }
}
</style>
