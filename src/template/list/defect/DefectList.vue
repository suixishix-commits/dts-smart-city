<template>
  <div class="box-list">
    <div class="patrol-object">
      当前巡查对象
      <span class="num">{{ patrolObject.total }}</span>
      个，检查<span class="num">{{ patrolObject.inspect }}</span>
      个，已修复
      <span class="num">{{ patrolObject.repair }}</span>
      个，正常
      <span class="num" style="color: #2ecea2">{{ patrolObject.normal }}</span>
      个
    </div>
    <div class="result-items-list">
      <div class="defect-item" v-for="(item, index) in defectDataList" :key="index">
        <div class="box">
          <p class="top-text">{{ item.num }}<span>个</span></p>
          <p class="bottom-text">{{ item.name }}</p>
        </div>
        <img :src="item.img" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const patrolObject = reactive({
  total: 21,
  inspect: 0,
  repair: 0,
  normal: 21
})

const defectDataList = ref([
  {
    name: '坝体裂缝',
    num: '0',
    img: new URL('./assets/dam-crack.png', import.meta.url).href
  },
  {
    name: '坝体渗漏',
    num: '2',
    img: new URL('./assets/dam-leakage.png', import.meta.url).href
  },
  {
    name: '缺陷变化',
    num: '1',
    img: new URL('./assets/defect-change.png', import.meta.url).href
  }
])
</script>

<style lang="scss" scoped>
.box-list {
  display: flex;
  flex-flow: column nowrap;
  width: 100%;
  height: 100%;

  .patrol-object {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    padding: 0.9rem;
    width: 39.4rem;
    height: 5.1rem;
    // background: url('@/assets/home/left-bottom-total-bg.png') no-repeat center center / 100% 100%;
    font-family: OPPOSans;
    font-size: 1.4rem;
    letter-spacing: 0.05em;
    color: #d5e8fe;

    .num {
      margin-top: 0.1rem;
      font-family: YouSheBiaoTiHei;
      font-size: 2rem;
      color: #f3be60;
    }
  }

  .result-items-list {
    display: flex;
    justify-content: space-between;
    width: 39.4rem;
    flex: 1;

    .defect-item {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 12.6rem;
      height: 100%;
      // background: url('@/assets/home/defect-item-bg.png') no-repeat center center / 100% 100%;

      .box {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 7.2rem;
        height: calc(100% * (96 / 102));
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;

        .top-text {
          display: flex;
          align-items: center;
          font-family: YouSheBiaoTiHei;
          font-size: 2rem;
          color: #def0fc;

          span {
            margin-left: 0.4rem;
            font-family: OPPOSans;
            font-size: 1.2rem;
            color: #d5e8fe;
          }
        }

        .bottom-text {
          font-family: OPPOSans;
          font-size: 1.4rem;
          letter-spacing: 0.05em;
          color: #dff6fe;
        }
      }

      img {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        height: calc(100% * (92 / 102));
      }
    }
  }
}
</style>
