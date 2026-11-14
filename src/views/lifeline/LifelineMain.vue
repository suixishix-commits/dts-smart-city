<template>
  <div v-if="data" class="lifeline-main">
    <LifelineLeft :data="data" />
    <LifelineRight :data="data" :active-alarm="activeAlarm" :active-bridge="activeBridge" @alarm="selectAlarm" @bridge="selectBridge" />

    <SceneTools class="tools" :active="tools.active.value" @tool="tools.onTool" />
    <BaseLayerPanel v-if="tools.showLayers.value" class="base-layers" :state="tools.base" @change="tools.setBase" />

    <AlarmCard v-if="activeAlarmData" class="card" :alarm="activeAlarmData" @close="clearSelection" @locate="selectAlarm" />
    <DetailCard v-else-if="detail" class="card" :detail="detail" @close="clearSelection" />

    <!-- 图例只列当前打开的图层，和场景里看到的一一对应 -->
    <SceneLegend v-if="layers.length" class="legend">
      <span v-if="on('water')" class="legend-item"><i class="line" :style="{ borderTopColor: PIPE_COLOR.water }"></i>供水</span>
      <span v-if="on('power')" class="legend-item"><i class="line dashed" :style="{ borderTopColor: PIPE_COLOR.power }"></i>电力</span>
      <span v-if="on('gas')" class="legend-item"><i class="line dashed" :style="{ borderTopColor: PIPE_COLOR.gas }"></i>燃气</span>
      <span v-if="on('drain')" class="legend-item"><i class="line" :style="{ borderTopColor: PIPE_COLOR.drain }"></i>排水</span>
      <template v-if="on('alarm')">
        <span class="legend-item"><i class="line thick" :style="{ borderTopColor: COLOR.danger }"></i>受影响管段</span>
        <span class="legend-item">
          <b>告警</b>
          <template v-for="lv in LEVELS" :key="lv.level"><i class="dot" :style="{ background: LEVEL_COLOR[lv.level] }"></i>{{ lv.text }}</template>
        </span>
      </template>
      <span v-if="on('power') || on('gas') || on('drain') || on('bridge')" class="legend-item">
        <b>{{ statusTitle }}</b>
        <template v-for="(s, i) in STATUS" :key="s"><i class="dot" :style="{ background: STATUS_RAMP[i] }"></i>{{ s }}</template>
      </span>
    </SceneLegend>

    <LayerToggle v-model="layers" class="layers" :layers="LAYERS" @change="onLayer" />
  </div>
</template>

<script setup lang="ts">
import { getLifelineData } from '@/api/lifeline'
import { bridgeStatus } from '@/api/mock/lifeline'
import DetailCard from '@/components/panel/DetailCard.vue'
import { useEscape } from '@/composables/useEscape'
import { useSceneTools } from '@/composables/useSceneTools'
import { cityBase } from '@/scene/CityBase'
import { DtsSceneApi } from '@/scene/DtsSceneApi'
import { COLOR, LEVEL_COLOR, STATUS_RAMP } from '@/scene/kit'
import type { DetailModel } from '@/types/detail'
import type { LifelineData } from '@/types/lifeline'
import emitter from '@/utils/emitter'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AlarmCard from './_components/AlarmCard.vue'
import LifelineLeft from './LifelineLeft.vue'
import LifelineRight from './LifelineRight.vue'
import { LifelineScene, PIPE_COLOR } from './LifelineScene'

const LAYERS = [
  { key: 'water', name: '供水', on: true },
  { key: 'power', name: '电力', on: true },
  { key: 'alarm', name: '运行告警', on: true },
  { key: 'gas', name: '燃气', on: false },
  { key: 'drain', name: '排水内涝', on: false },
  { key: 'bridge', name: '桥梁', on: true }
]
const LEVELS = [
  { level: 1, text: '一级' },
  { level: 2, text: '二级' },
  { level: 3, text: '三级' },
  { level: 4, text: '四级' }
]
const STATUS = ['正常', '关注', '预警', '异常']
/** 场景里点击这些分组的标注都会打开关联的告警（没有告警的设施不响应） */
const FACILITY_GROUPS = ['sc_lifeline_alarm', 'sc_lifeline_substation', 'sc_lifeline_gas', 'sc_lifeline_flood', 'sc_lifeline_pump']

const data = ref<LifelineData | null>(null)
const layers = ref(LAYERS.filter(l => l.on).map(l => l.key))
const activeAlarm = ref<string | null>(null)
const activeBridge = ref<string | null>(null)

let scene: LifelineScene | null = null
/** 卸载时 abort，结束对场景就绪的等待 */
const unmounting = new AbortController()

const on = (key: string) => layers.value.includes(key)
const activeAlarmData = computed(() => data.value?.alarms.find(a => a.id === activeAlarm.value) ?? null)

/** 状态色图例的标题：列出当前打开的图层里用状态色的对象 */
const statusTitle = computed(() =>
  [on('power') && '变电站负荷', on('gas') && '调压站', on('drain') && '积水 / 泵站', on('bridge') && '桥梁健康'].filter(Boolean).join(' · ')
)

/** 桥梁的详情（告警有自己的卡片） */
const detail = computed<DetailModel | null>(() => {
  const bridge = data.value?.bridges.find(b => b.id === activeBridge.value)
  if (!bridge) return null
  const status = bridgeStatus(bridge.score)
  return {
    tag: { text: bridge.grade, color: STATUS_RAMP[status] },
    title: bridge.name,
    stats: [
      { label: '健康评分', value: bridge.score, color: status ? STATUS_RAMP[status] : undefined },
      { label: '在线传感器', value: bridge.sensors, unit: '个' },
      { label: '建成年份', value: bridge.builtYear }
    ],
    rows: [
      { label: '最近检测', value: bridge.lastInspect },
      {
        label: '在办告警',
        value:
          data.value?.alarms
            .filter(a => a.facilityId === bridge.id)
            .map(a => a.title)
            .join('、') || '无'
      }
    ]
  }
})

function clearSelection() {
  activeAlarm.value = null
  activeBridge.value = null
}
useEscape(clearSelection)

function selectAlarm(id: string) {
  clearSelection()
  activeAlarm.value = id
  scene?.focusAlarm(id)
}

function selectBridge(id: string) {
  clearSelection()
  activeBridge.value = id
  scene?.focusBridge(id)
}

function onLayer(key: string, visible: boolean) {
  scene?.setLayerVisible(key, visible)
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
  for (const l of LAYERS) scene.setLayerVisible(l.key, layers.value.includes(l.key))
  await scene.enter()
  // 本模块隐藏了底座路网，图层管理面板里的勾选跟着变
  if (scene) tools.base.roads = false
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
// 六个图层开关占满了底部右侧，图例放在它上面一行（仍在场景左下）
.legend {
  position: absolute;
  left: $scene-left;
  bottom: $page-margin + $toggle-height + 8px;
  white-space: nowrap;
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
