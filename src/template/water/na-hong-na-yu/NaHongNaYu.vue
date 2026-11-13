<template>
  <div class="box-template">
    <div class="box-summary">
      <div class="itemTitle">未来30天纳洪能力</div>
      <div class="itemDan">(亿m³)</div>
    </div>
    <div class="box-content">
      <div class="circleBlue">
        <div class="itemNumber">
          <div class="numItem">{{ nahong1 ? nahong1 : '-' }}</div>
        </div>
        <div class="water">{{ water1 }}</div>
      </div>
      <div class="circleYellow">
        <div class="itemNumber">
          <div class="numItem">{{ nahong2 ? nahong2 : '-' }}</div>
        </div>
        <div class="water">{{ water2 }}</div>
      </div>
      <div class="circleGreen">
        <div class="itemNumber">
          <div class="numItem">{{ nahong3 ? nahong3 : '-' }}</div>
        </div>
        <div class="water">{{ water3 }}</div>
      </div>
      <div class="circleBlue">
        <div class="itemNumber">
          <div class="numItem">{{ nahong4 ? nahong4 : '-' }}</div>
        </div>
        <div class="water">{{ water4 }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getTemplateData } from '@/api/fileData'

// 绑定数据
const listData: any = ref([])

const water1 = ref<any>('')
const water2 = ref<any>('')
const water3 = ref<any>('')
const water4 = ref<any>('')
const nahong1 = ref<any>('')
const nahong2 = ref<any>('')
const nahong3 = ref<any>('')
const nahong4 = ref<any>('')

// 初始化UI
async function initGUI() {
  let res: any = await getTemplateData('water/na-hong-na-yu/assets/data.json')
  console.log('后台数据:？', res)
  if (res?.data?.data?.length > 0) {
    listData.value = res.data.data[0].rainCapacityVoList
    water1.value = listData.value[0].water
    water2.value = listData.value[1].water
    water3.value = listData.value[2].water
    water4.value = listData.value[3].water
    nahong1.value = listData.value[0].nahong
    nahong2.value = listData.value[1].nahong
    nahong3.value = listData.value[2].nahong
    nahong4.value = listData.value[3].nahong
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
  display: flex;
  flex-flow: column nowrap;
  box-sizing: border-box;
  padding: 1rem;
  .box-summary {
    display: flex;
    color: white;
    justify-content: center;
    align-items: center;
    letter-spacing: 0.3rem;
    .itemTitle {
      font-size: 1.5rem;
      font-family: 'OPPOSans-R', sans-serif;
    }
    .itemDan {
      font-size: 1.2rem;
      font-family: 'OPPOSans-R', sans-serif;
    }
  }
  .box-content {
    display: flex;
    color: white;
    width: 100%;
    flex: 1;
    justify-content: space-between;
    align-items: center;
    .circleBlue {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      height: 100%;
      width: 22%;
      .itemNumber {
        display: flex;
        justify-content: center;
        align-items: center;
        background-image: url('./assets/circleBlue.png');
        background-size: contain;
        padding: 4.2rem;
        margin-top: 2rem;
        background-repeat: no-repeat;
        font-family: 'DIN-Bold', sans-serif;
        width: 20%;
        height: 2.2rem;
        position: relative;
        z-index: 1;
        .numItem {
          background: -webkit-linear-gradient(top, white 30%, #16f1f4);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-size: 2rem;
        }
      }
      .itemNumber::before {
        content: '';
        background-image: url('./assets/circleBlue.png');
        background-size: contain;
        background-repeat: no-repeat;
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        animation: rotate 10s linear infinite;
        transform-origin: center center;
        z-index: -1;
      }
    }
    .circleYellow {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      height: 100%;
      width: 22%;
      .itemNumber {
        display: flex;
        justify-content: center;
        align-items: center;
        background-image: url('./assets/circleYellow.png');
        background-size: contain;
        padding: 4.2rem;
        margin-top: 2rem;
        background-repeat: no-repeat;
        font-family: 'DIN-Bold', sans-serif;
        width: 20%;
        height: 2.2rem;
        position: relative;
        z-index: 1;
        .numItem {
          background: -webkit-linear-gradient(top, white 30%, #f3c016);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-size: 2rem;
        }
      }
      .itemNumber::before {
        content: '';
        background-image: url('./assets/circleYellow.png');
        background-size: contain;
        background-repeat: no-repeat;
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        animation: rotate 10s linear infinite;
        transform-origin: center center;
        z-index: -1;
      }
    }
    .circleGreen {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      height: 100%;
      width: 22%;
      .itemNumber {
        display: flex;
        justify-content: center;
        align-items: center;
        background-image: url('./assets/circleGreen.png');
        background-size: contain;
        padding: 4.2rem;
        margin-top: 2rem;
        background-repeat: no-repeat;
        font-family: 'DIN-Bold', sans-serif;
        width: 20%;
        height: 2.2rem;
        position: relative;
        z-index: 1;
        .numItem {
          background: -webkit-linear-gradient(top, white 30%, #18f494);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-size: 2rem;
        }
      }
      .itemNumber ::before {
        content: '';
        background-image: url('./assets/circleGreen.png');
        background-size: contain;
        background-repeat: no-repeat;
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        animation: rotate 10s linear infinite;
        transform-origin: center center;
        z-index: -1;
      }
    }
  }

  @keyframes rotate {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
}
</style>
