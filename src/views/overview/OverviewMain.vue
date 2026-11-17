<template>
  <div v-if="data" class="overview-main">
    <OverviewLeft :data="data" :hour="hour" :now-hour="nowHour" :active-district="activeDistrict" @district="selectDistrict" />
    <OverviewRight :data="data" :active-hotspot="activeHotspot" :active-camera="activeCamera" :active-alarm="activeAlarm" @hotspot="selectHotspot" @camera="selectCamera" @alarm="selectAlarm" />

    <SceneTools class="tools" :active="tools.active.value" @tool="tools.onTool" />
    <BaseLayerPanel v-if="tools.showLayers.value" class="base-layers" :state="tools.base" @change="tools.setBase" />

    <HotspotCard
      v-if="activeHotspotData"
      class="card"
      :hotspot="activeHotspotData"
      :rank="activeHotspotRank"
      :cameras="hotspotCameras"
      :camera-id="activeCamera"
      :district-name="districtName(activeHotspotData.districtId)"
      :hour="hour"
      @close="clearSelection"
      @camera="activeCamera = $event"
      @locate="locateCamera"
    />
    <DetailCard v-else-if="detail" class="card" :detail="detail" @close="clearSelection" @action="onDetailAction" />

    <TimeAxis class="axis" :now-hour="nowHour" :model-value="hour" :peak-hour="peak.hour" @update:model-value="onHour" />

    <SceneLegend class="legend">
      <span v-if="layers.includes('heat')" class="legend-item"><b>人口热力</b>低<i class="steps"><i v-for="c in HEAT_STEPS" :key="c" :style="{ background: c }"></i></i>高</span>
      <span v-if="layers.includes('district')" class="legend-item"><b>片区密度</b>低<i class="steps"><i v-for="c in RAMP" :key="c" :style="{ background: c }"></i></i>高</span>
      <span v-if="layers.includes('hotspot')" class="legend-item"><i class="ring"></i>热点事件</span>
      <span v-if="layers.includes('camera')" class="legend-item"><i class="dot"></i>摄像头</span>
      <span class="legend-item"><i class="line"></i>路网</span>
    </SceneLegend>

    <LayerToggle v-model="layers" class="layers" :layers="LAYERS" @change="onLayer" />
  </div>
</template>

<script setup lang="ts">
import { districtDensityAt, populationPeak } from '@/api/mock/population'
import { hourText as formatHour } from '@/components/chart/chartTooltip'
import { getOverviewData } from '@/api/overview'
import DetailCard from '@/components/panel/DetailCard.vue'
import { useEscape } from '@/composables/useEscape'
import { useSceneTools } from '@/composables/useSceneTools'
import { COLOR, HEAT_STOPS, LEVEL_COLOR, RAMP, rampColor } from '@/scene/kit'
import { DtsSceneApi } from '@/scene/DtsSceneApi'
import { cityBase } from '@/scene/CityBase'
import store from '@/stores'
import type { DetailModel } from '@/types/detail'
import type { Camera, District, OverviewData } from '@/types/smartCity'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import emitter from '@/utils/emitter'
import dayjs from 'dayjs'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { highlightPins } from '@/scene/pinSelection'
import { OverviewScene } from './OverviewScene'

const LAYERS = [
  { key: 'heat', name: '人口热力' },
  { key: 'hotspot', name: '热点事件' },
  { key: 'camera', name: '摄像头' },
  { key: 'district', name: '片区密度' }
]

