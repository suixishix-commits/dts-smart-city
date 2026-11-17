<template>
  <aside class="security-right">
    <!-- 警情和视频告警都是「待处置」清单，放在同一张卡片里切换 -->
    <PanelCard title="告警中心">
      <template #extra>
        <SegmentedTabs v-model="alarmTab" :options="ALARM_TABS" label="告警类型" />
      </template>
      <div v-if="alarmTab === 'incident'" class="list-note">在办 {{ activeCount }} / 共 {{ incidents.length }} 起</div>
      <div v-else class="list-note">待确认 {{ pendingAlarms }} 条</div>
      <div v-if="alarmTab === 'incident'" class="list scroll">
        <button v-for="i in incidents" :key="i.id" type="button" class="row" :class="{ active: i.id === activeIncident }" @click="emit('incident', i.id)">
          <LevelTag :level="i.level" />
          <span class="main">
            <span class="name">{{ i.title }}</span>
            <span class="sub">{{ i.type }} · {{ i.place }}</span>
          </span>
          <span class="side">
            <span class="status" :class="{ open: i.status !== '已办结' }">{{ i.status }}</span>
            <span class="time">{{ i.time }}</span>
          </span>
        </button>
      </div>
      <div v-else class="list scroll">
        <button v-for="a in data.aiAlarms" :key="a.id" type="button" class="row" :class="{ active: a.id === activeAlarm }" @click="emit('alarm', a.id)">
          <LevelTag :level="a.level" />
          <span class="main">
            <span class="name">{{ a.title }}</span>
            <span class="sub">{{ a.cameraId }} · <i class="state" :class="ALARM_STATE_CLASS[a.status]">{{ a.status }}</i></span>
          </span>
          <span class="time">{{ a.time }}</span>
        </button>
      </div>
    </PanelCard>

    <!-- 片区事件量和重点防护区：都是「按地点看态势」 -->
    <PanelCard title="防控态势">
      <template #extra>
        <SegmentedTabs v-model="areaTab" :options="AREA_TABS" label="态势视角" />
      </template>
      <div v-if="areaTab === 'district'" class="list-note">今日 · 起 / 办结率</div>
      <div v-else class="list-note">驻守 {{ guardTotal }} 人</div>
      <!-- 柱：事件量；折线：办结率（右轴）。点柱子定位片区 -->
      <LineChart v-if="areaTab === 'district'" :option="districtOption" :height="182" label="各片区今日事件量与办结率" @select="onDistrict" />
      <div v-else class="list scroll short">
        <button v-for="z in data.zones" :key="z.id" type="button" class="row" :class="{ active: z.id === activeZone }" @click="emit('zone', z.id)">
          <span class="guard">{{ GUARD_TEXT[z.guardLevel] }}</span>
          <span class="main">
            <span class="name">{{ z.name }}</span>
            <span class="sub">驻守 {{ z.guards }} 人 · 周边摄像头 {{ z.cameras }} 路</span>
          </span>
          <span class="status" :class="{ open: z.status !== '正常' }">{{ z.status }}</span>
        </button>
      </div>
    </PanelCard>

    <PanelCard title="视频巡查" :extra="'在线率 ' + onlineRate + '% · ' + onlineCount + ' / ' + data.cameras.length" grow>
      <div class="cams">
        <CameraTile v-for="c in featured" :key="c.id" :camera="c" :active="c.id === activeCamera" @select="emit('camera', $event)" />
      </div>
    </PanelCard>
  </aside>
</template>

<script setup lang="ts">
import { NUM_FONT, TEXT_FONT } from '@/components/chart/chartTheme'
import { COLOR } from '@/scene/kit'
import { isActive } from '@/api/mock/security'
import type { AiAlarmStatus, SecurityData } from '@/types/security'
import type { Camera } from '@/types/smartCity'
import CameraTile from '@/views/overview/_components/CameraTile.vue'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  data: SecurityData
  activeIncident: string | null
  activeZone: string | null
  activeCamera: string | null
  activeAlarm: string | null
  activeDistrict: string | null
}>()
const emit = defineEmits<{
  (e: 'incident', id: string): void
  (e: 'zone', id: string): void
  (e: 'camera', id: string): void
  (e: 'alarm', id: string): void
  (e: 'district', id: string): void
}>()

const ALARM_TABS = [
  { key: 'incident', name: '实时警情' },
  { key: 'ai', name: '视频告警' }
]
const AREA_TABS = [
  { key: 'district', name: '片区事件' },
  { key: 'zone', name: '防护区' }
]
const alarmTab = ref('incident')
const areaTab = ref('district')
// 在场景里点了某类对象时，切到对应的清单
watch(() => props.activeAlarm, id => id && (alarmTab.value = 'ai'))
watch(() => props.activeIncident, id => id && (alarmTab.value = 'incident'))
watch(() => props.activeZone, id => id && (areaTab.value = 'zone'))
watch(() => props.activeDistrict, id => id && (areaTab.value = 'district'))

