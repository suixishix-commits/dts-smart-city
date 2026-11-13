import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadGeoJson, loadOverviewJson } from '@/scene/__tests__/fixtures'

const geoJson = loadGeoJson()
const overviewJson = loadOverviewJson()

/** api/geo.ts 在模块级缓存请求，每个用例重新加载 */
async function load() {
  vi.resetModules()
  const geo = await import('../geo')
  const overview = await import('../overview')
  return { getGeoData: geo.getGeoData, getOverviewData: overview.getOverviewData }
}

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })
const failed = (status: number) => ({ ok: false, status, json: async () => ({}) })

describe('数据入口', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => (url.endsWith('geo.json') ? ok(geoJson) : ok(overviewJson)))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getGeoData', () => {
    it('loads data/smart-city/geo.json', async () => {
      const { getGeoData } = await load()
      expect(await getGeoData()).toEqual(geoJson)
      expect(fetchMock.mock.calls[0][0]).toMatch(/data\/smart-city\/geo\.json$/)
    })

    it('requests the file only once', async () => {
      const { getGeoData } = await load()
      const [a, b] = await Promise.all([getGeoData(), getGeoData()])
      expect(a).toBe(b)
      await getGeoData()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('rejects with the HTTP status and retries on the next call', async () => {
      fetchMock.mockResolvedValueOnce(failed(404))
      const { getGeoData } = await load()
      await expect(getGeoData()).rejects.toThrow('404')
      expect(await getGeoData()).toEqual(geoJson)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('getOverviewData', () => {
    it('merges overview.json with the districts of geo.json', async () => {
      const { getOverviewData } = await load()
      const data = await getOverviewData()
      expect(fetchMock.mock.calls.map(c => String(c[0]).split('/').pop()).sort()).toEqual(['geo.json', 'overview.json'])
      expect(data.districts).toEqual(geoJson.districts)
      expect(data.hotspots).toEqual(overviewJson.hotspots)
      expect(data.cameras).toEqual(overviewJson.cameras)
      expect(data.alarms).toEqual(overviewJson.alarms)
      expect(data.vitals).toEqual(overviewJson.vitals)
    })

    it('always takes the districts from geo.json, even if overview.json carried its own', async () => {
      fetchMock.mockImplementation(async (url: string) => (url.endsWith('geo.json') ? ok(geoJson) : ok({ ...overviewJson, districts: [{ id: 'stale' }] })))
      const { getOverviewData } = await load()
      expect((await getOverviewData()).districts).toEqual(geoJson.districts)
    })

    it('rejects with the HTTP status when overview.json cannot be loaded', async () => {
      fetchMock.mockImplementation(async (url: string) => (url.endsWith('geo.json') ? ok(geoJson) : failed(500)))
      const { getOverviewData } = await load()
      await expect(getOverviewData()).rejects.toThrow('500')
    })
  })
})
