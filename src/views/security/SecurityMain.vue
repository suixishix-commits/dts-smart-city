<template>
  <div v-if="data" class="security-main">
    <SecurityLeft :data="data" :period="period" :now-hour="nowHour" />
    <SecurityRight
      :data="data"
      :active-incident="activeIncident"
      :active-zone="activeZone"
      :active-camera="activeCamera"
      :active-alarm="activeAlarm"
      :active-district="activeDistrict"
      @incident="selectIncident"
      @zone="selectZone"
      @camera="selectCamera"
      @alarm="selectAlarm"
      @district="selectDistrict"
    />

    <SceneTools class="tools" :active="tools.active.value" @tool="tools.onTool" />
    <BaseLayerPanel v-if="tools.showLayers.value" class="base-layers" :state="tools.base" @change="tools.setBase" />

    <SecurityIncidentCard v-if="activeIncidentData" class="card" :incident="activeIncidentData" :cameras="activeIncidentCameras" @close="clearSelection" @camera="locateCamera" />
    <DetailCard v-else-if="detail" class="card" :detail="detail" @close="clearSelection" @action="onDetailAction" />

    <!-- 图例只列当前打开的图层，和场景里看得到的对象一一对应 -->
    <SceneLegend v-if="layers.length || projectedCamera" class="legend">
      <span v-if="layers.includes('fence')" class="legend-item"><i class="zone"></i>重点防护区</span>
      <span v-if="layers.includes('incident')" class="legend-item">
        <b>警情</b>
        <template v-for="l in LEVELS" :key="l.level"><i class="ring" :style="{ borderColor: l.color }"></i>{{ l.name }}</template>
      </span>
      <span v-if="layers.includes('patrol')" class="legend-item"><i class="route"></i>巡逻路线</span>
      <span v-if="layers.includes('patrol')" class="legend-item"><i class="dot unit"></i>巡逻单元</span>
      <span v-if="layers.includes('camera')" class="legend-item"><i class="dot online"></i>摄像头在线<i class="dot offline"></i>离线</span>
      <span v-if="layers.includes('cone') && hasCones" class="legend-item"><i class="cone"></i>监控视域</span>
      <span v-if="projectedCamera" class="legend-item"><i class="cone"></i>投射视域 {{ projectedCamera }}</span>
      <span v-if="layers.includes('heat')" class="legend-item"><b>警情热力</b>低<i class="ramp"></i>高</span>
    </SceneLegend>

    <SecurityPeriodSwitch class="period" :model-value="period" @update:model-value="onPeriod" />
    <LayerToggle v-model="layers" class="layers" :layers="SECURITY_LAYERS" @change="onLayer" />
  </div>
</template>

<script setup lang="ts">
import { isActive } from '@/api/mock/security'
import { currentHour, getSecurityData } from '@/api/security'
import DetailCard from '@/components/panel/DetailCard.vue'
import { useEscape } from '@/composables/useEscape'
import { useSceneTools } from '@/composables/useSceneTools'
import { cityBase } from '@/scene/CityBase'
import { DtsSceneApi } from '@/scene/DtsSceneApi'
import { COLOR, LEVEL_COLOR } from '@/scene/kit'
import type { DetailModel } from '@/types/detail'
import type { AiAlarmStatus, SecurityCamera, SecurityData, SecurityPeriod } from '@/types/security'
import emitter from '@/utils/emitter'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { highlightPins } from '@/scene/pinSelection'
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
const activeAlarm = ref<string | null>(null)
const activeDistrict = ref<string | null>(null)
// 选中的对象在场景里换成高亮标注（类别色描边 + 外发光）
watch([activeIncident, activeZone, activeCamera, activeAlarm, activeDistrict], ids => highlightPins(ids))
/** 投射到场景的摄像头（摄像头详情里的「投射到场景」） */
const projectedCamera = ref<string | null>(null)
/** 摄像头详情是否在看历史回放 */
const replaying = ref(false)
/** 场景里是否有监控视域可画（效果总包可用时是视锥，否则是贴地扇形） */
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

