import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/stores/index', async () => {
  const { reactive } = await import('vue')
  return { default: { dtsStore: reactive({ sceneState: 'connecting', dtApi: undefined }) } }
})
vi.mock('@/api/dts/dts', () => ({
  getDtsToken: vi.fn(async () => ({ data: { authorization: 'token' } })),
  getFreeInstance: vi.fn(async () => ({ data: { result: 0, id: 'iid-1' } }))
}))
vi.mock('@/components/dts/DtsFacade', () => ({ default: { getLayerTree: vi.fn(async () => {}), updateCampassPostion: vi.fn() } }))
vi.mock('@/components/dts/event/EventDispatcher', () => ({ default: { onReady: vi.fn(), onEvent: vi.fn() } }))
vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn() } }))

import { getFreeInstance } from '@/api/dts/dts'
import store from '@/stores/index'
import RtcPlayer from '../RtcPlayer.vue'

/** 最近一次构造 DigitalTwinPlayer 时收到的 options */
let playerOptions: any

class FakePlayer {
  constructor(_host: string, options: any) {
    playerOptions = options
  }
  getAPI() {
    return {}
  }
  destroy() {}
}

describe('RtcPlayer scene state', () => {
  beforeEach(() => {
    store.dtsStore.sceneState = 'connecting'
    playerOptions = undefined
    vi.stubGlobal('gVar', { dtsCloud: { player: 'host:8080', username: 'u', password: 'p', pid: '', iid: '', needInstanceId: true } })
    vi.stubGlobal('DigitalTwinPlayer', FakePlayer)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('marks the scene failed when there is no free instance', async () => {
    vi.mocked(getFreeInstance).mockResolvedValueOnce({ data: { result: 1 } } as any)
    mount(RtcPlayer)
    await flushPromises()
    expect(store.dtsStore.sceneState).toBe('failed')
  })

  it('marks the scene failed and logs when initialisation throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(getFreeInstance).mockRejectedValueOnce(new Error('network down'))
    mount(RtcPlayer)
    await flushPromises()
    expect(store.dtsStore.sceneState).toBe('failed')
    expect(error).toHaveBeenCalled()
  })

  it('marks the scene ready when the primary player is ready', async () => {
    mount(RtcPlayer)
    await flushPromises()
    await playerOptions.apiOptions.onReady({})
    expect(store.dtsStore.sceneState).toBe('ready')
  })

  it('does not mark the scene ready for a secondary player', async () => {
    mount(RtcPlayer, { props: { playerVariable: '__xapi2' } })
    await flushPromises()
    await playerOptions.apiOptions.onReady({})
    expect(store.dtsStore.sceneState).toBe('connecting')
  })
})
