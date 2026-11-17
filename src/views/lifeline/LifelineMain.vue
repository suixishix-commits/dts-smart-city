<template>
  <div v-if="data" class="lifeline-main">
    <LifelineLeft :data="data" />
    <LifelineRight
      :data="data"
      :active-alarm="activeAlarm"
      :active-bridge="activeBridge ?? activeFacility"
      :impact="impactView"
      @alarm="selectAlarm"
      @bridge="selectBridge"
      @order="onOrder"
      @impact="toggleImpact"
    />

    <SceneTools class="tools" :active="tools.active.value" @tool="tools.onTool" />
    <BaseLayerPanel v-if="tools.showLayers.value" class="base-layers" :state="tools.base" @change="tools.setBase" />

    <AlarmCard
      v-if="activeAlarmData"
      class="card"
      :alarm="activeAlarmData"
      :order="alarmOrder"
      :impact-on="impactDrawn === activeAlarmData.id"
      @close="clearSelection"
      @locate="locateAlarm"
      @impact="toggleImpact"
      @dispatch="dispatchAlarm"
    />
    <div v-else-if="detail" class="card stack">
      <DetailCard :detail="detail" @close="clearSelection" @action="onDetailAction" />
      <BridgeTrend v-if="activeBridgeData && trendOpen" :name="activeBridgeData.name" :points="bridgeTrend(activeBridgeData.id, data.hour)" :limit="JOINT_LIMIT" />
    </div>

    <!-- 图例只列当前打开的图层和选中告警带出的对象，和场景里看到的一一对应 -->
    <SceneLegend v-if="layers.length || valvesShown || impactDrawn" class="legend">
      <span v-if="on('water')" class="legend-item"><i class="line" :style="{ borderTopColor: PIPE_COLOR.water }"></i>供水</span>
      <span v-if="on('power')" class="legend-item"><i class="line dashed" :style="{ borderTopColor: PIPE_COLOR.power }"></i>电力</span>
      <span v-if="on('gas')" class="legend-item"><i class="line dashed" :style="{ borderTopColor: PIPE_COLOR.gas }"></i>燃气</span>
      <span v-if="on('drain')" class="legend-item"><i class="line" :style="{ borderTopColor: PIPE_COLOR.drain }"></i>排水</span>
      <span v-if="on('cooling')" class="legend-item"><i class="line" :style="{ borderTopColor: PIPE_COLOR.cooling }"></i>区域供冷</span>
      <template v-if="on('alarm')">
        <span class="legend-item"><i class="line thick" :style="{ borderTopColor: COLOR.danger }"></i>受影响管段</span>
        <span class="legend-item">
          <b>告警</b>
          <template v-for="lv in LEVELS" :key="lv.level"><i class="dot" :style="{ background: LEVEL_COLOR[lv.level] }"></i>{{ lv.text }}</template>
        </span>
      </template>
      <span v-if="impactAlarm" class="legend-item"><i class="area" :style="{ borderColor: LEVEL_COLOR[impactAlarm.level] }"></i>影响范围</span>
      <span v-if="valvesShown" class="legend-item"><i class="dot" :style="{ background: VALVE_COLOR }"></i>阀门</span>
      <span v-if="statusTitle" class="legend-item">
        <b>{{ statusTitle }}</b>
        <template v-for="(s, i) in STATUS" :key="s"><i class="dot" :style="{ background: STATUS_RAMP[i] }"></i>{{ s }}</template>
      </span>
    </SceneLegend>

    <LayerToggle v-model="layers" class="layers" :layers="LAYERS" @change="onLayer" />
  </div>
</template>

