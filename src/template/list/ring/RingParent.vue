<template>
  <div class="generatoroil">
    <div class="generatoroilgroup">
      <div>
        <div class="top">
          <Ring
            :rate="listData.turbine / 100"
            :config="{
              startColor: '#4A47E5',
              endColor: '#FF6BE1',
              circleColor: '#F32BCB',
              endPoscolor: 'rgba(74, 71, 229, 0.2)'
            }"
          >
            <span class="orederclass slot-font1">{{ listData.turbine ? Number(listData.turbine).toFixed(2) : 0 }}%</span>
          </Ring>
        </div>
        <div>汽端</div>
      </div>
      <div>
        <div class="top">
          <Ring
            :rate="listData.exciter / 100"
            :config="{
              startColor: '#4A47E5',
              endColor: '#FF6BE1',
              circleColor: '#F32BCB',
              endPoscolor: 'rgba(74, 71, 229, 0.2)'
            }"
          >
            <span class="orederclass slot-font1">{{ listData.exciter ? Number(listData.exciter).toFixed(2) : 0 }}%</span>
          </Ring>
        </div>
        <div>励端</div>
      </div>
      <div>
        <div class="top">
          <Ring
            :rate="listData.cooler / 100"
            :config="{
              startColor: '#4A47E5',
              endColor: '#FF6BE1',
              circleColor: '#F32BCB',
              endPoscolor: 'rgba(74, 71, 229, 0.2)'
            }"
          >
            <span class="orederclass slot-font1">{{ listData.cooler ? Number(listData.cooler).toFixed(2) : 0 }}%</span>
          </Ring>
        </div>
        <div>冷水箱</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import Ring from './Ring.vue'

const listData = ref({
  turbine: 33.33,
  exciter: 60.456,
  cooler: 89.999
})
</script>

<style lang="scss" scoped>
.generatoroil {
  flex: 1;
  font-size: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  .generatoroilgroup {
    flex: 1;
    display: flex;
    justify-content: space-around;
    align-items: center;
    > div {
      height: 224px;
      width: 168px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      font-size: 24px;
      color: #fafbff;
      .top {
        height: 168px;
        width: 168px;
        span {
          font-family: PangMenZhengDao;
          font-size: 44px;
          background: linear-gradient(180deg, #f3fbff 0%, #4a47e5 99%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-fill-color: transparent;
        }
        .chart-box {
          --border-width: 14px !important;
          --eyes-size: 20px !important;
          --dot-width: 20px !important;
        }
      }
    }
  }
}
</style>
