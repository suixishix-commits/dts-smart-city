import type { OverviewData } from '@/types/smartCity'

/** 总览数据。一期读取静态 mock 文件；接真实后端时只改这个函数。 */
export async function getOverviewData(): Promise<OverviewData> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/smart-city/overview.json`)
  if (!res.ok) throw new Error('总览数据加载失败：' + res.status)
  return res.json()
}