<script setup lang="ts">
import { getLifelineData } from '@/api/lifeline'
import { bridgeTrend, JOINT_LIMIT } from '@/api/mock/lifeline'
import DetailCard from '@/components/panel/DetailCard.vue'
import { useEscape } from '@/composables/useEscape'
import { useSceneTools } from '@/composables/useSceneTools'
import { cityBase } from '@/scene/CityBase'
import { DtsSceneApi } from '@/scene/DtsSceneApi'
import { COLOR, LEVEL_COLOR, STATUS_RAMP } from '@/scene/kit'
import type { DetailModel } from '@/types/detail'
import type { LifelineAlarm, LifelineData, WorkOrder } from '@/types/lifeline'
import emitter from '@/utils/emitter'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { highlightPins } from '@/scene/pinSelection'
import AlarmCard from './_components/AlarmCard.vue'
import BridgeTrend from './_components/BridgeTrend.vue'
import { bridgeDetail, facilityDetail, findFacility } from './details'
import LifelineLeft from './LifelineLeft.vue'
import LifelineRight from './LifelineRight.vue'
import { LifelineScene, PIPE_COLOR, PIPE_LAYERS, VALVE_COLOR } from './LifelineScene'
import { dispatchInspection, dispatchRepair, openOrderFor } from './orders'

/** 地下模式不是数据图层：打开时隐藏底座路网并显示全部管网 */
const UNDERGROUND = 'underground'
const LAYERS = [
  { key: 'water', name: '供水', on: true },
  { key: 'power', name: '电力', on: true },
  { key: 'alarm', name: '运行告警', on: true },
  { key: 'gas', name: '燃气', on: false },
  { key: 'drain', name: '排水内涝', on: false },
  { key: 'bridge', name: '桥梁', on: true },
  { key: 'cooling', name: '区域供冷', on: false },
  { key: UNDERGROUND, name: '地下模式', on: false }
]
const LEVELS = [
  { level: 1, text: '一级' },
  { level: 2, text: '二级' },
  { level: 3, text: '三级' },
  { level: 4, text: '四级' }
]
const STATUS = ['正常', '关注', '预警', '异常']
/** 场景里点击这些分组的标注：有在办告警的打开告警卡片，没有的打开设施详情 */
const FACILITY_GROUPS = ['sc_lifeline_alarm', 'sc_lifeline_substation', 'sc_lifeline_gas', 'sc_lifeline_flood', 'sc_lifeline_pump', 'sc_lifeline_cooling']

const data = ref<LifelineData | null>(null)
const layers = ref(LAYERS.filter(l => l.on).map(l => l.key))
const activeAlarm = ref<string | null>(null)
const activeBridge = ref<string | null>(null)
const activeFacility = ref<string | null>(null)
// 选中的对象在场景里换成高亮标注（类别色描边 + 外发光）
watch([activeAlarm, activeBridge, activeFacility], ids => highlightPins(ids))
/** 影响范围已画在场景里的告警 */
const impactDrawn = ref<string | null>(null)
/** 桥梁详情下方是否展开监测曲线 */
const trendOpen = ref(false)
/** 打开地下模式前各管网图层的开关状态，关闭时恢复 */
let pipesBeforeUnderground: string[] | null = null

let scene: LifelineScene | null = null
/** 卸载时 abort，结束对场景就绪的等待 */
const unmounting = new AbortController()

const on = (key: string) => layers.value.includes(key)
const findAlarm = (id: string | null): LifelineAlarm | null => data.value?.alarms.find(a => a.id === id) ?? null
const activeAlarmData = computed(() => findAlarm(activeAlarm.value))
const activeBridgeData = computed(() => data.value?.bridges.find(b => b.id === activeBridge.value) ?? null)
const alarmOrder = computed(() => (data.value && activeAlarm.value ? openOrderFor(data.value.orders, activeAlarm.value) : undefined))
const impactAlarm = computed(() => findAlarm(impactDrawn.value))
/** 选中告警带出的阀门标注 */
const valvesShown = computed(() => (activeAlarmData.value?.analysis?.valves.length ?? 0) > 0)

/** 影响分析卡片：画出的 > 选中的 > 最严重的一条有影响分析的告警 */
const impactView = computed(() => {
  const alarm = impactAlarm.value ?? (activeAlarmData.value?.analysis ? activeAlarmData.value : null) ?? data.value?.alarms.find(a => a.analysis) ?? null
  return alarm ? { alarm, drawn: impactDrawn.value === alarm.id } : null
})

/** 状态色图例的标题：列出当前打开的图层里用状态色的对象 */
const statusTitle = computed(() =>
  [on('power') && '变电站负荷', on('gas') && '调压站', on('drain') && '积水 / 泵站', on('cooling') && '供冷站', on('bridge') && '桥梁健康'].filter(Boolean).join(' · ')
)

