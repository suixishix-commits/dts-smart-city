import type { SecurityData } from '@/types/security'
import dayjs from 'dayjs'
import { getGeoData } from './geo'
import { buildSecurityData } from './mock/security'

/** 当前时刻（小时，带小数） */
export function currentHour(): number {
  return dayjs().hour() + dayjs().minute() / 60
}

/**
 * 公共安全数据。一期由地理底数据（geo.json）生成 mock；接真实后端时只改这个函数。
 */
export async function getSecurityData(nowHour: number = currentHour()): Promise<SecurityData> {
  return buildSecurityData(await getGeoData(), nowHour)
}
