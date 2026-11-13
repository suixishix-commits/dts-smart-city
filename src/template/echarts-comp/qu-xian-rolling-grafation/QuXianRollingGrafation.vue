<template>
  <div class="chartBox">
    <!-- <ChartFrame :option="chartOption" ref="myChart" /> -->
    <div ref="myChart" class="chartStyle"></div>
  </div>
</template>

<script setup lang="ts">
import { setScaledOption } from '@/utils/viewportScale'
import dayjs from 'dayjs'
import * as echarts from 'echarts'
import { getTemplateData } from '@/api/fileData'
import QuXianRollingGrafationOption from './QuXianRollingGrafationOption'

//echart引用
const myChart = ref()
// echart配置信息
const chartOption = ref({})
//表格数据源
const rollingList = ref<any>([])
// 定时器
const timer: any = ref(null)

async function initChartsList() {
  let res: any = await getTemplateData('popup/shui-qing/assets/data.json')
  console.log('河道水情数据', res)
  if (res?.data?.data?.length > 0) {
    rollingList.value = res.data.data
    // 过滤部分数据
    const listData = rollingList.value.filter((item: any) => {
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
    //y流量
    const yDataArrLiu = listData.map((item: any) => item.q)

    nextTick(() => {
      // 基于准备好的dom，初始化echarts实例
      const myCharts = echarts.init(myChart.value)

      // 指定图表的配置项和数据
      const option: any = QuXianRollingGrafationOption.getOption(xDataArr, yDataArr, yDataArrLiu)

      // 使用刚指定的配置项和数据显示图表。
      setScaledOption(myCharts, option)
      // 定时跟新数据
      timer.value = setInterval(() => {
        // 水位
        yDataArr.shift()
        let data = (Math.random() * (8 - 7)) + 7
        yDataArr.push(data.toFixed(3))
        // 流量
        yDataArrLiu.shift()
        let data2 = (Math.random() * (400 - 200)) + 200
        yDataArrLiu.push(data2.toFixed(3))
        // x轴
        xDataArr.shift()
        let data3 = getTime(xDataArr[xDataArr.length - 1])
        xDataArr.push(data3)
        // 更新图表
        myCharts.setOption({
          xAxis: {
            data: xDataArr
          },
          series: [
            {
              data: yDataArr
            },
            {
              data: yDataArrLiu
            }
          ]
        })
      }, 1000)
      window.addEventListener('resize', () => {
        myCharts.resize()
      })
    })
    // chartOption.value = QuXianRollingGrafationOption.getOption(xDataArr, yDataArr, yDataArrLiu)
  }
}

function getTime(value: any) {
  // 加一天
  let time = new Date(value).getTime() + 1000 * 60 * 60 * 24
  let time2 = dayjs(time).format('YYYY-MM-DD')
  return time2
}

onMounted(() => {
  initChartsList()
})

onBeforeUnmount(() => {
  clearInterval(timer.value)
})
</script>

<style lang="scss" scoped>
.chartBox {
  position: relative;
  width: 100%;
  height: 100%;
  padding-bottom: 3px;
  display: flex;

  .chartStyle {
    width: 100%;
    height: 100%;
  }
}
</style>
