<template>
  <div class="box-template">
    <div class="box-table">
      <el-table :data="listData" :height="'100%'" style="width: 100%; cursor: pointer">
        <el-table-column prop="tm" label="时间" align="center" show-overflow-tooltip />
        <el-table-column prop="waterLevel" label="水位" align="center" width="80" show-overflow-tooltip />
        <el-table-column prop="inflow" label="入库流量" align="center" show-overflow-tooltip />
        <el-table-column prop="ckflz" label="校核洪水位" align="center" width="95" show-overflow-tooltip />
        <!-- <el-table-column prop="dsflz" label="设计洪水位" align="center" width="95" show-overflow-tooltip /> -->
      </el-table>
    </div>
    <ChartFrame :option="chartOption" ref="myChart" class="box-chart" />
  </div>
</template>

<script setup lang="ts">
import { getTemplateData } from '@/api/fileData'
import ShuiKuShuiQingOption from './ShuiKuShuiQingOption'

//echart引用
const myChart = ref()
// echart配置信息
const chartOption = ref({})

// 绑定数据
const listData: any = ref([])
// 初始化UI
async function initGUI() {
  let res: any = await getTemplateData('water/shui-ku-shui-qing/assets/data.json')
  console.log('后台数据:？', res)
  if (res?.data?.data) {
    listData.value = res.data.data
    // X时间轴
    const xDataArr = listData.value
      .filter((item: any) => {
        let date_object = new Date(item.tm)
        let hour = date_object.getHours()
        let minute = date_object.getMinutes()
        return hour === 8 && minute === 0
      })
      .map((item: any) => {
        let date_object = new Date(item.tm)
        let year = date_object.getFullYear()
        let month = date_object.getMonth() + 1
        let day = date_object.getDate()
        let formatted_date = year + '-' + month.toString().padStart(2, '0') + '-' + day.toString().padStart(2, '0')
        return formatted_date
      })
    // 历史水位
    const yDataArr = listData.value.map((item: any) => item.waterLevel)
    // 校核洪水位
    const yckflz = listData.value.map((item: any) => item.ckflz)
    // 设计洪水位
    const ydsflz = listData.value.map((item: any) => item.dsflz)
    // 正常蓄水位
    const ynormz = listData.value.map((item: any) => item.normz)
    // 汛限水位
    const yxun = []
    for (let i = 0; i < yDataArr.length; i++) {
      yxun.push(213.37)
    }
    // 入库流量
    const yDataArrLiu = listData.value.map((item: any) => item.inflow)
    chartOption.value = ShuiKuShuiQingOption.getOption(xDataArr, yDataArr, yckflz, ydsflz, ynormz, yxun, yDataArrLiu)
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
  display: flex;
  .box-table {
    width: 40%;
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
  }
  .box-chart {
    flex: 1;
  }
}
</style>
