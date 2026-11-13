import { cityBase } from '@/scene/CityBase'
import { downloadSnapshot, setAmbienceEnabled } from '@/scene/effects'
import store from '@/stores'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { onBeforeUnmount, reactive, ref } from 'vue'

export interface SceneToolsOptions {
  /** 视角复位：回到本模块的默认相机位 */
  reset: () => Promise<void> | void
  /** 城市巡航的机位，按顺序飞：[x, y, z, pitch, yaw]。至少两个 */
  tour: () => number[][]
}

const TOUR_ID = 'sc_tour'
/** 巡航时相邻机位之间的飞行时间，秒 */
const TOUR_STEP = 7

/**
 * 通用工具栏的行为，五个模块共用。配合 <SceneTools :active="tools.active.value" @tool="tools.onTool" /> 使用；
 * 图层管理面板用 <BaseLayerPanel v-if="tools.showLayers.value" :state="tools.base" @change="tools.setBase" />。
 */
export function useSceneTools(options: SceneToolsOptions) {
  /** 当前处于按下状态的开关型工具 */
  const active = ref<string[]>([])
  const showLayers = ref(false)
  /** 底图图层的开关状态 */
  const base = reactive({ roads: true, ambience: true, cloud: false })
  let tourTimer: ReturnType<typeof setTimeout> | undefined

  const isOn = (key: string) => active.value.includes(key)
  function set(key: string, on: boolean) {
    active.value = on ? [...active.value.filter(k => k !== key), key] : active.value.filter(k => k !== key)
  }
  const sceneReady = () => store.dtsStore.sceneState === 'ready'

  function stopTour() {
    clearTimeout(tourTimer)
    if (isOn('tour') && sceneReady()) __xapi.cameraTour.stop()
    set('tour', false)
  }

  async function startTour() {
    const views = options.tour()
    if (views.length < 2) return
    const w = window as any
    const frames = views.map((v, i) => new w.CameraTourKeyFrame(i, i * TOUR_STEP, [v[0], v[1], v[2]], [v[3], v[4], 0]))
    await __xapi.cameraTour.delete(TOUR_ID)
    await __xapi.cameraTour.add(new w.CameraTourData(TOUR_ID, '城市巡航', frames))
    __xapi.cameraTour.play(TOUR_ID)
    set('tour', true)
    // 播完自动弹起按钮（SDK 没有循环播放）
    tourTimer = setTimeout(() => set('tour', false), (views.length - 1) * TOUR_STEP * 1000 + 500)
  }

  function stopMeasure() {
    if (isOn('measure') && sceneReady()) __xapi.tools.stopMeasurement()
    set('measure', false)
  }

  async function onTool(key: string) {
    if (key === 'fullscreen') {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
      return
    }
    if (key === 'layers') {
      showLayers.value = !showLayers.value
      set('layers', showLayers.value)
      return
    }
    if (!sceneReady()) return
    if (key === 'reset') {
      stopTour()
      await options.reset()
    } else if (key === 'tour') {
      if (isOn('tour')) stopTour()
      else await startTour()
    } else if (key === 'measure') {
      if (isOn('measure')) return stopMeasure()
      // 2 = MeasurementMode.Linear：在场景里依次点击量距离，再点一次工具结束
      __xapi.tools.setMeasurement(2, { unitType: 0, pointSize: 8, textSize: 12, textColor: [1, 1, 1, 1], pointColor: [0.3, 0.6, 1, 0.9], lineColor: [0.3, 0.6, 1, 1], areaColor: [0.3, 0.6, 1, 0.2], showCoordinateText: false })
      __xapi.tools.startMeasurement()
      set('measure', true)
      ElMessage.info('在场景中依次点击量取距离，再点一次「测量」结束')
    } else if (key === 'night') {
      set('night', !isOn('night'))
      __xapi.weather.setDarkMode(isOn('night'))
    } else if (key === 'rain') {
      set('rain', !isOn('rain'))
      if (isOn('rain')) {
        __xapi.weather.setCloudThickness(2)
        __xapi.weather.setRainParam(0.4, 1, 1, [0.7, 0.75, 0.8, 0.25], 0.5, 0.5)
      } else {
        __xapi.weather.disableRainSnow()
        __xapi.weather.setCloudDensity(base.cloud ? 0.4 : 0)
      }
    } else if (key === 'snapshot') {
      if (!downloadSnapshot('智慧城市-' + dayjs().format('YYYYMMDD-HHmmss') + '.png')) ElMessage.warning('场景画面还没有就绪，无法截图')
    }
  }

  /** 图层管理面板里的开关 */
  async function setBase(key: 'roads' | 'ambience' | 'cloud', on: boolean) {
    base[key] = on
    if (!sceneReady()) return
    if (key === 'roads') await cityBase.setRoadsVisible(on)
    else if (key === 'ambience') await setAmbienceEnabled(on)
    else __xapi.weather.setCloudDensity(on ? 0.4 : 0)
  }

  onBeforeUnmount(() => {
    stopTour()
    stopMeasure()
  })

  return { active, showLayers, base, onTool, setBase }
}
