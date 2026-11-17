<template>
  <div v-if="data" class="traffic-main">
    <TrafficLeft :data="data" :hour="hour" :now-hour="nowHour" :active-segment="activeSegment" :active-vehicle="activeVehicle" @segment="selectSegment" @vehicle="selectVehicle" />
    <TrafficRight :data="data" :hour="hour" :active-incident="activeIncident" :active-signal="activeSignal" @incident="selectIncident" @signal="selectSignal" />

    <SceneTools class="tools" :active="tools.active.value" @tool="tools.onTool" />
    <BaseLayerPanel v-if="tools.showLayers.value" class="base-layers" :state="tools.base" @change="tools.setBase" />

    <TrafficIncidentCard
      v-if="activeIncidentData"
      class="card"
      :incident="activeIncidentData"
      :camera-index="cameraIndex"
      :detour-shown="detourShown"
      @close="clearSelection"
      @camera="nextCamera"
      @detour="toggleDetour"
    />
    <DetailCard v-else-if="detail" class="card" :detail="detail" @close="clearSelection" @action="onDetailAction" />

    <LayerToggle v-model="layers" class="layers" :layers="LAYERS" @change="onLayer" />

    <TimeAxis class="axis" subject="路况变化" :now-hour="nowHour" :model-value="hour" :peak-hour="peak.hour" @update:model-value="onHour" />

    <!-- 图例只列当前打开的图层，和场景里实际看到的东西一一对应 -->
    <SceneLegend class="legend">
      <span v-if="layers.includes('road')" class="legend-item">
        <b>路况</b>
        <template v-for="(name, i) in CONGESTION_TEXT" :key="name"><i class="bar" :style="{ background: STATUS_RAMP[i] }"></i>{{ name }}</template>
      </span>
      <span v-if="layers.includes('od')" class="legend-item">
        <b>通勤</b>
        <template v-if="flowPak"><i class="bar grad"></i>{{ inbound ? '居住区 → 商务区' : '商务区 → 居住区' }}</template>
        <template v-else><i class="bar thin" :style="{ background: COLOR.accentLight }"></i>一般<i class="bar thin" :style="{ background: COLOR.warn }"></i>最大两条</template>
      </span>
      <span v-if="layers.includes('vehicle')" class="legend-item">
        <b>车辆</b>
        <template v-for="k in VEHICLE_KINDS" :key="k"><i class="dot" :style="{ background: VEHICLE_COLOR[k] }"></i>{{ VEHICLE_TEXT[k] }}</template>
      </span>
      <span v-if="layers.includes('incident')" class="legend-item">
        <b>事件</b>
        <i class="dot" :style="{ background: INCIDENT_COLOR.accident }"></i>事故<i class="dot" :style="{ background: INCIDENT_COLOR.construction }"></i>施工 / 管制<i class="dot" :style="{ background: INCIDENT_COLOR.breakdown }"></i>故障
      </span>
      <span v-if="layers.includes('signal')" class="legend-item">
        <b>信号</b>
        <template v-for="s in SIGNAL_KEYS" :key="s"><i class="ring" :style="{ borderColor: SIGNAL_COLOR[s] }"></i>{{ SIGNAL_TEXT[s] }}</template>
      </span>
      <span v-if="detourShown" class="legend-item"><b>绕行</b><i class="bar" :style="{ background: DETOUR_COLOR }"></i>推荐路线</span>
      <span v-if="layers.length === 0 && !detourShown" class="legend-item">图层已全部关闭</span>
    </SceneLegend>
  </div>
</template>

