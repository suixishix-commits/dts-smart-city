<template>
  <TwinPlayer></TwinPlayer>
  <div id="layout-container">
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
}
</style>
