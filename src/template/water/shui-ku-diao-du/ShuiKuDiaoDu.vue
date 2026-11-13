<template>
  <div class="box-template">
    <ChartFrame :option="chartOption" ref="myChart" class="box-chart" />
  </div>
</template>

<script setup lang="ts">
import { getTemplateData } from '@/api/fileData'
import ShuiKuDiaoDuOption from './ShuiKuDiaoDuOption'

//echart引用
const myChart = ref()
// echart配置信息
const chartOption = ref({})

// 后台数据
const listData: any = ref([])
// X轴1 按旬
const xDataArr1 = ref([
  '上',
  '中',
  '下',
  '上',
  '中',
  '下',
  '上',
  '中',
  '下',
  '上',
  '中',
  '下',
  '上',
  '中',
  '下',
  '上',
  '中',
  '下',
  '上',
  '中',
  '下',
  '上',
  '中',
  '下',
  '上',
  '中',
  '下',
  '上',
  '中',
  '下',
  '上',
  '中',
  '下',
  '上',
  '中',
  '下'
])
// X轴2 按天
const xDataArr2: any = ref([])
// X轴3 按月
const xDataArr3 = ref([
  '',
  '4月',
  '',
  '',
  '5月',
  '',
  '',
  '6月',
  '',
  '',
  '7月',
  '',
  '',
  '8月',
  '',
  '',
  '9月',
  '',
  '',
  '10月',
  '',
  '',
  '11月',
  '',
  '',
  '12月',
  '',
  '',
  '1月',
  '',
  '',
  '2月',
  '',
  '',
  '3月',
  ''
])
//正常蓄水位
const arrZcXSW = ref([
  216, 216, 216, 216, 216, 216, 216, 216, 213.37, 213.37, 213.37, 213.37, 213.37, 213.37, 213.37, 216, 216, 216, 216, 216, 216, 216, 216, 216, 216, 216, 216,
  216, 216, 216, 216, 216, 216, 216, 216, 216, 216
])
//汛限水位数据
const arrFanXunLine = ref<any>([
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  213.37,
  213.37,
  213.37,
  213.37,
  213.37,
  213.37,
  213.37,
  213.37,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null
])
// 死水位
const arrDeadline = ref([
  195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195,
  195, 195, 195, 195, 195
])
// 真实水位线
const arrReal: any = ref([])
// 防弃水线
const arrFefg = ref<any>([])
// 应急供水线
const arrYJX = ref<any>([
  199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199, 199,
  199, 199, 199, 199, 199, 199
])

//正常水位
const get_normal = ref<any>([])
//限制水位线
const get_limit1 = ref<any>([])
//限制水位二线
const get_limit2 = ref<any>([])

// 初始化UI
async function initGUI() {
  let res: any = await getTemplateData('water/shui-ku-diao-du/assets/data.json')
  console.log('后台数据:？', res)
  if (res?.data?.data) {
    listData.value = res.data.data
    listData.value = res.data.data
    if (listData.value?.yaerSrz?.length > 0) {
      listData.value.yaerSrz.forEach((item: any) => {
        //x轴2绑定数据
        xDataArr2.value.push(item.tm.substr(0, 10))
        //库水位数据
        arrReal.value.push(item.rz)
      })
    }
    //防弃水线
    arrFefg.value = listData.value.fefg
    //正常供水位
    get_normal.value = listData.value.normal
    //限制水位线
    get_limit1.value = listData.value.limit1
    //限制水位二线
    get_limit2.value = listData.value.limit2

    chartOption.value = ShuiKuDiaoDuOption.getOption(
      xDataArr1.value,
      xDataArr2.value,
      xDataArr3.value,
      arrZcXSW.value,
      arrFanXunLine.value,
      arrFefg.value,
      get_normal.value,
      get_limit1.value,
      get_limit2.value,
      arrDeadline.value,
      arrYJX.value,
      arrReal.value
    )

    console.log('水库调度图初始化数据', xDataArr1.value, arrFefg.value)
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
