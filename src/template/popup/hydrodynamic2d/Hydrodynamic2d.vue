<template>
  <div class="chartBox">
    <div class="location">点击点坐标：{{ props.location }}</div>
    <ChartFrame :option="chartOption1" ref="myChart" />
  </div>
</template>

<script setup lang="ts">
import { getTemplateData } from '@/api/fileData'
import Hydrodynamic2dOption from './Hydrodynamic2dOption'
// 属性定义
const props = defineProps({
  location: {
    type: Array,
    default: () => [492782.216, 2492117.762]
  },
  schema: {
    type: String,
    default: ''
  },
  srid: {
    type: String,
    default: ''
  }
})
//echart引用
const myChart = ref()
// echart配置信息
const chartOption1 = ref({})

// 获取Echart数据，并绑定chart
async function initGUI() {
  let res: any = await getTemplateData('popup/hydrodynamic2d/assets/gridDeep.json')
  console.log('水动力水深过程数据', res)
  if (res?.data?.data?.length > 0) {
    chartOption1.value = Hydrodynamic2dOption.getOption(res.data.data)
  }
}

onMounted(() => {
  //chartOption1.value = getYuLiangZhanLineOption()
  initGUI()
})
</script>

<style lang="scss" scoped>
.chartBox {
  position: relative;
  width: 100%;
  height: 100%;
  padding-bottom: 3px;
  .location {
    position: absolute;
    padding-left: 33px;
    z-index: 99;
    color: white;
  }
}
</style>
