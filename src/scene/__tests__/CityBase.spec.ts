import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadGeoJson } from './fixtures'

const mocks = vi.hoisted(() => ({
  ready: true,
  pak: false,
  applyAmbience: vi.fn(async () => {}),
  mountEffectsPak: vi.fn(async () => false),
  getGeoData: vi.fn()
}))

vi.mock('../sceneReady', () => ({ whenSceneReady: async () => mocks.ready }))
vi.mock('../effects', () => ({
  applyAmbience: mocks.applyAmbience,
  mountEffectsPak: mocks.mountEffectsPak,
  loadLib: vi.fn(async () => ({}))
}))
vi.mock('@/api/geo', () => ({ getGeoData: mocks.getGeoData }))

/** cityBase 是模块级单例，每个用例重新加载 */
async function load() {
  vi.resetModules()
  return (await import('../CityBase')).cityBase
}

describe('cityBase', () => {
  const geoJson = loadGeoJson()
  /** CityBase 启动时逐类清空的接口对象类型 */
  const TYPES = ['marker', 'marker3d', 'polygon', 'polygon3d', 'polyline', 'odline', 'beam', 'radiationPoint', 'heatmap', 'customObject']
  type ObjectApi = Record<'add' | 'delete' | 'show' | 'hide' | 'clear', ReturnType<typeof vi.fn>>
  let objects: Record<string, ObjectApi>
  let polyline: ObjectApi
  let gcs2pcs: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mocks.ready = true
    mocks.applyAmbience.mockClear()
    mocks.mountEffectsPak.mockReset().mockResolvedValue(false)
    mocks.getGeoData.mockReset().mockResolvedValue(geoJson)
    const objectApi = (): ObjectApi => ({
      add: vi.fn(async () => ({ result: 0 })),
      delete: vi.fn(async () => ({ result: 0 })),
      show: vi.fn(async () => ({ result: 0 })),
      hide: vi.fn(async () => ({ result: 0 })),
      clear: vi.fn(async () => ({ result: 0 }))
    })
    objects = Object.fromEntries(TYPES.map(t => [t, objectApi()]))
    polyline = objects.polyline
    gcs2pcs = vi.fn(async (lonLat: number[][]) => ({ result: 0, coordinates: lonLat.map(p => [p[0] * 1e5, p[1] * 1e5, 0]) }))
    vi.stubGlobal('__xapi', { ...objects, coord: { gcs2pcs } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null and draws nothing when the scene is not connected', async () => {
    mocks.ready = false
    const cityBase = await load()
    expect(await cityBase.start()).toBeNull()
    expect(cityBase.geo).toBeNull()
    expect(mocks.applyAmbience).not.toHaveBeenCalled()
    expect(polyline.add).not.toHaveBeenCalled()
    for (const t of TYPES) expect(objects[t].clear, t).not.toHaveBeenCalled()
  })

  it('clears the objects a previous page left in the render instance before drawing anything', async () => {
    const cityBase = await load()
    await cityBase.start()
    for (const t of TYPES) expect(objects[t].clear, t).toHaveBeenCalledTimes(1)
    const lastClear = Math.max(...TYPES.map(t => objects[t].clear.mock.invocationCallOrder[0]))
    expect(lastClear).toBeLessThan(mocks.applyAmbience.mock.invocationCallOrder[0])
    expect(lastClear).toBeLessThan(mocks.mountEffectsPak.mock.invocationCallOrder[0])
    expect(lastClear).toBeLessThan(polyline.add.mock.invocationCallOrder[0])
  })

  it('applies the ambience, mounts the pak and returns the projected geo data', async () => {
    const cityBase = await load()
    const geo = await cityBase.start()
    expect(geo).not.toBeNull()
    expect(cityBase.geo).toBe(geo)
    expect(geo!.districts).toHaveLength(geoJson.districts.length)
    expect(mocks.applyAmbience).toHaveBeenCalledTimes(1)
    expect(mocks.mountEffectsPak).toHaveBeenCalledTimes(1)
    expect(cityBase.pak).toBe(false)
    // geo.json 的全部坐标一次投影完
    expect(gcs2pcs).toHaveBeenCalledTimes(1)
  })

  it('starts only once, however many modules ask', async () => {
    const cityBase = await load()
    const [a, b] = await Promise.all([cityBase.start(), cityBase.start()])
    expect(a).toBe(b)
    expect(await cityBase.start()).toBe(a)
    expect(mocks.getGeoData).toHaveBeenCalledTimes(1)
    expect(polyline.add).toHaveBeenCalledTimes(1)
  })

  // 路网的粗细、亮度还在按实际画面调，这里只断言不随调参变化的关系
  it('draws every road plus the closed coastline in one call, trunk roads thicker and brighter than the rest', async () => {
    const cityBase = await load()
    await cityBase.start()
    const lines = polyline.add.mock.calls[0][0] as Record<string, any>[]
    expect(lines.map(l => l.id)).toEqual([...geoJson.roads.map(r => 'sc_base_road_' + r.id), 'sc_base_coast'])
    expect(lines.every(l => l.groupId === 'sc_base')).toBe(true)

    const trunk = lines.find(l => l.id === 'sc_base_road_corniche')!
    const minor = lines.find(l => l.id === 'sc_base_road_hamdan')!
    expect(trunk.thickness).toBeGreaterThan(minor.thickness)
    expect(trunk.intensity).toBeGreaterThan(minor.intensity)
    expect(trunk.coordinates).toHaveLength(geoJson.roads.find(r => r.id === 'corniche')!.path.length)
    for (const r of geoJson.roads) {
      const l = lines.find(x => x.id === 'sc_base_road_' + r.id)!
      expect(l.thickness, r.id).toBe(r.level === 1 ? trunk.thickness : minor.thickness)
    }

    // 海岸线是闭合的静态细线
    const coast = lines[lines.length - 1]
    expect(coast.style).toBe(4)
    expect(coast.coordinates).toHaveLength(geoJson.island.length + 1)
    expect(coast.coordinates[coast.coordinates.length - 1]).toEqual(coast.coordinates[0])
  })

  it('draws the same road network whether or not the effects pak is mounted, and records the result in pak', async () => {
    const without = await load()
    await without.start()
    expect(without.pak).toBe(false)
    const plain = polyline.add.mock.calls[0][0]

    polyline.add.mockClear()
    mocks.mountEffectsPak.mockResolvedValue(true)
    const withPak = await load()
    await withPak.start()
    expect(withPak.pak).toBe(true)
    expect(polyline.add.mock.calls[0][0]).toEqual(plain)
  })

  it('hides and shows the roads but never the coastline', async () => {
    const cityBase = await load()
    await cityBase.start()
    const roadIds = geoJson.roads.map(r => 'sc_base_road_' + r.id)
    await cityBase.setRoadsVisible(false)
    expect(polyline.hide).toHaveBeenCalledWith(roadIds)
    await cityBase.setRoadsVisible(true)
    expect(polyline.show).toHaveBeenCalledWith(roadIds)
  })

  it('remembers a road switch made before start and applies it once the roads exist', async () => {
    const cityBase = await load()
    await cityBase.setRoadsVisible(false)
    expect(polyline.hide).not.toHaveBeenCalled()
    await cityBase.start()
    expect(polyline.hide).toHaveBeenCalledTimes(1)
    expect((polyline.hide.mock.calls[0][0] as string[]).includes('sc_base_coast')).toBe(false)
  })
})
