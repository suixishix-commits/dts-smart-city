<template>
  <div class="chartBox">
    <ChartFrame :option="chartOption" ref="myChart" :enableClickEvent="true" @click="showBigChartDialog" />
    <ProjectDialog2
      ref="refProjectDialog"
      class="project-dialog"
      :visible="bigChartVisible"
      title="重要测点曲线大图"
      height="600px"
      width="1200px"
      @close="closeDialog"
    >
      <ChartFrame :option="bigChartOption" />
    </ProjectDialog2>
  </div>
</template>

<script setup lang="ts">
import { getTemplateData } from '@/api/fileData'
import ScalableChart from './ScalableChartOption'
//echart引用
const myChart = ref()
// echart配置信息
const chartOption = ref({})

// 横坐标数据
const xDataArr: any = ref([])
// 水位曲线
const shuiWeiDateArr: any = ref([])
// 水位Map
const shuiWeiMap: any = ref()

// 重点监测测点全部数据
const allData: any = ref()

// 大图参数
const bigChartVisible = ref(false)
const bigChartOption = ref({})
const refProjectDialog = ref()

// 关闭大图Dialog
const closeDialog = () => {
  bigChartVisible.value = false
  refProjectDialog.value.visible = false
}

// 属性定义
const props = defineProps({
  dataSource: {
    type: Object,
    default: undefined
  }
})

// 监测属性变化
watch([() => props.dataSource], (newVal, oldVal) => {
  if (newVal[0] != oldVal[0]) {
  }
})

// 获取Echart数据，并绑定chart
async function initGUI() {
  let res: any = await getTemplateData('popup/scalable-chart/assets/data.json')
  console.log('可缩放工情水情数据', res)
  if (res?.data?.data) {
    allData.value = res.data.data
    if (allData.value?.上游水位) {
      let listTemp = allData.value.上游水位
      shuiWeiMap.value = new Map()
      let strDate = ''
      // 生成X轴数据
      for (let i = 0; i < listTemp.length; i++) {
        const dayData = listTemp[i]
        strDate = dayData.observationDate.substring(0, 10)
        xDataArr.value.push(strDate)
        shuiWeiDateArr.value.push(dayData.waterLevel)
        shuiWeiMap.value.set(strDate, dayData.waterLevel)
      }
      let seriesData = await initEchartsData()
      //绑定图表
      chartOption.value = ScalableChart.getOption(seriesData)
    }
  }
}

// 显示大弹窗
async function initBigChart() {
  bigChartVisible.value = true
  let seriesData = await initEchartsData()
  //绑定图表
  bigChartOption.value = ScalableChart.getOption(seriesData)
}

const initEchartsData = async () => {
  let s1: any = undefined
  let x1: any = undefined
  let s2: any = undefined
  if (allData.value && allData.value.hasOwnProperty('WE-1')) {
    s1 = []
    s2 = []
    x1 = []
    let list: any = allData.value['WE-1']
    //console.log('WE-1？', allData.value, list)
    let strDate = ''
    for (let index = 0; index < list.length; index++) {
      const element = list[index]
      strDate = element.observationDate.substring(0, 10)
      x1.push(strDate)
      s1.push(element.leakageAmount === 99999 ? null : element.leakageAmount)
      s2.push(shuiWeiMap.value.get(strDate))
    }
    //console.log('WE-1获得取啥？', s1, x1, s2)
  }
  return { s1, x1, s2 }
}

// 弹大窗
function showBigChartDialog(params: any) {
  console.log('echart点击', params)
  initBigChart()
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
