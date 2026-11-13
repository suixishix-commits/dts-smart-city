<template>
  <div class="partitionPanel" :style="big">
    <div class="partitionPanel-title" :class="ImageClass">
      <div class="text" @click="titleClick(title)" :style="{ cursor: cursor ? 'pointer' : 'default' }">
        {{ title }}
      </div>
      <div class="btnGroup">
        <div class="icon" @click="switchClick" v-if="switchVisible">
          <slot name="icon-text">
            <div class="switch-text">{{ switchState.text }}</div>
          </slot>
        </div>
        <div class="icon" @click="detailClick(title)" v-if="goToVisible || restore">
          <slot name="icon">
            <div class="icon-text" v-if="goToVisible">详情</div>
            <div class="icon-text" v-if="restore && !switchBlowUp">最大化</div>
            <div class="icon-text" v-if="restore && switchBlowUp">最小化</div>
            <div class="icon-icon" v-if="goToVisible"></div>
            <div :class="switchImg" v-if="restore"></div>
          </slot>
        </div>
      </div>
    </div>
    <div class="partitionPanel-content">
      <slot></slot>
    </div>
  </div>
</template>
<script lang="ts" setup>
const emit = defineEmits(['handleDetail', 'titleClick', 'switchClick'])
const ImageClass = ref('small')
const props = defineProps({
  // 左上角标题
  title: {
    type: String,
    default: '标题'
  },
  // 是否显示详情按钮
  goToVisible: {
    type: Boolean,
    default: true
  },
  // 是否显示隐藏开关
  switchVisible: {
    type: Boolean,
    default: false
  },
  // 是否显示全选按钮
  switchConfig: {
    type: Object,
    default: {
      default: {
        text: '取消全选',
        val: 1
      },
      switch: {
        text: '全选',
        val: 0
      }
    }
  },
  // 标题背景图片大小
  titleBgSize: {
    type: String,
    default: 'small'
  },
  // 光标显示的样式
  cursor: {
    type: Boolean,
    default: false
  },
  // 表格位置和大小
  maximizingParameters: {
    type: Object,
    default: () => {
      return {
        top: '0rem',
        left: '0rem',
        right: '0rem',
        bottom: '0rem',
        height: '100%',
        width: '100%'
      }
    }
  },
  // 是否变大
  switchBlowUp: {
    type: Boolean,
    default: false
  },
  // 是否显示放大还原按钮
  restore: {
    type: Boolean,
    default: false
  }
})
const switchImg = computed(() => {
  if (props.switchBlowUp) {
    return 'icon-restore'
  } else {
    return 'icon-blowUp'
  }
})
const detailClick = (title: string) => {
  //console.log(title)
  emit('handleDetail', title)
}
const titleClick = (title: string) => {
  //console.log(title)
  emit('titleClick', title)
}

// 当前选中状态,default\switch
const switchState = ref({
  text: '取消全选',
  val: 0
})
// 选中配置
const switchConf = ref()

const switchClick = () => {
  if (switchState.value.val == switchConf.value.default.val) {
    switchState.value = switchConf.value.switch
  } else {
    switchState.value = switchConf.value.default
  }
  emit('switchClick', switchState.value)
}
const bgSize = () => {
  if (props.titleBgSize == 'middle') ImageClass.value = 'middle'
  if (props.titleBgSize == 'small') ImageClass.value = 'small'
  if (props.titleBgSize == 'secondaryTitle') ImageClass.value = 'secondaryTitle'
}
// 通过props中的isBig判断是否变大变小
const big: any = computed(() => {
  if (props.switchBlowUp) {
    return {
      position: 'absolute',
      top: props.maximizingParameters.top,
      left: props.maximizingParameters.left,
      right: props.maximizingParameters.right,
      bottom: props.maximizingParameters.bottom,
      // height: `calc(100% - ${props.maximizingParameters.top} - 2rem) `,
      // width: `calc(100% - ${props.maximizingParameters.left} - ${props.maximizingParameters.right} + 2rem)`,
      height: props.maximizingParameters.height,
      width: props.maximizingParameters.width,
      'z-index': 9999,
      'background-color': '#0c253e'
    }
  } else {
    return ''
  }
})
onMounted(() => {
  if (props.switchVisible) {
    switchConf.value = props.switchConfig
    switchState.value = props.switchConfig.default
  }
  bgSize()
})
</script>
<style lang="scss" scoped>
.partitionPanel {
  box-sizing: border-box;
  position: relative;
  pointer-events: all;
  width: 100%;
  height: 100%;
  border-right: 0.1rem solid #19a0ff;
  border-top: 0.1rem solid #19a0ff;
  background: linear-gradient(0deg, rgba(10, 39, 103, 0.8) 0%, rgba(10, 39, 103, 0.6) 100%);
  .partitionPanel-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 3.4rem;
    width: 100%;
    // background: url('./assets/partitionPanel-title-bg.png') no-repeat center center / 100% 100%;

    .text {
      margin: -0.5em 0 0 1rem;
      font-family: SourceHanSans CN;
      font-size: 1.8rem;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-variation-settings: 'opsz' auto;
      background: linear-gradient(181deg, #dce8ff 52%, #70b3ff 82%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      z-index: 10;
    }

    .btnGroup {
      display: flex;
      .icon {
        cursor: pointer;
        display: flex;
        align-items: center;
        margin: -1rem 1rem 0 0;
        z-index: 10;
        font-family: OPPOSans;
        font-size: 1.4rem;
        font-weight: normal;
        line-height: normal;
        text-transform: uppercase;
        letter-spacing: 0.05em;

        font-variation-settings: 'opsz' auto;
        font-feature-settings: 'kern' on;
        color: #97d5ff;

        .icon-text {
          z-index: 10;
        }

        .icon-icon {
          margin-left: 0.6rem;
          width: 1.6rem;
          height: 1.6rem;
          background: url('./assets/left-bottom-jump-icon.png') no-repeat center center / 100% 100%;
          z-index: 10;
        }
        .icon-restore {
          margin-left: 0.6rem;
          width: 1.6rem;
          height: 1.6rem;
          background: url('./assets/icon-restore.png') no-repeat center center / 100% 100%;
          z-index: 10;
        }
        .icon-blowUp {
          margin-left: 0.6rem;
          width: 1.6rem;
          height: 1.6rem;
          background: url('./assets/icon-blow-up.png') no-repeat center center / 100% 100%;
          z-index: 10;
        }
      }
    }
  }
  .middle {
    background: url('./assets/partitionPanel-title-middle-bg.png') no-repeat center center / 100% 100%;
  }
  .small {
    background: url('./assets/partitionPanel-title-bg.png') no-repeat center center / 100% 100%;
  }
  // 二级标题背景
  .secondaryTitle {
    background: url('./assets/secondaryTitle.png') no-repeat center center / 100% 100%;
  }
  .partitionPanel-content {
    box-sizing: border-box;
    position: relative;
    width: 100%;
    height: calc(100% - 3.4rem);
    border-left: 0.1rem solid #19a0ff;
    border-bottom: 0.1rem solid #19a0ff;
  }
}
.aaaa {
  position: fixed;
  top: 11rem;
  bottom: 0rem;
  height: 80rem !important;
  width: 144rem !important;
  z-index: 11;
  background-color: #0c253e;
}
</style>
