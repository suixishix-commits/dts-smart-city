<template>
  <div class="chart-box" :style="styObj">
    <!-- 进度条部分 -->
    <div class="process-wrapper">
      <div class="process-box"></div>
      <div class="pointer-box"></div>
    </div>
    <!-- 插槽内容 -->
    <div class="slot-content">
      <slot></slot>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  rate: {
    type: Number,
    default: 0
  },
  config: {
    type: Object,
    default: () => ({})
  }
})

const defaultConfig = ref({
  borderWidth: '8px', // 描边宽度
  borderBackground: 'transparent', // 描边背景颜色
  circleSize: '16px', // 结尾处圆点直径
  circleColor: '#FF6A39', // 结尾处圆点颜色
  startColor: '#00FF22', // 进度条起始颜色
  endColor: '#FF6A39', // 进度条结束颜色
  clockwise: true, // 是否顺时针
  showEyes: false, // 是否显示结尾处小眼睛
  eyesSize: '8px', // 结尾处小眼睛大小
  endPoscolor: '#1C4C68'
})

const styObj = computed(() => {
  let rate = 0
  if (props.rate <= 0) {
    rate = 0
  } else if (props.rate >= 1) {
    rate = 1
  } else {
    rate = props.rate
  }
  let endPos = `${rate * 100}%`
  let obj = { ...defaultConfig.value, ...props.config } // 使用展开运算符简化对象合并
  let rotate = `rotate(${360 * rate}deg)`
  let chartRotate = obj.clockwise ? 'rotateY(0deg)' : 'rotateY(180deg)'
  let showEyes = obj.showEyes ? 1 : 0
  return {
    '--background-image': `conic-gradient(${obj.startColor} 0%, ${obj.endColor} ${endPos}, ${obj.endPoscolor} ${endPos})`,
    '--border-width': obj.borderWidth,
    '--dot-width': obj.circleSize,
    '--pointer-rotate': rotate,
    '--background-color': obj.borderBackground,
    '--circle-color': obj.circleColor,
    '--clockwise-wise': chartRotate,
    '--show-eyes': showEyes,
    '--eyes-size': obj.eyesSize,
    '--start-color': obj.startColor
  }
})
</script>
<style scoped>
.chart-box {
  position: relative;
  width: 100%;
  height: 100%;
  --border-width: 8px !important;
  --eyes-size: 18px !important;
  --dot-width: 18px !important;
}
/* 将图表和插槽内容分开，便于控制进度条顺时针亦或是逆时针 */
.process-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  transform: var(--clockwise-wise);
}
/* 开始处增加一个圆形端点，模拟圆角效果 */
.process-wrapper::after {
  content: '';
  width: var(--border-width);
  height: var(--border-width);
  border-radius: 50%;
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  background: var(--start-color);
}
/* 核心代码、控制进度条样式及进度 */
.process-box {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  box-sizing: border-box;
  background-color: var(--background-color);
  background-image: var(--background-image);
  -webkit-mask: radial-gradient(closest-side at center center, transparent calc(100% - var(--border-width)), #fff calc(100% - var(--border-width)));
  mask: radial-gradient(closest-side at center center, transparent calc(100% - var(--border-width)), #fff calc(100% - var(--border-width)));
}
/* 指示针 */
.pointer-box {
  position: absolute;
  left: 50%;
  top: calc(0px + var(--border-width) / 2);
  bottom: calc(0px + var(--border-width) / 2);
  z-index: 1;
  transform: var(--pointer-rotate);
}
/* 指示针的头部（进度条结尾处）添加一个小圆点 */
.pointer-box::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  width: var(--dot-width);
  height: var(--dot-width);
  border-radius: 50%;
  background: var(--circle-color);
  transform: translate(-50%, -50%);
}
/* 进度条结尾处添加一个小眼睛，背景白色 */
.pointer-box::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  width: var(--eyes-size);
  height: var(--eyes-size);
  border-radius: 50%;
  background: #fff;
  transform: translate(-50%, -50%);
  z-index: 1;
  opacity: var(--show-eyes);
}
/* 插槽内容样式 */
.slot-content {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