/** 桥梁和设施的详情（告警有自己的卡片） */
const detail = computed<DetailModel | null>(() => {
  const d = data.value
  if (!d) return null
  if (activeBridge.value) return bridgeDetail(d, activeBridge.value, { order: openOrderFor(d.orders, activeBridge.value), trendOpen: trendOpen.value })
  if (activeFacility.value) return facilityDetail(d, activeFacility.value, openOrderFor(d.orders, activeFacility.value))
  return null
})

function formatHour(hour: number): string {
  const h = Math.floor(hour) % 24
  return String(h).padStart(2, '0') + ':' + String(Math.round((hour - Math.floor(hour)) * 60)).padStart(2, '0')
}

function clearSelection() {
  activeAlarm.value = null
  activeBridge.value = null
  activeFacility.value = null
  impactDrawn.value = null
  trendOpen.value = false
  scene?.clearAlarmContext()
}
useEscape(clearSelection)

function selectAlarm(id: string) {
  clearSelection()
  activeAlarm.value = id
  scene?.focusAlarm(id)
  scene?.showAlarmContext(id)
}

function locateAlarm(id: string) {
  scene?.focusAlarm(id)
}

/** 影响分析：画出 / 收起告警的影响范围；告警未选中时先选中它 */
function toggleImpact(id: string) {
  if (impactDrawn.value === id) {
    impactDrawn.value = null
    scene?.hideImpact()
    return
  }
  if (activeAlarm.value !== id) selectAlarm(id)
  impactDrawn.value = id
  scene?.showImpact(id)
}

/** 派发工单：新建抢修工单，已有则催办 */
function dispatchAlarm(id: string) {
  const alarm = findAlarm(id)
  if (data.value && alarm) data.value.orders = dispatchRepair(data.value.orders, alarm)
}

function selectBridge(id: string) {
  clearSelection()
  activeBridge.value = id
  scene?.focusBridge(id)
}

function selectFacility(id: string) {
  const f = data.value && findFacility(data.value, id)
  if (!f) return
  clearSelection()
  activeFacility.value = id
  scene?.focusAnchor(f.anchor)
}

function onDetailAction(key: string) {
  const d = data.value
  if (!d) return
  const bridge = activeBridgeData.value
  const facility = activeFacility.value ? findFacility(d, activeFacility.value) : null
  const eta = formatHour(d.hour + 2)
  if (key === 'trend') trendOpen.value = !trendOpen.value
  else if (key === 'inspect' && bridge) d.orders = dispatchInspection(d.orders, { id: bridge.id, name: bridge.name, crew: '桥梁养护组', eta })
  else if (key === 'inspect' && facility) d.orders = dispatchInspection(d.orders, { id: facility.id, name: facility.name, crew: facility.crew, eta })
  else if (key === 'locate' && facility) scene?.focusAnchor(facility.anchor)
}

/** 工单列表：抢修单打开告警，巡检单打开桥梁或设施 */
function onOrder(o: WorkOrder) {
  if (o.alarmId) selectAlarm(o.alarmId)
  else if (data.value?.bridges.some(b => b.id === o.targetId)) selectBridge(o.targetId)
  else selectFacility(o.targetId)
}

/** 地下模式：打开时显示全部管网、隐藏底座路网；关闭时恢复打开前的管网开关和路网 */
function setUnderground(enabled: boolean) {
  if (enabled) {
    pipesBeforeUnderground = PIPE_LAYERS.filter(on)
    const missing = PIPE_LAYERS.filter(k => !on(k))
    layers.value = [...layers.value, ...missing]
    missing.forEach(k => scene?.setLayerVisible(k, true))
  } else if (pipesBeforeUnderground) {
    const keep = pipesBeforeUnderground
    const off: string[] = PIPE_LAYERS.filter(k => !keep.includes(k))
    layers.value = layers.value.filter(k => !off.includes(k))
    off.forEach(k => scene?.setLayerVisible(k, false))
    pipesBeforeUnderground = null
  }
  scene?.setUnderground(enabled)
  tools.base.roads = !enabled
}

function onLayer(key: string, visible: boolean) {
  if (key === UNDERGROUND) setUnderground(visible)
  else scene?.setLayerVisible(key, visible)
}