const LEVEL_TEXT: Record<number, string> = { 1: '一级', 2: '二级', 3: '三级', 4: '四级' }
/** 热力图例：与 kit.heatmap 的色带一致 */
const HEAT_STEPS = HEAT_STOPS.slice(2).map(s => s.color)
const peak = populationPeak()
const data = ref<OverviewData | null>(null)
// 当前真实时刻，取整到半小时
const nowHour = Math.round((dayjs().hour() + dayjs().minute() / 60) * 2) / 2
const hour = ref(nowHour)
// 首屏只开热力和热点：片区点阵与热力会大面积互相遮盖（见模块开发约定），片区密度、摄像头按需打开
const layers = ref(['heat', 'hotspot'])
const activeHotspot = ref<string | null>(null)
const activeCamera = ref<string | null>(null)
const activeAlarm = ref<string | null>(null)
const activeDistrict = ref<string | null>(null)
// 选中的对象在场景里换成高亮标注（类别色描边 + 外发光）
watch([activeHotspot, activeCamera, activeAlarm, activeDistrict], ids => highlightPins(ids))
/** 摄像头详情卡片是否在历史回放 */
const replay = ref(false)
/** 告警模块 → 路由 */
const MODULE_ROUTE: Record<string, string> = { 交通: '/traffic', 安全: '/security', 环境: '/environment', 生命线: '/lifeline' }
/** 历史回放往前推的分钟数 */
const REPLAY_MINUTES = 15
const router = useRouter()

let scene: OverviewScene | null = null
/** 卸载时 abort，结束对场景就绪的等待 */
const unmounting = new AbortController()

const sortedHotspots = computed(() => (data.value ? [...data.value.hotspots].sort((a, b) => b.heat - a.heat) : []))
const activeHotspotData = computed(() => sortedHotspots.value.find(h => h.id === activeHotspot.value) ?? null)
const activeHotspotRank = computed(() => sortedHotspots.value.findIndex(h => h.id === activeHotspot.value) + 1)

function districtName(id: string): string {
  return data.value?.districts.find(d => d.id === id)?.name ?? ''
}

/** WGS84 两点间的近似距离（米），只用来给摄像头排远近 */
function distance(a: [number, number], b: [number, number]): number {
  const k = Math.cos((a[1] * Math.PI) / 180)
  return Math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * 111320
}

/** 选中热点的周边摄像头：关联摄像头在前，其余按距离，最多 6 路 */
const hotspotCameras = computed<Camera[]>(() => {
  const h = activeHotspotData.value
  const cams = data.value?.cameras ?? []
  if (!h) return []
  const own = cams.filter(c => c.id === h.cameraId)
  const rest = cams.filter(c => c.id !== h.cameraId).sort((x, y) => distance(x.position, h.position) - distance(y.position, h.position))
  return [...own, ...rest].slice(0, 6)
})

/** 摄像头、告警的详情（热点事件有自己的卡片；选中热点时它的摄像头只是高亮，不换卡片） */
const detail = computed<DetailModel | null>(() => {
  const district = data.value?.districts.find(d => d.id === activeDistrict.value)
  if (district && data.value) return districtDetail(district, data.value)
  const alarm = store.alarmStore.alarms.find(x => x.id === activeAlarm.value)
  if (alarm) {
    return {
      tag: { text: LEVEL_TEXT[alarm.level], color: LEVEL_COLOR[alarm.level] },
      title: alarm.title,
      rows: [
        { label: '所属模块', value: alarm.module },
        { label: '所在片区', value: alarm.area },
        { label: '发生时间', value: alarm.time },
        { label: '处置要求', value: alarm.level <= 2 ? '立即处置，30 分钟内反馈' : '按时限处置，当日办结' }
      ],
      actions: [
        { key: 'goto', label: '前往处置' },
        { key: 'district', label: '定位片区' }
      ]
    }
  }
  const camera = data.value?.cameras.find(c => c.id === activeCamera.value)
  if (!camera) return null
  const watching = data.value?.hotspots.find(h => h.cameraId === camera.id)
  return {
    tag: { text: camera.online ? '在线' : '离线', color: camera.online ? COLOR.ok : COLOR.muted },
    title: camera.name,
    camera: { id: camera.id, online: camera.online, replayMinutes: replay.value ? REPLAY_MINUTES : 0 },
    rows: [
      { label: '设备编号', value: camera.id },
      { label: '视频信号', value: camera.online ? '正常' : '信号中断，已报修' },
      { label: '关联热点', value: watching?.name ?? '无' }
    ],
    actions: camera.online
      ? [
          { key: 'replay', label: replay.value ? '返回实时' : '回放 ' + REPLAY_MINUTES + ' 分钟前' },
          { key: 'locate', label: '定位摄像头' }
        ]
      : [{ key: 'locate', label: '定位摄像头' }]
  }
})

