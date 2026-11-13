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

describe('DtsSceneApi 的调用顺序', () => {
  /** 按调用顺序记录 "对象类.方法" 和参数 */
  let log: { call: string; args: unknown[] }[]
  let results: Record<string, unknown>
  let warn: ReturnType<typeof vi.spyOn>

  const names = () => log.map(l => l.call)

  beforeEach(() => {
    log = []
    results = {}
    const object = (type: string) =>
      Object.fromEntries(
        ['add', 'delete', 'show', 'hide', 'focus', 'addByHeatPoints'].map(method => [
          method,
          async (...args: unknown[]) => {
            log.push({ call: `${type}.${method}`, args })
            return results[`${type}.${method}`] ?? { result: 0 }
          }
        ])
      )
    vi.stubGlobal('__xapi', {
      marker: object('marker'),
      polyline: object('polyline'),
      heatmap: object('heatmap'),
      camera: {
        set: async (...args: unknown[]) => {
          log.push({ call: 'camera.set', args })
          return { result: 0 }
        }
      },
      coord: {
        gcs2pcs: async (...args: unknown[]) => {
          log.push({ call: 'coord.gcs2pcs', args })
          return results['coord.gcs2pcs'] ?? { result: 0, coordinates: [] }
        }
      }
    })
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
    vi.unstubAllGlobals()
  })

  it('deletes objects with the same ids before adding them', async () => {
    const objects = [{ id: 'm1' }, { id: 'm2' }]
    await new DtsSceneApi().add('marker', objects)
    expect(names()).toEqual(['marker.delete', 'marker.add'])
    expect(log[0].args).toEqual([['m1', 'm2']])
    expect(log[1].args).toEqual([objects])
  })

  it('returns early on empty input without calling the SDK', async () => {
    await new DtsSceneApi().add('marker', [])
    await new DtsSceneApi().add('heatmap', [])
    expect(log).toEqual([])
  })

  it('does not warn when the delete before an add reports that the object does not exist', async () => {
    results['marker.delete'] = { result: 5, resultMessage: 'not found' }
    await new DtsSceneApi().add('marker', [{ id: 'm1' }])
    expect(names()).toEqual(['marker.delete', 'marker.add'])
    expect(warn).not.toHaveBeenCalled()
  })

  it('still warns when a plain remove fails', async () => {
    results['marker.delete'] = { result: 5, resultMessage: 'not found' }
    await new DtsSceneApi().remove('marker', ['m1'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('marker.delete')
  })

  it('deletes heatmaps first, then adds them one by one through addByHeatPoints', async () => {
    const a = { id: 'h1' }
    const b = { id: 'h2' }
    await new DtsSceneApi().add('heatmap', [a, b])
    expect(names()).toEqual(['heatmap.delete', 'heatmap.addByHeatPoints', 'heatmap.addByHeatPoints'])
    expect(log[0].args).toEqual([['h1', 'h2']])
    expect(log[1].args).toEqual([a])
    expect(log[2].args).toEqual([b])
  })

  it('shows or hides by id', async () => {
    const api = new DtsSceneApi()
    await api.setVisible('polyline', ['l1'], true)
    await api.setVisible('polyline', ['l1'], false)
    expect(names()).toEqual(['polyline.show', 'polyline.hide'])
    expect(log[0].args).toEqual([['l1']])
  })

  it('passes the camera view and a default fly time of 2 s', async () => {
    const api = new DtsSceneApi()
    await api.setCamera([1, 2, 3, -40, 30])
    await api.setCamera([1, 2, 3, -40, 30], 0.5)
    expect(log[0].args).toEqual([1, 2, 3, -40, 30, 2])
    expect(log[1].args).toEqual([1, 2, 3, -40, 30, 0.5])
  })

  it('focuses with a default distance of 600 m', async () => {
    const api = new DtsSceneApi()
    await api.focus('marker', 'm1')
    await api.focus('marker', 'm1', 1800)
    expect(log[0].args).toEqual(['m1', 600, 2])
    expect(log[1].args).toEqual(['m1', 1800, 2])
  })

  it('projects through coord.gcs2pcs and skips the call for an empty list', async () => {
    const api = new DtsSceneApi()
    expect(await api.project([])).toEqual([])
    expect(log).toEqual([])
    results['coord.gcs2pcs'] = { result: 0, coordinates: [[100, 200, 0]] }
    expect(await api.project([[54.3, 24.4]])).toEqual([[100, 200, 0]])
    expect(log[0].args).toEqual([[[54.3, 24.4]], 1])
  })
})
