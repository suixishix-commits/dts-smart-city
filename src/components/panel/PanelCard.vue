<template>
  <section class="panel-card" :class="{ grow }">
    <div class="head">
      <h2 class="title">{{ title }}</h2>
      <div class="extra"><slot name="extra">{{ extra }}</slot></div>
    </div>
    <slot></slot>
  </section>
</template>

<script setup lang="ts">
defineProps<{ title: string; extra?: string; grow?: boolean }>()
</script>

<style lang="scss" scoped>
.panel-card {
  box-sizing: border-box;
  padding: $panel-padding;
  display: flex;
  flex-direction: column;
  gap: 16px;
  pointer-events: all;
  background: $bg-panel;
  border: 1px solid $border;
  border-radius: $radius;
  &.grow {
    flex-grow: 1;
    min-height: 0;
  }
}
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.title {
  font-size: $fs-title;
  font-weight: 600;
  color: $text-strong;
}
.extra {
  font-size: $fs-aux;
  color: $text-muted;
}
</style>
