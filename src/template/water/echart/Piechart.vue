<template>
    <div class="industry_govern">
      <SmallTitle title="产业治理情况" />
      <div class="container">
        <div class="industry_govern_chart">
          <ChartFrame :option="getIndustryGovernChart()" />
          <img src="@/assets/images/hxz/industy-icon1.png" />
        </div>
        <div class="value">
          <div class="content">
            <img src="@/assets/images/hxz/industy-icon2.png" />
            <div class="status">
              <p>已完成</p>
              <p style="color: #7ac962;">{{ (getPressGovernance.ywc/14*100).toFixed(0) +'%' }}</p>
            </div>
          </div>
          <div class="content">
            <img src="@/assets/images/hxz/industy-icon3.png" />
            <div class="status">
              <p>未完成</p>
              <p style="color: #6D8FED;">{{ (getPressGovernance.ycgb/14*100).toFixed(0) +'%' }}</p>
            </div>
          </div>
          <div class="content">
            <img src="@/assets/images/hxz/industy-icon4.png" />
            <div class="status">
              <p>已整改</p>
              <p style="color: #78C3FF;">{{ (getPressGovernance.yzg/14*100).toFixed(0) +'%' }}</p>
            </div>
          </div>
          <div class="content">
            <img src="@/assets/images/hxz/industy-icon5.png" />
            <div class="status">
              <p>待整改</p>
              <p style="color: #BADEFC;">{{ (getPressGovernance.dzg/14*100).toFixed(0) +'%' }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
  <script setup lang="ts">
import { ref, computed } from 'vue'
import ChartFrame from '@/components/chart/ChartFrame.vue'


const data1 = ref([
  { value: 10, name: '已完成', itemStyle: { color: '#7ac962' } },
  { value: 3, name: '未完成', itemStyle: { color: '#6D8FED' } },
  { value: 1, name: '已整改', itemStyle: { color: '#78C3FF' } },
  { value: 0, name: '未整改', itemStyle: { color: '#BADEFC' } },
])
const getPressGovernance=ref({
    ywc:10,
    ycgb:3,
    yzg:1,
    dzg:0
})
const getIndustryGovernChart = () => {
  data1.value[0].value = getPressGovernance.value.ywc
  data1.value[1].value = getPressGovernance.value.ycgb
  data1.value[2].value = getPressGovernance.value.yzg
  data1.value[3].value = getPressGovernance.value.dzg
  const option = {
    tooltip: {
      trigger: 'none',
    },
    series: [
      {
        name: 'From',
        type: 'pie',
        radius: ['70%', '95%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: 'transparent', // 设置边框颜色为透明色
          borderWidth: 0,
        },
        label: {
          show: false,
        },
        labelLine: {
          show: false,
        },
        data: data1.value,
      },
    ],
  }
  return option
}

// 如果需要在 mounted 钩子中执行操作，可以这样写
import { onMounted } from 'vue'
onMounted(() => {
  // 执行一些操作
})
</script>
  
  <style scoped lang="scss">
  .industry_govern {
    margin-top: 25px;
  
    .container {
      margin-top: 24px;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-sizing: border-box;
      padding: 0 31px 0 27px;
  
      .industry_govern_chart {
        width: 140px;
        height: 140px;
        position: relative;
  
        img {
          width: 81px;
          height: 77px;
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          margin: auto;
        }
      }
      .value {
        width: 164px;
        height: 92px;
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
  
        .content {
          display: flex;
          align-items: center;
          img {
            width: 32px;
            height: 32px;
          }
          .status {
              display: flex;
              flex-direction: column;
            p:first-child {
              font-family: OPPOSans;
              font-size: 12px;
              line-height: 12px;
              display: flex;
              align-items: center;
              color: #ffffff;
            }
            p:nth-child(2) {
              font-family: PangMenZhengDao;
              font-size: 16px;
              line-height: 16px;
              margin-top: 5px;
            }
          }
        }
      }
    }
  }
  </style>
  