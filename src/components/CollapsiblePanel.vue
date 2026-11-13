<template>
  <!--
    CollapsiblePanel —— 可收缩侧边面板

    核心思路：
      整个容器（content + edge列）一起做 translateX 动画。
      偏移量 = content 宽度，动画结束后 content 滑出屏幕，
      而 edge列（收缩按钮 + 挂件）正好停在屏幕边缘，始终可见。

    布局（side="right"，DOM 顺序从左到右，flex-direction: row-reverse 视觉翻转）：
      DOM:    [ panel-content ] [ panel-edge ]
      视觉:   [ panel-edge ] [ panel-content ]
                ↑ 贴屏幕右边缘

    布局（side="left"，flex-direction: row，DOM 顺序即视觉顺序）：
      DOM/视觉: [ panel-edge ] [ panel-content ]
                  ↑ 贴屏幕左边缘

    收缩动画原理：
      collapsed=true 时，对整个 .collapsible-panel 施加 translateX(±contentWidth)。
      panel-content 随之滑出屏幕，panel-edge 停在边缘位置，按钮和挂件仍可交互。

    panel-edge 布局细节：
      - flex column，高度 align-self: stretch 撑满父容器
      - panel-widget：正常流 flex item，margin auto 控制垂直对齐，其宽度撑开 panel-edge
      - collapse-btn：position: absolute 叠加，不参与宽度计算，不影响 panel-edge 宽度

    Slots:
      default   主内容区，收起时随 panel-content 滑出屏幕
      widget    挂件区（按钮组、图例等），与收缩按钮同列，收起后仍贴边可见

    Props:
      side         'left' | 'right'                        面板贴靠方向
      group        string                                   联动组名，同名面板自动联动
      linkage      sync | exclusive | none（默认 none）     联动模式
      widgetAlign  start | center | end（默认 end）         挂件垂直对齐
      btnAlign     start | center | end（默认 center）      收缩按钮垂直对齐

    Emits:
      toggle(collapsed: boolean)   手动点击收缩按钮时触发

    Expose:
      setCollapsed(val: boolean)   供父组件或联动组静默控制收缩状态
  -->
  <div class="collapsible-panel" :class="[`side-${side}`, { collapsed }]" :style="cssVars">
    <!-- 可收缩内容区：ref 用于 ResizeObserver 实时测量宽度 -->
    <div class="panel-content" ref="contentRef">
      <slot></slot>
    </div>

    <!-- 边缘列：flex column 撑满高度，widget 正常流撑宽，button 绝对定位叠加 -->
    <div class="panel-edge">
      <!-- 挂件区：正常流 flex item，撑开 panel-edge 宽度；margin 控制垂直位置 -->
      <div v-if="$slots.widget" class="panel-widget" :style="widgetPositionStyle">
        <slot name="widget"></slot>
      </div>
      <!-- 收缩按钮：绝对定位，不影响 panel-edge 宽度；btnAlign 控制垂直位置，默认居中 -->
      <button class="collapse-btn" @click="toggle" :title="collapsed ? '展开' : '收起'"
        :style="btnPositionStyle">
        <svg viewBox="0 0 12 20" fill="none">
          <path :d="arrowPath" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { registerPanel, unregisterPanel, notifyGroup, type LinkageMode } from './useCollapsibleGroup'

const props = defineProps<{
  side: 'left' | 'right'
  group?: string                            // 联动组名，同名面板自动联动
  linkage?: LinkageMode                     // 联动模式：sync | exclusive | none（默认 none）
  widgetAlign?: 'start' | 'center' | 'end' // 挂件垂直对齐：上/中/下，默认 end
  btnAlign?: 'start' | 'center' | 'end'    // 收缩按钮垂直对齐：上/中/下，默认 center
}>()
const emit = defineEmits<{ toggle: [collapsed: boolean] }>()

// 收缩状态
const collapsed = ref(false)
// panel-content DOM 引用，用于测量宽度
const contentRef = ref<HTMLElement>()
// panel-content 的实际像素宽度，由 ResizeObserver 实时维护
const contentWidth = ref(0)
// 当前面板在联动组中的唯一标识
const panelId = Symbol()

// 箭头方向：根据 side 和 collapsed 状态决定指向
// side=left  展开时指左（←），收起时指右（→）
// side=right 展开时指右（→），收起时指左（←）
const arrowPath = computed(() => {
  const pointLeft = (props.side === 'left') !== collapsed.value
  return pointLeft ? 'M8 2L2 10L8 18' : 'M4 2L10 10L4 18'
})

// 收缩时对整个面板施加 translateX，偏移量 = panel-content 宽度
// collapsed=false 或 contentWidth=0 时不加 transform，保持原位
// side=right：向右平移（内容滑出右侧屏幕外）
// side=left ：向左平移（内容滑出左侧屏幕外）
const cssVars = computed(() => {
  if (!collapsed.value || contentWidth.value === 0) return {}
  const offset = `${contentWidth.value}px`
  return props.side === 'right'
    ? { transform: `translateX(${offset})` }
    : { transform: `translateX(-${offset})` }
})

