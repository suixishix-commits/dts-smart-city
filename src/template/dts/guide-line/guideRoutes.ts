import type { GuideRide } from './GuideLine'
import type { ScenePoint } from './routePath'

/**
 * 牵引线的演示路线：从同一个起点出发的三条出行路线（直行 / 右转 / 左转），顶点是在当前
 * 工程场景的道路上取的（投影坐标），每条一个颜色、一个标记。
 */

/** 路线顶点统一的场景高度，米：路面约 -0.9，抬高一点不被路面吃掉。 */
const Z = -0.3
/** 线头和标记的速率，米/秒：线越长走得越久。 */
const RIDE_SPEED = 15
/** 线的宽度，米。 */
const LINE_WIDTH_M = 10

const HOME: ScenePoint = [492583, 2491941, Z]
/** 起点到路口的共用前段。 */
const TO_CROSSING: readonly ScenePoint[] = [HOME, [492660, 2491940, Z]]

/** public/static/guide-line 下的标记图，按页面地址解析成 http 地址给引擎拉取。 */
const icon = (file: string): string => new URL(`static/guide-line/${file}.svg`, document.baseURI).href

const ROUTES: readonly Omit<GuideRide, 'speed' | 'width' | 'image'>[] = [
  {
    key: 'south',
    ink: [0.3137, 0.6157, 0.8667],
    points: [...TO_CROSSING, [492650, 2491890, Z], [492632, 2491822, Z]]
  },
  {
    key: 'north',
    ink: [0.5137, 0.7216, 0.3608],
    points: [...TO_CROSSING, [492667, 2491968, Z], [492692, 2492045, Z]]
  },
  {
    key: 'east',
    ink: [0.949, 0.6431, 0.2667],
    points: [HOME, [492764, 2491933, Z], [492900, 2491925, Z]]
  }
]

const IMAGES: Readonly<Record<string, string>> = {
  south: 'family-school',
  north: 'family-park',
  east: 'family-shop'
}

/** 演示路线，带上共用的速率、宽度和各自的标记图。 */
export function demoGuideRides(): GuideRide[] {
  return ROUTES.map((route) => ({ ...route, image: icon(IMAGES[route.key]), speed: RIDE_SPEED, width: LINE_WIDTH_M }))
}
