<template>
  <TwinPlayer></TwinPlayer>
  <div id="layout-container">
    <AppHeader></AppHeader>
    <router-view />
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
#layout-container {
  position: absolute;
  /* 窗口很小时由 index.html 的适配脚本给出 --ui-scale（<1），界面整体缩小；平时为 1，不起作用 */
  width: calc(100% / var(--ui-scale, 1));
  height: calc(100% / var(--ui-scale, 1));
  transform: scale(var(--ui-scale, 1));
  transform-origin: 0 0;
  z-index: 1;
  pointer-events: none;
}
</style>
