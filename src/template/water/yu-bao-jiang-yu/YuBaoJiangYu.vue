<template>
  <div class="chartBox">
    <ChartFrame :option="chartOption" ref="myChart" />
  </div>
</template>

<script setup lang="ts">
import { getTemplateData } from '@/api/fileData'
import YuBaoJiangYuOption from './YuBaoJiangYuOption'
//echart引用
const myChart = ref()
// echart配置信息
const chartOption = ref({})

// 获取Echart数据，并绑定chart
async function initGUI() {
  let res: any = await getTemplateData('water/yu-bao-jiang-yu/assets/data.json')
  console.log('后台数据', res)
  if (res?.data?.data?.length > 0) {
    let dataList = res.data.data
    //x
    let xDateArr = dataList.map((item: any) => {
      let date_object = new Date(item.creatTime)
      let month = date_object.getMonth() + 1
      let day = date_object.getDate()
      let formatted_date = month.toString().padStart(2, '0') + '-' + day.toString().padStart(2, '0')
      return formatted_date
    })
    //y
    let yDataArr = dataList.map((item: any) => item.preRainSize.toFixed(1))

    chartOption.value = YuBaoJiangYuOption.getOption(xDateArr, yDataArr)
  }
}

onMounted(() => {
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
