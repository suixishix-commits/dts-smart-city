<template>
  <div class="layout-right">
    <AlarmRightTop class="sidebar-top"></AlarmRightTop>
    <AlarmRightMiddle class="sidebar-middle"></AlarmRightMiddle>
    <AlarmRightBottom class="sidebar-bottom"></AlarmRightBottom>
  </div>
</template>

<script setup lang="ts">
import AlarmRightTop from './comp/AlarmRightTop.vue'
import AlarmRightMiddle from './comp/AlarmRightMiddle.vue'
import AlarmRightBottom from './comp/AlarmRightBottom.vue'
onMounted(async () => {})
</script>

<style lang="scss" scoped>
.layout-right {
  position: absolute;
  width: 41.2rem;
  height: calc(100% - 4rem);
  right: 2.9rem;
  margin: 1.6rem 0;
  display: flex;
  flex-flow: column nowrap;
  gap: 1%;
  pointer-events: all;
  overflow: hidden;
  .sidebar-top {
    height: 30%;
  }
  .sidebar-middle {
    height: 25%;
  }
  .sidebar-bottom {
    flex: 1;
  }
}
</style>
