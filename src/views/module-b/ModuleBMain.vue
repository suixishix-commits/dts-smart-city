<template>
  <div class="layout-main">
    <CollapsiblePanelV1 ref="collapsiblePanel" :rightSlotVisible="true" :leftSlotVisible="true">
      <template #left>
        <!-- 子组件必须采用相对定位 --->
        <AlarmLeft></AlarmLeft>
      </template>
      <template #right>
        <!-- 子组件必须采用相对定位 --->
        <AlarmRight></AlarmRight>
      </template>
      <template #rightUtils>
        <!-- 子组件可采用相对定位或绝对定位 --->
        <ModuleBBtnGroup></ModuleBBtnGroup>
      </template>
    </CollapsiblePanelV1>
  </div>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.layout-main {
  position: absolute;
  width: 100%;
  height: calc(100% - $titleHeight);
  display: flex;
  justify-content: space-between;
  margin-top: $titleHeight;
  pointer-events: none;
}
</style>
