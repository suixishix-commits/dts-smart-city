<template>
  <div v-if="data" class="environment-main">
    <EnvironmentLeft :data="data" :hour="hour" :index="index" :active-station="activeStation" @station="selectStation" />
    <EnvironmentRight :data="data" :alarms="alarms" :active-water="activeWater" :active-alarm="activeAlarm" @water="selectWater" @alarm="selectAlarm" />

    <SceneTools class="tools" :active="tools.active.value" @tool="tools.onTool" />
    <BaseLayerPanel v-if="tools.showLayers.value" class="base-layers" :state="tools.base" @change="tools.setBase" />

    <EnvStationCard v-if="activeStationData" class="card" :station="activeStationData" :hour="hour" :index="index" :alarm="stationAlarm" @close="clearSelection" @action="onStationAction" />
    <DetailCard v-else-if="detail" class="card" :detail="detail" @close="clearSelection" @action="onDetailAction" />

    <!-- 图例只列当前打开的图层，和场景里看到的一一对应 -->
    <SceneLegend v-if="layers.length" class="legend">
      <span v-if="shows('air') || shows('station')" class="legend-item">
        <b>{{ meta.name }}等级</b>
        <template v-for="(name, i) in AIR_LEVEL_NAMES" :key="name"><i class="swatch" :style="{ background: AIR_COLORS[i] }"></i>{{ name }}</template>
      </span>
      <span v-if="shows('air')" class="legend-item"><i class="region" :style="{ borderColor: AIR_COLORS[0] }"></i>片区</span>
      <span v-if="shows('station')" class="legend-item"><i class="pin" :style="{ background: AIR_COLORS[1] }"></i>监测站 · 读数</span>
      <span v-if="shows('source') && sourceLevels.length" class="legend-item">
        <i class="ring" :style="{ borderColor: LEVEL_COLOR[sourceLevels[0]] }"></i>污染源
        <template v-for="lv in sourceLevels" :key="lv"><i class="swatch" :style="{ background: LEVEL_COLOR[lv] }"></i>{{ LEVEL_NAMES[lv] }}</template>
      </span>
      <span v-if="shows('noise')" class="legend-item"><b>噪声柱</b>{{ NOISE_RANGE[0] }}<i class="ramp" :style="{ background: noiseRamp }"></i>{{ NOISE_RANGE[1] }} dB</span>
      <span v-if="shows('green')" class="legend-item"><i class="region fill" :style="{ borderColor: COLOR.ok }"></i>生态空间</span>
      <span v-if="shows('water')" class="legend-item">
        <b>近岸水质</b>
        <template v-for="g in WATER_GRADES" :key="g"><i class="pin" :style="{ background: WATER_COLORS[g] }"></i>{{ WATER_GRADE_NAMES[g] }}</template>
      </span>
    </SceneLegend>

    <TimeAxis class="axis" subject="空气质量变化" :now-hour="nowHour" :model-value="hour" :peak-hour="peakHour" @update:model-value="onHour" />

    <EnvIndexSwitch class="switch" :model-value="index" @update:model-value="onIndex" />
    <LayerToggle v-model="layers" class="layers" :layers="LAYERS" @change="onLayer" />
  </div>
</template>

<script setup lang="ts">
import { getEnvironmentData } from '@/api/environment'
import { AIR_INDEXES, AIR_LEVEL_NAMES, alarmsAt, WATER_GRADE_NAMES, worstHour } from '@/api/mock/environment'
import DetailCard from '@/components/panel/DetailCard.vue'
import { useEscape } from '@/composables/useEscape'
import { useSceneTools } from '@/composables/useSceneTools'
import { cityBase } from '@/scene/CityBase'
import { DtsSceneApi } from '@/scene/DtsSceneApi'
import { COLOR, LEVEL_COLOR, RAMP } from '@/scene/kit'
import type { DetailModel } from '@/types/detail'
import type { AirIndex, EnvAlarm, EnvironmentData, HandleStatus, WaterGrade } from '@/types/environment'
import emitter from '@/utils/emitter'
import TimeAxis from '@/views/overview/_components/TimeAxis.vue'
import dayjs from 'dayjs'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { highlightPins } from '@/scene/pinSelection'
import EnvIndexSwitch from './_components/EnvIndexSwitch.vue'
import EnvStationCard from './_components/EnvStationCard.vue'
import { nextStatus, sourceDetail, waterDetail, type EnvAction } from './details'
import EnvironmentLeft from './EnvironmentLeft.vue'
import EnvironmentRight from './EnvironmentRight.vue'
import { AIR_COLORS, ENV_LAYERS, EnvironmentScene, NOISE_RANGE, WATER_COLORS } from './EnvironmentScene'

