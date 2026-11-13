import type { GeoData } from '@/types/geo'

let cached: Promise<GeoData> | null = null

/** 主岛地理底数据（片区、道路、路口、地标）。只请求一次 */
export function getGeoData(): Promise<GeoData> {
  cached ??= fetch(`${import.meta.env.BASE_URL}data/smart-city/geo.json`).then(res => {
    if (!res.ok) throw new Error('地理底数据加载失败：' + res.status)
    return res.json() as Promise<GeoData>
  })
  cached.catch(() => (cached = null))
  return cached
}
