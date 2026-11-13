import type { EnvironmentData } from '@/types/environment'
import { getGeoData } from './geo'
import { buildEnvironmentData } from './mock/environment'

/**
 * 生态环境数据。一期由地理底数据（geo.json）生成 mock；接真实后端时只改这个函数。
 */
export async function getEnvironmentData(): Promise<EnvironmentData> {
  return buildEnvironmentData(await getGeoData())
}
