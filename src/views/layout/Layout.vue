<template>
  <TwinPlayer></TwinPlayer>
  <div id="layout-container">
    <AppHeader></AppHeader>
    <router-view />
    <AlarmToast />
    <!-- 地理底数据来自 OpenStreetMap（ODbL 要求署名） -->
    <a class="attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">地图数据 © OpenStreetMap contributors</a>
  </div>
</template>

<script setup lang="ts">
import AlarmToast from '@/components/panel/AlarmToast.vue'
import { useLiveAlarms } from '@/composables/useLiveAlarms'

// 模拟实时告警推送（顶部通知 + 城市总览的实时告警列表）
useLiveAlarms()
</script>

<style scoped lang="scss">
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
.attribution {
  position: absolute;
  left: $page-margin;
  bottom: 4px;
  font-size: 11px;
  line-height: 16px;
  color: $text-muted;
  text-decoration: none;
  opacity: 0.7;
  pointer-events: all;
  &:hover {
    opacity: 1;
    text-decoration: underline;
  }
}
</style>
