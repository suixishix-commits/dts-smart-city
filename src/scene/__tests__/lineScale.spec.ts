import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('lineScale', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('maps camera height to a discrete width factor', async () => {
    const { lineScaleFor } = await import('../lineScale')
    expect(lineScaleFor(9600)).toBe(1)
    expect(lineScaleFor(12000)).toBe(1)
    expect(lineScaleFor(6000)).toBe(0.65)
    expect(lineScaleFor(4500)).toBe(0.45)
    expect(lineScaleFor(3000)).toBe(0.3)
    expect(lineScaleFor(2400)).toBe(0.3)
  })

  it('never scales a line below the minimum width', async () => {
    const { scaledThickness } = await import('../lineScale')
    expect(scaledThickness(60, 1)).toBe(60)
    expect(scaledThickness(60, 0.3)).toBe(18)
    expect(scaledThickness(10, 0.3)).toBe(4)
  })

  it('tracks base widths and rescales every tracked line when the camera settles lower', async () => {
    const handlers = new Map<string, () => void>()
    vi.doMock('@/utils/emitter', () => ({ default: { on: (name: string, fn: () => void) => handlers.set(name, fn) } }))
    const update = vi.fn()
    const camera = { get: vi.fn(async () => ({ camera: [0, 0, 3000, -42, -38] })) }
    vi.stubGlobal('__xapi', { settings: { setEnableCameraMovingEvent: vi.fn() }, camera, polyline: { update } })
    const { lineScaler } = await import('../lineScale')

    const sent = lineScaler.track([{ id: 'a', thickness: 60 }, { id: 'b', thickness: 30 }, { id: 'c' }])
    expect(sent[0]).toEqual({ id: 'a', thickness: 60 })
    lineScaler.untrack(['b'])
    lineScaler.start()

    handlers.get('CameraStopMove')?.()
    await vi.runAllTimersAsync()
    expect(update).toHaveBeenCalledWith([{ id: 'a', thickness: 18 }])
    // 同一档不再发指令
    handlers.get('CameraStopMove')?.()
    await vi.runAllTimersAsync()
    expect(update).toHaveBeenCalledTimes(1)
    // 之后添加的线直接按当前档位发出
    expect(lineScaler.track([{ id: 'd', thickness: 90 }])[0]).toEqual({ id: 'd', thickness: 27 })
  })
})
