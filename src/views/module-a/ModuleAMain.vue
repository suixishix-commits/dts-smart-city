<template>
  <div class="layout-main">
    <RightAlarm></RightAlarm>
  </div>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.layout-main {
  position: absolute;
  width: 100%;
  height: calc(100% - $titleHeight);
  display: flex;
  margin-top: $titleHeight;
}
</style>
