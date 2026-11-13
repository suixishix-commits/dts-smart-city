/**
 * 一条出行路线的几何：采集的折线怎么变成画在地上、载体沿着走的那条线。全是纯函数，
 * `GuideLine.ts` 拿它们算。
 *
 * 三步（用户要求，2026-09-26）：
 *  1. `fillet` 转角倒圆——每个拐点换成一段与两侧线段相切的圆弧（二次贝塞尔，控制点就是
 *     拐点），直线段保持直线。宽线在急转弯处的接头会外甩出尖角，样条又会在急弯处外甩，
 *     倒圆两样都没有。
 *  2. `densify` 等距加密——相邻点不超过 STEP 米，线的生长和载体的插值都均匀，加密后相邻
 *     段夹角很小，引擎按直线段（shape 0）连也看不出折。
 *  3. `grownTo` 线的生长——走了多少米，线就画到哪：已过的点加线头的插值点，每拍
 *     `polyline.setCoordinates` 一次；`movePath` 给载体 `startMove` 用的到达时间表。
 */

/** `[x, y, z]`，场景米制（投影坐标）。 */
export type ScenePoint = readonly [number, number, number]

/**
 * 转角倒圆。切点离拐点 `radius` 米，但不超过两侧线段的 45%，免得相邻两个弧互相吃掉。
 *
 * @param points 采集的折线
 * @param radius 切点离拐点的距离，米
 * @param step 弧上采样的间距，米
 */
export function fillet(points: readonly ScenePoint[], radius: number, step: number): ScenePoint[] {
  if (points.length < 3) return points.map((p) => [...p])
  const out: ScenePoint[] = [[...points[0]]]
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    const a = points[i - 1]
    const b = points[i + 1]
    const la = Math.hypot(p[0] - a[0], p[1] - a[1])
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1])
    const d = Math.min(radius, la * 0.45, lb * 0.45)
    const towards = (q: ScenePoint, l: number): ScenePoint => [
      p[0] + ((q[0] - p[0]) * d) / l,
      p[1] + ((q[1] - p[1]) * d) / l,
      p[2] + ((q[2] - p[2]) * d) / l,
    ]
    const A = towards(a, la)
    const B = towards(b, lb)
    const n = Math.max(4, Math.ceil((2 * d) / step))
    for (let k = 0; k <= n; k++) {
      const t = k / n
      const u = 1 - t
      out.push([
        u * u * A[0] + 2 * u * t * p[0] + t * t * B[0],
        u * u * A[1] + 2 * u * t * p[1] + t * t * B[1],
        u * u * A[2] + 2 * u * t * p[2] + t * t * B[2],
      ])
    }
  }
  out.push([...points[points.length - 1]])
  return out
}

/** 等距加密：每段按 `step` 等分插点，x/y/z 都线性插值。 */
export function densify(points: readonly ScenePoint[], step: number): ScenePoint[] {
  const out: ScenePoint[] = [[...points[0]]]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.max(1, Math.ceil(len / step))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
    }
  }
  return out
}

/** 累计里程，`cum[i]` 是到第 i 个顶点为止的长度（平面）。 */
export function cumulative(points: readonly ScenePoint[]): number[] {
  const cum = [0]
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]
    const [bx, by] = points[i]
    cum.push(cum[i - 1] + Math.hypot(bx - ax, by - ay))
  }
  return cum
}

/**
 * 走了 `metres` 之后线应有的顶点：已过的点加线头的插值点。超出总长是整条线；不足两个点
 * 时给头两个点，引擎不画单点的线。
 */
export function grownTo(
  points: readonly ScenePoint[],
  cum: readonly number[],
  metres: number,
): number[][] {
  const total = cum[cum.length - 1]
  if (metres >= total) return points.map((p) => [...p])
  const pts: number[][] = []
  let i = 0
  while (i < points.length && cum[i] <= metres) pts.push([...points[i++]])
  if (i < points.length && i > 0) {
    const a = points[i - 1]
    const b = points[i]
    const t = (metres - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
  }
  // 还没出发（线头和起点重合）：给头两个点，引擎不画零长的线。
  const head = pts[pts.length - 1]
  if (pts.length < 2 || (pts.length === 2 && head.every((v, k) => v === pts[0][k])))
    return [[...points[0]], [...points[1]]]
  return pts
}

/** `customObject.startMove` 的轨迹：每个顶点的到达时间 = 累计里程 / 速度，起点为 0。 */
export function movePath(
  points: readonly ScenePoint[],
  cum: readonly number[],
  speed: number,
): { time: number; coordinate: number[] }[] {
  return points.map((p, i) => ({ time: cum[i] / speed, coordinate: [...p] }))
}
