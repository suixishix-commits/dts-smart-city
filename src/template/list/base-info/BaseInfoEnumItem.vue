<template>
  <div class="comp-box">
    <div v-for="(item, index) in itemData" :key="index" class="flexItem" @click="btnGroupClick(item, index)">
      <div class="vData">
        <div class="data-value">{{ item.value }}</div>
      </div>
      <div class="vName">{{ item.text }}</div>
      <div class="vUnit">{{ item.unit }}</div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive } from 'vue'

const emit = defineEmits(['click'])

const itemData = reactive([
  {
    name: 'shuiWei',
    text: '实时水位',
    value: '207.84',
    unit: '(m)'
  },
  {
    name: 'inWater',
    text: '入库流量',
    value: '321',
    unit: '(m³/s)'
  },
  {
    name: 'outWater',
    text: '出库流量',
    value: '10.66',
    unit: '(m³/s)'
  },
  {
    name: 'fdl',
    text: '年发电量',
    value: '3.11',
    unit: '(亿kW·h)'
  }
])

// 图标点击状态
const itemState = Array.from({ length: itemData.length }, () => 0)

/**
 * 图标点击事件
 *
 * @param item
 * @param index
 */
async function btnGroupClick(item, index) {
  itemState[index]++ // 状态切换
  itemData[index].isSelected = !itemData[index].isSelected
  if (itemData[index].isSelected) {
    const iconName = item.name
    itemData.forEach((itemTmp) => {
      if (itemTmp.name != iconName) itemTmp.isSelected = false
    })
  }
  emit('click', item, itemState[index])
}

onMounted(() => {})

onBeforeUnmount(async () => {})
</script>

<style lang="scss" scoped>
.comp-box {
  display: flex;
  width: 100%;
  height: 15rem;
  justify-content: space-evenly;
  .flexItem {
    display: flex;
    flex-flow: column;
    justify-content: center;
    cursor: pointer;
    width: 25%;
    position: relative;
    .vData {
      position: relative;
      height: 5rem;
      font-size: 2rem;
      text-align: center;
      padding: 3rem;
      background-image: url('./assets/circleBottom.png');
      background-repeat: no-repeat;
      background-size: 100% 100%;
      overflow: hidden;

      .data-value {
        position: absolute;
        bottom: 25%;
        left: 50%;
        transform: translateX(-50%);
        background: -webkit-linear-gradient(top, rgb(255, 254, 254) 30%, #0de40d) 50%;
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-family: 'DIN-Bold', sans-serif;
      }
    }
    .vName {
      color: white;
      font-size: 1.4rem;
      padding-top: 0.4rem;
      box-sizing: border-box;
      text-align: center;
      font-family: 'OPPOSans-R', sans-serif;
    }

    .vUnit {
      color: white;
      padding-top: 0.2rem;
      box-sizing: border-box;
      font-size: 1.2rem;
      text-align: center;
      font-family: 'OPPOSans-R', sans-serif;
    }
  }
}

.flexItem::before {
  content: '';
  position: absolute;
  width: 3rem;
  height: 3rem;
  top: 1rem;
  left: 1rem;
  background-image: url('./assets/circleBlue.png');
  background-size: contain;
  background-repeat: no-repeat;
  animation: flying 5s linear infinite;
  transform-origin: center;
}

@keyframes flying {
  0% {
    transform: translate(50%, 0) rotate(0deg);
    transform-origin: center top;
  }
  25% {
    transform: translate(100%, 50%) rotate(90deg);
    transform-origin: right center;
  }
  50% {
    transform: translate(100%, 100%) rotate(180deg);
    transform-origin: center bottom;
  }
  75% {
    transform: translate(50%, 100%) rotate(270deg);
    transform-origin: left center;
  }
  100% {
    transform: translate(50%, 0) rotate(360deg);
    transform-origin: center top;
  }
}
</style>
