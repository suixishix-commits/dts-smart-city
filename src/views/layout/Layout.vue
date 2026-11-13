<template>
  <TwinPlayer></TwinPlayer>
  <div id="layout-container">
    <Header module-name="default" shadow="shadow"></Header>
    <router-view />
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
#layout-container {
  position: absolute;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
  background: url('@/assets/framework/mask.png') no-repeat center center / 100% 100%;
}
</style>
