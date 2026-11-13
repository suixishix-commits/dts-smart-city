import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/stores', async () => {
  const { reactive } = await import('vue')
  return { default: { dtsStore: reactive({ sceneState: 'connecting' }) } }
})

import store from '@/stores'
import { whenSceneReady } from '../sceneReady'

/** 记录 promise 的结果；未完成时为 undefined */
function track(p: Promise<boolean>) {
  const state: { value?: boolean } = {}
  p.then(v => (state.value = v))
  return state
}

const flush = () => new Promise<void>(resolve => setTimeout(resolve))

describe('whenSceneReady', () => {
  beforeEach(() => {
    store.dtsStore.sceneState = 'connecting'
  })

  it('resolves immediately when the scene is already ready or failed', async () => {
    store.dtsStore.sceneState = 'ready'
    expect(await whenSceneReady()).toBe(true)
    store.dtsStore.sceneState = 'failed'
    expect(await whenSceneReady()).toBe(false)
  })

  it('resolves true when the state becomes ready later', async () => {
    const result = track(whenSceneReady())
    await flush()
    expect(result.value).toBeUndefined()
    store.dtsStore.sceneState = 'ready'
    await flush()
    expect(result.value).toBe(true)
  })

  it('resolves false when the state becomes failed after the promise was created', async () => {
    const result = track(whenSceneReady())
    store.dtsStore.sceneState = 'failed'
    await flush()
    expect(result.value).toBe(false)
  })

  it('resolves false when aborted while waiting, and ignores later state changes', async () => {
    const controller = new AbortController()
    const result = track(whenSceneReady(controller.signal))
    controller.abort()
    await flush()
    expect(result.value).toBe(false)
    store.dtsStore.sceneState = 'ready'
    await flush()
    expect(result.value).toBe(false)
  })

  it('resolves false when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    expect(await whenSceneReady(controller.signal)).toBe(false)
  })
})