<script setup lang="ts">
import { commuteAt, congestionAt, congestionLevel, CONGESTION_TEXT, nearbySignals, networkPeak, segmentSpeedAt, vehicleStateAt } from '@/api/mock/traffic'
import { getTrafficData } from '@/api/traffic'
import DetailCard from '@/components/panel/DetailCard.vue'
import { useEscape } from '@/composables/useEscape'
import { useSceneTools } from '@/composables/useSceneTools'
import { cityBase } from '@/scene/CityBase'
import { DtsSceneApi } from '@/scene/DtsSceneApi'
import { COLOR, STATUS_RAMP } from '@/scene/kit'
import type { DetailModel } from '@/types/detail'
import type { SignalStatus, TrafficData, VehicleKind } from '@/types/traffic'
import emitter from '@/utils/emitter'
import dayjs from 'dayjs'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { highlightPins } from '@/scene/pinSelection'
import TrafficIncidentCard from './_components/TrafficIncidentCard.vue'
import TrafficLeft from './TrafficLeft.vue'
import TrafficRight from './TrafficRight.vue'
import { DETOUR_COLOR, INCIDENT_COLOR, SIGNAL_COLOR, SIGNAL_TEXT, TrafficScene, VEHICLE_COLOR, VEHICLE_TEXT } from './TrafficScene'

const LAYERS = [
  { key: 'road', name: '实时路况' },
  { key: 'od', name: '通勤 OD' },
  { key: 'vehicle', name: '车辆轨迹' },
  { key: 'incident', name: '交通事件' },
  { key: 'signal', name: '信号路口' }
]
/** 默认打开的图层；通勤 OD、车辆轨迹、信号路口默认关闭，避免和路况抢视线 */
const DEFAULT_ON = ['road', 'incident']
const SIGNAL_KEYS: SignalStatus[] = ['normal', 'offline', 'manual']
const VEHICLE_KINDS: VehicleKind[] = ['bus', 'patrol', 'ambulance', 'wrecker']
/** 信号路口详情里可切换的周边路口数 */
const NEARBY_SIGNALS = 2

const data = ref<TrafficData | null>(null)
// 当前真实时刻，取整到半小时
const nowHour = Math.round((dayjs().hour() + dayjs().minute() / 60) * 2) / 2
const hour = ref(nowHour)
const layers = ref([...DEFAULT_ON])
const activeIncident = ref<string | null>(null)
const activeSignal = ref<string | null>(null)
const activeSegment = ref<string | null>(null)
const activeVehicle = ref<string | null>(null)
// 选中的对象在场景里换成高亮标注（类别色描边 + 外发光）
watch([activeIncident, activeSignal, activeSegment, activeVehicle], ids => highlightPins(ids))
/** 详情卡片里正在看第几路摄像头（「查看周边视频」轮换） */
const cameraPick = ref(0)
/** 场景里画着所选事件的绕行方案 */
const detourShown = ref(false)

let scene: TrafficScene | null = null
/** 卸载时 abort，结束对场景就绪的等待 */
const unmounting = new AbortController()

const peak = computed(() => (data.value ? networkPeak(data.value.segments) : { hour: 18, value: 0 }))
const inbound = computed(() => commuteAt(hour.value) === 'in')
/** 交通流光材质包挂上了：通勤图例画渐变（出发端冷蓝 → 到达端暖色） */
const flowPak = ref(false)
const activeIncidentData = computed(() => data.value?.incidents.find(i => i.id === activeIncident.value) ?? null)
const activeSignalData = computed(() => data.value?.signals.find(s => s.id === activeSignal.value) ?? null)
const activeSegmentData = computed(() => data.value?.segments.find(s => s.id === activeSegment.value) ?? null)
const activeVehicleData = computed(() => data.value?.vehicles.find(v => v.id === activeVehicle.value) ?? null)
const vehicleState = computed(() => (activeVehicleData.value && data.value ? vehicleStateAt(activeVehicleData.value, data.value.segments, hour.value) : null))

/** 当前选中对象可以切换的摄像头（所在路口 id），第一个是默认画面 */
const cameraChoices = computed<string[]>(() => {
  const d = data.value
  if (!d) return []
  if (activeIncidentData.value) return activeIncidentData.value.cameras.map(c => c.intersectionId)
  if (activeSignal.value) return [activeSignal.value, ...nearbySignals(d.signals, activeSignal.value, NEARBY_SIGNALS).map(s => s.id)]
  if (activeSegmentData.value) return activeSegmentData.value.junctions
  if (vehicleState.value?.nearest) return [vehicleState.value.nearest.intersectionId]
  return []
})
const cameraIndex = computed(() => (cameraChoices.value.length ? cameraPick.value % cameraChoices.value.length : 0))
/** 正在看的摄像头所在的路口 id */
const cameraAt = computed(() => cameraChoices.value[cameraIndex.value] ?? null)

