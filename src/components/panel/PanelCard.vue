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
  gap: $panel-gap;
  pointer-events: all;
  @include glass;
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
  gap: 12px;
  // 标题下一道淡分隔线：从左往右渐隐，区分标题和内容又不切断卡片
  margin: 0 (-$panel-padding);
  padding: 0 $panel-padding 12px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 85%) bottom / 100% 1px no-repeat;
}
.title {
  position: relative;
  padding-left: 12px;
  font-size: $fs-title;
  font-weight: 600;
  letter-spacing: 0.4px;
  color: $text-strong;
  white-space: nowrap;
  // 标题前的短竖条：卡片的视觉锚点
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    width: 3px;
    height: 14px;
    border-radius: 2px;
    transform: translateY(-50%);
    background: linear-gradient(180deg, $accent-light, $accent);
    box-shadow: 0 0 8px rgba(76, 154, 255, 0.55);
  }
}
.extra {
  min-width: 0;
  font-size: $fs-aux;
  color: $text-muted;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
