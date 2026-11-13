<template>
  <div class="area_choose_wrap">
    <div class="closePopover" @click="closePopover"></div>
    <div class="title">
      <p class="text">区域选择</p>
    </div>
    <div class="checkbox_wrap">
      <el-checkbox v-model="allChecked" label="全苏州市" @change="allCheck" />
    </div>
    <div class="areaChooseCharts" ref="areaChooseChartsEle" style="width: 22.1rem; height: 24.8rem"></div>
  </div>
</template>

<script setup lang="ts">
import { setScaledOption } from '@/utils/viewportScale'
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import suzhouMap from '../assets/suzhou.js'

const emit = defineEmits(['close', 'item_click'])
const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  data: null,
  popoverIndex: {
    type: Number,
    required: true
  }
})

const areaChooseChartsEle = ref()
const allChecked = ref(true)
// 选中的区域
const currentSelectedArea = ref<any>([])
const seriesData = suzhouMap.features.map((item: any) => {
  return {
    name: item.properties.name,
    coordinates: item.geometry.coordinates,
    adcode: item.properties.adcode,
    value: item.properties.value
  }
})
const areaChooseCharts = ref()
let hasInit = false

// 初始化echarts图表
const initSuZhouMap = () => {
  currentSelectedArea.value = seriesData.map((item: any) => {
    return item
  })
  if (areaChooseCharts.value) {
    areaChooseCharts.value.dispose()
  }
  areaChooseCharts.value = echarts.init(areaChooseChartsEle.value)
  // 注册地图
  echarts.registerMap('suzhouMap', suzhouMap)
  const option = {
    tooltip: {
      trigger: 'item',
      showDelay: 0,
      transitionDuration: 0.2,
      formatter: '起降点数量<br /> {b}: {c}'
    },

    series: [
      {
        type: 'map',
        name: '苏州地图',
        map: 'suzhouMap',
        selectedMode: 'multiple',
        itemStyle: {
          areaColor: 'rgba(255, 255, 255, 0.5)',
          borderColor: '#C4D3EE'
        },
        // emphasis: {
        //   itemStyle: {
        //     areaColor: '#A1F0EB'
        //   }
        // },
        select: {
          disabled: false,
          itemStyle: {
            areaColor: '#A1F0EB'
          }
        },
        data: seriesData.map((item: any) => {
          return {
            name: item.name,
            coordinates: item.coordinates,
            adcode: item.adcode,
            selected: true,
            value: item.value
          }
        })
      }
    ]
  }
  setScaledOption(areaChooseCharts.value, option)
  // 监听echarts点击事件
  areaChooseCharts.value.on('click', function (params: any) {
    //console.log(`当前点击区域为：${params.name}`, params)
    const findRes = currentSelectedArea.value.findIndex((item: any) => {
      return item.name == params.data.name
    })
    if (findRes == -1) {
      currentSelectedArea.value.push({
        name: params.data.name,
        coordinates: params.data.coordinates,
        adcode: params.data.adcode
      })
    } else {
      currentSelectedArea.value.splice(findRes, 1)
    }
    if (currentSelectedArea.value.length == 9) {
      allChecked.value = true
    } else {
      allChecked.value = false
    }
  })
}
// 点击全选按钮
const allCheck = (val: any) => {
  if (val) {
    allChecked.value = true
    areaChooseCharts.value.dispatchAction({
      type: 'select',
      seriesIndex: 0,
      name: ['虎丘区', '吴中区', '相城区', '姑苏区', '吴江区', '常熟市', '张家港市', '昆山市', '太仓市']
    })
    currentSelectedArea.value = seriesData.map((item: any) => {
      return item
    })
  } else {
    allChecked.value = false
    areaChooseCharts.value.dispatchAction({
      type: 'unselect',
      seriesIndex: 0,
      name: ['虎丘区', '吴中区', '相城区', '姑苏区', '吴江区', '常熟市', '张家港市', '昆山市', '太仓市']
    })
    currentSelectedArea.value = []
  }
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      if (!hasInit) {
        hasInit = true
        nextTick(() => {
          initSuZhouMap()
          window.addEventListener('resize', () => {
            areaChooseCharts.value.resize()
          })
        })
      }
    }
  }
)
watch(
  () => currentSelectedArea.value,
  (val) => {
    // 事件转发
    emit('item_click', val)
  },
  {
    // immediate: true,
    deep: true
  }
)

// 关闭窗口
const closePopover = () => {
  // 关闭事件传递
  emit('close', { popoverIndex: props.popoverIndex, data: props.data })
}

onMounted(() => {})

onBeforeUnmount(() => {
  if (areaChooseCharts.value) {
    areaChooseCharts.value.dispose()
    window.removeEventListener('resize', () => {
      areaChooseCharts.value.resize()
    })
  }
})
</script>

<style scoped lang="scss">
.area_choose_wrap {
  width: 28.092rem;
  height: 35.354rem;
  background: url('../assets/pop_bg_area_choose.png') no-repeat 0 0 / 100% 100%;
  position: relative;
  font-family: OPPOSans;
  font-size: 1.4rem;
  font-weight: 500;
  color: #c4d3ee;

  .closePopover {
    position: absolute;
    top: 0;
    right: 0;
    width: 3.235rem;
    height: 1.646rem;
    z-index: 9;
    cursor: pointer;
  }

  .title {
    position: absolute;
    left: 0;
    top: 1.879rem;
    width: 86.01%;
    height: 7.36%;
    background: url('../assets/area_choose_title.png') no-repeat 0% 100% / 100% 81.34%;

    .text {
      margin-left: 4.142rem;
      height: 2.2rem;
      line-height: 2.2rem;
      font-size: 1.8rem;
    }
  }

  .checkbox_wrap {
    position: absolute;
    left: 3rem;
    top: 5rem;

    .el-checkbox {
      margin-right: 2rem;

      :deep(.el-checkbox__inner) {
        border: 1.2px solid #3ecac7;
        box-shadow: 0px 0px 3px 0px #00cec8;
        background: #0c1522;

        &:hover {
          border-color: #3ecac7;
        }
      }

      :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
        background: #3ecac7;
      }

      :deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner) {
        background: #3ecac7;
      }

      :deep(.el-checkbox__label) {
        font-family: OPPOSans;
        font-size: 1.4rem;
        font-weight: 500;
        color: #c4d3ee;
      }
    }
  }

  .areaChooseCharts {
    position: absolute;
    left: 2.6rem;
    top: 9rem;
  }
}
</style>
