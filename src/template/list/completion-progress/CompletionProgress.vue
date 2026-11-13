<script setup lang="ts">
const totalWater = ref(100) // 总需水量
const actualWater = ref(20) // 实际用水量
// 样式匹配
// 计算实际水位的样式
const actuaLevelStyle = computed(() => {
  let background
  // 计算水位比例
  const ratio = actualWater.value / totalWater.value
  // 根据水位比例选择背景色
  if (actualWater.value > totalWater.value * 0.8) {
    background = 'linear-gradient(270deg, #FF662A 0%, rgba(255, 106, 0, 0.45) 117%)'
  } else if (actualWater.value < totalWater.value * 0.3) {
    background = 'linear-gradient(270deg, #00FF7B 0%, rgba(0, 247, 255, 0.45) 117%)'
  } else {
    background = 'linear-gradient(270deg, #00DDFF 0%, rgba(0, 247, 255, 0.45) 117%)'
  }
  // 返回计算得到的样式对象
  return {
    'clip-path': 'polygon(0 0,  100% 0, 80% 100%, 0 100%)',
    background: background, // 设置背景色
    width: `${(ratio * 100).toFixed(2)}%` // 根据水位比例设置宽度
  }
})
</script>

<template>
  <div style="" class="CompletionProgress">
    <div class="water-situation_bg">
      <div class="water-situation situation">
        <!--未完成进度-->
        <div>
          <span class="water-title">&nbsp;实际用水:</span>
          <span class="speText">{{ actualWater.toFixed(2) }}</span
          >&nbsp;
          <span class="water-unit">万m³</span>
        </div>
        <!--        未完成进度-->
        <div>
          <span style="width: 2rem"></span>
          <span class="water-title">总需水量:</span> <span class="speText">{{ totalWater }}</span
          >&nbsp;
          <span class="water-unit">万m³</span>
        </div>
      </div>

      <div class="water-container">
        <span class="water-level water-text"> {{ actualWater.toFixed(2) }} / {{ totalWater }}万m³</span>
        <!-- 进度条  -->
        <div class="water-level" :style="actuaLevelStyle">
          <div class="ripples"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.CompletionProgress {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.water-situation_bg {
  padding: 0.3rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 90%;
}
.water-container {
  margin-top: 1rem;
  width: 90%;
  height: 2rem;
  padding: 0.2rem;
  //border-radius: 2rem;
  position: relative;
  overflow: hidden; /* 防止水位超出容器 */
  //background: rgba(0, 72, 74, 0.8);
  opacity: 0.9;
  background: linear-gradient(270deg, #ffffff 0%, rgba(255, 255, 255, 0) 50%);
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.8);
}
.water-title,
.water-unit {
  color: white;
  //padding-left: 0.2rem;
  display: inline-block;
}
.water-level {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: white; /* 字体颜色 */
  position: relative;
  overflow: hidden; /* 避免水波纹溢出 */
}

.water-text {
  width: 100%;

  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  //line-height: 2rem;
  color: white; /* 字体颜色 */
  //font-weight: bold;
}

.ripples {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.4) 20%, transparent 20%);
  background-size: 20% 20%;
  opacity: 0.6;
  animation:
    ripple 2s infinite linear,
    shake 0.3s infinite alternate; /* 添加晃动动画 */
  transform: translateX(-50%);
}

@keyframes ripple {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 100% 100%;
  }
}

@keyframes shake {
  0% {
    transform: translateX(-50%) translateY(0);
  }
  100% {
    transform: translateX(-50%) translateY(-2px); /* 上下晃动 */
  }
}

.water-situation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 1rem;
  width: 100%;
  height: 2rem;
  font-size: 1.2rem;

  .speTiem {
    padding: 1.2rem;
    font-size: 1.4rem;
    line-height: normal;
    text-align: right;
    font-variation-settings: 'opsz' auto;
    background: linear-gradient(180deg, #ffffff 5%, #00eeff 26%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .speText {
    font-size: 1.6rem;
    line-height: 1rem;
    text-align: right;
    letter-spacing: 0em;
    color: #00eeff;
    //font-family: OPPOSans;
  }
}
</style>
