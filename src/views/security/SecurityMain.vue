<template>
  <div v-if="data" class="security-main">
    <SecurityLeft :data="data" :period="period" :now-hour="nowHour" />
    <SecurityRight :data="data" :active-incident="activeIncident" :active-zone="activeZone" :active-camera="activeCamera" @incident="selectIncident" @zone="selectZone" @camera="selectCamera" />

    <SceneTools class="tools" :active="tools.active.value" @tool="tools.onTool" />
    <BaseLayerPanel v-if="tools.showLayers.value" class="base-layers" :state="tools.base" @change="tools.setBase" />

    <SecurityIncidentCard v-if="activeIncidentData" class="card" :incident="activeIncidentData" :cameras="activeIncidentCameras" @close="activeIncident = null" @camera="selectCamera" />

    <!-- 图例只列当前打开的图层，和场景里看得到的对象一一对应 -->
    <SceneLegend v-if="layers.length" class="legend">
      <span v-if="layers.includes('fence')" class="legend-item"><i class="zone"></i>重点防护区</span>
      <span v-if="layers.includes('incident')" class="legend-item">
        <b>警情</b>
        <template v-for="l in LEVELS" :key="l.level"><i class="ring" :style="{ borderColor: l.color }"></i>{{ l.name }}</template>
      </span>
      <span v-if="layers.includes('patrol')" class="legend-item"><i class="route"></i>巡逻路线</span>
      <span v-if="layers.includes('patrol')" class="legend-item"><i class="dot unit"></i>巡逻单元</span>
      <span v-if="layers.includes('camera')" class="legend-item"><i class="dot online"></i>摄像头在线<i class="dot offline"></i>离线</span>
      <span v-if="layers.includes('camera') && hasCones" class="legend-item"><i class="cone"></i>监控视域</span>
      <span v-if="layers.includes('heat')" class="legend-item"><b>警情热力</b>低<i class="ramp"></i>高</span>
    </SceneLegend>

    <SecurityPeriodSwitch class="period" :model-value="period" @update:model-value="onPeriod" />
    <LayerToggle v-model="layers" class="layers" :layers="SECURITY_LAYERS" @change="onLayer" />
  </div>
</template>

<script setup lang="ts">
import { currentHour, getSecurityData } from '@/api/security'
import { useSceneTools } from '@/composables/useSceneTools'
import { cityBase } from '@/scene/CityBase'
import { DtsSceneApi } from '@/scene/DtsSceneApi'
import { LEVEL_COLOR } from '@/scene/kit'
import type { SecurityCamera, SecurityData, SecurityPeriod } from '@/types/security'
import emitter from '@/utils/emitter'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SecurityIncidentCard from './_components/SecurityIncidentCard.vue'
import SecurityPeriodSwitch from './_components/SecurityPeriodSwitch.vue'
import SecurityLeft from './SecurityLeft.vue'
import SecurityRight from './SecurityRight.vue'
import { SECURITY_GROUP, SECURITY_LAYERS, SecurityScene } from './SecurityScene'

/** 图例里的警情等级，颜色与场景的波纹、标注一致 */
const LEVELS = [
  { level: 1, name: '一级', color: LEVEL_COLOR[1] },
  { level: 2, name: '二级', color: LEVEL_COLOR[2] },
  { level: 3, name: '三级', color: LEVEL_COLOR[3] },
  { level: 4, name: '四级', color: LEVEL_COLOR[4] }
]

const data = ref<SecurityData | null>(null)
/** 当前真实时刻，取整到半小时；警情时间、今日趋势都相对它 */
const nowHour = Math.round(currentHour() * 2) / 2
const period = ref<SecurityPeriod>('today')
const layers = ref(SECURITY_LAYERS.filter(l => l.on).map(l => l.key))
const activeIncident = ref<string | null>(null)
const activeZone = ref<string | null>(null)
const activeCamera = ref<string | null>(null)
/** 场景里是否画了监控视域（需要效果总包） */
const hasCones = ref(false)

let scene: SecurityScene | null = null
/** 卸载时 abort，结束对场景就绪的等待 */
const unmounting = new AbortController()

const activeIncidentData = computed(() => data.value?.incidents.find(i => i.id === activeIncident.value) ?? null)
const activeIncidentCameras = computed<SecurityCamera[]>(() => {
  const d = data.value
  const inc = activeIncidentData.value
  if (!d || !inc) return []
  return inc.cameraIds.flatMap(id => d.cameras.find(c => c.id === id) ?? [])
})

function selectIncident(id: string) {
  activeIncident.value = id
  activeZone.value = null
  scene?.focusIncident(id)
}

