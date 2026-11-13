<template>
  <div class="layout-main">
    <CollapsiblePanelV1
      ref="collapsiblePanel"
      leftPanelCustomClass="aside-Panel left-Panel widescreen"
      rightPanelCustomClass="aside-Panel right-panel widescreen"
    >
      <template #left>
        <!-- 子组件必须采用相对定位 --->
        <div class="static left-static1">在1920*1080、3840*2160分辨下试试效果</div>
        <div class="static left-static2">2</div>
      </template>
      <template #right>
        <!-- 子组件必须采用相对定位 --->
        <div class="static right-static1">3</div>
        <div class="static right-static2">4</div>
      </template>
      <template #rightUtils>
        <!-- 子组件可采用相对定位或绝对定位 --->
        <ModuleBBtnGroup></ModuleBBtnGroup>
      </template>
    </CollapsiblePanelV1>
  </div>
</template>

<script setup lang="ts">
import CollapsiblePanelV1 from '@/components/CollapsiblePanelV1.vue'
</script>

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
  :deep(.aside-Panel) {
    width: 20%;
    height: 100%;
    background-color: aquamarine;
    pointer-events: all;
    .content {
      display: flex;
      flex-flow: row wrap;
      gap: 1rem;
      width: 100%;
    }
    margin: 0.6rem 0 0rem 0;
  }

  // 单列统计表面
  :deep(.static) {
    width: 100%;
    height: 100%;
    background-color: rgb(93, 225, 104);
  }

  // 当分辨率宽度大于2000px时，将单列统计表变为两列
  @media (min-width: 2000px) {
    :deep(.static) {
      width: calc((100% - 1rem) / 2);
      height: 100%;
      background-color: rgb(32, 119, 227);
    }
    :deep(.widescreen) {
      width: 25%;
    }
  }
}
</style>