const GUARD_LEVEL = ['一级', '二级', '三级']
const LEVEL_TEXT: Record<number, string> = { 1: '一级', 2: '二级', 3: '三级', 4: '四级' }
/** 摄像头详情「历史回放」往前推的分钟数 */
const REPLAY_MINUTES = 15

/** 重点防护区、片区、视频告警、摄像头的详情（警情有自己的卡片） */
const detail = computed<DetailModel | null>(() => {
  const d = data.value
  if (!d) return null
  const zone = d.zones.find(z => z.id === activeZone.value)
  if (zone)
    return {
      tag: { text: zone.status, color: zone.status === '正常' ? COLOR.ok : COLOR.warn },
      title: zone.name,
      stats: [
        { label: '驻守警力', value: zone.guards, unit: '人' },
        { label: '周边摄像头', value: zone.cameras, unit: '路' },
        { label: '防护半径', value: zone.radius, unit: 'm' }
      ],
      rows: [
        { label: '防护等级', value: GUARD_LEVEL[zone.guardLevel - 1] + '防护' },
        {
          label: '在办警情',
          value:
            d.incidents
              .filter(i => i.status !== '已办结' && i.place === zone.name)
              .map(i => i.title)
              .join('、') || '无'
        }
      ]
    }
  const district = d.eventStats.districts.find(x => x.districtId === activeDistrict.value)
  if (district) {
    const open = d.incidents.filter(i => i.districtId === district.districtId && isActive(i))
    return {
      tag: { text: '片区', color: COLOR.accent },
      title: district.name,
      stats: [
        { label: '今日事件', value: district.total, unit: '起' },
        { label: '办结率', value: (district.closeRate * 100).toFixed(1), unit: '%' },
        { label: '超时', value: district.overdue, unit: '件', color: district.overdue ? COLOR.warn : undefined }
      ],
      rows: [
        { label: '已办结', value: district.closed + ' 件' },
        { label: '处置中', value: district.active + ' 件' },
        { label: '主要承办', value: district.topDepartment },
        { label: '在办警情', value: open.map(i => i.title).join('、') || '无' }
      ]
    }
  }
  const alarm = d.aiAlarms.find(a => a.id === activeAlarm.value)
  if (alarm) {
    const cam = d.cameras.find(c => c.id === alarm.cameraId)
    return {
      tag: { text: LEVEL_TEXT[alarm.level], color: LEVEL_COLOR[alarm.level] },
      title: alarm.title,
      // 回放到告警发生的时刻
      camera: { id: alarm.cameraId, online: cam?.online ?? true, replayMinutes: Math.max(1, alarm.ageMinutes) },
      stats: [
        { label: '识别置信度', value: Math.round(alarm.confidence * 100), unit: '%' },
        { label: '告警时刻', value: alarm.time },
        { label: '状态', value: alarm.status, color: alarm.status === '待确认' ? COLOR.warn : undefined }
      ],
      rows: [
        { label: '识别类型', value: alarm.type },
        { label: '摄像头', value: alarm.cameraId + (cam ? ' ' + cam.name : '') },
        { label: '画面', value: `回放告警时刻（${alarm.ageMinutes} 分钟前）` }
      ],
      actions:
        alarm.status === '待确认'
          ? [
              { key: 'alarm-confirm', label: '确认派单' },
              { key: 'alarm-false', label: '误报' }
            ]
          : undefined
    }
  }
  const camera = d.cameras.find(c => c.id === activeCamera.value)
  if (camera) {
    const cone = d.viewCones.find(v => v.cameraId === camera.id)
    const projected = projectedCamera.value === camera.id
    return {
      tag: { text: camera.online ? '在线' : '离线', color: camera.online ? COLOR.ok : COLOR.muted },
      title: camera.id + ' ' + camera.name,
      camera: { id: camera.id, online: camera.online, replayMinutes: replaying.value ? REPLAY_MINUTES : 0 },
      rows: [
        { label: '视频信号', value: camera.online ? '正常' : '信号中断，已报修' },
        { label: '画面', value: replaying.value ? `历史回放（${REPLAY_MINUTES} 分钟前）` : '实时' },
        { label: '对准警情', value: (cone && d.incidents.find(i => i.id === cone.incidentId)?.title) || '无' }
      ],
      actions: [
        { key: 'camera-project', label: projected ? '取消投射' : '投射到场景' },
        { key: 'camera-replay', label: replaying.value ? '返回实时' : '历史回放' }
      ]
    }
  }
  return null
})

