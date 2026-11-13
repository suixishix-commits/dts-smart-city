<template>
  <div class="box">
    <div class="title">
      <div class="glowicon"></div>
      <div>{{ info.name }}</div>
    </div>
    <div class="containimage">
      <div>
        <div class="cpubg">
          <div>
            <Ring :rate="Number((info.cpuRate / 100).toFixed(2))">
              <span class="orederclass slot-font1">{{ info.cpuRate }}<span>%</span></span>
            </Ring>
          </div>
        </div>
        <div>cpu</div>
      </div>
      <div>
        <div class="rambg">
          <div>
            <Ring :rate="Number((info.memoryRate / 100).toFixed(2))">
              <span class="orederclass slot-font1">{{ info.memoryRate }}<span>%</span></span>
            </Ring>
          </div>
        </div>
        <div>内存</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import Ring from '../ring/Ring.vue'
const info = ref({
  name: 'cmgii-alarm',
  cpuRate: 2,
  memoryRate: 70
})
</script>

<style lang="scss" scoped>
.box {
  background-color: pink;
  flex: 1;
  background: linear-gradient(180deg, rgba(35, 58, 78, 0) 0%, #233a4e 100%);
  box-sizing: border-box;
  border: 2px solid #295e8e;
  display: flex;
  flex-direction: column;
  .title {
    height: 100px;
    background: linear-gradient(180deg, rgba(32, 133, 220, 0.4) 0%, rgba(32, 133, 220, 0) 100%);
    border-bottom: 2px solid #295e8e;
    display: flex;
    font-size: 38px;
    font-weight: bold;
    color: #c4ecff;
    display: flex;
    align-items: center;

    .glowicon {
      width: 42px;
      height: 42px;
      background-image: url('./assets/glowicon.png');
      background-size: 100% 100%;
      background-repeat: no-repeat;
      margin-left: 27px;
      margin-right: 29px;
    }
  }

  .containimage {
    padding: 30px;
    display: flex;
    flex: 1;

    .orederclass {
      font-family: PangMenZhengDao;
      font-size: 50px;
      font-weight: 400;
      display: flex;
      align-items: baseline;

      > span {
        font-size: 32px;
      }
    }

    > div {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      font-size: 38px;
      font-weight: bold;
      color: #ffffff;

      > div:first-child {
        width: 226px;
        height: 226px;
        background-size: 100% 100%;
        background-repeat: no-repeat;
        margin-bottom: 30px;
        display: flex;
        justify-content: center;
        align-items: center;

        > div {
          width: 142px;
          height: 142px;
          box-sizing: border-box;
        }
      }
    }

    .cpubg {
      background-image: url('./assets/cpubg.png');
    }

    .rambg {
      background-image: url('./assets/rambg.png');
    }
  }
}
</style>