// 挂件垂直对齐：正常流 flex item，用 margin auto 推到对应位置
// start  → marginBottom: auto（贴顶）
// center → 上下 auto（居中）
// end    → marginTop: auto（贴底，默认）
const widgetPositionStyle = computed(() => {
  switch (props.widgetAlign ?? 'end') {
    case 'start':  return { marginTop: '1rem', marginBottom: 'auto' }
    case 'center': return { marginTop: 'auto', marginBottom: 'auto' }
    default:       return { marginTop: 'auto', marginBottom: '1rem' }
  }
})

// 收缩按钮垂直对齐：绝对定位，通过 top/bottom 控制位置
// start  → 贴顶
// end    → 贴底
// center → top:50% + translateY(-50%)（默认居中）
const btnPositionStyle = computed(() => {
  switch (props.btnAlign ?? 'center') {
    case 'start':  return { top: '1rem', bottom: 'auto' }
    case 'end':    return { bottom: '1rem', top: 'auto' }
    default:       return { top: '50%', transform: 'translateY(-50%)' }
  }
})

// 点击收缩按钮：切换状态，触发 toggle 事件，通知联动组
function toggle() {
  collapsed.value = !collapsed.value
  emit('toggle', collapsed.value)
  // 有联动组且联动模式不为 none 时，通知同组其他面板
  if (props.group && props.linkage && props.linkage !== 'none') {
    notifyGroup(props.group, panelId, collapsed.value, props.linkage)
  }
}

// 联动组回调：静默更新收缩状态，不触发 notifyGroup（避免循环通知）
function setCollapsed(val: boolean) {
  collapsed.value = val
}

// ResizeObserver 实例，用于监听 panel-content 宽度变化
let ro: ResizeObserver | null = null

onMounted(() => {
  if (contentRef.value) {
    // 用 ResizeObserver 持续监听 panel-content 尺寸变化
    // 保证 contentWidth 始终与实际渲染宽度同步（如内部布局切换时宽度会变）
    // cssVars 依赖 contentWidth，会自动重算，确保收缩偏移量始终正确
    ro = new ResizeObserver(() => {
      contentWidth.value = contentRef.value?.offsetWidth ?? 0
    })
    ro.observe(contentRef.value)
  }
  // 向联动组注册当前面板
  if (props.group) registerPanel(props.group, { id: panelId, setCollapsed })
})

onBeforeUnmount(() => {
  // 停止监听，避免内存泄漏
  ro?.disconnect()
  // 从联动组注销当前面板
  if (props.group) unregisterPanel(props.group, panelId)
})

// 暴露给父组件，允许外部直接控制收缩状态
defineExpose({ setCollapsed })
</script>

<style lang="scss" scoped>
/*
 * 整体容器：flex 横向排列，transition 驱动 translateX 收缩动画
 * overflow: visible 确保内容超出容器边界时不被裁剪（right 面板内容向左延伸）
 */
.collapsible-panel {
  display: flex;
  height: 100%;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: visible;

  /* side-right：flex-direction: row-reverse，视觉上 panel-edge 在右侧贴边 */
  &.side-right {
    flex-direction: row-reverse;
    // 收缩按钮贴右边（屏幕边缘侧），左侧边框去掉避免双线
    .collapse-btn { right: 0; left: auto; border-radius: 0 0.4rem 0.4rem 0; border-left: none; }
  }

  /* side-left：flex-direction: row，panel-edge 在左侧贴边 */
  &.side-left {
    flex-direction: row;
    // 收缩按钮贴左边（屏幕边缘侧），右侧边框去掉避免双线
    .collapse-btn { left: 0; right: auto; border-radius: 0.4rem 0 0 0.4rem; border-right: none; }
  }
}

/* 主内容区：flex 容器，高度撑满，flex-shrink:0 防止被压缩 */
.panel-content {
  display: flex;
  height: 100%;
  flex-shrink: 0;
  position: relative;
}

/*
 * 边缘列：flex column，高度 align-self:stretch 撑满父容器
 * 宽度由 panel-widget 内容自然撑开（collapse-btn 绝对定位不参与宽度）
 * min-width 保证无 widget 时按钮仍有最小宽度
 */
.panel-edge {
  flex-shrink: 0;
  align-self: stretch;
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 1.8rem;
  padding: 1rem 0;
  pointer-events: all;
}

/* 挂件区：正常流 flex item，撑开 panel-edge 宽度；margin 由 widgetPositionStyle 控制垂直位置 */
.panel-widget {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 收缩按钮：绝对定位叠加在 panel-edge 上，不影响 panel-edge 宽度 */
.collapse-btn {
  position: absolute;
  width: 1.8rem;
  height: 5rem;
  background: rgba(10, 28, 44, 0.95);
  border: 1px solid rgba(21, 186, 198, 0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(21, 186, 198, 0.8);
  transition: background 0.2s, border-color 0.2s, color 0.2s;
  padding: 0;

  svg { width: 0.9rem; height: 1.4rem; }

  &:focus { outline: none; }

  &:hover {
    background: rgba(21, 186, 198, 0.15);
    border-color: rgba(21, 186, 198, 0.7);
    color: #60E4FF;
  }
}
</style>
