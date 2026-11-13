<template>
  <div class="region-block">
    <div class="region-title">
      <p class="title-text">监控数据有效性判断</p>
      <div class="jump" @click="openDataDetails">
        <p class="detail">详情<i class="icon"></i></p>
      </div>
    </div>

    <div class="region-content">
      <div class="region-content_title">
        <div class="title_left">
          <p>测点总数：<span>7000</span>个</p>
        </div>
        <div class="title_right">
          <p>查看项目：<span>全部</span></p>
        </div>
      </div>
      <div class="region-content_content">
        <div class="left">
          <div id="main" style="width: 15.3rem; height: 15.3rem"></div>
          <!-- <ChartFrame style="width: 15.3rem; height: 15.3rem" :option="chartOption" ref="myChart" /> -->
        </div>
        <div class="right">
          <ul>
            <li v-for="(item, indx) in dataList" :key="indx" :style="{ color: item.itemStyle.color }">
              <p style="width: 4rem">·</p>
              <p>{{ item.name }}</p>
              <p style="width: 4rem">{{ item.value }}</p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { setScaledOption } from '@/utils/viewportScale'
import * as echarts from 'echarts'

const props = defineProps({
  dataSource: {
    type: Object
  }
})
// 打开详情
const openDataDetails = async () => {
  // dialogTableVisible.value = true
  // console.log(locationValue, monitorValue)
  // let list = {
  //   locationValue: locationValue.value,
  //   monitorValue: monitorValue.value,
  //   pageNo: 1,
  //   pageSize: 10
  // }
  // console.log(list)
}

const dataList = ref([
  // { value: 300, name: '轻度异常' }
  { value: 5000, name: '正常', itemStyle: { color: '#9EF796' } },
  { value: 500, name: '异常', itemStyle: { color: '#FFB578' } },
  { value: 500, name: '危险', itemStyle: { color: '#FF5A5A' } },
  { value: 500, name: '停用', itemStyle: { color: '#F5E74F' } },
  { value: 500, name: '轻度异常', itemStyle: { color: '#1FC6FF' } }
])

// echart配置信息
const chartOption = ref({})

// 初始化图
function initChartData() {
  chartOption.value = {
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      confine: true //解决浮窗被截断问题
    },
    series: [
      {
        type: 'pie',
        radius: ['60%', '90%'],
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {},
        data: dataList.value
      }
    ]
  }
  var chartDom = document.getElementById('main')
  var myChart = echarts.init(chartDom)
  chartOption.value && setScaledOption(myChart, chartOption.value)
}

onMounted(async () => {
  initChartData()
})
</script>

<style lang="scss" scoped>
.region-block {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 41rem;
  height: 26.9rem;
  box-sizing: border-box;
  background: url('../assets/right_bag.png') no-repeat center center / 100% 100%;
  .region-title {
    position: relative;
    width: 100%;
    height: 3.4rem;
    line-height: 3.4rem;
    background: url('../assets/areaPic.png') no-repeat center center / 100% 100%;

    .title-text {
      position: absolute;
      left: 5.9rem;
      top: 0;
      height: 100%;
      font-family: YouSheBiaoTiHei;
      font-size: 2rem;
      line-height: 3.4rem;
      letter-spacing: 0.05em;
      background: linear-gradient(180deg, #ffffff 0%, #94e0ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .jump {
      position: absolute;
      right: 0;
      top: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 9.7rem;
      height: 100%;
      cursor: pointer;
      .detail {
        display: flex;
        font-family: OPPOSans;
        font-size: 1.4rem;
        line-height: 1.6rem;
        letter-spacing: 0.05em;
        color: #ffffff;
        .icon {
          margin-left: 0.6rem;
          margin-top: 0.1rem;
          width: 1.6rem;
          height: 1.6rem;
          background: url('../assets/left-bottom-jump-icon.png') no-repeat center center / 100% 100%;
          display: inline-block;
        }
      }
    }
  }

  .region-content {
    position: relative;
    width: 100%;
    height: 22.5rem;
    padding-top: 0.5rem;
    box-sizing: border-box;

    margin-bottom: 1rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;

    .region-content_title {
      padding: 1.2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 38.6rem;
      height: 3.8rem;
      background: url('../assets/juxingbj.png') no-repeat center center / 100% 100%;
      box-sizing: border-box;
      background: linear-gradient(180deg, rgba(21, 106, 189, 0) 12%, #156abd 100%);

      div {
        font-family: 'OPPOSans';
        font-size: 1.6rem;
        font-weight: normal;
        line-height: normal;
        // letter-spacing: 0em;
        opacity: 0.8;
        // font-variation-settings: "opsz" auto;
        color: #ffffff;

        span {
          color: #ffb578;
          opacity: 1;
          font-size: 1.8rem;
        }
      }

      .imgIcon {
        width: 10%;
        height: 60%;
      }

      .region-content_text {
        color: #fff;
        font-size: 1.5rem;
        // line-height: 40px;
      }
    }

    .region-content_content {
      display: flex;
      // justify-content: space-around;
      width: 100%;
      height: 75%;

      .left {
        width: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .right {
        width: 50%;
        height: 100%;
        display: flex;
        // justify-content: center;
        align-items: center;

        ul {
          width: 15rem;
          height: 13.8rem;
          display: flex;
          flex-wrap: wrap;
          list-style: none;

          li {
            width: 100%;
            display: flex;
            justify-content: space-around;
          }

          li p:nth-child(2) {
            width: 8rem;
            font-family: 'Alibaba PuHuiTi 2.0';
            font-size: 1.6rem;
            font-weight: normal;
            letter-spacing: 0em;
            font-variation-settings: 'opsz' auto;
            color: #ffffff;
          }

          li p:nth-child(3) {
            font-family: 'DIN';
            font-size: 1.8rem;
            font-weight: bold;
            font-variation-settings: 'opsz' auto;
            text-shadow: 0px 0.4rem 1rem rgba(31, 198, 255, 0.3);
          }
        }
      }
    }
  }
}
</style>
