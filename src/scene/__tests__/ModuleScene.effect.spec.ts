import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModuleScene, type SceneEffect } from '../ModuleScene'
import type { SceneApi, SceneObjectType } from '../SceneApi'

/** 只记录对象增删的场景替身 */
class FakeApi implements SceneApi {
  objects = new Set<string>()
  async add(type: SceneObjectType, objects: { id: string }[]) {
    objects.forEach(o => this.objects.add(`${type}:${o.id}`))
  }
  async remove(type: SceneObjectType, ids: string[]) {
    ids.forEach(id => this.objects.delete(`${type}:${id}`))
  }
  async setVisible() {}
  async setCamera() {}
  async focus() {}
  async project(lonLat: number[][]) {
    return lonLat
  }
}

/** 效果替身：记录 show / hide / remove 的调用顺序 */
function fakeEffect() {
  const calls: string[] = []
  const effect: SceneEffect = {
    show: vi.fn(async () => void calls.push('show')),
    hide: vi.fn(async () => void calls.push('hide')),
    remove: vi.fn(async () => void calls.push('remove'))
  }
  return { effect, calls }
}

/** 测试用场景：进入时在 fx 图层登记一个效果，再往 points 图层加一个 marker */
class EffectScene extends ModuleScene {
  create: () => Promise<SceneEffect> = async () => fakeEffect().effect
  /** 最近一次进入拿到的 token，用来模拟过期流程 */
  lastToken = 0
  protected async onEnter(token: number) {
    this.lastToken = token
    await this.effect(token, 'fx', () => this.create())
    await this.add(token, 'marker', [{ id: 'm1' }], 'points')
  }
  /** 用指定 token 再登记一个效果 */
  register(token: number, layer: string, create: () => Promise<SceneEffect>) {
    return this.effect(token, layer, create)
  }
}

describe('ModuleScene.effect', () => {
  let api: FakeApi
  let scene: EffectScene
  let warn: ReturnType<typeof vi.spyOn>
  let error: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    api = new FakeApi()
    scene = new EffectScene(api)
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    error = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
    error.mockRestore()
  })

  it('leaves a registered effect alone while its layer is visible', async () => {
    const fx = fakeEffect()
    scene.create = async () => fx.effect
    await scene.enter()
    expect(fx.calls).toEqual([])
  })

  it('removes a registered effect on leave, exactly once', async () => {
    const fx = fakeEffect()
    scene.create = async () => fx.effect
    await scene.enter()
    await scene.leave()
    expect(fx.calls).toEqual(['remove'])
    await scene.leave()
    expect(fx.effect.remove).toHaveBeenCalledTimes(1)
  })

  it('removes every registered effect and all objects on leave', async () => {
    const a = fakeEffect()
    const b = fakeEffect()
    scene.create = async () => a.effect
    await scene.enter()
    await scene.register(scene.lastToken, 'other', async () => b.effect)
    await scene.leave()
    expect(a.calls).toEqual(['remove'])
    expect(b.calls).toEqual(['remove'])
    expect(api.objects.size).toBe(0)
  })

  it('hides the effect right after creating it when its layer is already hidden', async () => {
    const fx = fakeEffect()
    scene.create = async () => fx.effect
    await scene.setLayerVisible('fx', false)
    await scene.enter()
    expect(fx.calls).toEqual(['hide'])
  })

  it('hides and shows the effect with its layer', async () => {
    const fx = fakeEffect()
    scene.create = async () => fx.effect
    await scene.enter()
    await scene.setLayerVisible('fx', false)
    expect(fx.calls).toEqual(['hide'])
    await scene.setLayerVisible('fx', true)
    expect(fx.calls).toEqual(['hide', 'show'])
  })

  it('does not touch the effect when another layer is toggled', async () => {
    const fx = fakeEffect()
    scene.create = async () => fx.effect
    await scene.enter()
    await scene.setLayerVisible('points', false)
    await scene.setLayerVisible('points', true)
    expect(fx.calls).toEqual([])
  })

  it('does not throw when create() rejects, and still builds the other layers', async () => {
    scene.create = async () => {
      throw new Error('效果总包没挂载')
    }
    await expect(scene.enter()).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('fx')
    expect([...api.objects]).toEqual(['marker:m1'])
    // 没有登记失败的效果：开关图层、离开都不会出错
    await scene.setLayerVisible('fx', false)
    await expect(scene.leave()).resolves.toBeUndefined()
  })

  it('removes an effect immediately when its create() resolves after leave', async () => {
    const fx = fakeEffect()
    let finish!: () => void
    const pending = new Promise<void>(resolve => (finish = resolve))
    scene.create = async () => {
      await pending
      return fx.effect
    }
    const entering = scene.enter()
    await scene.leave()
    expect(fx.calls).toEqual([])
    finish()
    await entering
    expect(fx.calls).toEqual(['remove'])
    expect(api.objects.size).toBe(0)

    // 没有被登记：之后的图层开关和再次离开都不会再碰它
    await scene.setLayerVisible('fx', false)
    await scene.setLayerVisible('fx', true)
    await scene.leave()
    expect(fx.calls).toEqual(['remove'])
  })

  it('removes an effect of a superseded enter when a newer enter is already running', async () => {
    const stale = fakeEffect()
    const fresh = fakeEffect()
    let finish!: () => void
    const pending = new Promise<void>(resolve => (finish = resolve))
    scene.create = async () => {
      await pending
      return stale.effect
    }
    const first = scene.enter()
    await scene.leave()
    scene.create = async () => fresh.effect
    await scene.enter()
    finish()
    await first
    expect(stale.calls).toEqual(['remove'])
    expect(fresh.calls).toEqual([])
    await scene.leave()
    expect(fresh.calls).toEqual(['remove'])
  })

  it('does not even call create() with a stale token', async () => {
    await scene.enter()
    const staleToken = scene.lastToken
    await scene.leave()
    const create = vi.fn(async () => fakeEffect().effect)
    await scene.register(staleToken, 'fx', create)
    expect(create).not.toHaveBeenCalled()
  })

  it('logs a failing effect.remove() on leave and still removes the rest', async () => {
    const bad = fakeEffect()
    bad.effect.remove = vi.fn(async () => {
      throw new Error('remove failed')
    })
    const good = fakeEffect()
    scene.create = async () => bad.effect
    await scene.enter()
    await scene.register(scene.lastToken, 'other', async () => good.effect)
    await expect(scene.leave()).resolves.toBeUndefined()
    expect(error).toHaveBeenCalled()
    expect(good.calls).toEqual(['remove'])
    expect(api.objects.size).toBe(0)
  })

  it('creates a fresh effect on every enter', async () => {
    const created: ReturnType<typeof fakeEffect>[] = []
    scene.create = async () => {
      const fx = fakeEffect()
      created.push(fx)
      return fx.effect
    }
    for (let i = 0; i < 3; i++) {
      await scene.enter()
      await scene.leave()
    }
    expect(created).toHaveLength(3)
    expect(created.map(c => c.calls)).toEqual([['remove'], ['remove'], ['remove']])
  })
})
