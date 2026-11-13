<template>
  <!-- <template #header>
      <div class="title">严坪村2号桥处模拟结果</div>
    </template> -->
  <div class="top">
    <div class="box">
      <div class="name">洪峰流量</div>
      <div class="value">1416m³/s</div>
    </div>
    <div class="box">
      <div class="name">洪峰时间</div>
      <div class="value">7-19 21:00</div>
    </div>
  </div>
  <div class="chartBox">
    <ChartFrame :option="chartOption1" ref="myChart" />
  </div>
</template>

<script setup lang="ts">
import { getTemplateData } from '@/api/fileData'
import YuLiangZhan1Option from './YuLiangZhan1Option'
//echart引用
const myChart = ref()
// echart配置信息
const chartOption1 = ref({})
//表格数据源
const waterList = ref<any>([])

const xData = ref([])
const rainList = ref([]) //降雨
const simulatedFlow = ref([]) //模拟流量

// 获取Echart数据，并绑定chart
async function initGUI() {
  let res: any = await getTemplateData('popup/yu-liang/assets/yan_ping_mo_ni_echarts.json')
  console.log('严坪村2号桥处模拟结果数据', res)
  if (res?.data?.length > 0) {
    waterList.value = res.data
    //x轴
    xData.value = waterList.value.map((item: any) => item.时间)
    //y--降雨数据
    rainList.value = waterList.value.map((item: any) => Number(item.降雨).toFixed(2))
    //y--模拟流量
    simulatedFlow.value = waterList.value.map((item: any) => Number(item.模拟流量).toFixed(2))
    chartOption1.value = YuLiangZhan1Option.getOption(xData, rainList, simulatedFlow)
  }
}

onMounted(() => {
  initGUI()
})
</script>

<style lang="scss" scoped>
.top {
  height: 40px;
  margin: 1px 60px;
  display: flex;

  .box {
    margin: 0 25px;
    padding: 0 20px;
    flex: 1;
    background-image: url('@/template/popup/yu-liang/assets/box.png');
    background-color: rgba($color: #125779, $alpha: 0.3);
    background-size: 100% 100%;
    background-repeat: no-repeat;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .name {
      color: #fff;
      // font-size: 40px;
    }

    .value {
      // font-size: 40px;
      font-weight: bold;
      background: linear-gradient(180deg, #ffffff 0%, #ffb522 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-fill-color: transparent;
    }
  }
}

.chartBox {
  position: relative;
  width: 100%;
  height: 90%;
  padding-bottom: 3px;
  display: flex;

  .location {
    position: absolute;
    padding-left: 33px;
    z-index: 99;
    color: white;
  }
}
</style>
