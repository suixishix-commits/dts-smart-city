<template>
  <div class="time_choose_wrap">
    <div class="closePopover" @click="closePopover"></div>
    <div class="title">
      <p class="text">时间轴</p>
    </div>
    <div class="year">
      <p class="text">{{ new Date().getFullYear() }}</p>
    </div>
    <div class="content_wrap">
      <el-slider v-model="timeRange" range show-stops :min="1" :max="12" :show-tooltip="false" :marks="marks" />
      <div class="slider_bg"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue'

const emit = defineEmits(['close', 'item_click'])
const props = defineProps({
  data: null,
  popoverIndex: {
    type: Number,
    required: true
  }
})

// 选择的时间范围
const timeRange = ref([1, 12])
const marks = reactive({
  1: `${new Date().getFullYear()}年1月`,
  2: '2月',
  3: '3月',
  4: '4月',
  5: '5月',
  6: '6月',
  7: '7月',
  8: '8月',
  9: '9月',
  10: '10月',
  11: '11月',
  12: '12月'
})

watch(
  () => timeRange.value,
  val => {
    // 格式化选择的时间
    let starttime = `${new Date().getFullYear()}-` + val[0].toString().padStart(2, '0')
    let endtime = `${new Date().getFullYear()}-` + val[1].toString().padStart(2, '0')
    let time = {
      starttime,
      endtime
    }
    // 事件转发
    emit('item_click', time)
  },
  {
    // immediate: true,
    deep: true
  }
)

// 关闭窗口
const closePopover = () => {
  // 关闭事件传递
  emit('close', { popoverIndex: props.popoverIndex, data: props.data })
}

onMounted(() => {})
</script>

<style scoped lang="scss">
.time_choose_wrap {
  width: 72.492rem;
  height: 15.454rem;
  background: url('../assets/pop_bg_time_choose.png') no-repeat 0 0 / 100% 100%;
  position: relative;
  font-family: OPPOSans;
  font-size: 1.4rem;
  font-weight: 500;
  color: #c4d3ee;

  .closePopover {
    position: absolute;
    top: 0;
    right: 0;
    width: 3.235rem;
    height: 1.646rem;
    z-index: 9;
    cursor: pointer;
  }

  .title {
    position: absolute;
    left: 0.186rem;
    top: 1.879rem;
    width: 33.45%;
    height: 16.84%;
    background: url('../assets/time_choose_title.png') no-repeat 0% 100% / 100% 81.34%;

    .text {
      margin-left: 4.142rem;
      height: 2.2rem;
      line-height: 2.2rem;
      font-size: 1.8rem;
    }
  }

  .year {
    display: flex;
    align-items: center;
    position: absolute;
    left: 2.77rem;
    top: 5.534rem;
    width: 14.9%;
    height: 12.94%;
    background: url('../assets/year_bg.png') no-repeat 0 0 / 100% 100%;

    .text {
      margin-left: 1.45rem;
      font-family: DIN Alternate;
      font-size: 1.6rem;
      color: #ffffff;
    }
  }

  .content_wrap {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    position: absolute;
    left: 3.366rem;
    top: 7.654rem;
    width: 91.87%;
    height: 39.8%;

    .el-slider {
      width: 92%;

      :deep(.el-slider__runway) {
        height: 1rem;
        background-color: transparent;

        .el-slider__bar {
          height: 1rem;
          background: #00fffa;
          box-shadow: 0px 0px 3px 0px rgba(240, 225, 178, 0.4);
        }

        .el-slider__button-wrapper {
          z-index: 999;

          .el-slider__button {
            position: relative;
            width: 1.4rem;
            height: 1.89rem;
            border: none;
            transform: translateY(-0.3rem);
            background: url('../assets/time_choose_points_bg.png') no-repeat 0 0 / 100% 100%;
          }
        }

        .el-slider__stop {
          background-color: transparent;

          &.el-slider__marks-stop::after {
            content: '';
            display: block;
            width: 0.2rem;
            height: 0.2rem;
            background: #ffffff;
            position: absolute;
            left: 50%;
            top: 1.2rem;
            transform: translateX(-50%);
          }

          &.el-slider__marks-stop:first-child::before,
          &.el-slider__marks-stop:last-child::before {
            content: '';
            display: block;
            width: 0.2rem;
            height: 0.2rem;
            background: #ffffff;
            position: absolute;
            left: 50%;
            top: -0.2rem;
            transform: translateX(-50%);
          }
        }

        .el-slider__marks-text {
          font-family: OPPOSans;
          font-size: 1.2rem;
          font-weight: 500;
          color: #e8ffff;
        }
      }
    }

    .slider_bg {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 100%;
      height: 1rem;
      background: linear-gradient(270deg, rgba(1, 87, 82, 0.8) 0%, #7bfdff 44%, rgba(1, 87, 77, 0.8) 100%);
      opacity: 0.4;
      pointer-events: none;
    }
  }
}
</style>
