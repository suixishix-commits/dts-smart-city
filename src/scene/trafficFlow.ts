/**
 * 交通流光（UE 材质 TrafficFlow V2，设计稿方案 D，dts-effect-kit/projects/TrafficFlow_20261117）：路况流光丝带和通勤 OD 弧线。
 *
 * 两种线都是 customMesh 丝带，材质没有 UV，用顶点颜色带数据（RGB 经 sRGB 转换只能放 0/1，A 是线性 8 位值）：
 * - 路况：R = 横向 0/1，G、B = 拥堵等级的两位，A = 一个流动周期内的相位（0→1）。材质画细实线 + 柔光，
 *   每个周期一个短白光点沿通行方向流动，越堵越慢；严重拥堵缓慢呼吸。
 * - OD：R = 横向 0/1，A = 沿弧长 0→1（起点 → 终点）。材质从起点冷蓝渐变到终点暖色，一个光点从起点流向终点。
 *
 * 网格只建一次：路按流动周期从两端各切一遍（再加折点），所以通行方向翻转、拥堵等级变化都只改顶点颜色
 * （customMesh.update），不新增、不删除对象，换时刻时不闪。
 */
import type { SceneApi } from './SceneApi'

export const ROAD_FLOW_MATERIAL = '/JC_CustomAssets/TrafficFlow/MI_RoadFlow_V2_FX'
export const OD_ARC_MATERIAL = '/JC_CustomAssets/TrafficFlow/MI_OdArc_V2_FX'

/** 一个流动周期的长度，米（白色光点的间距：稀疏，只指示方向） */
export const FLOW_PERIOD = 600
/** 路况丝带离地高度，米（材质关了深度测试） */
const ROAD_Z = 4

export interface RoadFlow {
  id: string
  /** 投影坐标折线 [[x, y], …] */
  path: number[][]
  /** 丝带宽度，米（中心线只占其中一小部分，其余是柔光） */
  width: number
  /** 拥堵等级 0 畅通 … 3 严重 */
  level: number
  /** true：光点从路的终点流向起点 */
  reverse: boolean
}

export interface OdArc {
  id: string
  from: number[]
  to: number[]
  width: number
  warm: boolean
}

interface MeshBuild {
  mesh: Record<string, unknown> & { id: string }
  key: string
  colors: () => number[][]
}

const r2 = (v: number) => Math.round(v * 100) / 100
const r3 = (v: number) => Math.round(v * 1000) / 1000

/** 一条路的切分：每个四边形的起止弧长，以及它所在折线段 */
interface RoadQuad {
  d0: number
  d1: number
}

function cumulative(path: number[][]): number[] {
  const out = [0]
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]))
  return out
}

/** 断点：折点 + 从起点、从终点按周期各切一遍。这样两种方向的相位在每个四边形内都单调落在 [0, 1] */
function roadQuads(cum: number[], period: number): RoadQuad[] {
  const L = cum[cum.length - 1]
  if (L <= 0) return []
  const cuts = new Set<number>(cum.map(r2))
  for (let d = period; d < L; d += period) {
    cuts.add(r2(d))
    cuts.add(r2(L - d))
  }
  cuts.add(0)
  cuts.add(r2(L))
  const sorted = [...cuts].filter(d => d >= 0 && d <= L).sort((a, b) => a - b)
  const quads: RoadQuad[] = []
  for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] > 0.05) quads.push({ d0: sorted[i - 1], d1: sorted[i] })
  return quads
}

/** 弧长 d 处的位置和半宽方向（折点处用斜接方向，长度按 1/cos 放大，转角不断不叠） */
function frameAt(path: number[][], cum: number[], d: number): { p: number[]; n: number[] } {
  const last = path.length - 1
  let i = 1
  while (i < last && cum[i] < d - 1e-6) i++
  const a = path[i - 1]
  const b = path[i]
  const seg = cum[i] - cum[i - 1] || 1
  const t = Math.min(1, Math.max(0, (d - cum[i - 1]) / seg))
  const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  const normal = (u: number[], v: number[]) => {
    const len = Math.hypot(v[0] - u[0], v[1] - u[1]) || 1
    return [-(v[1] - u[1]) / len, (v[0] - u[0]) / len]
  }
  let n = normal(a, b)
  const atVertex = (k: number) => Math.abs(d - cum[k]) < 0.06 && k > 0 && k < last
  const k = atVertex(i) ? i : atVertex(i - 1) ? i - 1 : -1
  if (k > 0) {
    const n1 = normal(path[k - 1], path[k])
    const n2 = normal(path[k], path[k + 1])
    const m = [n1[0] + n2[0], n1[1] + n2[1]]
    const ml = Math.hypot(m[0], m[1])
    if (ml > 1e-3) {
      const cos = Math.max(0.35, (m[0] * n1[0] + m[1] * n1[1]) / ml)
      n = [m[0] / ml / cos, m[1] / ml / cos]
    }
  }
  return { p, n }
}