/** 同一时刻只选中一个对象：警情、防护区、片区、告警、摄像头互斥。投射和回放跟着选中走，一并取消 */
function clearSelection() {
  activeIncident.value = null
  activeZone.value = null
  activeCamera.value = null
  activeAlarm.value = null
  activeDistrict.value = null
  replaying.value = false
  if (projectedCamera.value) {
    projectedCamera.value = null
    void scene?.clearProjection()
  }
}
useEscape(clearSelection)

function selectIncident(id: string) {
  clearSelection()
  activeIncident.value = id
  scene?.focusIncident(id)
}

function selectZone(id: string) {
  clearSelection()
  activeZone.value = id
  scene?.focusZone(id)
}

/** 飞到某路摄像头。摄像头图层默认关闭，定位时顺手打开，否则飞过去什么也看不到 */
function flyToCamera(id: string) {
  if (!layers.value.includes('camera')) {
    layers.value = [...layers.value, 'camera']
    onLayer('camera', true)
  }
  scene?.focusCamera(id)
}

/** 选中并飞到某路摄像头 */
function locateCamera(id: string) {
  activeCamera.value = id
  flyToCamera(id)
}

/** 从列表或场景里选中摄像头：换成摄像头的详情。警情卡片里点摄像头用 locateCamera，警情卡片保留 */
function selectCamera(id: string) {
  clearSelection()
  locateCamera(id)
}

/** 片区事件量里点片区：飞到片区上空，弹出片区详情 */
function selectDistrict(id: string) {
  clearSelection()
  activeDistrict.value = id
  scene?.focusDistrict(id)
}

/** 视频智能告警：飞到告警摄像头，详情里回放告警时刻的画面 */
function selectAlarm(id: string) {
  const alarm = data.value?.aiAlarms.find(a => a.id === id)
  if (!alarm) return
  clearSelection()
  activeAlarm.value = id
  flyToCamera(alarm.cameraId)
}

function setAlarmStatus(id: string, status: AiAlarmStatus) {
  const alarm = data.value?.aiAlarms.find(a => a.id === id)
  if (alarm) alarm.status = status
}

/** 摄像头投射：再点一次取消。场景没连上时什么也不做 */
async function toggleProjection(id: string) {
  if (projectedCamera.value === id) {
    projectedCamera.value = null
    await scene?.clearProjection()
    return
  }
  const ok = (await scene?.projectCamera(id)) ?? false
  // 等待期间可能已经关掉卡片或换了摄像头
  if (activeCamera.value === id) projectedCamera.value = ok ? id : null
  else if (ok) await scene?.clearProjection()
}

/** 详情卡片底部按钮 */
function onDetailAction(key: string) {
  if (key === 'camera-project' && activeCamera.value) void toggleProjection(activeCamera.value)
  else if (key === 'camera-replay') replaying.value = !replaying.value
  else if (key === 'alarm-confirm' && activeAlarm.value) setAlarmStatus(activeAlarm.value, '已派单')
  else if (key === 'alarm-false' && activeAlarm.value) setAlarmStatus(activeAlarm.value, '误报')
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
  hasCones.value = loaded.viewCones.length > 0
  scene = new SecurityScene(new DtsSceneApi(), geo, {
    cameraView: HOME,
    heatmapZ: gVar?.smartCity?.heatmapZ ?? [-50, 300],
    pak: cityBase.pak,
    beacons: cityBase.beacons,
    dimBaseRoads: dim => cityBase.setRoadsDimmed(dim)
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
    background: linear-gradient(to right, #1d4f91, #4c9aff, #ffa94d, #ff6b6b);
  }
}
</style>
