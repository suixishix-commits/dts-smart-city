<template>
  <div class="alarm-card">
    <div class="head">
      <LevelTag :level="alarm.level" />
      <h3 class="name">{{ SYSTEM_NAME[alarm.system] }} · {{ alarm.type }}</h3>
      <span class="time">{{ alarm.time }}</span>
      <button type="button" class="icon" aria-label="定位到现场" title="定位到现场" @click="emit('locate', alarm.id)">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <path d="M8 0.5v3M8 12.5v3M0.5 8h3M12.5 8h3" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </button>
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
      <dt>建议</dt>
      <dd class="advice">{{ alarm.advice }}</dd>
    </dl>

    <div class="readings">
      <div v-for="r in alarm.readings" :key="r.label" class="reading">
        <span class="label">{{ r.label }}</span>
        <span class="value">{{ r.value }}</span>
        <span class="normal">{{ r.normal ? '正常 ' + r.normal : '' }}</span>
      </div>
    </div>

    <div v-if="impactOn && alarm.analysis" class="impact" aria-label="影响分析">
      <span
        ><b>{{ alarm.analysis.communities.length }}</b>个小区</span
      >
      <span
        ><b>{{ alarm.analysis.users.toLocaleString() }}</b>户</span
      >
      <span>预计 <b>{{ alarm.analysis.recovery }}</b> 恢复</span>
    </div>

    <p v-if="order" class="order">
      工单 {{ order.id }} · {{ order.status }} · 进度 {{ order.progress }}% · 预计 {{ order.eta }}
    </p>

    <ol class="steps" :aria-label="'处置进度：' + alarm.status">
      <li v-for="s in alarm.steps" :key="s.name" class="step" :class="{ done: s.done }">
        <i class="dot" aria-hidden="true"></i>
        <span class="step-name">{{ s.name }}</span>
        <span class="step-time">{{ s.time }}</span>
      </li>
    </ol>

    <div class="actions">
      <button v-if="alarm.analysis" type="button" class="primary" :aria-pressed="impactOn ? 'true' : 'false'" @click="emit('impact', alarm.id)">
        {{ impactOn ? '收起影响范围' : '影响分析' }}
      </button>
      <button v-else type="button" class="primary" @click="emit('locate', alarm.id)">定位到现场</button>
      <button type="button" class="secondary" @click="emit('dispatch', alarm.id)">{{ order ? '催办工单' : '派发工单' }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LifelineAlarm, WorkOrder } from '@/types/lifeline'
import { SYSTEM_NAME } from '../names'

defineProps<{
  alarm: LifelineAlarm
  /** 该告警未完成的工单 */
  order?: WorkOrder
  /** 影响范围是否已画在场景里 */
  impactOn: boolean
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'locate', id: string): void
  (e: 'impact', id: string): void
  (e: 'dispatch', id: string): void
}>()
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
.icon {
  width: 32px;
  height: 32px;
  margin: -6px -4px;
  border: 0;
  border-radius: $radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $text-muted;
  background: none;
  cursor: pointer;
  &:hover {
    color: $accent;
  }
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
    &.advice {
      color: $accent-light;
    }
  }
}
.impact {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: $fs-aux;
  color: $text-muted;
  background: rgba(76, 154, 255, 0.1);
  b {
    margin: 0 2px;
    font-size: 16px;
    font-weight: 600;
    color: $text-strong;
  }
}
.order {
  margin: 0;
  font-size: $fs-aux;
  color: $accent-light;
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
.actions {
  display: flex;
  gap: 8px;
  button {
    flex: 1 1 0;
    height: 44px;
    border-radius: $radius-sm;
    font-family: inherit;
    font-size: $fs-body;
    cursor: pointer;
  }
}
.primary {
  border: 0;
  font-weight: 500;
  color: $bg-page;
  background: $accent;
  &:hover {
    background: $accent-light;
  }
}
.secondary {
  color: $text;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  &:hover {
    border-color: $accent-light;
  }
}
</style>