const LAYERS = ENV_LAYERS.map(l => ({ key: l.key, name: l.name }))
const WATER_GRADES: WaterGrade[] = [1, 2, 3, 4]
const LEVEL_NAMES: Record<number, string> = { 1: '一级', 2: '二级', 3: '三级', 4: '四级' }
const STATION_EVENT = 'sc_environment_station'
const SOURCE_EVENT = 'sc_environment_source'
const WATER_EVENT = 'sc_environment_water'
/** 噪声色带，和场景里噪声柱用的是同一组颜色 */
const noiseRamp = `linear-gradient(to right, ${RAMP.join(', ')})`

const data = ref<EnvironmentData | null>(null)
// 当前真实时刻，取整到半小时
// 当前真实时刻，取整到半小时
const nowHour = Math.round((dayjs().hour() + dayjs().minute() / 60) * 2) / 2
const hour = ref(nowHour)
const index = ref<AirIndex>('aqi')
const layers = ref<string[]>(ENV_LAYERS.filter(l => l.on).map(l => l.key))
const activeStation = ref<string | null>(null)
const activeSource = ref<string | null>(null)
const activeWater = ref<string | null>(null)
const activeAlarm = ref<string | null>(null)
// 选中的对象在场景里换成高亮标注（类别色描边 + 外发光）
watch([activeStation, activeSource, activeWater, activeAlarm], ids => highlightPins(ids))
/** 本地处置状态（派发核查、标记办结后覆盖告警的初始状态），键为告警 id */
const statuses = ref<Record<string, HandleStatus>>({})

let scene: EnvironmentScene | null = null
/** 卸载时 abort，结束对场景就绪的等待 */
const unmounting = new AbortController()

const meta = computed(() => AIR_INDEXES.find(i => i.key === index.value) ?? AIR_INDEXES[0])
const activeStationData = computed(() => data.value?.stations.find(s => s.id === activeStation.value) ?? null)
/** 全岛均值最差的时刻，标在时间轴上 */
const peakHour = computed(() => (data.value ? worstHour(data.value, index.value) : 0))

/** 污染源实际出现的告警等级（图例只列场景里有的） */
const sourceLevels = computed(() => [...new Set(data.value?.sources.map(s => s.level) ?? [])].sort())

const shows = (key: string) => layers.value.includes(key)

/** 当前时刻的超标告警（叠加本地处置状态）：未办结的在前，同类按等级 */
const alarms = computed<EnvAlarm[]>(() => {
  if (!data.value) return []
  return alarmsAt(data.value, hour.value)
    .map(a => ({ ...a, status: statuses.value[a.id] ?? a.status }))
    .sort((a, b) => Number(a.status === '已办结') - Number(b.status === '已办结') || a.level - b.level)
})
const statusOf = (alarmId: string): HandleStatus | null => alarms.value.find(a => a.id === alarmId)?.status ?? null

/** 站点卡片里显示的告警：从告警列表点进来的那条，否则取本站当前最严重的一条 */
const stationAlarm = computed<EnvAlarm | null>(() => {
  const id = activeStation.value
  if (!id) return null
  const own = alarms.value.filter(a => a.kind === 'station' && a.targetId === id)
  return own.find(a => a.id === activeAlarm.value) ?? own[0] ?? null
})

/** 污染源、水质采样点的通用详情（监测站有自己的卡片） */
const detail = computed<DetailModel | null>(() => {
  const source = data.value?.sources.find(s => s.id === activeSource.value)
  if (source) return sourceDetail(source, statusOf('source:' + source.id) ?? source.status)
  const sample = data.value?.waterSamples.find(w => w.id === activeWater.value)
  if (sample) return waterDetail(sample, statusOf('water:' + sample.id))
  return null
})

function clearSelection() {
  activeStation.value = null
  activeSource.value = null
  activeWater.value = null
  activeAlarm.value = null
}
useEscape(clearSelection)

/** 打开某个图层（定位到被关掉的图层里的对象时用） */
function ensureLayer(key: string) {
  if (layers.value.includes(key)) return
  layers.value = [...layers.value, key]
  onLayer(key, true)
}

/** 派发核查 / 标记办结：在本地更新告警的处置状态 */
function updateStatus(alarmId: string, action: EnvAction) {
  const status = statusOf(alarmId)
  if (status) statuses.value = { ...statuses.value, [alarmId]: nextStatus(status, action) }
}

function selectStation(id: string) {
  clearSelection()
  activeStation.value = id
  scene?.focusStation(id)
}

function selectSource(id: string) {
  clearSelection()
  activeSource.value = id
  scene?.focusSource(id)
}

function selectWater(id: string) {
  clearSelection()
  activeWater.value = id
  // 采样点在水质图层里，默认关闭；选中时打开，场景里能看到它
  ensureLayer('water')
  scene?.focusWater(id)
}

