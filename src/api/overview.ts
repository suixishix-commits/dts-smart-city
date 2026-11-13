import type { OverviewData } from '@/types/smartCity'
import { getGeoData } from './geo'

/**
 * 总览数据。一期读取静态 mock 文件；接真实后端时只改这个函数。
 * 片区来自地理底数据（geo.json），保证面板和场景用的是同一组片区。
 */
export async function getOverviewData(): Promise<OverviewData> {
  const [res, geo] = await Promise.all([fetch(`${import.meta.env.BASE_URL}data/smart-city/overview.json`), getGeoData()])
  if (!res.ok) throw new Error('总览数据加载失败：' + res.status)
  return { ...(await res.json()), districts: geo.districts }
}
