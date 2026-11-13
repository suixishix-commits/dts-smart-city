<template>
  <div class="chartBox">
    <div class="dialogList">
      <el-table :data="waterList" :height="'100%'" style="width: 100%; cursor: pointer">
        <el-table-column prop="time" label="时间" align="center" width="160" show-overflow-tooltip />
        <el-table-column prop="waterLevel" label="水位" align="center" width="75" show-overflow-tooltip />
        <el-table-column prop="q" label="流量" align="center" width="75" show-overflow-tooltip />
        <el-table-column prop="wrz" label="警戒水位" align="center" width="80" show-overflow-tooltip />
        <el-table-column prop="grz" label="保证水位" align="center" width="80" show-overflow-tooltip />
      </el-table>
    </div>
    <ChartFrame :option="chartOption1" ref="myChart" />
  </div>
</template>

<script setup lang="ts">
import { getTemplateData } from '@/api/fileData'
import ShuiQingOption from './ShuiQingOption'
//echart引用
const myChart = ref()
// echart配置信息
const chartOption1 = ref({})
//表格数据源
const waterList = ref<any>([])

// 获取Echart数据，并绑定chart
async function initGUI() {
  let res: any = await getTemplateData('popup/shui-qing/assets/data.json')
  console.log('河道水情数据', res)
  if (res?.data?.data?.length > 0) {
    waterList.value = res.data.data
    console.log(waterList.value, '河道水情')
    // 过滤部分数据
    const listData = waterList.value.filter((item: any) => {
      let date_object = new Date(item.time)
      let hour = date_object.getHours()
      let minute = date_object.getMinutes()
      return hour === 8 && minute === 0
    })
    //x轴
    const xDataArr = listData
      .map((item: any) => {
        let date_object = new Date(item.time)
        let year = date_object.getFullYear()
        let month = date_object.getMonth() + 1
        let day = date_object.getDate()
        let formatted_date = year + '-' + month.toString().padStart(2, '0') + '-' + day.toString().padStart(2, '0')
        return formatted_date
      })
      .slice(0, 16)
    //y
    const yDataArr = listData.map((item: any) => item.waterLevel)
    const wrz = listData.map((item: any) => item.wrz)
    const grz = listData.map((item: any) => item.grz)

    //y流量
    const yDataArrLiu = listData.map((item: any) => item.q)
    chartOption1.value = ShuiQingOption.getOption(xDataArr, grz, wrz, yDataArr, yDataArrLiu)
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
  .location {
    position: absolute;
    padding-left: 33px;
    z-index: 99;
    color: white;
  }
}

:deep(.el-table) {
  --el-table-row-hover-bg-color: rgba(120, 253, 249, 0.2);
  --el-table-text-color: white;
  --el-table-fixed-box-shadow: none;
  --el-table-header-text-color: white;
  --el-table-bg-color: transparent;
  --el-table-border-color: rgba(13, 14, 14, 0.5);
  --el-table-tr-bg-color: rgba(120, 253, 249, 0.05);
  --el-table-header-bg-color: rgba(120, 253, 249, 0.3);
  --el-table-border: 3px solid rgba(120, 253, 249, 0.3);
}
</style>
