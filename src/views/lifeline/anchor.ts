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

/**
 * 折线两侧 d 米的缓冲面（两端半圆封口），返回不闭合的环（投影坐标）。
 * 用于影响分析：沿受影响管段画出影响范围。转角处按角平分线外扩，急弯时限制外扩倍数。
 */
export function bufferLine(line: number[][], d: number, capSegments = 8): XY[] {
  const pts = line.filter((p, i) => i === 0 || Math.hypot(p[0] - line[i - 1][0], p[1] - line[i - 1][1]) > 1e-6)
  if (pts.length < 2) {
    const c = pts[0] ?? [0, 0]
    return Array.from({ length: capSegments * 2 }, (_, i) => {
      const a = (Math.PI * i) / capSegments
      return [c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d] as XY
    })
  }
  // 每一段的左法向
  const normals = pts.slice(1).map((p, i) => {
    const dx = p[0] - pts[i][0]
    const dy = p[1] - pts[i][1]
    const len = Math.hypot(dx, dy)
    return [-dy / len, dx / len]
  })
  const offsets = pts.map((_, i) => {
    if (i === 0) return normals[0]
    if (i === pts.length - 1) return normals[normals.length - 1]
    const a = normals[i - 1]
    const b = normals[i]
    const mx = a[0] + b[0]
    const my = a[1] + b[1]
    const len = Math.hypot(mx, my) || 1
    const m = [mx / len, my / len]
    const scale = 1 / Math.max(0.5, m[0] * b[0] + m[1] * b[1])
    return [m[0] * scale, m[1] * scale]
  })
  const side = (sign: number) => pts.map((p, i) => [p[0] + offsets[i][0] * d * sign, p[1] + offsets[i][1] * d * sign] as XY)
  const cap = (center: number[], normal: number[]) => {
    const start = Math.atan2(normal[1], normal[0])
    return Array.from({ length: capSegments - 1 }, (_, k) => {
      const a = start - (Math.PI * (k + 1)) / capSegments
      return [center[0] + Math.cos(a) * d, center[1] + Math.sin(a) * d] as XY
    })
  }
  const last = pts.length - 1
  const left = side(1)
  const right = side(-1).reverse()
  const n0 = normals[0]
  return [...left, ...cap(pts[last], normals[normals.length - 1]), ...right, ...cap(pts[0], [-n0[0], -n0[1]])]
}
