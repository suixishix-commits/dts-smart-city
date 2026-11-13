<template>
  <div class="chartBox">
    <ChartFrame :option="chartOption1" ref="myChart" />
  </div>
</template>

<script setup lang="ts">
import { getTemplateData } from '@/api/fileData'
import WaterOfMultiYearOption from './WaterOfMultiYearOption'
//echart引用
const myChart = ref()
// echart配置信息
const chartOption1 = ref({})

// 获取Echart数据，并绑定chart
async function initGUI() {
  let res: any = await getTemplateData('popup/multi-year-water/assets/data.json')
  console.log('多年同期来水', res)
  if (res?.data?.data?.dataList?.length > 0) {
    let dataList = res.data.data.dataList
    let avg = res.data.data.avg
    //x轴年份
    const xDateArr = dataList.map((item: any) => item.key)
    //y轴数据值
    const yDataArr = dataList.map((item: any) => Number(item.value).toFixed(2))
    //平均值
    const avgData = []
    for (let i = 0; i < dataList.length; i++) {
      avgData.push(avg)
    }
    console.log('Chart数据：', xDateArr, yDataArr, avgData)

    chartOption1.value = WaterOfMultiYearOption.getOption(xDateArr, yDataArr, avgData)
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
  display: flex;
}
</style>
