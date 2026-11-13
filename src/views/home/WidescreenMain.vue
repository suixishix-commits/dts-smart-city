<template>
  <div class="layout-main">
    <div class="aside-Panel left-Panel widescreen">
      <div class="static left-static1">在1920*1080、3840*2160分辨下试试效果</div>
      <div class="static left-static2">2</div>
    </div>
    <div class="aside-Panel right-panel widescreen">
      <div class="static right-static1">3</div>
      <div class="static right-static2">4</div>
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.layout-main {
  position: absolute;
  width: 100%;
  height: calc(100% - $titleHeight - 1rem);
  margin-top: $titleHeight;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
  overflow: auto;
  // 两侧面板通用样式
  .aside-Panel {
    width: 20%;
    background-color: aquamarine;
    pointer-events: all;

    display: flex;
    flex-flow: row wrap;
    gap: 1rem;
  }

  // 左侧面板
  .left-Panel {
    margin-left: 1.2rem;
  }
  // 右侧面板
  .right-panel {
    margin-right: 1.2rem;
  }

  // 单列统计表面
  .static {
    width: 100%;
    height: 100%;
    background-color: rgb(93, 225, 104);
  }

  // 当分辨率宽度大于2000px时，将单列统计表变为两列
  @media (min-width: 2000px) {
    .static {
      width: calc((100% - 1rem) / 2);
      height: 100%;
      background-color: rgb(32, 119, 227);
    }
    .widescreen {
      width: 25%;
    }
  }
}
</style>
