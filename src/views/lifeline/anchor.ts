import type { CityGeo, XY } from '@/scene/geo'
import { pointAt, sliceLine } from '@/scene/geo'
import type { Anchor } from '@/types/lifeline'

/** 点 p 在折线上最近位置的比例（0–1，按长度） */
export function fractionOf(line: number[][], p: number[]): number {
  let best = Infinity
  let bestAt = 0
  let walked = 0
  for (let i = 1; i < line.length; i++) {
    const [x0, y0] = line[i - 1]
    const dx = line[i][0] - x0
    const dy = line[i][1] - y0
    const len = Math.hypot(dx, dy)
    if (!len) continue
    const t = Math.min(1, Math.max(0, ((p[0] - x0) * dx + (p[1] - y0) * dy) / (len * len)))
    const d = Math.hypot(p[0] - (x0 + dx * t), p[1] - (y0 + dy * t))
    if (d < best) {
      best = d
      bestAt = walked + t * len
    }
    walked += len
  }
  return walked ? bestAt / walked : 0
}

function roadLine(geo: CityGeo, roadId: string): XY[] {
  const road = geo.road(roadId)
  if (!road) throw new Error('路网里没有道路 ' + roadId)
  return road.line
}

function intersectionXY(geo: CityGeo, id: string): XY {
  const i = geo.intersections.find(x => x.id === id)
  if (!i) throw new Error('路网里没有路口 ' + id)
  return i.xy
}

/** 两个路口在道路上的比例，按从小到大返回 */
export function spanOnRoad(geo: CityGeo, roadId: string, from: string, to: string): [number, number] {
  const line = roadLine(geo, roadId)
  const a = fractionOf(line, intersectionXY(geo, from))
  const b = fractionOf(line, intersectionXY(geo, to))
  return a <= b ? [a, b] : [b, a]
}

/** 道路上两个路口之间的那一段折线（投影坐标） */
export function segmentBetween(geo: CityGeo, roadId: string, from: string, to: string): XY[] {
  const [a, b] = spanOnRoad(geo, roadId, from, to)
  return sliceLine(roadLine(geo, roadId), a, b)
}

/** 把设施位置（Anchor）换成投影坐标 */
export function resolveAnchor(geo: CityGeo, anchor: Anchor): XY {
  if (anchor.kind === 'intersection') return intersectionXY(geo, anchor.id)
  if (anchor.kind === 'landmark') {
    const l = geo.landmark(anchor.id)
    if (!l) throw new Error('地理数据里没有地标 ' + anchor.id)
    return l.xy
  }
  const line = roadLine(geo, anchor.roadId)
  if (anchor.kind === 'road') return pointAt(line, anchor.t)
  const a = fractionOf(line, intersectionXY(geo, anchor.from))
  const b = fractionOf(line, intersectionXY(geo, anchor.to))
  return pointAt(line, a + (b - a) * anchor.t)
}
