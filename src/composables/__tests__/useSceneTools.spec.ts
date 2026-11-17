import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

const mocks = vi.hoisted(() => ({
  setRoadsVisible: vi.fn(async (_visible: boolean) => {}),
  setAmbienceEnabled: vi.fn(async (_enabled: boolean) => {}),
  setNight: vi.fn(async (_on: boolean, _ambience?: boolean) => {}),
  downloadSnapshot: vi.fn((_filename: string) => true),
  info: vi.fn(),
  warning: vi.fn()
}))

vi.mock('@/stores', async () => {
  const { reactive } = await import('vue')
  return { default: { dtsStore: reactive({ sceneState: 'ready' }) } }
})
vi.mock('@/scene/CityBase', () => ({ cityBase: { setRoadsVisible: mocks.setRoadsVisible } }))
vi.mock('@/scene/effects', () => ({ setAmbienceEnabled: mocks.setAmbienceEnabled, setNight: mocks.setNight, downloadSnapshot: mocks.downloadSnapshot }))
vi.mock('element-plus', () => ({ ElMessage: { info: mocks.info, warning: mocks.warning } }))

import store from '@/stores'
import { useSceneTools, type SceneToolsOptions } from '../useSceneTools'

/** SDK 里的巡航数据类：只记录构造参数 */
class CameraTourKeyFrame {
  constructor(
    public index: number,
    public time: number,
    public location: number[],
    public rotation: number[]
  ) {}
}
class CameraTourData {
  constructor(
    public id: string,
    public name: string,
    public keyFrames: CameraTourKeyFrame[]
  ) {}
}

const HOME = [100, 200, 9000, -38, -38]
const VIEWS = [HOME, [1000, 2000, 2200, -38, -38], [3000, 4000, 2200, -38, -38]]

