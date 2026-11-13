<!-- 公共chart组件 -->
<template>
  <div class="ChartFrame" ref="chartRef"></div>
</template>

<script setup lang="ts">
import { setScaledOption } from '@/utils/viewportScale'
import * as echarts from 'echarts'

// 属性定义
const props = defineProps({
  option: {
    type: Object,
    required: false
  },
  //是否开启点击事件
  enableClickEvent: {
    type: Boolean,
    default: false,
    required: false
  }
})

// const { option } = toRefs(props)
// 图表点击事件
const emit = defineEmits(['click'])
const chartRef = ref<any>()
let myChart: any

const resize = () => {
  nextTick(() => {
    myChart?.resize()
  })
}

const setOption = (option: any) => {
  myChart?.clear()
  if (myChart) setScaledOption(myChart, option)
  resize()
}

const getOption = () => {
  return myChart?.getOption()
}

watch(
  [() => props.option],
  (newVal, oldVal) => {
    if (newVal[0] != oldVal[0]) {
      console.log('ChartFrame中的属性发生变化了啊', newVal[0], oldVal[0])
      if (newVal[0]) {
        setOption(newVal[0])
      }
    }
  },
  {
    immediate: true
  }
)

const clear = () => {
  myChart?.clear()
}

const dispatchAction = (params: any) => {
  myChart?.dispatchAction(params)
}
defineExpose({ dispatchAction, resize, clear, setOption, getOption })

onMounted(() => {
  nextTick(() => {
    myChart = (echarts as any).init(chartRef.value as HTMLDivElement)
    console.log('ChartFrame中监听了点击事件', props?.enableClickEvent)
    if (props?.enableClickEvent) {
      myChart.on('click', (params: any) => {
        console.log('ChartFrame点击事件', params)
        emit('click', params)
      })
    }
  })
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
})
</script>

<style lang="scss" scoped>
.ChartFrame {
  width: 100%;
  height: 100%;
  transform-origin: 0% 0%;
  pointer-events: all;
}
</style>
