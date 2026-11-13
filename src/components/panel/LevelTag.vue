<template>
  <span class="level-tag" :class="'lv' + level">{{ TEXT[level] }}</span>
</template>

<script setup lang="ts">
defineProps<{ level: 1 | 2 | 3 | 4 }>()
const TEXT = { 1: '一级', 2: '二级', 3: '三级', 4: '四级' }
</script>

<style lang="scss" scoped>
.level-tag {
  flex-shrink: 0;
  width: 40px;
  height: 22px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: $bg-page;
  &.lv1 {
    background: $level-1;
  }
  &.lv2 {
    background: $level-2;
  }
  &.lv3 {
    background: $level-3;
  }
  &.lv4 {
    background: $level-4;
  }
}
</style>
