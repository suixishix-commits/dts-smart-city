<template>
  <div class="region-block">
    <div class="region-title">
      <p class="title-text">截断面筛选</p>
    </div>
    <div class="region-content">
      <ul>
        <li><span>截断面</span> <span style="color: #ffb578">（300）</span></li>
        <li><span>截断面1</span> <span style="color: #ffb578">（300）</span></li>
        <li><span>截断面2</span> <span style="color: #ffb578">（300）</span></li>
        <li><span>截断面3</span> <span style="color: #ffb578">（300）</span></li>
        <li><span>截断面4</span> <span style="color: #ffb578">（300）</span></li>
        <li><span>截断面5</span> <span style="color: #ffb578">（300）</span></li>
        <li><span>截断面6</span> <span style="color: #ffb578">（300）</span></li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  dataSource: {
    type: Object
  }
})
</script>

<style lang="scss" scoped>
.region-block {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 41.1rem;
  height: 20.2rem;
  box-sizing: border-box;
  background: url('../assets/right_bag.png') no-repeat center center / 100% 100%;

  .region-title {
    position: relative;
    width: 100%;
    height: 3.4rem;
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
  }

  .region-content {
    width: 100%;
    padding: 1rem 1.2rem 0rem 1.2rem;
    box-sizing: border-box;
    height: 16.4rem;
    background-image: none;
    ul {
      width: 100%;
      // height: 100%;
      height: 13.9rem;
      overflow-y: auto;
      display: flex;
      flex-wrap: wrap;
      box-sizing: border-box;

      li {
        width: 100%;
        height: 4.1rem;
        background: rgba(0, 51, 95, 0.2);
        margin-bottom: 0.8rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-radius: 0.4rem;
        padding: 0 1.6rem 0 1.2rem;

        span {
          font-family: 'OPPOSans';
          font-size: 1.6rem;
          font-weight: normal;
          color: #ffffff;
        }
      }
    }
  }
}
</style>
