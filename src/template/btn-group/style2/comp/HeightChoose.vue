<template>
  <div class="height_choose_wrap">
    <div class="closePopover" @click="closePopover"></div>
    <div class="title">
      <p class="text">高度选择</p>
    </div>
    <div class="main">
      <div class="height_unit"></div>
      <div class="height_tick"></div>
      <div class="height_box">
        <div class="height_base">
          <div class="min_height" :style="{ bottom: (minBottom / 6) * 100 + '%' }"></div>
          <div class="height_range"
            :style="{ bottom: (minBottom / 6) * 100 + '%', height: ((maxBottom - minBottom) / 6) * 100 + '%' }">
          </div>
          <div class="max_height" :style="{ bottom: (maxBottom / 6) * 100 + '%' }"></div>
          <div id="min_choose" class="min_choose choose_tool" :style="{ bottom: (minBottom / 6) * 100 + '%' }"
            draggable="true" @dragstart="dragstart" @dragend="dragend"></div>
          <div id="max_choose" class="max_choose choose_tool" :style="{ bottom: (maxBottom / 6) * 100 + '%' }"
            draggable="true" @dragstart="dragstart" @dragend="dragend"></div>
        </div>
        <div class="model"></div>
      </div>
    </div>
    <div class="selected_height_wrap">
      <span class="text">所选高度：</span>
      <div class="selected_height">{{ heightRange[0] }}-{{ heightRange[1] }}</div>
      <span class="text">米</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";

const emit = defineEmits(['close', 'item_click'])
const props = defineProps({
  data: null,
  popoverIndex: {
    type: Number,
    required: true
  }
})

// 选择的高度
const heightRange = ref<number[]>([0, 10000]);
const minBottom = ref<number>(0);
const maxBottom = ref<number>(6);
let boxHeight: number, startY: number;

// 开始拖拽
const dragstart = (e: any) => {
  const heightBase: any = document.querySelector(".height_base");
  boxHeight = parseFloat(getComputedStyle(heightBase).height);
  startY = e.clientY;
}
// 结束拖拽
const dragend = (e: any) => {
  let endY = e.clientY;
  let moveY = endY - startY;
  let id = e.target.id;
  if (id == "max_choose") {
    let currentOffset = ((boxHeight / 6) * maxBottom.value) - moveY;
    let currentBottom = Math.round(currentOffset / (boxHeight / 6));
    if (currentBottom > 6) {
      maxBottom.value = 6;
    } else if (currentBottom <= minBottom.value) {
      maxBottom.value = minBottom.value + 1;
    } else {
      maxBottom.value = currentBottom;
    }
    heightRange.value[1] = handleHeight(maxBottom.value);
  } else if (id == "min_choose") {
    let currentOffset = ((boxHeight / 6) * minBottom.value) - moveY;
    let currentBottom = Math.round(currentOffset / (boxHeight / 6));
    if (currentBottom < 0) {
      minBottom.value = 0;
    } else if (currentBottom >= maxBottom.value) {
      minBottom.value = maxBottom.value - 1;
    } else {
      minBottom.value = currentBottom;
    }
    heightRange.value[0] = handleHeight(minBottom.value);
  }
}
// 判定选择的高度
const handleHeight = (percent: any) => {
  switch (percent) {
    case 0:
      return 0;
    case 1:
      return 120;
    case 2:
      return 300;
    case 3:
      return 600;
    case 4:
      return 1000;
    case 5:
      return 5000;
    case 6:
      return 10000;
    default:
      return 0;
  }
}

watch(() => heightRange.value, (val) => {
  // 事件转发
  emit('item_click', val)
}, {
  // immediate: true,
  deep: true
})

// 关闭窗口
const closePopover = () => {
  // 关闭事件传递
  emit('close', { popoverIndex: props.popoverIndex, data: props.data })
}

onMounted(() => { });
</script>

<style scoped lang="scss">
.height_choose_wrap {
  width: 28.092rem;
  height: 35.354rem;
  background: url("../assets/pop_bg_height_choose.png") no-repeat 0 0 / 100% 100%;
  position: relative;
  font-family: OPPOSans;
  font-size: 1.4rem;
  font-weight: 500;
  color: #C4D3EE;
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
    left: 0;
    top: 1.879rem;
    width: 86.01%;
    height: 7.36%;
    background: url("../assets/height_choose_title.png") no-repeat 0% 100% / 100% 81.34%;
    .text {
      margin-left: 4.142rem;
      height: 2.2rem;
      line-height: 2.2rem;
      font-size: 1.8rem;
    }
  }
  .main {
    position: absolute;
    left: 3rem;
    top: 6.1rem;
    width: 19.124rem;
    height: 23.2rem;
    .height_unit {
      position: absolute;
      left: 0;
      top: 0;
      width: 5.6rem;
      height: 1.2rem;
      background: url("../assets/height_unit.png") no-repeat 0 0 / 100% 100%;
    }
    .height_tick {
      position: absolute;
      left: 0;
      top: 2rem;
      width: 4.2rem;
      height: 20rem;
      background: url("../assets/height_tick.png") no-repeat 0 0 / 100% 100%;
    }
    .height_box {
      position: absolute;
      left: 5rem;
      top: 1.3rem;
      width: 14.124rem;
      height: 20.4rem;
      .height_base {
        position: absolute;
        left: 0;
        top: 1.428rem;
        width: 14.124rem;
        height: 18.972rem;
        background: url("../assets/height_base.png") no-repeat 0 0 / 100% 100%;
        .min_height {
          position: absolute;
          left: 0;
          width: 14rem;
          height: 1.4rem;
          background: url("../assets/min_height_bg.png") no-repeat 0 0 / 100% 100%;
        }
        .max_height {
          position: absolute;
          left: 0;
          width: 14rem;
          height: 1.4rem;
          background: url("../assets/max_height_bg.png") no-repeat 0 0 / 100% 100%;
        }
        .height_range {
          position: absolute;
          left: 0;
          width: 14.1rem;
          background: url("../assets/height_range_bg.png") no-repeat 0 0 / 100% 100%;
        }
        .choose_tool {
          position: absolute;
          left: 14.724rem;
          width: 2.237rem;
          height: 2.267rem;
          transform: translateY(50%);
          background: url("../assets/height_choose_icon.png") no-repeat 0 0 / 100% 100%;
          cursor: pointer;
        }
        .max_choose {
          bottom: calc(18.972rem - 1.1335rem);
        }
      }
      .model {
        position: absolute;
        left: 0;
        top: 0;
        width: 14.124rem;
        height: 20.4rem;
        background: url("../assets/height_model.png") no-repeat 0 0 / 100% 100%;
      }
    }
  }
  .selected_height_wrap {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: absolute;
    left: 2rem;
    top: 30.4rem;
    width: 84.78%;
    height: 8.49%;
    .selected_height {
      width: 58.58%;
      height: 3rem;
      border-radius: 0.4rem;
      background: linear-gradient(180deg, rgba(30, 32, 48, 0.5) 0%, rgba(7, 25, 36, 0.5) 100%);
      border: 1px solid;
      border-image: linear-gradient(105deg, rgba(115, 160, 206, 0.4) 12%, rgba(115, 160, 206, 0.1) 95%);
      text-align: center;
      line-height: 3rem;
      font-size: 1.6rem;
      font-weight: 900;
      color: #3AFBF7;
    }
  }
}
</style>