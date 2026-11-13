<template>
  <div class="main_layout">
    <div class="border-bg"></div>
    <div class="secondary-menu-wrap">
      <div class="result-visualization">
        <img src="./assets/result-visualization-icon.png" draggable="false">
        <p class="text">结果可视化</p>
      </div>
      <div class="secondary-menu">
        <el-radio-group v-model="radio">
          <el-radio-button label="安全状态总览" value="SafeStatus" />
          <el-radio-button label="实测性态分析结果" value="TestBehaviorAnalysis" />
          <el-radio-button label="结构安全复核结果" value="StructureSafeCheck" />
          <el-radio-button label="现场巡视检查结果" value="ScenePatrolInspection" />
          <el-radio-button label="安全评判规则设定" value="SafeJudgeRule" />
        </el-radio-group>
      </div>
    </div>
    <component :is="currentComponent" class="safety-assessment-content"></component>
  </div>
</template>

<script setup lang="ts">
import SafeStatus from "./components/SafeStatus.vue"
import TestBehaviorAnalysis from "./components/TestBehaviorAnalysis.vue"
import StructureSafeCheck from "./components/StructureSafeCheck.vue"
import ScenePatrolInspection from "./components/ScenePatrolInspection.vue"
import SafeJudgeRule from "./components/SafeJudgeRule.vue"
import { ref, watch, onMounted } from "vue";

const radio = ref("SafeStatus");
let currentComponent: any;

watch(() => radio.value, (val) => {
  switch (val) {
    case "SafeStatus":
      currentComponent = SafeStatus;
      break;
    case "TestBehaviorAnalysis":
      currentComponent = TestBehaviorAnalysis;
      break;
    case "StructureSafeCheck":
      currentComponent = StructureSafeCheck;
      break;
    case "ScenePatrolInspection":
      currentComponent = ScenePatrolInspection;
      break;
    case "SafeJudgeRule":
      currentComponent = SafeJudgeRule;
    default:
      break;
  }
}, {
  immediate: true
})

onMounted(() => {})
</script>

<style lang="scss" scoped>
.main_layout {
  pointer-events: all;
  position: relative;
  width: 100%;
  // height: calc(100% - 8rem);
  height: 100%;
  box-sizing: border-box;
  // padding-top: 8rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  // margin-top: 8rem;
  background: #0C253E;
  .border-bg {
    pointer-events: none;
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: url('./assets/border.png') no-repeat center center / 100% 100%;
  }
  .secondary-menu-wrap {
    position: relative;
    display: flex;
    justify-content: center;
    margin-top: 3.7rem;
    width: 180rem;
    height: 4rem;
    .result-visualization {
      cursor: pointer;
      position: absolute;
      left: 0;
      top: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 14.4rem;
      height: 100%;
      background: url("./assets/result-visualization-bg.png") no-repeat 0 0 / 100% 100%;
      font-family: YouSheBiaoTiHei;
      font-size: 2rem;
      letter-spacing: 0.05em;
      img {
        width: 1.8rem;
        height: 1.8rem;
      }
      .text {
        margin-left: 0.8rem;
        background: linear-gradient(180deg, #FFFFFF 0%, #A1DAF7 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
    }
    .secondary-menu {
      width: 108.7rem;
      height: 100%;
      .el-radio-group {
        justify-content: space-between;
        width: 100%;
        height: 100%;
        .el-radio-button {
          width: 20.3rem;
          height: 100%;
          background: url("./assets/secondary-menu-bg.png") no-repeat 0 0 / 100% 100%;
          --el-radio-button-checked-bg-color: transparent;
          :deep(.el-radio-button__inner) {
            border: none;
            width: 100%;
            height: 100%;
            background: transparent;
            font-family: YouSheBiaoTiHei;
            font-size: 2rem;
            font-weight: normal;
            letter-spacing: 0.1em;
            color: rgba(161, 218, 247, 0.88);
            text-shadow: 0 0.2rem 0.2rem #021C34;
          }
        }
        .el-radio-button.is-active {
          background: url("./assets/checked-secondary-menu-bg.png") no-repeat 0 0 / 100% 100%;
          :deep(.el-radio-button__inner) {
            color: #FFFFFF;
            box-shadow: none;
          }
        }
      }
    }
  }
  .safety-assessment-content {
    margin-top: 2.3rem;
    margin-bottom: 5rem;
    width: 180rem;
    flex-grow: 1;
    overflow: hidden;
    // height: 84rem;
  }
}
</style>
