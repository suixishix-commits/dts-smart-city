import type { SecurityData } from '@/types/security'
import { getGeoData } from './geo'
import { buildSecurityData } from './mock/security'

import { currentHour } from '@/utils/clock'

export { currentHour }

/**
 * 公共安全数据。一期由地理底数据（geo.json）生成 mock；接真实后端时只改这个函数。
 */
export async function getSecurityData(nowHour: number = currentHour()): Promise<SecurityData> {
  return buildSecurityData(await getGeoData(), nowHour)
}
