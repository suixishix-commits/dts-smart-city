import emitter from '@/utils/emits';
<template>
  <div class="dialog-box">
    <el-dialog
      v-model="visible"
      :modal="false"
      :draggable="true"
      :align-center="true"
      :width="dialogWidth"
      :lock-scroll="false"
      :destroy-on-close="true"
      :close-on-click-modal="false"
      :style="{ height: dialogHeight }"
      @opened="openDialog"
      @close="closeDialog"
      class="element-dialog"
    >
      <template #header>
        <div class="box-dialog-title">
          <img src="@/assets/popup2/icon_dialog.png" />
          <p class="dialog-title-text">{{ props.title }}</p>
          <div class="highlight top"></div>
          <div class="highlight bottom"></div>
        </div>
      </template>
      <slot></slot>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { designPxToRem } from '@/utils/viewportScale'

// 属性定义
const props = defineProps({
  visible: {
    type: Boolean,
    default: true
  },
  title: {
    type: String,
    default: '默认标题'
  },
  height: {
    type: String,
    default: '50%'
  },
  width: {
    type: String,
    default: '50%'
  }
})
const visible = ref(props.visible)
// 调用方传的是 1920 设计稿 px（如 '800px'），转成 rem 跟随根字号缩放；%、vw 等原样
const dialogWidth = computed(() => designPxToRem(props.width))
const dialogHeight = computed(() => designPxToRem(props.height))

watch([() => props.visible, () => props.title], (newVal, oldVal) => {
  if (newVal[0] != oldVal[0]) {
    //console.log('visible属性发生变化了啊', newVal[0], oldVal[0])
    visible.value = newVal[0]
  }
})

// 事件定义
const emit = defineEmits(['opened', 'close'])

// 显示Dialog
const openDialog = () => {
  emit('opened', {})
}
// 关闭Dialog
const closeDialog = () => {
  emit('close', {})
}

defineExpose({
  visible
})
</script>

<style lang="scss" scoped>
.dialog-box {
  :deep(.element-dialog) {
    z-index: 99;
    --el-dialog-bg-color: rgba(13, 14, 14, 0.9);
    --el-dialog-padding-primary: 0;
    box-shadow: 0 0 1rem 0.5rem rgba(46, 222, 243, 0.85);
    pointer-events: all;
    padding: 0px;
    &:not(.is-fullscreen) {
      margin-top: auto !important;
    }
    .el-dialog__header {
      position: relative;
      margin-right: 0;
      height: 50px;
      line-height: 50px;
      font-size: 32px;
      padding: 0;
      background-color: rgb(46, 222, 243);

      .dialog-title {
        font-family: OPPOSans;
        padding-left: 36px;
        background: linear-gradient(180deg, #ffffff 0%, #00b7ff 100%);
        background-clip: border-box;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .el-dialog__headerbtn {
        top: 6px;
        right: 26px;
        width: 38px;
        height: 38px;
        color: white;
        font-size: 22px;
        .el-dialog__close {
          color: white;
          font-size: 22px;
        }
      }
    }
    .el-dialog__body {
      position: relative;
      height: calc(100% - 50px);
    }
  }

  .box-dialog-title {
    color: white;
    font-size: 2.2rem;
    height: 100%;
    line-height: 5rem;
    // background-size: 100% 100%;
    // background-image: url('@/assets/popup2/bg_dialog19.png');
    position: relative;
    overflow: hidden;
    display: flex;
    gap: 1rem;
    padding-left: 1rem;
    align-items: center;
    img {
      width: 2.8rem;
      height: 2.6rem;
      display: block;
    }
    .dialog-title-text {
      box-sizing: border-box;
      letter-spacing: 0.1rem;
      white-space: nowrap;
    }
    .highlight {
      position: absolute;
      width: 115%;
      height: 100%;
      background-size: contain;
      background-repeat: no-repeat;
      animation-duration: 5s;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
    }
    .top {
      top: 0;
      right: 0;
      background-image: url('@/assets/popup2/lightHeight_top.png');
      animation-name: move-top;
    }
    .bottom {
      bottom: 0;
      left: 0;
      background-image: url('@/assets/popup2/lightHeight_bottom.png');
      animation-name: move-bottom;
    }
  }
  @keyframes move-top {
    0% {
      transform: translateX(calc(100% - 50px));
    }
    100% {
      transform: translateX(0);
    }
  }
  @keyframes move-bottom {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(calc(100% - 50px));
    }
  }
}
</style>
