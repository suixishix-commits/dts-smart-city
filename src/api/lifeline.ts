import type { LifelineData } from '@/types/lifeline'
import { getGeoData } from './geo'
import { buildLifelineData } from './mock/lifeline'

/**
 * 城市生命线数据。一期由地理底数据（geo.json）生成 mock；接真实后端时只改这个函数。
 */
export async function getLifelineData(): Promise<LifelineData> {
  return buildLifelineData(await getGeoData())
}
