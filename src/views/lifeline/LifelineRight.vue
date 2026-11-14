<template>
  <aside class="lifeline-right">
    <PanelCard title="运行告警" :extra="'未办结 ' + data.alarms.length + ' 条 · 一二级 ' + urgent + ' 条'" grow>
      <div class="list scroll">
        <button v-for="a in data.alarms" :key="a.id" type="button" class="row" :class="{ active: a.id === activeAlarm }" @click="emit('alarm', a.id)">
          <LevelTag :level="a.level" />
          <span class="main">
            <span class="name">{{ a.title }}</span>
            <span class="sub">{{ SYSTEM_NAME[a.system] }} · {{ a.area }} · {{ a.status }}</span>
          </span>
          <span class="time">{{ a.time }}</span>
        </button>
      </div>
    </PanelCard>

    <PanelCard title="桥梁健康" extra="健康评分 · 技术状况">
      <div class="bridges">
        <button v-for="b in data.bridges" :key="b.id" type="button" class="bridge" :class="{ active: b.id === activeBridge }" :aria-label="b.name + ' 健康评分 ' + b.score" @click="emit('bridge', b.id)">
          <BarRow :name="b.shortName" :value="b.score" :percent="b.score" :color="bridgeColor(b.score)" :note="b.grade" />
        </button>
      </div>
    </PanelCard>

    <PanelCard title="抢修工单" :extra="'进行中 ' + data.orders.length + ' 单'">
      <div class="list">
        <button v-for="o in orders" :key="o.id" type="button" class="row" :class="{ active: o.alarmId === activeAlarm }" @click="emit('alarm', o.alarmId)">
          <span class="main">
            <span class="name">{{ o.title }}</span>
            <span class="sub">{{ o.crew }} · {{ o.status }}</span>
            <span class="track"><span class="fill" :style="{ width: o.progress + '%' }"></span></span>
          </span>
          <span class="eta">
            <span class="percent">{{ o.progress }}%</span>
            <span class="sub">预计 {{ o.eta }}</span>
          </span>
        </button>
      </div>
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { bridgeStatus } from '@/api/mock/lifeline'
import { COLOR } from '@/scene/kit'
import type { LifelineData, LifelineSystem } from '@/types/lifeline'
import { computed } from 'vue'

const props = defineProps<{ data: LifelineData; activeAlarm: string | null; activeBridge: string | null }>()
const emit = defineEmits<{ (e: 'alarm', id: string): void; (e: 'bridge', id: string): void }>()

const SYSTEM_NAME: Record<LifelineSystem, string> = { water: '供水', power: '电力', gas: '燃气', drain: '排水', bridge: '桥梁' }

const urgent = computed(() => props.data.alarms.filter(a => a.level <= 2).length)
/** 面板只列前 4 张工单 */
const orders = computed(() => props.data.orders.slice(0, 4))

/** 与场景里桥梁标注的颜色一致 */
function bridgeColor(score: number): string {
  return bridgeStatus(score) === 0 ? COLOR.ok : COLOR.caution
}
</script>

<style lang="scss" scoped>
.lifeline-right {
  position: absolute;
  right: $page-margin;
  top: $panel-top;
  width: $panel-width;
  height: calc(100% - #{$panel-top} - #{$page-margin});
  display: flex;
  flex-direction: column;
  gap: $panel-gap;
}
.list {
  display: flex;
  flex-direction: column;
  margin-top: -8px;
  &.scroll {
    flex-grow: 1;
    min-height: 0;
    overflow-y: auto;
    // 滚动条不压住时间列
    margin-right: -8px;
    padding-right: 8px;
  }
}
.row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 6px 8px;
  margin: 0 -8px;
  border: 0;
  border-top: 1px solid $divider;
  border-radius: $radius-sm;
  text-align: left;
  font-family: inherit;
  color: $text;
  background: transparent;
  cursor: pointer;
  &.active {
    background: rgba(76, 196, 212, 0.14);
  }
}
.main {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.name {
  font-size: $fs-body;
  color: $text-strong;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub,
.time {
  font-size: $fs-aux;
  color: $text-muted;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.time {
  flex-shrink: 0;
}
.bridges {
  display: flex;
  flex-direction: column;
  margin: -8px 0;
}
.bridge {
  display: block;
  min-height: 44px;
  padding: 0 8px;
  margin: 0 -8px;
  border: 0;
  border-radius: $radius-sm;
  text-align: left;
  font-family: inherit;
  background: transparent;
  cursor: pointer;
  &.active {
    background: rgba(76, 196, 212, 0.14);
  }
}
.track {
  height: 4px;
  margin-top: 4px;
  border-radius: 2px;
  background: $track;
}
.fill {
  display: block;
  height: 4px;
  border-radius: 2px;
  background: $accent;
}
.eta {
  flex-shrink: 0;
  width: 76px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.percent {
  font-size: 16px;
  font-weight: 600;
  color: $text-strong;
}
</style>