function selectZone(id: string) {
  activeZone.value = id
  scene?.focusZone(id)
}

function selectCamera(id: string) {
  activeCamera.value = id
  // 摄像头图层默认关闭，定位摄像头时顺手打开，否则飞过去什么也看不到
  if (!layers.value.includes('camera')) {
    layers.value = [...layers.value, 'camera']
    onLayer('camera', true)
  }
  scene?.focusCamera(id)
}

function onPeriod(v: SecurityPeriod) {
  period.value = v
  scene?.setPeriod(v)
}

function onLayer(key: string, visible: boolean) {
  scene?.setLayerVisible(key, visible)
}

/** 默认机位 [x, y, z, pitch, yaw] */
const HOME: number[] | null = gVar?.smartCity?.cameras?.security ?? null

const tools = useSceneTools({
  reset: async () => {
    if (HOME) await __xapi.camera.set(HOME[0], HOME[1], HOME[2], HOME[3], HOME[4], 1.5)
  },
  // 巡航：从默认机位出发，依次俯瞰重点防护区和最严重的警情，再回到默认机位
  tour: () => (HOME ? [HOME, ...(scene?.tourViews() ?? []), HOME] : [])
})

// 场景里点击标注：EventDispatcher 会按 groupId 派发事件，data.userData 是 JSON 字符串
function onIncidentClick(e: any) {
  selectIncident(JSON.parse(e.data.userData).id)
}
function onZoneClick(e: any) {
  selectZone(JSON.parse(e.data.userData).id)
}
function onCameraClick(e: any) {
  selectCamera(JSON.parse(e.data.userData).id)
}

onMounted(async () => {
  const loaded = await getSecurityData(nowHour)
  data.value = loaded

  emitter.on(SECURITY_GROUP.incident, onIncidentClick)
  emitter.on(SECURITY_GROUP.zone, onZoneClick)
  emitter.on(SECURITY_GROUP.camera, onCameraClick)

  const geo = await cityBase.start()
  if (!geo || unmounting.signal.aborted) return
  hasCones.value = cityBase.pak && loaded.viewCones.length > 0
  scene = new SecurityScene(new DtsSceneApi(), geo, {
    cameraView: HOME,
    heatmapZ: gVar?.smartCity?.heatmapZ ?? [-50, 300],
    pak: cityBase.pak
  })
  scene.setData(loaded, period.value)
  // 场景就绪前用户可能已经切换了某些图层
  for (const l of SECURITY_LAYERS) scene.setLayerVisible(l.key, layers.value.includes(l.key))
  await scene.enter()
})

onBeforeUnmount(async () => {
  unmounting.abort()
  emitter.off(SECURITY_GROUP.incident, onIncidentClick)
  emitter.off(SECURITY_GROUP.zone, onZoneClick)
  emitter.off(SECURITY_GROUP.camera, onCameraClick)
  await scene?.leave()
  scene = null
})
</script>

<style lang="scss" scoped>
$scene-left: $page-margin + $panel-width + 24px; // 480
$scene-right: $scene-left;
// 底部两行：下面一行是统计周期和图层开关，上面一行是图例
$row-2: $page-margin + 52px + 12px;

.security-main {
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
.period {
  position: absolute;
  left: $scene-left;
  bottom: $page-margin;
}
.layers {
  position: absolute;
  right: $scene-right;
  bottom: $page-margin;
}
.legend {
  position: absolute;
  left: $scene-left;
  bottom: $row-2;
  max-width: calc(100% - #{$scene-left} - #{$scene-right});
  box-sizing: border-box;
  b {
    font-weight: 400;
    color: $text;
    margin-right: 2px;
  }
  i {
    display: inline-block;
    font-style: normal;
  }
  // 防护区：蓝色幕墙
  .zone {
    width: 14px;
    height: 10px;
    box-sizing: border-box;
    border: 1.5px solid $accent;
    background: rgba(76, 154, 255, 0.25);
  }
  // 警情：按等级着色的波纹
  .ring {
    width: 10px;
    height: 10px;
    box-sizing: border-box;
    margin-left: 4px;
    border-radius: 50%;
    border: 2px solid;
  }
  .route {
    width: 18px;
    border-top: 2px dashed $ok;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    &.unit {
      background: $ok;
    }
    &.online {
      background: $accent;
    }
    &.offline {
      margin-left: 6px;
      background: $text-muted;
    }
  }
  // 视域：从镜头张开的扇形
  .cone {
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 14px solid rgba(76, 154, 255, 0.55);
  }
  .ramp {
    width: 80px;
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(to right, #2b5f9e, #4c9aff, #e8a33d, #e8603c);
  }
}
</style>
