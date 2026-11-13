<template>
  <div v-if="data" class="overview-main">
    <OverviewLeft :data="data" :hour="hour" :now-hour="nowHour" />
    <OverviewRight :data="data" :active-hotspot="activeHotspot" :active-camera="activeCamera" @hotspot="selectHotspot" @camera="selectCamera" />

    <SceneTools class="tools" :active="tools.active.value" @tool="tools.onTool" />
    <BaseLayerPanel v-if="tools.showLayers.value" class="base-layers" :state="tools.base" @change="tools.setBase" />

    <HotspotCard v-if="activeHotspotData" class="card" :hotspot="activeHotspotData" :rank="activeHotspotRank" @close="activeHotspot = null" @camera="selectCamera" />

    <TimeAxis class="axis" :model-value="hour" :peak-hour="peak.hour" @update:model-value="onHour" />

    <SceneLegend class="legend">
      <span class="legend-item"><b>人口密度</b>低<i class="ramp"></i>高</span>
      <span class="legend-item"><i class="pin">1</i>热点事件</span>
      <span class="legend-item"><i class="dot"></i>摄像头</span>
      <span class="legend-item"><i class="line"></i>片区（按密度着色）</span>
    </SceneLegend>

    <LayerToggle v-model="layers" class="layers" :layers="LAYERS" @change="onLayer" />
  </div>
</template>

<script setup lang="ts">
import { populationPeak } from '@/api/mock/population'
import { getOverviewData } from '@/api/overview'
import { useSceneTools } from '@/composables/useSceneTools'
import { DtsSceneApi } from '@/scene/DtsSceneApi'
import { cityBase } from '@/scene/CityBase'
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
  { key: 'district', name: '片区密度' }
]

const peak = populationPeak()
const data = ref<OverviewData | null>(null)
// 当前真实时刻，取整到半小时
const nowHour = Math.round((dayjs().hour() + dayjs().minute() / 60) * 2) / 2
const hour = ref(nowHour)
const layers = ref(LAYERS.map(l => l.key))
const activeHotspot = ref<string | null>(null)
const activeCamera = ref<string | null>(null)

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

  emitter.on('sc_hotspot', onHotspotClick)
  emitter.on('sc_camera', onCameraClick)

  const geo = await cityBase.start()
  if (!geo || unmounting.signal.aborted) return
  scene = new OverviewScene(new DtsSceneApi(), geo, {
    cameraView: gVar?.smartCity?.cameras?.overview ?? null,
    heatmapZ: gVar?.smartCity?.heatmapZ ?? [-50, 300],
    pak: cityBase.pak
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
