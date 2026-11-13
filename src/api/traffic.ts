import type { TrafficData } from '@/types/traffic'
import { getGeoData } from './geo'
import { buildTrafficData } from './mock/traffic'

/**
 * 智慧交通数据。一期由地理底数据（geo.json）生成 mock；接真实后端时只改这个函数。
 */
export async function getTrafficData(): Promise<TrafficData> {
  return buildTrafficData(await getGeoData())
}