/** 路口摄像头：编号取自信号路口，信号机离线时摄像头也离线 */
function cameraOf(intersectionId: string | null): DetailModel['camera'] {
  const s = data.value?.signals.find(x => x.id === intersectionId)
  return s ? { id: s.cameraId, online: s.status !== 'offline' } : undefined
}

const ROAD_LEVEL = ['主干路', '次干路', '支路']
const clock = (h: number) => String(Math.floor(h)).padStart(2, '0') + ':' + (h % 1 ? '30' : '00')
const signalName = (id: string | null) => data.value?.signals.find(s => s.id === id)?.name ?? '—'

/** 信号路口、路段、重点车辆的详情（交通事件有自己的卡片） */
const detail = computed<DetailModel | null>(() => {
  const d = data.value
  if (!d) return null
  const signal = activeSignalData.value
  if (signal) {
    const related = d.incidents.find(i => i.intersectionId === signal.id)
    return {
      tag: { text: SIGNAL_TEXT[signal.status], color: SIGNAL_COLOR[signal.status] },
      title: signal.name,
      camera: cameraOf(cameraAt.value),
      rows: [
        { label: '控制方式', value: signal.status === 'manual' ? '手动（原' + signal.mode + '）' : signal.mode },
        { label: '运行情况', value: signal.note || '信号机在线，配时正常' },
        { label: '关联事件', value: related?.title ?? '无' },
        { label: '画面', value: cameraAt.value === signal.id ? '本路口' : signalName(cameraAt.value) }
      ],
      actions: [{ key: 'nextCamera', label: '查看周边视频' }, related ? { key: 'incident', label: '查看事件' } : { key: 'locate', label: '定位路口' }]
    }
  }
  const segment = activeSegmentData.value
  if (segment) {
    const index = congestionAt(segment, hour.value)
    const level = congestionLevel(index)
    const junctions = segment.junctions
    return {
      tag: { text: CONGESTION_TEXT[level], color: STATUS_RAMP[level] },
      title: segment.name,
      camera: cameraOf(cameraAt.value),
      stats: [
        { label: '拥堵指数', value: index.toFixed(2), color: level >= 2 ? STATUS_RAMP[level] : undefined },
        { label: '平均车速', value: Math.round(segmentSpeedAt(segment, hour.value)), unit: 'km/h' },
        { label: '路段长度', value: segment.lengthKm.toFixed(1), unit: 'km' }
      ],
      rows: [
        { label: '所属道路', value: segment.roadName + ' · ' + ROAD_LEVEL[segment.level - 1] },
        { label: '数据时刻', value: clock(hour.value) + (hour.value === nowHour ? '（当前）' : '') },
        ...(junctions.length ? [{ label: '画面', value: signalName(cameraAt.value) }] : [])
      ],
      actions: junctions.length
        ? [{ key: 'junction', label: '查看路口' }, junctions.length > 1 ? { key: 'nextCamera', label: '查看周边视频' } : { key: 'locate', label: '定位路段' }]
        : [{ key: 'locate', label: '定位路段' }]
    }
  }
  const vehicle = activeVehicleData.value
  const state = vehicleState.value
  if (vehicle && state) {
    return {
      tag: { text: VEHICLE_TEXT[vehicle.kind], color: VEHICLE_COLOR[vehicle.kind] },
      title: vehicle.name,
      camera: cameraOf(cameraAt.value),
      stats: [
        { label: '车速', value: state.speed, unit: 'km/h' },
        { label: '方向', value: state.heading },
        { label: '距路口', value: state.nearestDistance, unit: 'm' }
      ],
      rows: [
        { label: '线路', value: vehicle.route },
        { label: '所在路段', value: state.segmentName },
        { label: '状态', value: vehicle.status },
        { label: '最近路口', value: state.nearest?.name ?? '—' },
        { label: '数据时刻', value: clock(hour.value) + (hour.value === nowHour ? '（当前）' : '') }
      ],
      actions: [{ key: 'locate', label: '跟随定位' }, ...(state.nearest ? [{ key: 'junction', label: '查看路口' }] : [])]
    }
  }
  return null
})

