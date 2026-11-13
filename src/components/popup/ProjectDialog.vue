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
        <p class="dialog-title">{{ props.title }}</p>
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
    pointer-events: all;
    --el-dialog-bg-color: transparent;
    box-sizing: border-box;
    box-shadow: none;
    background: url('@/assets/popup/popup_bg.png') 0 0 / 100% 100% no-repeat;
    padding: 16px;
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
        background: url('@/assets/popup/pop_btn.png') 0 0 / 100% 100% no-repeat;
        .el-dialog__close {
          color: transparent;
        }
      }
    }
    .el-dialog__body {
      height: calc(100% - 50px);
    }
  }
}
</style>