/** 片区卡片：当前密度、较 1 小时前、全岛排名、今日峰值时刻，以及片区里的热点 */
function districtDetail(d: District, all: OverviewData): DetailModel {
  const now = districtDensityAt(d, hour.value)
  const before = districtDensityAt(d, Math.max(0, hour.value - 1))
  const rank = [...all.districts].sort((a, b) => districtDensityAt(b, hour.value) - districtDensityAt(a, hour.value)).findIndex(x => x.id === d.id) + 1
  const peakHour = Array.from({ length: 48 }, (_, i) => i / 2).reduce((best, h) => (districtDensityAt(d, h) > districtDensityAt(d, best) ? h : best), 0)
  const spots = sortedHotspots.value.filter(h => h.districtId === d.id)
  const delta = now - before
  return {
    tag: { text: '第 ' + rank + ' 名', color: rampColor(now / 2.8) },
    title: d.name + '片区',
    stats: [
      { label: '当前密度', value: now.toFixed(2), unit: '万人/km²' },
      { label: '较 1 小时前', value: (delta >= 0 ? '+' : '') + delta.toFixed(2), color: delta > 0.005 ? COLOR.warn : undefined },
      { label: '今日峰值', value: formatHour(peakHour) }
    ],
    rows: [
      { label: '日间基准', value: d.baseDensity.toFixed(1) + ' 万人/km²' },
      { label: '片区热点', value: spots.length ? spots.map(h => h.shortName).join('、') : '暂无' }
    ],
    actions: spots.length
      ? [
          { key: 'district-hotspot', label: '查看热点' },
          { key: 'district-locate', label: '定位片区' }
        ]
      : [{ key: 'district-locate', label: '定位片区' }]
  }
}

function selectDistrict(id: string) {
  clearSelection()
  activeDistrict.value = id
  const d = data.value?.districts.find(x => x.id === id)
  if (d) scene?.focusDistrict(d.name)
}

/** 详情卡片按钮 */
async function onDetailAction(key: string) {
  if (key === 'district-hotspot') {
    const top = sortedHotspots.value.find(h => h.districtId === activeDistrict.value)
    if (top) selectHotspot(top.id)
    return
  }
  if (key === 'district-locate') {
    const d = data.value?.districts.find(x => x.id === activeDistrict.value)
    if (d) scene?.focusDistrict(d.name)
    return
  }
  const alarm = store.alarmStore.alarms.find(x => x.id === activeAlarm.value)
  if (alarm && key === 'goto') router.push(MODULE_ROUTE[alarm.module] ?? '/overview')
  else if (alarm && key === 'district') {
    if (scene && !(await scene.focusDistrict(alarm.area))) ElMessage.info('场景里没有片区「' + alarm.area + '」')
  } else if (key === 'replay') replay.value = !replay.value
  else if (key === 'locate' && activeCamera.value) scene?.focusCamera(activeCamera.value)
}

function clearSelection() {
  activeDistrict.value = null
  activeHotspot.value = null
  activeCamera.value = null
  activeAlarm.value = null
  replay.value = false
}
useEscape(clearSelection)

function selectHotspot(id: string) {
  clearSelection()
  activeHotspot.value = id
  const h = data.value?.hotspots.find(x => x.id === id)
  activeCamera.value = h?.cameraId ?? null
  scene?.focusHotspot(id)
}

/** 飞到某路摄像头，不改变当前的详情卡片（热点卡片里点摄像头时用） */
function locateCamera(id: string) {
  activeCamera.value = id
  if (!layers.value.includes('camera')) {
    layers.value = [...layers.value, 'camera']
    onLayer('camera', true)
  }
  scene?.focusCamera(id)
}

function selectCamera(id: string) {
  clearSelection()
  locateCamera(id)
}

