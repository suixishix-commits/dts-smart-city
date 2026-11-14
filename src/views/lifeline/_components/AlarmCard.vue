<template>
  <div class="alarm-card">
    <div class="head">
      <LevelTag :level="alarm.level" />
      <h3 class="name">{{ SYSTEM_NAME[alarm.system] }} · {{ alarm.type }}</h3>
      <span class="time">{{ alarm.time }}</span>
      <button type="button" class="close" aria-label="关闭" @click="emit('close')">×</button>
    </div>
    <p class="title">{{ alarm.title }}</p>

    <dl class="facts">
      <dt>设施</dt>
      <dd>{{ alarm.facility }}</dd>
      <dt>位置</dt>
      <dd>{{ alarm.location }}（{{ alarm.area }}）</dd>
      <dt>影响</dt>
      <dd>{{ alarm.impact }}</dd>
      <dt>队伍</dt>
      <dd>{{ alarm.crew }}</dd>
    </dl>

    <div class="readings">
      <div v-for="r in alarm.readings" :key="r.label" class="reading">
        <span class="label">{{ r.label }}</span>
        <span class="value">{{ r.value }}</span>
        <span class="normal">{{ r.normal ? '正常 ' + r.normal : '' }}</span>
      </div>
    </div>

    <ol class="steps" :aria-label="'处置进度：' + alarm.status">
      <li v-for="s in alarm.steps" :key="s.name" class="step" :class="{ done: s.done }">
        <i class="dot" aria-hidden="true"></i>
        <span class="step-name">{{ s.name }}</span>
        <span class="step-time">{{ s.time }}</span>
      </li>
    </ol>

    <button type="button" class="primary" @click="emit('locate', alarm.id)">定位到现场</button>
  </div>
</template>

<script setup lang="ts">
import type { LifelineAlarm, LifelineSystem } from '@/types/lifeline'

defineProps<{ alarm: LifelineAlarm }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'locate', id: string): void }>()

const SYSTEM_NAME: Record<LifelineSystem, string> = { water: '供水', power: '电力', gas: '燃气', drain: '排水', bridge: '桥梁' }
</script>

<style lang="scss" scoped>
.alarm-card {
  width: 320px;
  box-sizing: border-box;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: all;
  background: rgba(17, 22, 30, 0.96);
  border: 1px solid $border-strong;
  border-radius: $radius;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.name {
  flex-grow: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: $text-strong;
}
.time {
  font-size: $fs-aux;
  color: $text-muted;
}
.close {
  width: 44px;
  height: 44px;
  margin: -10px -12px -10px -8px;
  border: 0;
  font-size: 20px;
  color: $text-muted;
  background: none;
  cursor: pointer;
}
.title {
  margin: 0;
  font-size: $fs-body;
  line-height: 20px;
  color: $text;
}
.facts {
  margin: 0;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 6px 8px;
  font-size: $fs-aux;
  line-height: 18px;
  dt {
    color: $text-muted;
  }
  dd {
    margin: 0;
    color: $text;
  }
}
.readings {
  display: flex;
  flex-direction: column;
  padding: 4px 12px;
  border-radius: 4px;
  background: $bg-inset;
}
.reading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-height: 30px;
  font-size: $fs-aux;
  & + & {
    border-top: 1px solid $divider;
  }
}
.label {
  width: 84px;
  color: $text-muted;
}
.value {
  flex-grow: 1;
  font-weight: 600;
  color: $text-strong;
}
.normal {
  color: $text-muted;
}
.steps {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: $fs-aux;
}
.step {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: $text-muted;
  .dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    box-sizing: border-box;
    border-radius: 50%;
    border: 1.5px solid #5d6b74;
  }
  &.done {
    color: $text;
    .dot {
      border-color: $accent;
      background: $accent;
    }
  }
}
.step-name {
  flex-grow: 1;
}
.step-time {
  flex-shrink: 0;
  color: $text-muted;
}
.primary {
  height: 44px;
  border: 0;
  border-radius: $radius-sm;
  font-family: inherit;
  font-size: $fs-body;
  font-weight: 500;
  color: $bg-page;
  background: $accent;
  cursor: pointer;
}
</style>
