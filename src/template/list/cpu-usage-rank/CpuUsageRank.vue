<template>
  <div class="box">
    <div class="cpuranking"></div>
    <div class="contain">
      <div class="cpuicon"></div>
      <div class="cpuiconright">
        <vue3-seamless-scroll :list="cpuTop" :hover="true" :step="0.4" class="givealarmfirstdivscroll">
          <div :class="[index <= 1 ? 'thirdback' : '', 'cpuiconrightlist']" v-for="(item, index) in cpuTop" :key="item.id">
            <div class="top">
              <div class="toptext">
                <div class="yellowtoptextbg">
                  <div class="toptextdiv">TOP{{ index + 1 }}</div>
                </div>
                <div>{{ item.name }}</div>
              </div>
              <div class="topnumber">{{ item.cpuRate }}%</div>
            </div>
            <div class="bottom">
              <div class="orangeprogress" :style="`width:${item.cpuRate}%`"></div>
              <div class="square" :style="`left:${item.cpuRate}%`"></div>
            </div>
          </div>
        </vue3-seamless-scroll>
      </div>
    </div>
  </div>
</template>
<script setup>
import { Vue3SeamlessScroll } from 'vue3-seamless-scroll'
import { onMounted, ref } from 'vue'

let allInfo = ref([])

const cpuTop = computed(() => {
  if (allInfo.value) {
    let cpu = [...allInfo.value]
    cpu.sort((a, b) => b.cpuRate - a.cpuRate)
    return cpu
  }
})
onMounted(() => {
  initdata()
})
const initdata = () => {
  //接口返回数据
  const data = {
    code: 0,
    msg: 'suc',
    data: [
      {
        code: 'cmgii-alarm',
        ip: '10.11.0.176',
        name: 'cmgii-alarm',
        cpuRate: 2,
        memoryRate: 70,
        fileRate: 30,
        updateTime: 1700118500000
      },
      {
        code: 'cmgii-integration',
        ip: '10.11.0.209',
        name: 'cmgii-integration',
        cpuRate: 2,
        memoryRate: 70,
        fileRate: 30,
        updateTime: 1700200704000
      },
      {
        code: 'cmgii-iot',
        ip: '10.11.0.45',
        name: 'cmgii-iot',
        cpuRate: 70,
        memoryRate: 70,
        fileRate: 30,
        updateTime: 1700200284000
      },
      {
        code: 'cmgii-main',
        ip: '10.11.0.4',
        name: 'cmgii-main',
        cpuRate: 20,
        memoryRate: 70,
        fileRate: 30,
        updateTime: 1700118711000
      },
      {
        code: 'cmgii-run',
        ip: '10.11.0.36',
        name: 'cmgii-run',
        cpuRate: 4,
        memoryRate: 70,
        fileRate: 30,
        updateTime: 1700129403000
      },
      {
        code: 'cmgii-work',
        ip: '10.11.0.47',
        name: 'cmgii-work',
        cpuRate: 3,
        memoryRate: 70,
        fileRate: 30,
        updateTime: 1700129955000
      }
    ]
  }
  allInfo.value = data.data
}
</script>
<style lang="scss" scoped>
.box {
  height: 100%;
  display: flex;
  flex-direction: column;
  .cpuranking {
    width: 100%;
    height: 52px;
    background-image: url('./assets/cpuranking.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
  }
  .contain {
    // background-color: pink;
    flex: 1;
    display: flex;
    padding: 19px 25px 31px 19px;

    > div:first-child {
      width: 360px;
      background-size: 100% 100%;
      background-repeat: no-repeat;
      margin-right: 26px;
    }

    .cpuiconright {
      flex: 1;
      display: flex;
      justify-content: space-between;
      flex-direction: column;
      height: 500px;
      .cpuiconrightlist {
        display: flex;
        flex-direction: column;
        margin-bottom: 46px;

        .top {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .toptext {
            display: flex;
            font-size: 32px;
            color: #c4ecff;
            align-items: center;

            .toptextdiv {
              font-family: PangMenZhengDao;
              font-size: 40px;
              color: #ffffff;
              position: absolute;
              top: -16px;
              left: 11px;
            }

            > div:first-child {
              width: 106px;
              height: 24px;
              position: relative;
            }

            > div:last-child {
              margin-left: 44px;
            }
          }

          .topnumber {
            font-family: PangMenZhengDao;
            font-size: 38px;
            color: #7bd5ff;
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

          // .orangeprogress {
          //   width: 90%;
          //   height: 12px;
          //   opacity: 1;
          //   background: linear-gradient(270deg, #FF4800 0%, rgba(255, 72, 0, 0.43) 72%, rgba(255, 72, 0, 0.00) 95%);
          // }

          // .yellowprogress {
          //   width: 90%;
          //   height: 12px;
          //   opacity: 1;
          //   background: linear-gradient(270deg, #FBFF00 0%, rgba(251, 255, 0, 0.43) 68%, rgba(251, 255, 0, 0.00) 100%);
          // }

          // .blueprogress {
          //   width: 90%;
          //   height: 12px;
          //   opacity: 1;
          //   background: linear-gradient(270deg, #84FCAF 0%, rgba(132, 252, 175, 0.43) 69%, rgba(132, 252, 175, 0.00) 100%);
          // }

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
      > div > div > div {
        > :nth-child(1) {
          .orangeprogress {
            width: 90%;
            height: 12px;
            opacity: 1;
            background: linear-gradient(270deg, #ff4800 0%, rgba(255, 72, 0, 0.43) 72%, rgba(255, 72, 0, 0) 95%);
          }
          .yellowtoptextbg {
            background: linear-gradient(90deg, #f19b39 0%, rgba(241, 155, 57, 0) 100%);
          }
        }
        > :nth-child(2) {
          .orangeprogress {
            width: 90%;
            height: 12px;
            opacity: 1;
            background: linear-gradient(270deg, #fbff00 0%, rgba(251, 255, 0, 0.43) 68%, rgba(251, 255, 0, 0) 100%);
          }
          .yellowtoptextbg {
            background: linear-gradient(90deg, #c4c4c4 0%, rgba(196, 196, 196, 0) 100%);
          }
        }
        > :not(.thirdback) {
          .orangeprogress {
            width: 90%;
            height: 12px;
            opacity: 1;
            background: linear-gradient(270deg, #84fcaf 0%, rgba(132, 252, 175, 0.43) 69%, rgba(132, 252, 175, 0) 100%);
          }
          .yellowtoptextbg {
            background: linear-gradient(90deg, #397cf1 0%, rgba(57, 124, 241, 0) 100%);
          }
        }
      }
      .givealarmfirstdivscroll {
        overflow: hidden;
        height: 100%;
      }
    }

    .cpuicon {
      background-image: url('./assets/cpuicon.png');
    }

    .ramicon {
      background-image: url('./assets/ramicon.png');
    }
  }
}
</style>
