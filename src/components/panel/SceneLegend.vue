<template>
  <div class="scene-legend" role="group" aria-label="图例"><slot></slot></div>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.scene-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 52px;
  padding: 0 16px;
  font-size: $fs-aux;
  color: $text-muted;
  pointer-events: all;
  background: $bg-float;
  border: 1px solid $border;
  border-radius: $radius;
  :deep(.legend-item) {
    display: flex;
    align-items: center;
    gap: 6px;
  }
}
</style>
