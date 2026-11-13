<template>
  <div v-if="data" class="traffic-main">
    <TrafficLeft :data="data" :hour="hour" :now-hour="nowHour" :active-segment="activeSegment" @segment="selectSegment" />
    <TrafficRight :data="data" :hour="hour" :active-incident="activeIncident" :active-signal="activeSignal" @incident="selectIncident" @signal="selectSignal" />

    <SceneTools class="tools" :active="tools.active.value" @tool="tools.onTool" />
    <BaseLayerPanel v-if="tools.showLayers.value" class="base-layers" :state="tools.base" @change="tools.setBase" />

    <TrafficIncidentCard v-if="activeIncidentData" class="card" :incident="activeIncidentData" @close="activeIncident = null" />

    <LayerToggle v-model="layers" class="layers" :layers="LAYERS" @change="onLayer" />

    <TimeAxis class="axis" :model-value="hour" :peak-hour="peak.hour" @update:model-value="onHour" />

    <!-- 图例只列当前打开的图层，和场景里实际看到的东西一一对应 -->
    <SceneLegend class="legend">
      <span v-if="layers.includes('road')" class="legend-item">
        <b>路况</b>
        <template v-for="(name, i) in CONGESTION_TEXT" :key="name"><i class="bar" :style="{ background: STATUS_RAMP[i] }"></i>{{ name }}</template>
      </span>
      <span v-if="layers.includes('od')" class="legend-item">
        <b>通勤 {{ inbound ? '进城' : '出城' }}</b>
        <i class="bar thin" :style="{ background: COLOR.accentLight }"></i>一般<i class="bar thin" :style="{ background: COLOR.warn }"></i>最大两条
      </span>
      <span v-if="layers.includes('incident')" class="legend-item">
        <b>事件</b>
        <i class="dot" :style="{ background: INCIDENT_COLOR.accident }"></i>事故<i class="dot" :style="{ background: INCIDENT_COLOR.construction }"></i>施工 / 管制<i class="dot" :style="{ background: INCIDENT_COLOR.breakdown }"></i>故障
      </span>
      <span v-if="layers.includes('signal')" class="legend-item">
        <b>信号</b>
        <template v-for="s in SIGNAL_KEYS" :key="s"><i class="ring" :style="{ borderColor: SIGNAL_COLOR[s] }"></i>{{ SIGNAL_TEXT[s] }}</template>
      </span>
      <span v-if="layers.includes('district')" class="legend-item"><b>片区拥堵</b>低<i class="ramp" :style="{ background: rampCss }"></i>高</span>
      <span v-if="layers.length === 0" class="legend-item">图层已全部关闭</span>
    </SceneLegend>
  </div>
</template>

<script setup lang="ts">
import { commuteAt, CONGESTION_TEXT, networkPeak } from '@/api/mock/traffic'
import { getTrafficData } from '@/api/traffic'
import { useSceneTools } from '@/composables/useSceneTools'
import { cityBase } from '@/scene/CityBase'
import { DtsSceneApi } from '@/scene/DtsSceneApi'
import { COLOR, RAMP, STATUS_RAMP } from '@/scene/kit'
import type { SignalStatus, TrafficData } from '@/types/traffic'
import emitter from '@/utils/emitter'
import dayjs from 'dayjs'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import TrafficIncidentCard from './_components/TrafficIncidentCard.vue'
import TrafficLeft from './TrafficLeft.vue'
import TrafficRight from './TrafficRight.vue'
import { INCIDENT_COLOR, SIGNAL_COLOR, SIGNAL_TEXT, TrafficScene } from './TrafficScene'

const LAYERS = [
  { key: 'road', name: '实时路况' },
  { key: 'od', name: '通勤 OD' },
  { key: 'incident', name: '交通事件' },
  { key: 'signal', name: '信号路口' },
  { key: 'district', name: '片区拥堵' }
]
/** 默认打开的图层；信号路口和片区拥堵默认关闭，避免画面过满 */
const DEFAULT_ON = ['road', 'od', 'incident']
const SIGNAL_KEYS: SignalStatus[] = ['normal', 'offline', 'manual']
/** 片区拥堵图例的色带，与场景用的 RAMP 相同 */
const rampCss = `linear-gradient(to right, ${RAMP.join(', ')})`

const data = ref<TrafficData | null>(null)
// 当前真实时刻，取整到半小时
const nowHour = Math.round((dayjs().hour() + dayjs().minute() / 60) * 2) / 2
const hour = ref(nowHour)
const layers = ref([...DEFAULT_ON])
const activeIncident = ref<string | null>(null)
const activeSignal = ref<string | null>(null)
const activeSegment = ref<string | null>(null)

