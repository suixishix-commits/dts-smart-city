<template>
  <div class="layout-right">
    <AlarmRightTop class="sidebar-top"></AlarmRightTop>
    <AlarmRightMiddle class="sidebar-middle"></AlarmRightMiddle>
    <AlarmRightBottom class="sidebar-bottom"></AlarmRightBottom>
  </div>
</template>

<script setup lang="ts">
onMounted(async () => {})
</script>

<style lang="scss" scoped>
.layout-right {
  position: relative;
  width: 41.2rem;
  height: 100%;
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