/** 默认机位 [x, y, z, pitch, yaw] */
const HOME: number[] | null = gVar?.smartCity?.cameras?.lifeline ?? null

const tools = useSceneTools({
  reset: async () => {
    if (HOME) await __xapi.camera.set(HOME[0], HOME[1], HOME[2], HOME[3], HOME[4], 1.5)
  },
  // 巡航：从默认机位出发，先看一、二级告警，再看三座桥，最后回到默认机位
  tour: () => (HOME ? [HOME, ...(scene?.tourViews() ?? []), HOME] : [])
})

// 场景里点击标注：EventDispatcher 会按 groupId 派发事件，data.userData 是 JSON 字符串
function onFacilityClick(e: any) {
  const id = JSON.parse(e.data.userData).id
  const alarm = data.value?.alarms.find(a => a.id === id || a.facilityId === id)
  if (alarm) selectAlarm(alarm.id)
  else selectFacility(id)
}
function onBridgeClick(e: any) {
  selectBridge(JSON.parse(e.data.userData).id)
}

onMounted(async () => {
  const loaded = await getLifelineData()
  data.value = loaded

  FACILITY_GROUPS.forEach(g => emitter.on(g, onFacilityClick))
  emitter.on('sc_lifeline_bridge', onBridgeClick)

  const geo = await cityBase.start()
  if (!geo || unmounting.signal.aborted) return
  scene = new LifelineScene(new DtsSceneApi(), geo, {
    cameraView: HOME,
    pak: cityBase.pak,
    roads: cityBase
  })
  scene.setData(loaded)
  // 默认关闭的图层、以及场景就绪前用户已经切换过的图层
  for (const l of LAYERS) if (l.key !== UNDERGROUND) scene.setLayerVisible(l.key, on(l.key))
  scene.setUnderground(on(UNDERGROUND))
  await scene.enter()
})

onBeforeUnmount(async () => {
  unmounting.abort()
  FACILITY_GROUPS.forEach(g => emitter.off(g, onFacilityClick))
  emitter.off('sc_lifeline_bridge', onBridgeClick)
  // leave() 会同步发出「恢复底座路网」，排在下一个模块进入之前
  const leaving = scene?.leave()
  scene = null
  await leaving
})
</script>

<style lang="scss" scoped>
$scene-left: $page-margin + $panel-width + 24px; // 480
$scene-right: $scene-left;
// 图层开关的高度：按钮 44 + 内边距 8 + 描边 2
$toggle-height: 54px;

.lifeline-main {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.tools {
  position: absolute;
  left: $scene-left;
  top: $panel-top;
}
.base-layers {
  position: absolute;
  left: $scene-left + 64px;
  top: $panel-top;
}
.card {
  position: absolute;
  right: $scene-right;
  top: $panel-top;
}
// 桥梁详情下方可展开监测曲线
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
// 八个图层开关占满了底部右侧，图例放在它上面一行（仍在场景左下）
.legend {
  position: absolute;
  left: $scene-left;
  bottom: $page-margin + $toggle-height + 8px;
  white-space: nowrap;
}
// 图层多时图例换行（向上长），不越过右侧面板
.lifeline-main .legend {
  height: auto;
  min-height: 52px;
  box-sizing: border-box;
  max-width: calc(100% - #{$scene-left * 2});
  flex-wrap: wrap;
  row-gap: 4px;
  padding-top: 8px;
  padding-bottom: 8px;
  b {
    font-weight: 400;
    color: $text;
    margin-right: 2px;
  }
  i {
    display: inline-block;
    font-style: normal;
  }
  .line {
    width: 16px;
    height: 0;
    border-top: 3px solid $accent;
    &.dashed {
      border-top-style: dashed;
    }
    &.thick {
      border-top-width: 4px;
    }
  }
  .area {
    width: 14px;
    height: 10px;
    box-sizing: border-box;
    border: 2px solid $accent;
    border-radius: 2px;
  }
  .dot {
    width: 8px;
    height: 8px;
    margin-left: 4px;
    border-radius: 50%;
  }
}
.layers {
  position: absolute;
  right: $scene-right;
  bottom: $page-margin;
}
</style>