let scene: TrafficScene | null = null
/** 卸载时 abort，结束对场景就绪的等待 */
const unmounting = new AbortController()

const peak = computed(() => (data.value ? networkPeak(data.value.segments) : { hour: 18, value: 0 }))
const inbound = computed(() => commuteAt(hour.value) === 'in')
const activeIncidentData = computed(() => data.value?.incidents.find(i => i.id === activeIncident.value) ?? null)

function selectIncident(id: string) {
  activeIncident.value = id
  scene?.focusIncident(id)
}

/** 信号路口图层默认关闭，定位前先打开，否则飞过去什么也看不到 */
async function selectSignal(id: string) {
  activeSignal.value = id
  if (!layers.value.includes('signal')) {
    layers.value = [...layers.value, 'signal']
    await scene?.setLayerVisible('signal', true)
  }
  await scene?.focusSignal(id)
}

function selectSegment(id: string) {
  activeSegment.value = id
  scene?.focusSegment(id)
}

function onHour(v: number) {
  hour.value = v
  scene?.setHour(v)
}

function onLayer(key: string, visible: boolean) {
  scene?.setLayerVisible(key, visible)
}

/** 默认机位 [x, y, z, pitch, yaw] */
const HOME: number[] | null = gVar?.smartCity?.cameras?.traffic ?? null

const tools = useSceneTools({
  reset: async () => {
    if (HOME) await __xapi.camera.set(HOME[0], HOME[1], HOME[2], HOME[3], HOME[4], 1.5)
  },
  // 巡航：从默认机位出发，依次俯瞰所选时刻最堵的路段，再回到默认机位
  tour: () => (HOME ? [HOME, ...(scene?.tourViews() ?? []), HOME] : [])
})

// 场景里点击标注：EventDispatcher 会按 groupId 派发事件，data.userData 是 JSON 字符串
function onIncidentClick(e: any) {
  selectIncident(JSON.parse(e.data.userData).id)
}
function onSignalClick(e: any) {
  selectSignal(JSON.parse(e.data.userData).id)
}

onMounted(async () => {
  const loaded = await getTrafficData()
  data.value = loaded

  emitter.on('sc_traffic_incident', onIncidentClick)
  emitter.on('sc_traffic_signal', onSignalClick)

  const geo = await cityBase.start()
  if (!geo || unmounting.signal.aborted) return
  scene = new TrafficScene(new DtsSceneApi(), geo, {
    cameraView: HOME,
    pak: cityBase.pak,
    setBaseRoads: visible => cityBase.setRoadsVisible(visible)
  })
  scene.setData(loaded, hour.value)
  // 场景就绪前用户可能已经切换了某些图层
  for (const l of LAYERS) scene.setLayerVisible(l.key, layers.value.includes(l.key))
  // 本模块自己画路况，底座路网在进入时隐藏；让「图层管理」里的开关显示真实状态
  tools.base.roads = false
  await scene.enter()
})

onBeforeUnmount(async () => {
  unmounting.abort()
  emitter.off('sc_traffic_incident', onIncidentClick)
  emitter.off('sc_traffic_signal', onSignalClick)
  await scene?.leave()
  scene = null
})
</script>

<style lang="scss" scoped>
$scene-left: $page-margin + $panel-width + 24px; // 480
$scene-right: $scene-left;
$axis-bottom: 100px;

.traffic-main {
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
.axis {
  position: absolute;
  left: $scene-left;
  right: $scene-right;
  bottom: $axis-bottom;
}
// 五个图层的图例放不进和图层开关同一行，所以图例独占底行（可折成两行），图层开关放在时间轴上方
.layers {
  position: absolute;
  right: $scene-right;
  bottom: $axis-bottom + 60px + 12px;
}
.legend {
  position: absolute;
  left: $scene-left;
  bottom: $page-margin;
  box-sizing: border-box;
  max-width: calc(100% - #{$scene-left} - #{$scene-right});
  height: auto;
  min-height: 36px;
  padding: 8px 16px;
  flex-wrap: wrap;
  gap: 6px 20px;
  :deep(.legend-item) {
    gap: 5px;
    white-space: nowrap;
  }
  b {
    font-weight: 400;
    color: $text;
    margin-right: 3px;
  }
  i {
    display: inline-block;
    flex-shrink: 0;
    font-style: normal;
    margin-left: 5px;
  }
  .bar {
    width: 14px;
    height: 4px;
    border-radius: 2px;
    &.thin {
      height: 2px;
    }
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .ring {
    width: 8px;
    height: 8px;
    box-sizing: border-box;
    border-radius: 50%;
    border: 2px solid;
  }
  .ramp {
    width: 72px;
    height: 8px;
    border-radius: 4px;
    margin-right: 5px;
  }
}
</style>
