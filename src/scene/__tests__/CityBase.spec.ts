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
  mountPointBeaconPak: vi.fn(async () => false),
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
  type ObjectApi = Record<'add' | 'delete' | 'show' | 'hide' | 'clear' | 'update', ReturnType<typeof vi.fn>>
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
      clear: vi.fn(async () => ({ result: 0 })),
      update: vi.fn(async () => ({ result: 0 }))
    })
    objects = Object.fromEntries(TYPES.map(t => [t, objectApi()]))
    polyline = objects.polyline
    gcs2pcs = vi.fn(async (lonLat: number[][]) => ({ result: 0, coordinates: lonLat.map(p => [p[0] * 1e5, p[1] * 1e5, 0]) }))
    vi.stubGlobal('__xapi', { ...objects, coord: { gcs2pcs } })
    // 开场动画要相机接口，这里的桩没有；单独测 introStart / introHome
    vi.stubGlobal('gVar', { smartCity: { intro: false } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('dims the street network to a faint grey and restores each street own colour, leaving the coastline alone', async () => {
    const cityBase = await load()
    await cityBase.start()
    const drawn = polyline.add.mock.calls[0][0] as Record<string, any>[]
    const streets = drawn.filter(l => l.id !== 'sc_base_coast')
    await cityBase.setRoadsDimmed(true)
    await cityBase.setRoadsDimmed(true)
    const dimmed = polyline.update.mock.calls.flatMap(c => c[0] as Record<string, any>[])
    expect(dimmed.map(u => u.id)).toEqual(streets.map(l => l.id))
    expect(dimmed.every(u => u.color[3] < 0.5)).toBe(true)
    expect(dimmed[0].intensity).toBeLessThan(streets[0].intensity)
    // 每批不超过 200 条
    expect(polyline.update.mock.calls.every(c => (c[0] as unknown[]).length <= 200)).toBe(true)

    polyline.update.mockClear()
    await cityBase.setRoadsDimmed(false)
    const restored = polyline.update.mock.calls.flatMap(c => c[0] as Record<string, any>[])
    expect(restored).toEqual(streets.map(l => ({ id: l.id, color: l.color, intensity: l.intensity })))
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
  it('draws every real street plus the closed coastline in one call, higher classes thicker and brighter', async () => {
    const cityBase = await load()
    await cityBase.start()
    const streets = geoJson.streets ?? []
    expect(streets.length).toBeGreaterThan(100)
    const lines = polyline.add.mock.calls[0][0] as Record<string, any>[]
    expect(lines.map(l => l.id)).toEqual([...streets.map(r => 'sc_base_road_' + r.id), 'sc_base_coast'])
    expect(lines.every(l => l.groupId === 'sc_base')).toBe(true)

    const byLevel = (lv: number) => lines.find(l => l.id === 'sc_base_road_' + streets.find(s => s.level === lv)!.id)!
    for (let lv = 1; lv < 4; lv++) {
      expect(byLevel(lv).thickness).toBeGreaterThan(byLevel(lv + 1).thickness)
      expect(byLevel(lv).intensity).toBeGreaterThanOrEqual(byLevel(lv + 1).intensity)
    }
    const first = streets[0]
    expect(lines[0].coordinates).toHaveLength(first.path.length)

    // 海岸线是闭合的静态细线
    const coast = lines[lines.length - 1]
    expect(coast.style).toBe(4)
    expect(coast.coordinates).toHaveLength(geoJson.island.length + 1)
    expect(coast.coordinates[coast.coordinates.length - 1]).toEqual(coast.coordinates[0])
  })

  it('falls back to the main roads when geo.json has no street layer', async () => {
    mocks.getGeoData.mockResolvedValue({ ...geoJson, streets: undefined })
    const cityBase = await load()
    await cityBase.start()
    const lines = polyline.add.mock.calls[0][0] as Record<string, any>[]
    expect(lines.map(l => l.id)).toEqual([...geoJson.roads.map(r => 'sc_base_road_' + r.id), 'sc_base_coast'])
    const trunk = lines.find(l => l.id === 'sc_base_road_corniche')!
    const minor = lines.find(l => l.id === 'sc_base_road_hamdan')!
    expect(trunk.thickness).toBeGreaterThan(minor.thickness)
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
    const roadIds = (geoJson.streets ?? []).map(r => 'sc_base_road_' + r.id)
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

describe('introStart', () => {
  /** 相机视线和地面的交点（朝向约定同 kit.focusView） */
  const groundTarget = ([x, y, z, pitch, yaw]: number[]) => {
    const rad = Math.PI / 180
    const reach = z / Math.tan(-pitch * rad)
    return [x + Math.cos(yaw * rad) * reach, y - Math.sin(yaw * rad) * reach]
  }

  it('starts higher, steeper and turned aside, but looking at the same ground point', async () => {
    const { introStart } = await import('../CityBase')
    const home = [225780, 2698610, 9600, -38, -38]
    const start = introStart(home)
    expect(start[2]).toBeGreaterThan(home[2] * 2)
    expect(start[3]).toBeLessThan(home[3])
    expect(start[4]).not.toBe(home[4])
    const [a, b] = [groundTarget(home), groundTarget(start)]
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1)
  })
})

describe('introHome', () => {
  it('uses the configured camera of the module in the route, falling back to the overview camera', async () => {
    const { introHome } = await import('../CityBase')
    vi.stubGlobal('gVar', { smartCity: { cameras: { overview: [1, 2, 3, -38, -38], traffic: [4, 5, 6, -40, -30] } } })
    expect(introHome('#/traffic')).toEqual([4, 5, 6, -40, -30])
    expect(introHome('#/security?x=1')).toEqual([1, 2, 3, -38, -38])
    expect(introHome('')).toEqual([1, 2, 3, -38, -38])
    vi.stubGlobal('gVar', {})
    expect(introHome('#/traffic')).toBeUndefined()
    vi.unstubAllGlobals()
  })
})
