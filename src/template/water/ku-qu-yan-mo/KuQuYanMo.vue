<template>
  <div class="box-kuquyanmo">
    <div class="summary">
      <div class="middle1">经济总损失</div>
      <div class="middle2">{{ currTotal }}</div>
      <div class="middle3">亿元</div>
    </div>
    <div class="box-content">
      <ChartFrame :option="chartOption" ref="myChart" class="box-chart" />
      <div class="list-text">
        <div class="list-item" v-for="item in listData">
          <div class="box-icon"></div>
          <div class="item-text">{{ item.text }}</div>
          <div class="item-val">{{ item.value }}</div>
          <div>&nbsp;&nbsp;{{ item.unit }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getTemplateData } from '@/api/fileData'
import KuQuYanMoOption from './KuQuYanMoOption'

// 绑定数据
const listData: any = ref([])
const maxData: any = ref([])
const currTotal = ref(0) //总损失

//echart引用
const myChart = ref()
// echart配置信息
const chartOption = ref({})
// 初始化UI
async function initGUI() {
  let res: any = await getTemplateData('water/ku-qu-yan-mo/assets/data.json')
  console.log('后台数据:？', res)
  if (res?.data) {
    maxData.value = res.data?.max?.list
    listData.value = res.data['216']?.list
    currTotal.value = res.data?.max.total
    let indicator: any = []
    let s1Data: any = []
    let s2Data: any = []
    if (maxData.value?.length > 0) {
      maxData.value.forEach((item: any, index: any) => {
        indicator.push({ name: item.text, max: item.value, nameLocation: 'end', unit: item.unit })
        s2Data.push(item.value)
      })
    }

    if (listData.value?.length > 0) {
      listData.value.forEach((item: any, index: any) => {
        s1Data.push(item.value)
      })
    }

    chartOption.value = KuQuYanMoOption.getOption(indicator, s1Data, s2Data)
  }
}
onMounted(() => {
  initGUI()
})

onBeforeUnmount(() => {})
</script>

<style lang="scss" scoped>
.box-kuquyanmo {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  box-sizing: border-box;
  padding: 1rem;
  gap: 0.5rem;
  .summary {
    background-image: url('./assets/middleB.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
    padding: 0.5rem;
    display: flex;
    margin: 0;
    justify-content: center;
    align-items: center;
    .middle1 {
      color: white;
      font-size: 1.5rem;
    }
    .middle2 {
      background: -webkit-linear-gradient(top, #ffb9b9 40%, #fb2f39);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-size: 2rem;
      margin-left: 2.6rem;
      font-family: 'DIN-Bold', sans-serif;
    }
    .middle3 {
      color: white;
      font-size: 1.2rem;
      margin-left: 0.5rem;
    }
  }
  .box-content {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: row;
    .box-chart {
      width: 60%;
      height: 100%;
    }
    .list-text {
      flex: 1;
      margin: 0.5rem 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      .list-item {
        display: flex;
        align-items: center;
        color: white;
        font-size: 1rem;
        box-sizing: border-box;
        .item-text {
          width: 3rem;
          margin-left: 0.5rem;
        }
        .box-icon {
          // background-image: url('@/assets/img4k/liu_yu19/radarIcon.png');
          background-size: contain;
          background-repeat: no-repeat;
          padding: 0.7rem;
        }
        .item-val {
          background: -webkit-linear-gradient(top, white 40%, rgb(251, 205, 94));
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-family: 'DIN-Bold';
          font-size: 2.3rem;
        }
      }
    }
  }
}
</style>