/** 告警只带片区名，没有坐标：飞到所在片区 */
function selectAlarm(id: string) {
  clearSelection()
  activeAlarm.value = id
  const alarm = store.alarmStore.alarms.find(x => x.id === id)
  if (alarm) scene?.focusDistrict(alarm.area)
}

function onHour(v: number) {
  hour.value = v
  scene?.setHour(v)
}

function onLayer(key: string, visible: boolean) {
  scene?.setLayerVisible(key, visible)
}

/** 默认机位 [x, y, z, pitch, yaw] */
const HOME: number[] | null = gVar?.smartCity?.cameras?.overview ?? null

const tools = useSceneTools({
  reset: async () => {
    if (HOME) await __xapi.camera.set(HOME[0], HOME[1], HOME[2], HOME[3], HOME[4], 1.5)
  },
  // 巡航：从默认机位出发，依次俯瞰各热点事件，再回到默认机位
  tour: () => (HOME ? [HOME, ...(scene?.tourViews() ?? []), HOME] : [])
})

// 场景里点击标注：EventDispatcher 会按 groupId 派发事件，data.userData 是 JSON 字符串
function onHotspotClick(e: any) {
  selectHotspot(JSON.parse(e.data.userData).id)
}
function onCameraClick(e: any) {
  selectCamera(JSON.parse(e.data.userData).id)
}

onMounted(async () => {
  const loaded = await getOverviewData()
  data.value = loaded
  store.alarmStore.setAlarms(loaded.alarms)
  // 从别的模块点告警通知跳过来时，数据加载完再选中
  if (store.alarmStore.pending) {
    activeAlarm.value = store.alarmStore.pending
    store.alarmStore.pending = null
  }

  emitter.on('sc_hotspot', onHotspotClick)
  emitter.on('sc_camera', onCameraClick)

  const geo = await cityBase.start()
  if (!geo || unmounting.signal.aborted) return
  scene = new OverviewScene(new DtsSceneApi(), geo, {
    cameraView: gVar?.smartCity?.cameras?.overview ?? null,
    heatmapZ: gVar?.smartCity?.heatmapZ ?? [-50, 300],
    pak: cityBase.pak,
    beacons: cityBase.beacons,
    heatField: cityBase.heatField
  })
  scene.setData(loaded, hour.value)
  // 场景就绪前用户可能已经关掉了某些图层
  for (const l of LAYERS) scene.setLayerVisible(l.key, layers.value.includes(l.key))
  await scene.enter()
  // 场景就绪前从告警通知跳过来的：现在补上飞到片区
  if (activeAlarm.value) selectAlarm(activeAlarm.value)
})

// 顶部告警通知上点了「查看」：选中这条告警（打开详情卡片、飞到所在片区）
watch(
  () => store.alarmStore.pending,
  id => {
    if (!id || !data.value) return
    store.alarmStore.pending = null
    selectAlarm(id)
  }
)

onBeforeUnmount(async () => {
  unmounting.abort()
  emitter.off('sc_hotspot', onHotspotClick)
  emitter.off('sc_camera', onCameraClick)
  await scene?.leave()
  scene = null
})
</script>

<style lang="scss" scoped>
$scene-left: $page-margin + $panel-width + 24px; // 480
$scene-right: $scene-left;

.overview-main {
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
.legend {
  position: absolute;
  left: $scene-left;
  bottom: $page-margin;
  b {
    font-weight: 400;
    color: $text;
    margin-right: 2px;
  }
  i {
    display: inline-block;
    font-style: normal;
  }
  .steps {
    display: inline-flex;
    overflow: hidden;
    border-radius: 4px;
    i {
      width: 16px;
      height: 8px;
    }
  }
  .ring {
    width: 10px;
    height: 10px;
    box-sizing: border-box;
    border: 2px solid $level-2;
    border-radius: 50%;
  }
  .pin {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 700;
    line-height: 14px;
    text-align: center;
    color: $bg-page;
    background: $level-1;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: $accent;
  }
  .line {
    width: 16px;
    border-top: 2px solid $accent-light;
  }
}
.layers {
  position: absolute;
  right: $scene-right;
  bottom: $page-margin;
}
</style>