/** 点击告警：飞到对应的监测站 / 污染源 / 采样点并打开它的卡片 */
function selectAlarm(id: string) {
  const alarm = alarms.value.find(a => a.id === id)
  if (!alarm) return
  if (alarm.kind === 'station') selectStation(alarm.targetId)
  else if (alarm.kind === 'source') selectSource(alarm.targetId)
  else selectWater(alarm.targetId)
  activeAlarm.value = id
}

/** 通用详情卡片上的操作 */
function onDetailAction(key: string) {
  const action = key as EnvAction
  if (activeSource.value) {
    if (action === 'locate') {
      ensureLayer('source')
      scene?.focusSource(activeSource.value)
    } else updateStatus('source:' + activeSource.value, action)
  } else if (activeWater.value) {
    if (action === 'locate') {
      ensureLayer('water')
      scene?.focusWater(activeWater.value)
    } else updateStatus('water:' + activeWater.value, action)
  }
}

/** 站点卡片上的告警操作 */
function onStationAction(action: EnvAction) {
  if (stationAlarm.value) updateStatus(stationAlarm.value.id, action)
}

function onHour(v: number) {
  hour.value = v
  scene?.setHour(v)
}

function onIndex(v: AirIndex) {
  index.value = v
  scene?.setIndex(v)
}

function onLayer(key: string, visible: boolean) {
  scene?.setLayerVisible(key, visible)
}

/** 默认机位 [x, y, z, pitch, yaw] */
const HOME: number[] | null = gVar?.smartCity?.cameras?.environment ?? null

const tools = useSceneTools({
  reset: async () => {
    if (HOME) await __xapi.camera.set(HOME[0], HOME[1], HOME[2], HOME[3], HOME[4], 1.5)
  },
  // 巡航：从默认机位出发，依次俯瞰最差的监测站和各污染源，再回到默认机位
  tour: () => (HOME ? [HOME, ...(scene?.tourViews() ?? []), HOME] : [])
})

// 场景里点击标注：EventDispatcher 会按 groupId 派发事件，data.userData 是 JSON 字符串
function onStationClick(e: any) {
  selectStation(JSON.parse(e.data.userData).id)
}
function onSourceClick(e: any) {
  selectSource(JSON.parse(e.data.userData).id)
}
function onWaterClick(e: any) {
  selectWater(JSON.parse(e.data.userData).id)
}

onMounted(async () => {
  const loaded = await getEnvironmentData()
  data.value = loaded

  emitter.on(STATION_EVENT, onStationClick)
  emitter.on(SOURCE_EVENT, onSourceClick)
  emitter.on(WATER_EVENT, onWaterClick)

  const geo = await cityBase.start()
  if (!geo || unmounting.signal.aborted) return
  scene = new EnvironmentScene(new DtsSceneApi(), geo, { cameraView: HOME, pak: cityBase.pak, beacons: cityBase.beacons })
  scene.setData(loaded, hour.value, index.value)
  // 场景就绪前用户可能已经改过图层开关
  for (const l of LAYERS) scene.setLayerVisible(l.key, layers.value.includes(l.key))
  await scene.enter()
})

onBeforeUnmount(async () => {
  unmounting.abort()
  emitter.off(STATION_EVENT, onStationClick)
  emitter.off(SOURCE_EVENT, onSourceClick)
  emitter.off(WATER_EVENT, onWaterClick)
  await scene?.leave()
  scene = null
})
</script>

<style lang="scss" scoped>
$scene-left: $page-margin + $panel-width + 24px; // 480
$scene-right: $scene-left;

.environment-main {
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
  bottom: 92px;
}
.switch {
  position: absolute;
  left: $scene-left;
  bottom: $page-margin;
}
.layers {
  position: absolute;
  right: $scene-right;
  bottom: $page-margin;
}
// 图例放在时间轴上方单独一行：五个图层全开时条目较多，允许换行
.environment-main .legend {
  position: absolute;
  left: $scene-left;
  bottom: 168px;
  max-width: calc(100% - #{$scene-left} - #{$scene-right});
  box-sizing: border-box;
  height: auto;
  min-height: 52px;
  padding: 8px 16px;
  flex-wrap: wrap;
  row-gap: 8px;
  b {
    font-weight: 400;
    color: $text;
    margin-right: 2px;
  }
  i {
    display: inline-block;
    box-sizing: border-box;
    font-style: normal;
  }
  .swatch {
    width: 12px;
    height: 12px;
    margin-left: 4px;
    border-radius: 3px;
  }
  .region {
    width: 14px;
    height: 12px;
    border: 2px dotted;
    border-radius: 2px;
    &.fill {
      border-style: solid;
      background: rgba(81, 207, 102, 0.16);
    }
  }
  .pin {
    width: 8px;
    height: 8px;
    margin-left: 4px;
    border-radius: 50%;
  }
  .ring {
    width: 14px;
    height: 14px;
    border: 2px solid;
    border-radius: 50%;
  }
  .ramp {
    width: 96px;
    height: 8px;
    border-radius: 4px;
  }
}
</style>
