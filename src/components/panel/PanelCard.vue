<template>
  <section class="panel-card" :class="{ grow }">
    <!-- 四角角标：大屏面板的框架感，克制地只画短短一截 -->
    <i class="corner tl" aria-hidden="true"></i>
    <i class="corner tr" aria-hidden="true"></i>
    <i class="corner bl" aria-hidden="true"></i>
    <i class="corner br" aria-hidden="true"></i>
    <div class="head">
      <h2 class="title">{{ title }}<i class="stripes" aria-hidden="true"></i></h2>
      <div class="extra"><slot name="extra">{{ extra }}</slot></div>
    </div>
    <slot></slot>
  </section>
</template>

<script setup lang="ts">
defineProps<{ title: string; extra?: string; grow?: boolean }>()
</script>

<style lang="scss" scoped>
$corner: 10px;

.panel-card {
  position: relative;
  box-sizing: border-box;
  padding: $panel-padding;
  display: flex;
  flex-direction: column;
  gap: $panel-gap;
  pointer-events: all;
  @include glass;
  border-radius: $radius;
  // 顶边一道光：中间亮、两头渐隐
  &::before {
    content: '';
    position: absolute;
    left: 16%;
    right: 16%;
    top: -1px;
    height: 1px;
    background: linear-gradient(90deg, rgba(143, 192, 255, 0), rgba(143, 192, 255, 0.75), rgba(143, 192, 255, 0));
    pointer-events: none;
  }
  &.grow {
    flex-grow: 1;
    min-height: 0;
  }
}
.corner {
  position: absolute;
  width: $corner;
  height: $corner;
  border-color: rgba(143, 192, 255, 0.7);
  border-style: solid;
  border-width: 0;
  pointer-events: none;
  filter: drop-shadow(0 0 3px rgba(76, 154, 255, 0.6));
  &.tl {
    left: -1px;
    top: -1px;
    border-left-width: 1.5px;
    border-top-width: 1.5px;
    border-top-left-radius: $radius;
  }
  &.tr {
    right: -1px;
    top: -1px;
    border-right-width: 1.5px;
    border-top-width: 1.5px;
    border-top-right-radius: $radius;
  }
  &.bl {
    left: -1px;
    bottom: -1px;
    border-left-width: 1.5px;
    border-bottom-width: 1.5px;
    border-bottom-left-radius: $radius;
  }
  &.br {
    right: -1px;
    bottom: -1px;
    border-right-width: 1.5px;
    border-bottom-width: 1.5px;
    border-bottom-right-radius: $radius;
  }
}
// 标题栏：从左往右渐隐的蓝色光带，底边一道细线
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: (-$panel-padding) (-$panel-padding) 0;
  padding: 11px $panel-padding 10px;
  border-radius: $radius $radius 0 0;
  background:
    linear-gradient(90deg, rgba(76, 154, 255, 0.45), rgba(76, 154, 255, 0) 70%) bottom / 100% 1px no-repeat,
    linear-gradient(90deg, rgba(76, 154, 255, 0.16), rgba(76, 154, 255, 0.04) 45%, rgba(76, 154, 255, 0) 75%);
}
.title {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding-left: 12px;
  font-size: $fs-title;
  font-weight: 600;
  letter-spacing: 1px;
  color: $text-strong;
  white-space: nowrap;
  text-shadow: 0 0 12px rgba(76, 154, 255, 0.35);
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
    box-shadow: 0 0 8px rgba(76, 154, 255, 0.7);
  }
}
// 标题后三道斜纹，越往右越淡
.stripes {
  width: 22px;
  height: 8px;
  background: repeating-linear-gradient(-60deg, rgba(143, 192, 255, 0.55) 0 2px, transparent 2px 6px);
  mask-image: linear-gradient(90deg, #000, transparent);
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
