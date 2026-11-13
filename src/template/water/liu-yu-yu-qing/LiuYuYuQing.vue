<template>
  <div class="box-template">
    <ChartFrame :option="chartOption" ref="myChart" class="box-chart" />
  </div>
</template>

<script setup lang="ts">
import { getTemplateData } from '@/api/fileData'
import LiuYuYuQingOption from './LiuYuYuQingOption'
//echart引用
const myChart = ref()
// echart配置信息
const chartOption = ref({})
// 绑定数据
const listData: any = ref([])
// 初始化UI
async function initGUI() {
  let res: any = await getTemplateData('water/liu-yu-yu-qing/assets/data.json')
  console.log('后台数据:？', res)
  if (res?.data?.data) {
    listData.value = res.data.data
    let basin = listData.value.basin
    let area = listData.value.area
    //y轴
    const yDataArr = basin.map((item: any) => item.name)
    //x轴
    const xDataArr = basin.map((item: any) => parseFloat(item.drp.toFixed(2)))
    chartOption.value = LiuYuYuQingOption.getOption(xDataArr, yDataArr)
  }
}
onMounted(() => {
  initGUI()
})

onBeforeUnmount(() => {})
</script>

<style lang="scss" scoped>
.box-template {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
