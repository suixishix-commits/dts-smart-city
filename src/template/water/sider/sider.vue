<template>
  <div class="govern_rate">
    <div class="container">
      <div class="content" v-for="(item, index) in rateList" :key="index">
        <div class="text">
          <div class="name">
            <p>{{ item.rank }}</p>
            <p>{{ item.name }}</p>
          </div>
          <p class="percent">{{ item.value }}%</p>
        </div>
        <div class="progress_out">
          <el-slider v-model="item.value" :show-tooltip="false"></el-slider>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const rateList = [
  {
    rank: 'No.1',
    name: '长沙市',
    value: 80
  },
  {
    rank: 'No.2',
    name: '株洲市',
    value: 79.5
  },
  {
    rank: 'No.3',
    name: '湘潭市',
    value: 78.9
  },
  {
    rank: 'No.4',
    name: '衡阳市',
    value: 78
  },
  {
    rank: 'No.5',
    name: '岳阳市',
    value: 76
  }
]
</script>

<style scoped lang="scss">
.govern_rate {
  margin-top: 25px;
  .container {
    width: 100%;
    margin-top: 24px;

    .content {
      margin-bottom: 10px;
      .content :last-child {
        margin-bottom: 0;
      }
      .text {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-sizing: border-box;
        margin-bottom: 5px;
        .name {
          display: flex;
          align-items: center;
          font-family: DIN;
          font-size: 12px;
          font-weight: 500;
          color: #cddfff;
          p:first-child {
            margin-right: 30px;
          }
        }
        .percent {
          font-family: DIN;
          font-size: 14px;
          font-weight: 500;
          color: #cddfff;
        }
      }
      .progress_out {
        width: 400px; //340
        height: 6px; //13
        display: flex;
        align-items: center;

        :v-deep(.el-slider) {
          width: 100%;
          .el-slider__runway {
            background: rgba(62, 86, 125, 0.3);
            .el-slider__bar {
              background: linear-gradient(270deg, #d0e5fe 0%, rgba(208, 229, 254, 0) 100%);
            }
            .el-slider__button {
              width: 8px;
              height: 8px;
              border: 6px solid rgba(141, 176, 237, 0.8);
              background-color: #fff;
            }
          }
        }
      }
    }
  }
}
</style>
