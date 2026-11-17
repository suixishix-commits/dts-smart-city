<template>
  <aside class="lifeline-right">
    <PanelCard title="运行告警" :extra="'未办结 ' + data.alarms.length + ' 条 · 一二级 ' + urgent + ' 条'">
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

    <PanelCard title="影响分析" :extra="impact ? impact.alarm.shortTitle : ''">
      <p v-if="!impact" class="empty">选中一条告警后显示影响范围、受影响小区和预计恢复时间</p>
      <template v-else>
        <div class="impact-stats">
          <StatItem label="影响小区" :value="impact.alarm.analysis?.communities.length ?? 0" unit="个" />
          <StatItem label="影响用户" :value="(impact.alarm.analysis?.users ?? 0).toLocaleString()" unit="户" :color="LEVEL_COLOR[impact.alarm.level]" />
          <StatItem label="预计恢复" :value="impact.alarm.analysis?.recovery ?? '—'" />
        </div>
        <ul class="communities">
          <li v-for="c in impact.alarm.analysis?.communities ?? []" :key="c.name">
            <span class="name">{{ c.name }}</span>
            <span class="users">{{ c.users.toLocaleString() }} 户</span>
          </li>
        </ul>
        <button type="button" class="draw" :class="{ on: impact.drawn }" :aria-pressed="impact.drawn ? 'true' : 'false'" @click="emit('impact', impact.alarm.id)">
          {{ impact.drawn ? '已在场景中标出影响范围 · 点击收起' : '在场景中标出影响范围' }}
        </button>
      </template>
    </PanelCard>

    <!-- 抢修工单和桥梁健康：日常运维的两份清单，放在同一张卡片里切换 -->
    <PanelCard title="运维" grow>
      <template #extra>
        <SegmentedTabs v-model="opsTab" :options="OPS_TABS" label="运维清单" />
      </template>
      <div v-if="opsTab === 'order'" class="list-note">进行中 {{ openCount }} 单</div>
      <div v-else class="list-note">健康评分 · 技术状况</div>
      <div v-if="opsTab === 'order'" class="list">
        <button v-for="o in orders" :key="o.id" type="button" class="row" :class="{ active: o.targetId === activeAlarm || o.targetId === activeBridge }" @click="emit('order', o)">
          <span class="main">
            <span class="name">{{ o.title }}</span>
            <span class="sub">{{ o.kind === 'inspect' ? '巡检' : '抢修' }} · {{ o.crew }} · {{ o.status }}</span>
            <span class="track"><span class="fill" :style="{ width: o.progress + '%' }"></span></span>
          </span>
          <span class="eta">
            <span class="percent">{{ o.progress }}%</span>
            <span class="sub">预计 {{ o.eta }}</span>
          </span>
        </button>
      </div>
      <div v-else class="bridges">
        <button v-for="b in data.bridges" :key="b.id" type="button" class="bridge" :class="{ active: b.id === activeBridge }" :aria-label="b.name + ' 健康评分 ' + b.score" @click="emit('bridge', b.id)">
          <BarRow :name="b.shortName" :value="b.score" :percent="b.score" :color="bridgeColor(b.score)" :note="b.grade" />
        </button>
      </div>
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { bridgeStatus } from '@/api/mock/lifeline'
import { COLOR, LEVEL_COLOR } from '@/scene/kit'
import type { LifelineAlarm, LifelineData, WorkOrder } from '@/types/lifeline'
import { computed, ref, watch } from 'vue'
import { SYSTEM_NAME } from './names'

const props = defineProps<{
  data: LifelineData
  activeAlarm: string | null
  activeBridge: string | null
  /** 当前的影响分析：告警，以及影响范围是否已画在场景里；为 null 时显示空状态 */
  impact: { alarm: LifelineAlarm; drawn: boolean } | null
}>()
const emit = defineEmits<{
  (e: 'alarm', id: string): void
  (e: 'bridge', id: string): void
  (e: 'order', order: WorkOrder): void
  (e: 'impact', alarmId: string): void
}>()

const OPS_TABS = [
  { key: 'order', name: '抢修工单' },
  { key: 'bridge', name: '桥梁健康' }
]
const opsTab = ref('order')
// 在场景里点了桥梁时切到桥梁清单
watch(
  () => props.activeBridge,
  id => {
    if (id) opsTab.value = 'bridge'
  }
)

const urgent = computed(() => props.data.alarms.filter(a => a.level <= 2).length)
/** 面板只列前 4 张工单（新派发的在最前） */
const orders = computed(() => props.data.orders.slice(0, 4))
const openCount = computed(() => props.data.orders.filter(o => o.progress < 100).length)

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
    // 最多显示约 5 条，其余在列表内滚动
    max-height: 272px;
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
    background: rgba(76, 154, 255, 0.14);
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
.empty {
  margin: 0;
  font-size: $fs-aux;
  line-height: 20px;
  color: $text-muted;
}
.impact-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.communities {
  margin: -4px 0 0;
  padding: 0;
  list-style: none;
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    border-top: 1px solid $divider;
    font-size: $fs-aux;
  }
  .name {
    flex-grow: 1;
    font-size: $fs-aux;
    color: $text;
  }
  .users {
    flex-shrink: 0;
    color: $text-muted;
  }
}
.draw {
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: $radius-sm;
  font-family: inherit;
  font-size: $fs-aux;
  color: $text;
  background: none;
  cursor: pointer;
  &:hover,
  &.on {
    border-color: $accent;
    color: $accent-light;
  }
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
    background: rgba(76, 154, 255, 0.14);
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
.list-note {
  margin: -8px 0 -4px;
  font-size: $fs-aux;
  color: $text-muted;
}
</style>
