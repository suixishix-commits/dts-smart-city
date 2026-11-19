import type { DemoData, DemoRegion } from '@/views/heatdemo/HeatDemoScene'

/**
 * 片区热力数据接口。
 *
 * 地址取 smart-city.js 的 regionHeatApi；没配置时用本地示例 public/data/heatmap-demo/region-heat.json。
 * 示例文件和接口返回的格式完全一样，接真实接口时只改地址：
 *   { code: 200, msg, data: { regions: [{ regionCode, regionName, level, value: '1.25E+9', center: { x, y } }],
 *     geometry: GeoJSON FeatureCollection（properties.regionCode 对应 regions，Polygon / MultiPolygon，WGS84），
 *     minValue: '-1.375E+10', maxValue: '1.25E+9' } }
 */
export interface RegionHeatResponse {
  code: number
  msg?: string
  data: {
    regions: { regionCode: string; regionName: string; level?: string; value: string | number; center: { x: number; y: number } }[]
    geometry: { features: { properties: { regionCode: string }; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } }[] }
    minValue?: string | number
    maxValue?: string | number
  }
}

/** 边界简化容差，度（约 30 米）：画边界线、判断格点落在哪个片区都够用，点数降到约二十分之一 */
const SIMPLIFY = 0.0003

/** Douglas–Peucker 折线简化（迭代，长边界也不会爆栈） */
export function simplify(points: number[][], tol = SIMPLIFY): number[][] {
  if (points.length < 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop() as [number, number]
    const [ax, ay] = points[a]
    const dx = points[b][0] - ax
    const dy = points[b][1] - ay
    const len = Math.hypot(dx, dy)
    let far = -1
    let best = tol
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i]
      const d = len > 1e-12 ? Math.abs(dy * (px - ax) - dx * (py - ay)) / len : Math.hypot(px - ax, py - ay)
      if (d > best) {
        best = d
        far = i
      }
    }
    if (far >= 0) {
      keep[far] = 1
      stack.push([a, far], [far, b])
    }
  }
  return points.filter((_, i) => keep[i])
}

/** 接口返回 → 页面用的结构：数值转数字，只取各多边形的外环并简化 */
export function adaptRegionHeat(res: RegionHeatResponse): DemoData {
  if (res.code !== 200 || !res.data) throw new Error('片区热力接口返回异常：' + (res.msg ?? res.code))
  const outlines = new Map<string, number[][][]>()
  for (const f of res.data.geometry?.features ?? []) {
    const g = f.geometry
    const polygons = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][]
    outlines.set(String(f.properties.regionCode), polygons.map(poly => simplify(poly[0].map(p => [p[0], p[1]]))))
  }
  const regions: DemoRegion[] = res.data.regions.map(r => ({
    code: String(r.regionCode),
    name: r.regionName,
    value: Number(r.value),
    center: [r.center.x, r.center.y],
    rings: outlines.get(String(r.regionCode)) ?? []
  }))
  const values = regions.map(r => r.value)
  return {
    min: res.data.minValue !== undefined ? Number(res.data.minValue) : Math.min(...values),
    max: res.data.maxValue !== undefined ? Number(res.data.maxValue) : Math.max(...values),
    regions: regions.filter(r => Number.isFinite(r.value) && r.rings.length)
  }
}

export async function getRegionHeat(): Promise<DemoData> {
  const url: string = gVar?.smartCity?.regionHeatApi || `${import.meta.env.BASE_URL}data/heatmap-demo/region-heat.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`片区热力接口请求失败：${res.status}`)
  return adaptRegionHeat(await res.json())
}