/** 路况流光的 customMesh；roads 为空时返回 null */
export function roadFlowMesh(id: string, roads: RoadFlow[], o: { groupId?: string; brightness?: number; period?: number } = {}): MeshBuild | null {
  const period = o.period ?? FLOW_PERIOD
  const coordinates: number[][] = []
  const indices: number[] = []
  /** 每个顶点：属于哪条路、横向 0/1、弧长 */
  const meta: { road: number; side: number; d: number; quad: RoadQuad; L: number }[] = []
  roads.forEach((road, ri) => {
    const cum = cumulative(road.path)
    const L = cum[cum.length - 1]
    const half = road.width / 2
    for (const q of roadQuads(cum, period)) {
      const base = coordinates.length
      for (const [d, side] of [
        [q.d0, 0],
        [q.d0, 1],
        [q.d1, 1],
        [q.d1, 0]
      ] as const) {
        const { p, n } = frameAt(road.path, cum, d)
        const s = side ? half : -half
        coordinates.push([r2(p[0] + n[0] * s), r2(p[1] + n[1] * s), ROAD_Z])
        meta.push({ road: ri, side, d, quad: q, L })
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  })
  if (indices.length === 0) return null
  const colors = () =>
    meta.map(v => {
      const road = roads[v.road]
      const lv = Math.max(0, Math.min(3, Math.round(road.level)))
      // 相位：所在周期内的位置。四边形不跨周期边界（两端各切过一遍），所以两种方向都落在 [0, 1]
      const along = road.reverse ? v.L - v.d : v.d
      const qa = road.reverse ? v.L - v.quad.d1 : v.quad.d0
      const k = Math.floor(qa / period + 1e-6)
      const phase = Math.min(1, Math.max(0, along / period - k))
      return [v.side, lv >> 1, lv & 1, r3(phase)]
    })
  const mesh = {
    id,
    groupId: o.groupId,
    coordinateType: 0,
    coordinates,
    colors: colors(),
    indices,
    color: [1, 1, 1, 1],
    createCollision: false,
    material: ROAD_FLOW_MATERIAL,
    scalarParameters: o.brightness !== undefined ? [{ name: 'Brightness', value: o.brightness }] : []
  }
  return { mesh, key: `road:${roads.map(r => r.id + ':' + r.path.length + ':' + r.width).join('|')}:${coordinates.length}`, colors }
}

/** 弧线采样段数 */
const ARC_STEPS = 48

/** 通勤 OD 弧线：低弧（高度约为弦长的 12%），水平丝带；A 从起点 0 到终点 1 */
export function odArcMesh(id: string, arcs: OdArc[], o: { groupId?: string; brightness?: number; lift?: number } = {}): MeshBuild | null {
  const lift = o.lift ?? 0.12
  const coordinates: number[][] = []
  const indices: number[] = []
  const meta: { arc: number; side: number; s: number }[] = []
  arcs.forEach((arc, ai) => {
    // 几何总是从 from 到 to；方向翻转只改 A（顶点颜色），网格不变
    const [x0, y0] = arc.from
    const [x1, y1] = arc.to
    const len = Math.hypot(x1 - x0, y1 - y0)
    if (len < 1) return
    const n = [-(y1 - y0) / len, (x1 - x0) / len]
    const h = len * lift
    const half = arc.width / 2
    const base = coordinates.length
    for (let i = 0; i <= ARC_STEPS; i++) {
      const t = i / ARC_STEPS
      const x = x0 + (x1 - x0) * t
      const y = y0 + (y1 - y0) * t
      const z = 4 * h * t * (1 - t) + 10
      for (const side of [0, 1]) {
        const s = side ? half : -half
        coordinates.push([r2(x + n[0] * s), r2(y + n[1] * s), r2(z)])
        meta.push({ arc: ai, side, s: t })
      }
    }
    for (let i = 0; i < ARC_STEPS; i++) {
      const a = base + i * 2
      indices.push(a, a + 1, a + 3, a, a + 3, a + 2)
    }
  })
  if (indices.length === 0) return null
  return {
    mesh: {
      id,
      groupId: o.groupId,
      coordinateType: 0,
      coordinates,
      colors: [],
      indices,
      color: [1, 1, 1, 1],
      createCollision: false,
      material: OD_ARC_MATERIAL,
      scalarParameters: o.brightness !== undefined ? [{ name: 'Brightness', value: o.brightness }] : []
    },
    key: `od:${arcs.map(a => a.id).join('|')}:${coordinates.length}`,
    colors: () => meta.map(v => [v.side, arcs[v.arc].warm ? 1 : 0, 0, r3(v.s)])
  }
}

/** 通勤方向翻转时 OD 弧线的几何不变：把 from/to 固定成「居住区 → 商务区」，再用 reverse 控制光点方向 */
export function odArcMeshDirected(id: string, arcs: (OdArc & { reverse: boolean })[], o: { groupId?: string; brightness?: number; lift?: number } = {}): MeshBuild | null {
  const built = odArcMesh(id, arcs, o)
  if (!built) return null
  const base = built.colors
  const colors = () => {
    const raw = base()
    // 每条弧 (ARC_STEPS + 1) * 2 个顶点，按顺序
    const per = (ARC_STEPS + 1) * 2
    return raw.map((c, i) => {
      const arc = arcs[Math.floor(i / per)]
      return arc?.reverse ? [c[0], c[1], c[2], r3(1 - c[3])] : c
    })
  }
  built.mesh.colors = colors()
  return { ...built, colors }
}

/**
 * 只换顶点颜色的网格图层：第一次 show() 建网格，之后拓扑（key）不变就 customMesh.update 改颜色；
 * 拓扑变了或没有 update 时整体替换（先建后删）。图层关着时不建对象，打开时用最新的数据。
 */
export class RecolorMeshLayer {
  private id: string | null = null
  private key: string | null = null
  private slot = 0
  private latest: ((id: string) => MeshBuild | null) | null = null
  private running: Promise<void> = Promise.resolve()
  private visible = true

  constructor(
    private readonly api: SceneApi,
    private readonly baseId: string
  ) {}

  /** build 按给定 id 生成网格 */
  show(build: (id: string) => MeshBuild | null): Promise<void> {
    this.latest = build
    if (!this.visible) return this.running
    this.running = this.running.then(() => this.apply())
    return this.running
  }

  async setVisible(visible: boolean): Promise<void> {
    this.visible = visible
    await this.running
    if (this.id) await this.api.setVisible('customMesh', [this.id], visible)
    if (visible && this.latest) await this.show(this.latest)
  }

  async clear(): Promise<void> {
    this.latest = null
    await this.running
    if (this.id) {
      const id = this.id
      this.id = null
      this.key = null
      await this.api.remove('customMesh', [id])
    }
  }

  /** 页面关闭时用：只发删除指令，不等待 */
  abandon(): void {
    this.latest = null
    if (this.id) void this.api.remove('customMesh', [this.id]).catch(() => {})
    this.id = null
  }

  get currentId(): string | null {
    return this.id
  }

  private async apply(): Promise<void> {
    const build = this.latest
    if (!build || !this.visible) return
    const nextId = `${this.baseId}-${this.slot ? 'a' : 'b'}`
    const built = build(this.id ?? nextId)
    if (built && this.id && built.key === this.key && this.api.update) {
      await this.api.update('customMesh', [{ id: this.id, colors: built.colors() } as { id: string }])
      return
    }
    const old = this.id
    const fresh = built && old ? build(nextId) : built
    if (fresh) {
      await this.api.add('customMesh', [fresh.mesh])
      this.id = fresh.mesh.id
      this.key = fresh.key
      this.slot = 1 - this.slot
    } else {
      this.id = null
      this.key = null
    }
    if (old) await this.api.remove('customMesh', [old])
  }
}