/** 同一时刻只选中一个对象：事件、信号路口、路段、车辆互斥；绕行方案跟着事件一起取消 */
function clearSelection() {
  activeIncident.value = null
  activeSignal.value = null
  activeSegment.value = null
  activeVehicle.value = null
  cameraPick.value = 0
  detourShown.value = false
  scene?.clearDetour()
}
useEscape(clearSelection)

function selectIncident(id: string) {
  clearSelection()
  activeIncident.value = id
  scene?.focusIncident(id)
}

/** 打开默认关闭的图层：定位前先打开，否则飞过去什么也看不到 */
async function ensureLayer(key: string) {
  if (layers.value.includes(key)) return
  layers.value = [...layers.value, key]
  await scene?.setLayerVisible(key, true)
}

async function selectSignal(id: string) {
  clearSelection()
  activeSignal.value = id
  await ensureLayer('signal')
  await scene?.focusSignal(id)
}

function selectSegment(id: string) {
  clearSelection()
  activeSegment.value = id
  scene?.focusSegment(id)
}

async function selectVehicle(id: string) {
  clearSelection()
  activeVehicle.value = id
  await ensureLayer('vehicle')
  await scene?.focusVehicle(id)
}

/** 查看周边视频：轮换到下一路摄像头，相机飞到该摄像头 */
function nextCamera() {
  if (cameraChoices.value.length < 2) return
  cameraPick.value = (cameraIndex.value + 1) % cameraChoices.value.length
  if (cameraAt.value) scene?.focusCamera(cameraAt.value)
}

/** 绕行方案：在场景里画出 / 收起所选事件的绕行路线 */
async function toggleDetour() {
  const incident = activeIncidentData.value
  if (!incident?.detour) return
  if (detourShown.value) {
    detourShown.value = false
    await scene?.clearDetour()
    return
  }
  detourShown.value = true
  await scene?.showDetour(incident.id)
}

/** 通用详情卡片的操作按钮 */
function onDetailAction(key: string) {
  const d = data.value
  if (!d) return
  if (key === 'nextCamera') return nextCamera()
  if (key === 'junction') {
    if (cameraAt.value) selectSignal(cameraAt.value)
    return
  }
  if (key === 'incident') {
    const related = d.incidents.find(i => i.intersectionId === activeSignal.value)
    if (related) selectIncident(related.id)
    return
  }
  if (key === 'locate') {
    if (activeSignal.value) scene?.focusSignal(activeSignal.value)
    else if (activeSegment.value) scene?.focusSegment(activeSegment.value)
    else if (activeVehicle.value) scene?.focusVehicle(activeVehicle.value)
  }
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
function onVehicleClick(e: any) {
  selectVehicle(JSON.parse(e.data.userData).id)
}

onMounted(async () => {
  const loaded = await getTrafficData()
  data.value = loaded

  emitter.on('sc_traffic_incident', onIncidentClick)
  emitter.on('sc_traffic_signal', onSignalClick)
  emitter.on('sc_traffic_vehicle', onVehicleClick)

  const geo = await cityBase.start()
  flowPak.value = cityBase.trafficFlow
  if (!geo || unmounting.signal.aborted) return
  scene = new TrafficScene(new DtsSceneApi(), geo, {
    cameraView: HOME,
    pak: cityBase.pak,
    beacons: cityBase.beacons,
    trafficFlow: cityBase.trafficFlow,
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
  emitter.off('sc_traffic_vehicle', onVehicleClick)
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
    &.grad {
      width: 40px;
      height: 3px;
      background: linear-gradient(90deg, #8cc8ff, #ffd4a8);
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
}
</style>
