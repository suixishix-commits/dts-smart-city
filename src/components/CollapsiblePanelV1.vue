<template>
  <!-- 左侧折叠面板 -->
  <div
    :class="['collapsiblePanelLeft', getContainerAnimationClass(leftSlotIsShow, 'left'), leftPanelCustomClass]"
    v-if="leftPanelVisible"
    :style="{
      '--leftContentWidth': `-${leftContentWidth}px`,
      '--leftUtilsWidth': `${leftUtilsWidth}px`
    }"
  >
    <!-- 左侧主内容插槽 -->
    <div ref="leftContentRef" class="content leftContent" v-if="slots.left">
      <slot name="left" />
    </div>

    <!-- 左侧控制区 -->
    <div class="sideBtn leftBtn">
      <div class="imgBox" v-if="slots.left">
        <div class="sideImg leftImg" :class="{ active: !leftSlotIsShow }" @click="handleClick('left')"></div>
      </div>
      <!-- 左侧工具栏插槽 -->
      <div ref="leftUtilsRef" class="sideUtils leftUtils">
        <slot name="leftUtils" />
      </div>
    </div>
  </div>

  <!-- 右侧折叠面板 -->
  <div
    :class="['collapsiblePanelRight', getContainerAnimationClass(rightSlotIsShow, 'right'), rightPanelCustomClass]"
    v-if="rightPanelVisible"
    :style="{
      '--rightContentWidth': `-${rightContentWidth}px`,
      '--rightUtilsWidth': `${rightUtilsWidth}px`
    }"
  >
    <!-- 右侧控制区 -->
    <div class="sideBtn rightBtn">
      <div class="imgBox" v-if="slots.right">
        <div class="sideImg rightImg" :class="{ active: !rightSlotIsShow }" @click="handleClick('right')"></div>
      </div>
      <!-- 右侧工具栏插槽 -->
      <div ref="rightUtilsRef" class="sideUtils rightUtils">
        <slot name="rightUtils" />
      </div>
    </div>

    <!-- 右侧主内容插槽 -->
    <div ref="rightContentRef" class="content rightContent" v-if="slots.right">
      <slot name="right" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useSlots, ref, computed, watch, onMounted, nextTick } from 'vue'

// 类型定义
type Direction = 'left' | 'right'

interface AnimationClass {
  [key: string]: boolean
}

// 组件Props
const props = defineProps({
  enableLinkage: { type: Boolean, default: true },
  leftPanelCustomClass: { type: String, default: '' },
  rightPanelCustomClass: { type: String, default: '' }
})

// 插槽与DOM引用
const slots = useSlots()
const leftContentRef = ref<HTMLDivElement>()
const rightContentRef = ref<HTMLDivElement>()
const leftUtilsRef = ref<HTMLDivElement>()
const rightUtilsRef = ref<HTMLDivElement>()

// 状态管理（单位：rem，基于1rem=10px）
const [leftContentWidth, rightContentWidth] = [ref(0), ref(0)] // 200px = 20rem
const [leftUtilsWidth, rightUtilsWidth] = [ref(0), ref(0)] // 60px = 6rem
const [leftSlotIsShow, rightSlotIsShow] = [ref(false), ref(false)]

// 工具函数：判断插槽是否存在
const hasLeftSlot = () => !!(slots.left || slots.leftUtils)
const hasRightSlot = () => !!(slots.right || slots.rightUtils)

// 面板可见性
const leftPanelVisible = computed(hasLeftSlot)
const rightPanelVisible = computed(hasRightSlot)

// 生成容器动画类名（仅针对面板容器）
const getContainerAnimationClass = (isShow: boolean, direction: Direction): AnimationClass => {
  const prefix = `container${direction.charAt(0).toUpperCase() + direction.slice(1)}`
  return isShow ? { [`${prefix}Show`]: true } : { [`${prefix}Hide`]: true }
}

// 点击切换事件
const handleClick = (direction: Direction) => {
  if (props.enableLinkage) {
    leftSlotIsShow.value = !leftSlotIsShow.value
    rightSlotIsShow.value = leftSlotIsShow.value
  } else {
    direction === 'left' ? (leftSlotIsShow.value = !leftSlotIsShow.value) : (rightSlotIsShow.value = !rightSlotIsShow.value)
  }
  nextTick(calculateWidths)
}

// 核心：自动计算宽度
const calculateWidths = () => {
  // 左侧工具栏宽度
  if (slots.leftUtils && leftUtilsRef.value) {
    leftUtilsWidth.value = leftUtilsRef.value.offsetWidth || 0
  }

  // 左侧主内容宽度,只要有内容插槽，图标就应当展示
  if (slots.left && leftContentRef.value) {
    leftContentWidth.value = leftContentRef.value.offsetWidth || 0
    if (leftUtilsWidth.value == 0) {
      leftUtilsWidth.value = 18
    }
  }

  // 右侧工具栏宽度
  if (slots.rightUtils && rightUtilsRef.value) {
    rightUtilsWidth.value = rightUtilsRef.value.offsetWidth || 0
  }

  // 右侧主内容宽度,只要有内容插槽，图标就应当展示
  if (slots.right && rightContentRef.value) {
    rightContentWidth.value = rightContentRef.value.offsetWidth || 0
    if (rightUtilsWidth.value == 0) {
      rightUtilsWidth.value = 18
    }
  }
}

