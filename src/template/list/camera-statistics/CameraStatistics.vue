<template>
  <div class="iscamera">
    <div class="iscameratop">
      <div class="iscameratitle"></div>
      <div class="aiiconall">
        <div class="aiicon">
          <div class="motiongraphbg"></div>
        </div>
        <div class="aiiconright">
          <div>
            <div>总数</div>
            <div class="bluenumber otherclass">
              {{ online * 1 + offline * 1 }}
            </div>
          </div>
          <div>
            <div>在线数</div>
            <div class="bluenumber">{{ online }}</div>
          </div>
          <div>
            <div>离线数</div>
            <div>{{ offline }}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="iscamerabottom">
      <div class="listdiv">
        <div class="listdivtop">
          <div class="title">{{ cameraArr[0].areaName }}</div>
          <div class="title">{{ cameraArr[1].areaName }}</div>
        </div>
        <div class="listdivbottom">
          <div class="leftdiv">
            <div>
              <div>总数</div>
              <div>
                <span class="blueclass">{{ cameraArr[0].areaCount }}</span
                >个
              </div>
            </div>
            <div>
              <div>在线</div>
              <div>
                <span class="greenclass">{{ cameraArr[0].areaOnline }}</span
                >个
              </div>
            </div>
          </div>
          <div class="rightdiv">
            <div>
              <div>总数</div>
              <div>
                <span class="blueclass">{{ cameraArr[1].areaCount }}</span
                >个
              </div>
            </div>
            <div>
              <div>在线</div>
              <div>
                <span class="greenclass">{{ cameraArr[1].areaOnline }}</span
                >个
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="listdiv">
        <div class="listdivtop">
          <div class="title">{{ cameraArr[2].areaName }}</div>
          <div class="title">{{ cameraArr[3].areaName }}</div>
        </div>
        <div class="listdivbottom">
          <div class="leftdiv">
            <div>
              <div>总数</div>
              <div>
                <span class="blueclass">{{ cameraArr[2].areaCount }}</span
                >个
              </div>
            </div>
            <div>
              <div>在线</div>
              <div>
                <span class="greenclass">{{ cameraArr[2].areaOnline }}</span
                >个
              </div>
            </div>
          </div>
          <div class="rightdiv">
            <div>
              <div>总数</div>
              <div>
                <span class="blueclass">{{ cameraArr[3].areaCount }}</span
                >个
              </div>
            </div>
            <div>
              <div>在线</div>
              <div>
                <span class="greenclass">{{ cameraArr[3].areaOnline }}</span
                >个
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="iscamerabg">
        <div class="carmeraicon"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
let online = ref(0)
let offline = ref(0)
let cameraArr = ref([
  { areaName: '', areaCount: '', areaOnline: '' },
  { areaName: '', areaCount: '', areaOnline: '' },
  { areaName: '', areaCount: '', areaOnline: '' },
  { areaName: '', areaCount: '', areaOnline: '' }
])
onMounted(() => {
  initdata()
})
const initdata = () => {
  //接口返回数据
  const data = {
    code: 0,
    msg: 'suc',
    data: {
      countOnline: '11',
      countOffline: '10',
      partition: [
        {
          areaName: '其他区域',
          areaOnline: '7',
          areaCount: '7'
        },
        {
          areaName: '汽机房',
          areaOnline: '2',
          areaCount: '2'
        },
        {
          areaName: '1号锅炉房',
          areaOnline: '1',
          areaCount: '2'
        },
        {
          areaName: '2号锅炉房',
          areaOnline: '1',
          areaCount: '1'
        },
        {
          areaName: '',
          areaOnline: '0',
          areaCount: '6'
        },
        {
          areaName: '111',
          areaOnline: '0',
          areaCount: '1'
        },
        {
          areaName: '锅炉',
          areaOnline: '0',
          areaCount: '1'
        },
        {
          areaName: '电厂内',
          areaOnline: '0',
          areaCount: '1'
        }
      ]
    }
  }
  online.value = data.data.countOnline
  offline.value = data.data.countOffline
  cameraArr.value = data.data.partition
}
</script>

