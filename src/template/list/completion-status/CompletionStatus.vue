<template>
  <div class="oigiveanalarm">
    <div class="oigiveanalarmcontainer">
      <div class="oigiveanalarmbottom">
        <div class="listdiv">
          <div class="listdivtop">
            <Ring
              :rate="xjycProgressRing"
              :config="{
                startColor: 'rgba(251,255,0,0.00)',
                endColor: '#FBFF00',
                circleColor: '#fff',
                endPoscolor: '#1A2D3C'
              }"
            >
              <span class="orederclass slot-font1 yellowspan">{{ xjycProgressWidth }}<span>%</span></span>
            </Ring>
          </div>
          <div class="cpuiconrightlist">
            <div class="top">
              <div class="toptext">巡检异常</div>
              <div class="topnumber">
                {{ exceptionHandle.handle }}/<span class="rightnumber">{{ exceptionHandle.totalNum }}</span>
                <!-- 5/<span class="rightnumber">6</span> -->
              </div>
            </div>
            <div class="bottom">
              <div class="yellowprogress" :style="`width: ${xjycProgressWidth}%`"></div>
              <div class="square" :style="`left:${xjycProgressWidth}%`"></div>
            </div>
          </div>
        </div>
        <div class="listdiv">
          <div class="listdivtop">
            <Ring
              :rate="zdsgProgressRing"
              :config="{
                startColor: 'rgba(255,72,0,0.00)',
                endColor: '#FF4800',
                circleColor: '#fff',
                endPoscolor: '#1A2D3C'
              }"
            >
              <span class="orederclass slot-font1 orangespan">{{ zdsgProgressWidth }}<span>%</span></span>
            </Ring>
          </div>
          <div class="cpuiconrightlist">
            <div class="top">
              <div class="toptext">重大故障应急抢修</div>
              <div class="topnumber">
                {{ faultHandle.handle }}/<span class="rightnumber">{{ faultHandle.totalNum }}</span>
                <!-- 1/<span class="rightnumber">1</span> -->
              </div>
            </div>
            <div class="bottom">
              <div class="orangeprogress" :style="`width: ${zdsgProgressWidth}%`"></div>
              <div class="square" :style="`left:${zdsgProgressWidth}%`"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import Ring from '../ring/Ring.vue'

let radiofirst = ref('本周')
let timeType = ref('week')
let exceptionHandle = ref({ totalNum: 0 })
let faultHandle = ref({ totalNum: 0 })

onMounted(() => {
  initData()
})

const initData = () => {
  //接口返回数据
  const { data } = {
    code: 0,
    msg: 'suc',
    data: {
      exceptionHandle: {
        totalNum: 9,
        handle: 5,
        unHandle: 4
      },
      faultHandle: {
        totalNum: 6,
        handle: 1,
        unHandle: 5
      }
    }
  }
  exceptionHandle.value = data.exceptionHandle
  faultHandle.value = data.faultHandle
}

const xjycProgressWidth = computed(() => {
  if (exceptionHandle.value.totalNum === 0) {
    return 0 // 避免除以0错误，如果总数量为0，则进度条宽度为0
  } else {
    return Number((exceptionHandle.value.handle / exceptionHandle.value.totalNum) * 100).toFixed(1)
  }
})

const xjycProgressRing = computed(() => {
  if (exceptionHandle.value.totalNum === 0) {
    return 0 // 避免除以0错误，如果总数量为0，则进度条宽度为0
  } else {
    return exceptionHandle.value.handle / exceptionHandle.value.totalNum
  }
})

const zdsgProgressWidth = computed(() => {
  if (faultHandle.value.totalNum === 0) {
    return 0 // 避免除以0错误，如果总数量为0，则进度条宽度为0
  } else {
    return Number((faultHandle.value.handle / faultHandle.value.totalNum) * 100).toFixed(1)
  }
})

const zdsgProgressRing = computed(() => {
  if (faultHandle.value.totalNum === 0) {
    return 0 // 避免除以0错误，如果总数量为0，则进度条宽度为0
  } else {
    return faultHandle.value.handle / faultHandle.value.totalNum
  }
})
</script>

<style lang="scss">
.oigiveanalarm {
  //   height: 476px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  .oigiveanalarmcontainer {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    padding-left: 20px;
    padding-right: 35px;
  }
  .oigiveanalarmbottom {
    display: flex;
    flex-direction: column;
    > div:last-child {
      margin-top: 50.57px;
    }
    .listdiv {
      display: flex;
      align-items: center;
    }
    .cpuiconrightlist {
      display: flex;
      flex-direction: column;
      flex: 1;
      .top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        .toptext {
          display: flex;
          font-size: 28px;
          color: #c4ecff;
          align-items: center;
        }
        .topnumber {
          font-family: PangMenZhengDao;
          font-size: 38px;
          color: #7bd5ff;
        }
        .rightnumber {
          font-size: 28px;
        }
      }
      .bottom {
        width: 100%;
        height: 38px;
        border-radius: 3.17px;
        background: rgba(255, 255, 255, 0.05);
        box-shadow: inset 0px 0px 22px 0px rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        position: relative;
        .yellowprogress {
          height: 12px;
          opacity: 1;
          background: linear-gradient(270deg, #fbff00 0%, rgba(251, 255, 0, 0.43) 68%, rgba(251, 255, 0, 0) 100%);
        }
        .orangeprogress {
          height: 12px;
          opacity: 1;
          background: linear-gradient(270deg, #ff4800 0%, rgba(255, 72, 0, 0.43) 72%, rgba(255, 72, 0, 0) 95%);
        }
        .square {
          position: absolute;
          left: 90%;
          width: 10px;
          height: 32px;
          border-radius: 1.58px;
          background: #ffffff;
        }
      }
    }
  }
  .listdivtop {
    height: 89px;
    width: 89px;
    margin-right: 42px;
    margin-left: 15px;
    .chart-box {
      --border-width: 6px !important;
      --eyes-size: 10px !important;
      --dot-width: 10px !important;
    }
    .orederclass {
      font-family: PangMenZhengDao;
      font-size: 28px;
      font-weight: 700;
      display: flex;
      align-items: baseline;
      > span {
        font-size: 20px;
      }
    }
    .yellowspan {
      background: linear-gradient(180deg, #fafbff 9%, #fbff00 98%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-fill-color: transparent;
    }
    .orangespan {
      background: linear-gradient(180deg, #fafbff 9%, #ff4800 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-fill-color: transparent;
    }
  }
}
</style>
