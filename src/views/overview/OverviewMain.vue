<template>
  <div v-if="data" class="overview-main">
    <OverviewLeft :data="data" :hour="hour" :now-hour="nowHour" />
    <OverviewRight :data="data" :active-hotspot="activeHotspot" :active-camera="activeCamera" @hotspot="selectHotspot" @camera="selectCamera" />

    <SceneTools class="tools" :active="activeTools" @tool="onTool" />

    <HotspotCard v-if="activeHotspotData" class="card" :hotspot="activeHotspotData" :rank="activeHotspotRank" @close="activeHotspot = null" @camera="selectCamera" />

    <TimeAxis class="axis" :model-value="hour" :peak-hour="peak.hour" @update:model-value="onHour" />

    <SceneLegend class="legend">
      <span class="legend-item"><b>人口密度</b>低<i class="ramp"></i>高</span>
      <span class="legend-item"><i class="pin">1</i>热点事件</span>
      <span class="legend-item"><i class="dot"></i>摄像头</span>
      <span class="legend-item"><i class="line"></i>片区边界</span>
    </SceneLegend>

    <LayerToggle v-model="layers" class="layers" :layers="LAYERS" @change="onLayer" />
  </div>
</template>

<script setup lang="ts">
import { populationPeak } from '@/api/mock/population'
import { getOverviewData } from '@/api/overview'
import { DtsSceneApi } from '@/scene/DtsSceneApi'
import { whenSceneReady } from '@/scene/sceneReady'
import store from '@/stores'
import type { OverviewData } from '@/types/smartCity'
import emitter from '@/utils/emitter'
import dayjs from 'dayjs'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { OverviewScene } from './OverviewScene'

const LAYERS = [
  { key: 'heat', name: '人口热力' },
  { key: 'hotspot', name: '热点事件' },
  { key: 'camera', name: '摄像头' },
  { key: 'district', name: '片区边界' }
]

const peak = populationPeak()
const data = ref<OverviewData | null>(null)
// 当前真实时刻，取整到半小时
const nowHour = Math.round((dayjs().hour() + dayjs().minute() / 60) * 2) / 2
const hour = ref(nowHour)
const layers = ref(LAYERS.map(l => l.key))
const activeHotspot = ref<string | null>(null)
const activeCamera = ref<string | null>(null)
const activeTools = ref<string[]>([])

let scene: OverviewScene | null = null
/** 卸载时 abort，结束对场景就绪的等待 */
const unmounting = new AbortController()

const sortedHotspots = computed(() => (data.value ? [...data.value.hotspots].sort((a, b) => b.heat - a.heat) : []))
const activeHotspotData = computed(() => sortedHotspots.value.find(h => h.id === activeHotspot.value) ?? null)
const activeHotspotRank = computed(() => sortedHotspots.value.findIndex(h => h.id === activeHotspot.value) + 1)

function selectHotspot(id: string) {
  activeHotspot.value = id
  const h = data.value?.hotspots.find(x => x.id === id)
  if (h) activeCamera.value = h.cameraId
  scene?.focusHotspot(id)
}

function selectCamera(id: string) {
  activeCamera.value = id
  scene?.focusCamera(id)
}

function onHour(v: number) {
  hour.value = v
  scene?.setHour(v)
}

function onLayer(key: string, visible: boolean) {
  scene?.setLayerVisible(key, visible)
}

function toggleTool(key: string): boolean {
  const on = !activeTools.value.includes(key)
  activeTools.value = on ? [...activeTools.value, key] : activeTools.value.filter(k => k !== key)
  return on
}

async function onTool(key: string) {
  if (key === 'fullscreen') {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
    return
  }
  if (store.dtsStore.sceneState !== 'ready') return
  if (key === 'reset') {
    await scene?.leave()
    await scene?.enter()
  } else if (key === 'night') {
    __xapi.weather.setDarkMode(toggleTool('night'))
  } else if (key === 'rain') {
    if (toggleTool('rain')) __xapi.weather.setRainParam(0.3, 1, 1, null)
    else __xapi.weather.disableRainSnow(null)
  }
}

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

  emitter.on('sc_hotspot', onHotspotClick)
  emitter.on('sc_camera', onCameraClick)

  const ready = await whenSceneReady(unmounting.signal)
  if (!ready || unmounting.signal.aborted) return
  scene = new OverviewScene(new DtsSceneApi(), {
    cameraView: gVar?.smartCity?.cameras?.overview ?? null,
    heatmapZ: gVar?.smartCity?.heatmapZ ?? [-50, 300]
  })
  scene.setData(loaded, hour.value)
  // 场景就绪前用户可能已经关掉了某些图层
  for (const l of LAYERS) scene.setLayerVisible(l.key, layers.value.includes(l.key))
  await scene.enter()
})

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
  .ramp {
    width: 96px;
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(to right, $heat-low, $level-2, $level-1);
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
    border-top: 2px dashed #c9d1dc;
  }
}
.layers {
  position: absolute;
  right: $scene-right;
  bottom: $page-margin;
}
</style>