<style lang="scss" scoped>
.iscamera {
  font-size: 24px;
  display: flex;
  flex-direction: column;
  .iscameratop {
    display: flex;
    flex-direction: column;
    .iscameratitle {
      width: 302px;
      height: 32px;
      background-image: url('./assets/iscameratitle.png');
      background-size: 100% 100%;
      background-repeat: no-repeat;
    }
    .aiiconall {
      flex: 1;
      display: flex;
      align-items: center;
      margin: 18px 0;
      .aiicon {
        width: 151px;
        height: 165px;
        background-image: url('./assets/iscameraicon.png');
        background-size: 100% 100%;
        background-repeat: no-repeat;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .motiongraphbg {
        position: absolute;
        top: 0;
        background-image: url('./assets/motiongraphbg.gif');
        background-size: 100% 100%;
        background-repeat: no-repeat;
        width: 100%;
        height: 100%;
      }
      // .cameraicon{
      //   width: 76px;
      //   height: 76px;
      //   background-image: url("./assets/cameraicon.png");
      //   background-size: 100% 100%;
      //   background-repeat: no-repeat;
      // }
      .aiiconright {
        flex: 1;
        display: flex;
        height: 125px;
        justify-content: space-around;
        // background: linear-gradient(
        //   270deg,
        //   rgba(71, 134, 212, 0.5) 0%,
        //   rgba(71, 134, 212, 0.44) 57%,
        //   rgba(71, 134, 212, 0) 100%
        // );
        background-image: url('./assets/colorbg.png');
        background-size: 100% 100%;
        background-repeat: no-repeat;
        > div {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          color: rgba(235, 249, 255, 0.9);
          .bluenumber {
            font-family: PangMenZhengDao;
            font-size: 42px;
            background: linear-gradient(180deg, #f3fbff 0%, #00ffe5 98%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-fill-color: transparent;
          }
          .otherclass {
            background: linear-gradient(180deg, #f3fbff 0%, #00b3ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-fill-color: transparent;
          }
        }
        > div:last-child {
          > div:last-child {
            color: #f3fbff;
            font-family: PangMenZhengDao;
            font-size: 42px;
          }
        }
      }
    }
  }
  .iscamerabottom {
    height: 317px;
    display: flex;
    justify-content: space-between;
    flex-direction: column;
    position: relative;
    .iscamerabg {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      height: 275px;
      background-image: url('./assets/iscamerabg.png');
      background-size: 100% 100%;
      background-repeat: no-repeat;
      display: flex;
      // justify-content: center;
      align-items: center;
    }
    .carmeraicon {
      background-image: url('./assets/carmeraicon.png');
      background-size: contain;
      background-repeat: no-repeat;
      width: 48px;
      height: 48px;
      position: absolute;
      left: 282px;
    }
    .iscamerabg::before {
      content: '';
      background-image: url('./assets/iscamerabgother.png');
      background-size: contain;
      background-repeat: no-repeat;
      width: 600px;
      height: 275px;
      position: absolute;
      // left: 50%;
      // top: 50%;
      // transform: translate(-50%, -50%);
      animation: rotate 3s linear infinite;
      z-index: -1;
    }
    @keyframes rotate {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
    .listdiv {
      color: #fff;
      display: flex;
      flex-direction: column;
      > div {
        display: flex;
        > div {
          flex: 1;
        }
        > div:first-child {
          margin-right: 20px;
        }
      }
    }
    .listdivtop {
      display: flex;
      .title {
        height: 46px;
        line-height: 46px;
      }
      > div:first-child {
        padding-left: 28px;
        background: linear-gradient(90deg, rgba(0, 194, 255, 0.4) 0%, rgba(0, 194, 255, 0) 63%);
      }
      > div:last-child {
        padding-right: 28px;
        text-align: right;
        background: linear-gradient(90deg, rgba(0, 194, 255, 0) 42%, rgba(0, 194, 255, 0.4) 85%);
      }
    }
    .listdivbottom {
      height: 88px;
      > div {
        flex-direction: column;
        display: flex;
        justify-content: center;
        > div {
          display: flex;
          > div:last-child {
            font-size: 22px;
            margin-left: 9px;
          }
        }
      }
      // > div:first-child {
      //   background: linear-gradient(
      //     90deg,
      //     rgba(0, 194, 255, 0.1) 0%,
      //     rgba(0, 194, 255, 0) 63%
      //   );
      // }
      // > div:last-child {
      //   background: linear-gradient(
      //     90deg,
      //     rgba(0, 194, 255, 0) 63%,
      //     rgba(0, 194, 255, 0.1) 0%
      //   );
      // }
      .greenclass {
        font-family: PangMenZhengDao;
        font-size: 30px;
        background: linear-gradient(180deg, #f3fbff 0%, #00ffe5 98%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        text-fill-color: transparent;
      }
      .blueclass {
        font-family: PangMenZhengDao;
        font-size: 30px;
        background: linear-gradient(180deg, #f3fbff 0%, #00b3ff 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        text-fill-color: transparent;
      }
      .leftdiv {
        > div {
          display: flex;
          justify-content: space-between;
          padding-left: 31.5px;
          padding-right: 75px;
          align-items: center;
        }
      }
      .rightdiv {
        > div {
          display: flex;
          justify-content: space-between;
          padding-right: 31.5px;
          padding-left: 75px;
          align-items: center;
        }
      }
    }
  }
}
</style>