// 监听与初始化
watch([leftSlotIsShow, rightSlotIsShow], () => nextTick(calculateWidths))
watch(
  () => [slots.left, slots.leftUtils, slots.right, slots.rightUtils],
  () => {
    if (!leftSlotIsShow.value && hasLeftSlot()) leftSlotIsShow.value = true
    if (!rightSlotIsShow.value && hasRightSlot()) rightSlotIsShow.value = true
    nextTick(calculateWidths)
  },
  { deep: true }
)

onMounted(() =>
  nextTick(() => {
    leftSlotIsShow.value = hasLeftSlot()
    rightSlotIsShow.value = hasRightSlot()
    calculateWidths()
  })
)

// 暴露外部方法
defineExpose({
  switchBothSides: (visible: boolean) => {
    leftSlotIsShow.value = visible
    rightSlotIsShow.value = visible
  },
  switchLeftSide: (visible: boolean) => {
    leftSlotIsShow.value = visible
  },
  switchRightSide: (visible: boolean) => {
    rightSlotIsShow.value = visible
  },
  recalculateWidths: () => nextTick(calculateWidths)
})
</script>

<style lang="scss" scoped>
// 公共变量（全部使用rem，1rem=10px）
$edgeMargin: 0.1rem; // 1px = 0.1rem
$animationDuration: 0.5s;
$minContentWidth: 0rem; // 200px = 20rem
$minUtilsWidth: 0rem; // 60px = 6rem
$imgWidth: 1.8rem; // 图标宽度：原18px → 1.8rem
$imgHeight: 8.8rem; // 图标高度：原88px → 8.8rem

// 公共样式混合器
@mixin panelCommon {
  position: absolute;
  height: calc(100% - 0.26rem); // 2.6px = 0.26rem
  margin: 0.06rem 0 0.2rem 0; // 0.6px=0.06rem，2px=0.2rem
  pointer-events: none;
  display: flex;

  .content {
    position: relative;
    height: 100%;
    min-width: $minContentWidth;
  }

  .sideBtn {
    cursor: pointer;
    position: relative;
    top: 0;
    height: 100%;
    pointer-events: all;
    min-width: $minUtilsWidth;
    // border: 2px solid #f20505;
  }

  .imgBox {
    height: 50%;
    position: relative;
    z-index: 1;

    &:hover .sideImg {
      display: block;
    }
  }

  .sideImg {
    width: $imgWidth;
    height: $imgHeight;
    position: absolute;
    bottom: 0;
    display: none;
    cursor: pointer;
    transition: background-image $animationDuration;
  }

  .sideUtils {
    position: absolute;
    min-width: $minUtilsWidth;
    height: 50%;
    bottom: 0;
    display: flex;
    gap: 0.05rem; // 0.5px = 0.05rem
    max-height: calc(50%);
    overflow-y: auto;
    padding-bottom: 1rem; // 1px = 0.1rem
    box-sizing: border-box;
    justify-content: center;
    align-items: flex-end;
  }
}

// 左侧面板样式
.collapsiblePanelLeft {
  @include panelCommon;
  left: $edgeMargin;

  .leftBtn {
    left: calc($edgeMargin);
    width: var(--leftUtilsWidth);

    .leftImg {
      left: 0.5rem;
      background: url('@/assets/collapsible-panel/hide-bg-left.png') no-repeat center / 100% 100%;
    }

    .leftImg.active {
      background: url('@/assets/collapsible-panel/show-bg-left.png') no-repeat center / 100% 100%;
    }
  }
}

// 右侧面板样式
.collapsiblePanelRight {
  @include panelCommon;
  right: $edgeMargin;

  .content {
    flex-direction: row-reverse;
  }

  .rightBtn {
    right: calc($edgeMargin);
    width: var(--rightUtilsWidth);

    .rightImg {
      right: 0.5rem;
      background: url('@/assets/collapsible-panel/hide-bg-right.png') no-repeat center / 100% 100%;
    }

    .rightImg.active {
      background: url('@/assets/collapsible-panel/show-bg-right.png') no-repeat center / 100% 100%;
    }

    .rightUtils {
      right: 0.04rem; // 0.4px = 0.04rem
    }
  }
}

// 容器动画关键帧（仅作用于面板容器）
@keyframes containerLeftShow {
  0% {
    transform: translateX(var(--leftContentWidth));
    opacity: 1;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}
@keyframes containerLeftHide {
  0% {
    transform: translateX(0);
    opacity: 1;
  }
  100% {
    transform: translateX(var(--leftContentWidth));
    opacity: 1;
  }
}
@keyframes containerRightShow {
  0% {
    transform: translateX(calc(-1 * var(--rightContentWidth)));
    opacity: 1;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}
@keyframes containerRightHide {
  0% {
    transform: translateX(0);
    opacity: 1;
  }
  100% {
    transform: translateX(calc(-1 * var(--rightContentWidth)));
    opacity: 1;
  }
}

// 容器动画类配置
.containerLeftShow,
.containerLeftHide,
.containerRightShow,
.containerRightHide {
  animation: $animationDuration ease-in-out forwards;
}

.containerLeftShow {
  animation-name: containerLeftShow;
}
.containerLeftHide {
  animation-name: containerLeftHide;
}
.containerRightShow {
  animation-name: containerRightShow;
}
.containerRightHide {
  animation-name: containerRightHide;
}
</style>