describe('useSceneTools', () => {
  let xapi: {
    weather: Record<'setDarkMode' | 'setCloudThickness' | 'setRainParam' | 'disableRainSnow' | 'setCloudDensity', ReturnType<typeof vi.fn>>
    tools: Record<'setMeasurement' | 'startMeasurement' | 'stopMeasurement', ReturnType<typeof vi.fn>>
    cameraTour: Record<'delete' | 'add' | 'play' | 'stop', ReturnType<typeof vi.fn>>
  }
  let reset: ReturnType<typeof vi.fn>
  let views: number[][]

  /** 挂一个只调用 useSceneTools 的宿主组件 */
  function mountHost(options: Partial<SceneToolsOptions> = {}) {
    let tools!: ReturnType<typeof useSceneTools>
    const Host = defineComponent({
      setup() {
        tools = useSceneTools({ reset, tour: () => views, ...options })
        return () => null
      }
    })
    const wrapper = mount(Host)
    return { tools, wrapper }
  }

  beforeEach(async () => {
    store.dtsStore.sceneState = 'ready'
    Object.values(mocks).forEach(fn => fn.mockClear())
    mocks.downloadSnapshot.mockReturnValue(true)
    reset = vi.fn(async () => {})
    views = VIEWS
    xapi = {
      weather: { setDarkMode: vi.fn(), setCloudThickness: vi.fn(), setRainParam: vi.fn(), disableRainSnow: vi.fn(), setCloudDensity: vi.fn() },
      tools: { setMeasurement: vi.fn(), startMeasurement: vi.fn(), stopMeasurement: vi.fn() },
      cameraTour: { delete: vi.fn(async () => ({})), add: vi.fn(async () => ({})), play: vi.fn(), stop: vi.fn() }
    }
    vi.stubGlobal('__xapi', xapi)
    vi.stubGlobal('CameraTourKeyFrame', CameraTourKeyFrame)
    vi.stubGlobal('CameraTourData', CameraTourData)

    // 昼夜、天气、底图风格、云层是模块级的共享状态，会留到下一个用例：每个用例开始前通过公开接口拨回默认值
    const { tools, wrapper } = mountHost()
    for (const key of ['night', 'rain']) if (tools.active.value.includes(key)) await tools.onTool(key)
    await tools.setBase('ambience', true)
    await tools.setBase('cloud', false)
    wrapper.unmount()
    Object.values(mocks).forEach(fn => fn.mockClear())
    Object.values(xapi).forEach(group => Object.values(group).forEach(fn => fn.mockClear()))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts with nothing pressed, the layer panel closed and the default base layers', () => {
    const { tools } = mountHost()
    expect(tools.active.value).toEqual([])
    expect(tools.showLayers.value).toBe(false)
    expect(tools.base).toEqual({ roads: true, ambience: true, cloud: false })
  })

  describe('图层管理', () => {
    it('toggles the layer panel and its pressed state', async () => {
      const { tools } = mountHost()
      await tools.onTool('layers')
      expect(tools.showLayers.value).toBe(true)
      expect(tools.active.value).toEqual(['layers'])
      await tools.onTool('layers')
      expect(tools.showLayers.value).toBe(false)
      expect(tools.active.value).toEqual([])
    })

    it('works even when the scene is not connected', async () => {
      store.dtsStore.sceneState = 'failed'
      const { tools } = mountHost()
      await tools.onTool('layers')
      expect(tools.showLayers.value).toBe(true)
    })
  })

  describe('昼夜切换', () => {
    it('switches the night scene on and off, keeping the ambience setting', async () => {
      const { tools } = mountHost()
      await tools.onTool('night')
      expect(mocks.setNight).toHaveBeenLastCalledWith(true, true)
      expect(tools.active.value).toEqual(['night'])
      await tools.onTool('night')
      expect(mocks.setNight).toHaveBeenLastCalledWith(false, true)
      expect(tools.active.value).toEqual([])
    })

    it('only changes the time of day when the ambience style is off', async () => {
      const { tools } = mountHost()
      await tools.setBase('ambience', false)
      await tools.onTool('night')
      expect(mocks.setNight).toHaveBeenLastCalledWith(true, false)
      await tools.onTool('night')
    })
  })

  describe('天气模拟', () => {
    it('starts rain with thicker clouds, then stops it and clears the clouds', async () => {
      const { tools } = mountHost()
      await tools.onTool('rain')
      expect(xapi.weather.setCloudThickness).toHaveBeenCalledWith(2)
      expect(xapi.weather.setRainParam).toHaveBeenCalledTimes(1)
      expect(xapi.weather.disableRainSnow).not.toHaveBeenCalled()
      expect(tools.active.value).toEqual(['rain'])

      await tools.onTool('rain')
      expect(xapi.weather.disableRainSnow).toHaveBeenCalledTimes(1)
      expect(xapi.weather.setCloudDensity).toHaveBeenLastCalledWith(0)
      expect(tools.active.value).toEqual([])
    })

    it('goes back to the cloud layer setting when the rain stops', async () => {
      const { tools } = mountHost()
      await tools.setBase('cloud', true)
      await tools.onTool('rain')
      await tools.onTool('rain')
      expect(xapi.weather.setCloudDensity).toHaveBeenLastCalledWith(0.4)
    })
  })

  describe('测量', () => {
    it('starts a linear measurement and tells the user how to finish', async () => {
      const { tools } = mountHost()
      await tools.onTool('measure')
      expect(xapi.tools.setMeasurement).toHaveBeenCalledTimes(1)
      expect(xapi.tools.setMeasurement.mock.calls[0][0]).toBe(2)
      expect(xapi.tools.setMeasurement.mock.invocationCallOrder[0]).toBeLessThan(xapi.tools.startMeasurement.mock.invocationCallOrder[0])
      expect(tools.active.value).toEqual(['measure'])
      expect(mocks.info).toHaveBeenCalledTimes(1)
    })

    it('stops the measurement on the second click', async () => {
      const { tools } = mountHost()
      await tools.onTool('measure')
      await tools.onTool('measure')
      expect(xapi.tools.stopMeasurement).toHaveBeenCalledTimes(1)
      expect(xapi.tools.startMeasurement).toHaveBeenCalledTimes(1)
      expect(tools.active.value).toEqual([])
    })
  })

  describe('视角复位', () => {
    it('calls the reset option of the module', async () => {
      const { tools } = mountHost()
      await tools.onTool('reset')
      expect(reset).toHaveBeenCalledTimes(1)
      expect(tools.active.value).toEqual([])
    })

    it('stops a running tour first', async () => {
      const { tools } = mountHost()
      await tools.onTool('tour')
      await tools.onTool('reset')
      expect(xapi.cameraTour.stop).toHaveBeenCalledTimes(1)
      expect(xapi.cameraTour.stop.mock.invocationCallOrder[0]).toBeLessThan(reset.mock.invocationCallOrder[0])
      expect(tools.active.value).toEqual([])
    })

    it('does not stop a tour that is not running', async () => {
      const { tools } = mountHost()
      await tools.onTool('reset')
      expect(xapi.cameraTour.stop).not.toHaveBeenCalled()
    })
  })

  describe('城市巡航', () => {
    it('does nothing with fewer than two views', async () => {
      for (const few of [[], [HOME]]) {
        views = few
        const { tools } = mountHost()
        await tools.onTool('tour')
        expect(tools.active.value).toEqual([])
      }
      expect(xapi.cameraTour.delete).not.toHaveBeenCalled()
      expect(xapi.cameraTour.add).not.toHaveBeenCalled()
      expect(xapi.cameraTour.play).not.toHaveBeenCalled()
    })

    it('replaces the tour, plays it and marks the tool as pressed', async () => {
      const { tools } = mountHost()
      await tools.onTool('tour')
      expect(xapi.cameraTour.delete).toHaveBeenCalledWith('sc_tour')
      expect(xapi.cameraTour.delete.mock.invocationCallOrder[0]).toBeLessThan(xapi.cameraTour.add.mock.invocationCallOrder[0])
      expect(xapi.cameraTour.play).toHaveBeenCalledWith('sc_tour')
      expect(tools.active.value).toEqual(['tour'])
    })

    it('builds one key frame per view, 7 s apart, from [x, y, z, pitch, yaw]', async () => {
      const { tools } = mountHost()
      await tools.onTool('tour')
      const tour = xapi.cameraTour.add.mock.calls[0][0] as CameraTourData
      expect(tour).toBeInstanceOf(CameraTourData)
      expect(tour.id).toBe('sc_tour')
      expect(tour.keyFrames).toHaveLength(3)
      expect(tour.keyFrames.map(f => f.index)).toEqual([0, 1, 2])
      expect(tour.keyFrames.map(f => f.time)).toEqual([0, 7, 14])
      expect(tour.keyFrames[1].location).toEqual([1000, 2000, 2200])
      expect(tour.keyFrames[1].rotation).toEqual([-38, -38, 0])
    })

    it('asks the module for the views each time the tour starts', async () => {
      const tour = vi.fn(() => VIEWS)
      const { tools } = mountHost({ tour })
      expect(tour).not.toHaveBeenCalled()
      await tools.onTool('tour')
      expect(tour).toHaveBeenCalledTimes(1)
    })

    it('stops the tour on the second click', async () => {
      const { tools } = mountHost()
      await tools.onTool('tour')
      await tools.onTool('tour')
      expect(xapi.cameraTour.stop).toHaveBeenCalledTimes(1)
      expect(xapi.cameraTour.play).toHaveBeenCalledTimes(1)
      expect(tools.active.value).toEqual([])
    })

    it('releases the button by itself when the tour has played to the end', async () => {
      vi.useFakeTimers()
      const { tools } = mountHost()
      await tools.onTool('tour')
      // 3 个机位 → 2 段 × 7 秒
      await vi.advanceTimersByTimeAsync(14000)
      expect(tools.active.value).toEqual(['tour'])
      await vi.advanceTimersByTimeAsync(600)
      expect(tools.active.value).toEqual([])
      expect(xapi.cameraTour.stop).not.toHaveBeenCalled()
    })

    it('does not release the button of a restarted tour early', async () => {
      vi.useFakeTimers()
      const { tools } = mountHost()
      await tools.onTool('tour')
      await vi.advanceTimersByTimeAsync(10000)
      await tools.onTool('tour') // 停止
      await tools.onTool('tour') // 重新开始
      await vi.advanceTimersByTimeAsync(10000)
      expect(tools.active.value).toEqual(['tour'])
    })
  })

  describe('截图', () => {
    it('downloads a PNG named with the current time', async () => {
      const { tools } = mountHost()
      await tools.onTool('snapshot')
      expect(mocks.downloadSnapshot).toHaveBeenCalledTimes(1)
      expect(mocks.downloadSnapshot.mock.calls[0][0]).toMatch(/^智慧城市-\d{8}-\d{6}\.png$/)
      expect(mocks.warning).not.toHaveBeenCalled()
      expect(tools.active.value).toEqual([])
    })

    it('warns when there is no frame to capture', async () => {
      mocks.downloadSnapshot.mockReturnValue(false)
      const { tools } = mountHost()
      await tools.onTool('snapshot')
      expect(mocks.warning).toHaveBeenCalledTimes(1)
    })
  })

  describe('全屏', () => {
    const original = Object.getOwnPropertyDescriptor(document, 'fullscreenElement')
    afterEach(() => {
      if (original) Object.defineProperty(document, 'fullscreenElement', original)
      else delete (document as any).fullscreenElement
      delete (document.documentElement as any).requestFullscreen
      delete (document as any).exitFullscreen
    })

    it('enters fullscreen, and leaves it when already fullscreen — also without a scene', async () => {
      store.dtsStore.sceneState = 'failed'
      const request = vi.fn(async () => {})
      const exit = vi.fn(async () => {})
      ;(document.documentElement as any).requestFullscreen = request
      ;(document as any).exitFullscreen = exit
      const { tools } = mountHost()

      await tools.onTool('fullscreen')
      expect(request).toHaveBeenCalledTimes(1)
      expect(exit).not.toHaveBeenCalled()

      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.documentElement })
      await tools.onTool('fullscreen')
      expect(exit).toHaveBeenCalledTimes(1)
      expect(request).toHaveBeenCalledTimes(1)
      expect(tools.active.value).toEqual([])
    })
  })

  describe('场景没连上', () => {
    it.each(['connecting', 'failed'])('ignores scene tools while the scene is %s', async state => {
      store.dtsStore.sceneState = state
      const { tools } = mountHost()
      for (const key of ['night', 'rain', 'measure', 'tour', 'reset', 'snapshot']) await tools.onTool(key)
      expect(tools.active.value).toEqual([])
      expect(reset).not.toHaveBeenCalled()
      expect(mocks.downloadSnapshot).not.toHaveBeenCalled()
      expect(xapi.weather.setDarkMode).not.toHaveBeenCalled()
      expect(xapi.weather.setRainParam).not.toHaveBeenCalled()
      expect(xapi.tools.startMeasurement).not.toHaveBeenCalled()
      expect(xapi.cameraTour.play).not.toHaveBeenCalled()
    })

    it('remembers base layer switches without touching the scene', async () => {
      store.dtsStore.sceneState = 'connecting'
      const { tools } = mountHost()
      await tools.setBase('roads', false)
      await tools.setBase('cloud', true)
      expect(tools.base).toEqual({ roads: false, ambience: true, cloud: true })
      expect(mocks.setRoadsVisible).not.toHaveBeenCalled()
      expect(xapi.weather.setCloudDensity).not.toHaveBeenCalled()
    })
  })

  describe('底图图层', () => {
    it('shows and hides the road network of the city base', async () => {
      const { tools } = mountHost()
      await tools.setBase('roads', false)
      expect(tools.base.roads).toBe(false)
      expect(mocks.setRoadsVisible).toHaveBeenLastCalledWith(false)
      await tools.setBase('roads', true)
      expect(mocks.setRoadsVisible).toHaveBeenLastCalledWith(true)
    })

    it('switches the dusk ambience', async () => {
      const { tools } = mountHost()
      await tools.setBase('ambience', false)
      expect(tools.base.ambience).toBe(false)
      expect(mocks.setAmbienceEnabled).toHaveBeenLastCalledWith(false)
      await tools.setBase('ambience', true)
      expect(mocks.setAmbienceEnabled).toHaveBeenLastCalledWith(true)
    })

    it('switches the cloud layer', async () => {
      const { tools } = mountHost()
      await tools.setBase('cloud', true)
      expect(tools.base.cloud).toBe(true)
      expect(xapi.weather.setCloudDensity).toHaveBeenLastCalledWith(0.4)
      await tools.setBase('cloud', false)
      expect(xapi.weather.setCloudDensity).toHaveBeenLastCalledWith(0)
    })
  })

  it('keeps independent toggles pressed side by side', async () => {
    const { tools } = mountHost()
    for (const key of ['night', 'layers', 'measure', 'rain']) await tools.onTool(key)
    expect([...tools.active.value].sort()).toEqual(['layers', 'measure', 'night', 'rain'])
    await tools.onTool('measure')
    expect([...tools.active.value].sort()).toEqual(['layers', 'night', 'rain'])
  })

  describe('切换模块后保留的场景状态', () => {
    it('keeps night and rain pressed for the next module without sending the commands again', async () => {
      const first = mountHost()
      await first.tools.onTool('night')
      await first.tools.onTool('rain')
      first.wrapper.unmount()
      xapi.weather.setDarkMode.mockClear()
      xapi.weather.setRainParam.mockClear()

      const { tools } = mountHost()
      expect([...tools.active.value].sort()).toEqual(['night', 'rain'])
      expect(xapi.weather.setDarkMode).not.toHaveBeenCalled()
      expect(xapi.weather.setRainParam).not.toHaveBeenCalled()
      // 下一个模块里再点一次就是关掉
      await tools.onTool('night')
      expect(mocks.setNight).toHaveBeenLastCalledWith(false, true)
      await tools.onTool('rain')
      expect(xapi.weather.disableRainSnow).toHaveBeenCalledTimes(1)
      expect(mountHost().tools.active.value).toEqual([])
    })

    it('keeps the ambience and cloud switches, but not the road network switch', async () => {
      const first = mountHost()
      await first.tools.setBase('ambience', false)
      await first.tools.setBase('cloud', true)
      await first.tools.setBase('roads', false)
      first.wrapper.unmount()
      expect(mountHost().tools.base).toEqual({ roads: true, ambience: false, cloud: true })
    })

    it('does not carry over the layer panel, the measurement or the tour', async () => {
      const first = mountHost()
      for (const key of ['layers', 'measure', 'tour']) await first.tools.onTool(key)
      first.wrapper.unmount()
      const { tools } = mountHost()
      expect(tools.active.value).toEqual([])
      expect(tools.showLayers.value).toBe(false)
    })
  })

  describe('卸载', () => {
    it('stops a running tour and measurement when the module is left', async () => {
      const { tools, wrapper } = mountHost()
      await tools.onTool('tour')
      await tools.onTool('measure')
      wrapper.unmount()
      expect(xapi.cameraTour.stop).toHaveBeenCalledTimes(1)
      expect(xapi.tools.stopMeasurement).toHaveBeenCalledTimes(1)
      expect(tools.active.value).toEqual([])
    })

    it('does not call the scene on unmount when nothing is running', () => {
      const { wrapper } = mountHost()
      wrapper.unmount()
      expect(xapi.cameraTour.stop).not.toHaveBeenCalled()
      expect(xapi.tools.stopMeasurement).not.toHaveBeenCalled()
    })

    it('cancels the timer that releases the tour button', async () => {
      vi.useFakeTimers()
      const { tools, wrapper } = mountHost()
      await tools.onTool('tour')
      wrapper.unmount()
      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