/** 告警状态的文字样式：待确认用警示色，已了结的变灰 */
const ALARM_STATE_CLASS: Record<AiAlarmStatus, string> = { 待确认: 'pending', 已派单: 'sent', 已办结: 'done', 误报: 'done' }
/** 片区事件量列表展示的片区数 */
const DISTRICT_ROWS = 6

const GUARD_TEXT: Record<number, string> = { 1: '一级', 2: '二级', 3: '三级' }

/** 在办的排前面，同状态按等级从重到轻 */
const incidents = computed(() => [...props.data.incidents].sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || a.level - b.level))
const activeCount = computed(() => props.data.incidents.filter(isActive).length)
const pendingAlarms = computed(() => props.data.aiAlarms.filter(a => a.status === '待确认').length)
/** 事件量最多的几个片区 */
const districts = computed(() => props.data.eventStats.districts.slice(0, DISTRICT_ROWS))
const districtOption = computed(() => {
  const list = districts.value
  const active = props.activeDistrict
  return {
    grid: { left: 8, right: 8, top: 24, bottom: 24 },
    legend: { show: false },
    xAxis: { type: 'category', data: list.map(d => d.name), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } }, axisTick: { show: false }, axisLabel: { color: '#9aa4b2', fontSize: 12, fontFamily: TEXT_FONT, interval: 0 } },
    yAxis: [
      { type: 'value', show: false, splitLine: { show: false } },
      { type: 'value', min: 0, max: 100, show: false, splitLine: { show: false } }
    ],
    series: [
      {
        name: '事件量',
        type: 'bar',
        barWidth: 14,
        color: COLOR.accent,
        label: { show: true, position: 'top', color: '#f3f5f8', fontSize: 13, fontWeight: 600, fontFamily: NUM_FONT },
        data: list.map(d => ({ value: d.total, itemStyle: active && d.districtId !== active ? { opacity: 0.35 } : undefined }))
      },
      {
        name: '办结率 %',
        type: 'line',
        yAxisIndex: 1,
        color: '#66d9e8',
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 1.5, color: '#66d9e8', type: 'dashed' },
        data: list.map(d => Math.round(d.closeRate * 1000) / 10)
      }
    ]
  }
})

function onDistrict(item: { dataIndex: number; seriesIndex: number }) {
  const d = districts.value[item.dataIndex]
  if (d) emit('district', d.districtId)
}
const guardTotal = computed(() => props.data.zones.reduce((n, z) => n + z.guards, 0))
const onlineCount = computed(() => props.data.cameras.filter(c => c.online).length)
const onlineRate = computed(() => (props.data.cameras.length ? ((onlineCount.value / props.data.cameras.length) * 100).toFixed(1) : '0.0'))
/** 离在办警情最近的 4 路摄像头，转成 CameraTile 要的结构 */
const featured = computed<Camera[]>(() =>
  props.data.featuredCameraIds.flatMap(id => {
    const c = props.data.cameras.find(x => x.id === id)
    return c ? [{ ...c, featured: true }] : []
  })
)
</script>

<style lang="scss" scoped>
.security-right {
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
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 3px 8px;
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
.guard {
  flex-shrink: 0;
  width: 40px;
  height: 22px;
  box-sizing: border-box;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: $accent-light;
  border: 1px solid $accent;
}
.main {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.name {
  font-size: $fs-body;
  color: $text-strong;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub {
  font-size: 12px;
  color: $text-muted;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.side {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}
.status,
.time {
  flex-shrink: 0;
  font-size: 12px;
  color: $text-muted;
}
.status.open {
  color: $level-2;
}
.state {
  font-style: normal;
  &.pending {
    color: $level-2;
  }
  &.sent {
    color: $accent-light;
  }
}
.district {
  gap: 12px;
  font-size: $fs-body;
}
.d-name {
  flex-shrink: 0;
  width: 80px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track {
  flex-grow: 1;
  height: 6px;
  border-radius: 3px;
  background: $track;
}
.fill {
  display: block;
  height: 6px;
  border-radius: 3px;
  background: $accent;
}
.d-total {
  flex-shrink: 0;
  width: 32px;
  text-align: right;
  font-weight: 600;
  color: $text-strong;
}
.d-rate {
  flex-shrink: 0;
  width: 52px;
  text-align: right;
  font-size: 12px;
  color: $text-muted;
}
.cams {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.list-note {
  margin: -8px 0 -4px;
  font-size: $fs-aux;
  color: $text-muted;
}
// 清单长的时候在卡片里滚动，不把整列撑出屏幕
.scroll {
  max-height: 258px;
  overflow: hidden auto;
  &.short {
    max-height: 182px;
  }
}
</style>
