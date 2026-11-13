import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DtsSceneApi } from '../DtsSceneApi'

describe('DtsSceneApi', () => {
  let result: unknown
  let warn: ReturnType<typeof vi.spyOn>
  const call = vi.fn(async () => result)

  beforeEach(() => {
    result = { result: 0 }
    call.mockClear()
    const object = { add: call, delete: call, show: call, hide: call, focus: call, addByHeatPoints: call }
    vi.stubGlobal('__xapi', { marker: object, polygon: object, heatmap: object, camera: { set: call }, coord: { gcs2pcs: call } })
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
    vi.unstubAllGlobals()
  })

  it('stays quiet when the SDK reports success or returns nothing', async () => {
    const api = new DtsSceneApi()
    await api.add('marker', [{ id: 'm1' }])
    result = undefined
    await api.remove('marker', ['m1'])
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns with the operation, ids and message when the SDK reports a failure', async () => {
    result = { result: 3, resultMessage: 'id exists' }
    const api = new DtsSceneApi()
    await api.add('marker', [{ id: 'm1' }, { id: 'm2' }])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('marker.add')
    expect(warn.mock.calls[0]).toContainEqual(['m1', 'm2'])
    expect(warn.mock.calls[0]).toContain('id exists')
  })

  it('warns for every kind of call without throwing', async () => {
    result = { result: 1, resultMessage: 'bad' }
    const api = new DtsSceneApi()
    await api.add('heatmap', [{ id: 'h1' }])
    await api.remove('polygon', ['p1'])
    await api.setVisible('marker', ['m1'], true)
    await api.setVisible('marker', ['m1'], false)
    await api.setCamera([1, 2, 3, 4, 5])
    await api.focus('marker', 'm1')
    expect(warn.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      expect.stringContaining('heatmap.addByHeatPoints'),
      expect.stringContaining('polygon.delete'),
      expect.stringContaining('marker.show'),
      expect.stringContaining('marker.hide'),
      expect.stringContaining('camera.set'),
      expect.stringContaining('marker.focus')
    ])
  })

  it('still throws when the projection fails', async () => {
    result = { result: 1, resultMessage: 'bad' }
    await expect(new DtsSceneApi().project([[1, 2]])).rejects.toThrow('bad')
  })
})
