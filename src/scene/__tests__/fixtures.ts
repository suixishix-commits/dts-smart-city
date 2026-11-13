import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GeoData } from '@/types/geo'
import type { OverviewData } from '@/types/smartCity'
import { buildCityGeo, type CityGeo } from '../geo'

/** 读取 public/data/smart-city 下的数据文件（vitest 的工作目录是项目根） */
function readData<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/smart-city', name), 'utf8')) as T
}

/** 真实的 geo.json */
export function loadGeoJson(): GeoData {
  return readData<GeoData>('geo.json')
}

/** 真实的 overview.json（不含片区，片区由 geo.json 提供） */
export function loadOverviewJson(): Omit<OverviewData, 'districts'> {
  return readData<Omit<OverviewData, 'districts'>>('overview.json')
}

/** 假投影：经纬度 ×1e5，约等于 1 单位 ≈ 1 米，z 固定为 0 */
export const fakeProject = async (lonLat: number[][]): Promise<number[][]> => lonLat.map(p => [p[0] * 1e5, p[1] * 1e5, 0])

/** 用真实 geo.json + 假投影构造的 CityGeo */
export function loadCityGeo(): Promise<CityGeo> {
  return buildCityGeo(loadGeoJson(), fakeProject)
}
