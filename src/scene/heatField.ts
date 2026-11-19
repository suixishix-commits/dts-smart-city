/**
 * 热力场（UE 材质 HeatField V1，dts-effect-kit/projects/HeatField_20261117），替代 DTS 自带热力图。
 *
 * DTS 热力图每次换数据都要整张重新生成纹理，时间轴播放时一直闪。这里改成：
 * - 前端把热力点在规则网格上采样成一张平滑的密度面，作为一个 customMesh 发给渲染端；
 * - 顶点颜色的 A 是密度 0–1（线性 8 位，三角形内插值后就是连续的面），色带、等值线、高值呼吸都在材质里算；
 * - 网格只建一次：哪些格子要发只取决于热力点的位置（覆盖范围），和数值无关，所以换时刻时形状不变；
 * - 换数据只用 customMesh.update 改顶点颜色（实测约 40 ms、几十 KB），并从当前显示值分几帧插值到新值。
 *   不新增、不删除对象，画面上始终是同一张面，不会闪。
 */
import { linearColor } from './lineFlow'
import type { SceneApi } from './SceneApi'

export const HEAT_FIELD_MATERIAL = '/JC_CustomAssets/HeatField/MI_HeatField_V1_FX'
/** 关掉等值线时的 Levels：密度在 0–1，条数小于 1 时没有整数等值线落在范围里 */
export const HEAT_LINES_OFF = 0.5

export interface HeatSource {
  /** 投影坐标 [x, y]（米） */
  at: number[]
  /** 影响半径，米 */
  radius: number
  value: number
}

/** 规则网格上的密度场，按行排列（row * cols + col） */
export interface HeatField {
  origin: [number, number]
  step: number
  cols: number
  rows: number
  /** 归一化到 0–1 的密度 */
  values: Float32Array
  /** 1 表示该格点在热力点的覆盖范围内（只由位置决定，换时刻不变） */
  covered: Uint8Array
}

/** 覆盖度阈值：核权重之和低于它的格点不在任何热力点附近 */
const COVER_MIN = 0.02

/**
 * 在规则网格上采样热力点。
 * points 做加权平均（高斯核，σ = 半径 × 0.6）：相邻格点的密度连成一张平滑的面，边缘随覆盖度淡出；
 * extra 直接叠加（热点事件这类局部峰值，平均会把它们冲淡）。结果按 range 归一化并截到 0–1。
 * fade 为 false 时不按覆盖度淡出，取真实的加权平均（空气质量这类读数，边上淡出会被读成「变好了」）；
 * mask 限定哪些格点可以建面（例如只在陆地上）。
 */
export function sampleHeatField(o: { points: HeatSource[]; extra?: HeatSource[]; range: [number, number]; step: number; fade?: boolean; mask?: (xy: number[]) => boolean }): HeatField {
  const all = [...o.points, ...(o.extra ?? [])]
  const step = o.step
  if (all.length === 0) return { origin: [0, 0], step, cols: 0, rows: 0, values: new Float32Array(0), covered: new Uint8Array(0) }
  const pad = Math.max(...all.map(p => p.radius)) * 1.5
  const x0 = Math.floor((Math.min(...all.map(p => p.at[0])) - pad) / step) * step
  const y0 = Math.floor((Math.min(...all.map(p => p.at[1])) - pad) / step) * step
  const cols = Math.ceil((Math.max(...all.map(p => p.at[0])) + pad - x0) / step) + 1
  const rows = Math.ceil((Math.max(...all.map(p => p.at[1])) + pad - y0) / step) + 1
  const n = cols * rows
  const wsum = new Float32Array(n)
  const vsum = new Float32Array(n)
  const add = new Float32Array(n)
  const reachW = new Float32Array(n)
  const splat = (p: HeatSource, target: 'avg' | 'add') => {
    const sigma = p.radius * 0.6
    const reach = sigma * 2.6
    const c0 = Math.max(0, Math.floor((p.at[0] - reach - x0) / step))
    const c1 = Math.min(cols - 1, Math.ceil((p.at[0] + reach - x0) / step))
    const r0 = Math.max(0, Math.floor((p.at[1] - reach - y0) / step))
    const r1 = Math.min(rows - 1, Math.ceil((p.at[1] + reach - y0) / step))
    const k = -1 / (2 * sigma * sigma)
    for (let r = r0; r <= r1; r++) {
      const dy = y0 + r * step - p.at[1]
      for (let c = c0; c <= c1; c++) {
        const dx = x0 + c * step - p.at[0]
        const w = Math.exp((dx * dx + dy * dy) * k)
        const i = r * cols + c
        reachW[i] += w
        if (target === 'avg') {
          wsum[i] += w
          vsum[i] += w * p.value
        } else {
          add[i] += w * p.value
        }
      }
    }
  }
  o.points.forEach(p => splat(p, 'avg'))
  o.extra?.forEach(p => splat(p, 'add'))
  const [lo, hi] = o.range
  const span = hi - lo || 1
  const values = new Float32Array(n)
  const covered = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    // 覆盖度不足 1 时（陆地边缘、海上）按覆盖度淡出，而不是把边上的一个点放大成整片
    const base = wsum[i] > 0 ? vsum[i] / (o.fade === false ? wsum[i] : Math.max(wsum[i], 1)) : 0
    values[i] = Math.min(1, Math.max(0, (base + add[i] - lo) / span))
    covered[i] = reachW[i] >= COVER_MIN && (!o.mask || o.mask([x0 + (i % cols) * step, y0 + Math.floor(i / cols) * step])) ? 1 : 0
  }
  return { origin: [x0, y0], step, cols, rows, values, covered }
}

/** 离地高度，米（材质关了深度测试，只影响透视下的位置） */
const FIELD_Z = 8

/** 网格的拓扑：发了哪些格点（顶点顺序）。同一拓扑的两张场可以只换颜色 */
export interface HeatFieldLayout {
  key: string
  /** 第 k 个顶点对应的格点下标 */
  vertices: Int32Array
}

const round3 = (v: number) => Math.round(v * 1000) / 1000

/** 顶点颜色：RGB 不用（白），A 是密度 */
export function heatFieldColors(field: HeatField, layout: HeatFieldLayout, values: Float32Array = field.values): number[][] {
  return Array.from(layout.vertices, i => [1, 1, 1, round3(values[i])])
}

/**
 * 把密度场转成 customMesh 参数和它的拓扑。只发覆盖范围内的格子（四个角都在覆盖范围内）；一个都没有时返回 null。
 */
export function heatFieldMesh(
  id: string,
  field: HeatField,
  o: { groupId?: string; brightness?: number; levels?: number; colors?: readonly string[]; opacity?: number; speed?: number } = {}
): { mesh: Record<string, unknown> & { id: string }; layout: HeatFieldLayout } | null {
  const { cols, rows, covered, step } = field
  const [x0, y0] = field.origin
  const index = new Int32Array(cols * rows).fill(-1)
  const vertices: number[] = []
  const coordinates: number[][] = []
  const indices: number[] = []
  const vertex = (r: number, c: number) => {
    const i = r * cols + c
    if (index[i] < 0) {
      index[i] = vertices.length
      vertices.push(i)
      coordinates.push([x0 + c * step, y0 + r * step, FIELD_Z])
    }
    return index[i]
  }
  for (let r = 0; r + 1 < rows; r++) {
    for (let c = 0; c + 1 < cols; c++) {
      const a = r * cols + c
      const k00 = covered[a]
      const k10 = covered[a + 1]
      const k11 = covered[a + cols + 1]
      const k01 = covered[a + cols]
      const n = k00 + k10 + k11 + k01
      if (n === 4) {
        const v00 = vertex(r, c)
        const v10 = vertex(r, c + 1)
        const v11 = vertex(r + 1, c + 1)
        const v01 = vertex(r + 1, c)
        indices.push(v00, v10, v11, v00, v11, v01)
      } else if (n === 3) {
        // 边缘的格子只缺一个角：画另外三个角的三角形，边界是斜边而不是直角台阶
        const corners: [number, number][] = []
        if (k00) corners.push([r, c])
        if (k10) corners.push([r, c + 1])
        if (k11) corners.push([r + 1, c + 1])
        if (k01) corners.push([r + 1, c])
        indices.push(...corners.map(([rr, cc]) => vertex(rr, cc)))
      }
    }
  }
  if (indices.length === 0) return null
  const layout: HeatFieldLayout = { key: `${x0},${y0},${step},${cols},${rows},${vertices.length},${indices.length}`, vertices: Int32Array.from(vertices) }
  const scalarParameters = [{ name: 'Opacity', value: o.opacity ?? 1 }]
  if (o.brightness !== undefined) scalarParameters.push({ name: 'Brightness', value: o.brightness })
  if (o.levels !== undefined) scalarParameters.push({ name: 'Levels', value: o.levels })
  if (o.speed !== undefined) scalarParameters.push({ name: 'Speed', value: o.speed })
  return {
    mesh: {
      id,
      groupId: o.groupId,
      coordinateType: 0,
      coordinates,
      colors: heatFieldColors(field, layout),
      indices,
      color: [1, 1, 1, 1],
      createCollision: false,
      material: HEAT_FIELD_MATERIAL,
      scalarParameters,
      // 色带 C0–C5（密度 0.35 / 0.55 / 0.68 / 0.8 / 0.9 / 1.0 处的颜色），不传用材质默认的人口热力色带
      ...(o.colors ? { vectorParameters: o.colors.map((c, i) => ({ name: 'C' + i, value: linearColor(c) })) } : {})
    },
    layout
  }
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
const ease = (t: number) => t * t * (3 - 2 * t)

/**
 * 一个热力场图层。第一次 show() 建网格；之后数据只要拓扑不变，就原地改顶点颜色，并从当前显示值插值过去。
 * 重叠调用只保留最新一次（从当前显示到最新目标继续过渡）；图层关着时不建对象，打开时用最新数据创建。
 * 需要 SceneApi.update；没有时每次整张替换。
 */
export class HeatFieldLayer {
  private id: string | null = null
  private layout: HeatFieldLayout | null = null
  /** 当前画面上的值（按格点） */
  private shown: Float32Array | null = null
  private pending: HeatField | null = null
  private running: Promise<void> | null = null
  private visible = true
  private cleared = false
  private slot = 0
  private latest: HeatField | null = null

  constructor(
    private readonly api: SceneApi,
    private readonly o: { id: string; groupId?: string; brightness?: number; levels?: number; colors?: readonly string[]; opacity?: number; speed?: number; tweenMs?: number; tweenSteps?: number }
  ) {}

  /**
   * 原地改材质参数（等值线条数、色带），不重建网格、不闪。没建好时只记下，建网格时用。
   * 等值线：材质在密度 0–1 上画 Levels 条，Levels 小于 1 就一条都没有（见 HEAT_LINES_OFF）。
   */
  async setParams(p: { levels?: number; colors?: readonly string[] }): Promise<void> {
    if (p.levels !== undefined) this.o.levels = p.levels
    if (p.colors) this.o.colors = p.colors
    await this.running
    if (!this.id || !this.api.update) return
    const patch: Record<string, unknown> = { id: this.id }
    if (p.levels !== undefined) patch.scalarParameters = [{ name: 'Levels', value: p.levels }]
    if (p.colors) patch.vectorParameters = p.colors.map((c, i) => ({ name: 'C' + i, value: linearColor(c) }))
    await this.api.update('customMesh', [patch as { id: string }])
  }

  show(field: HeatField): Promise<void> {
    this.cleared = false
    this.latest = field
    if (!this.visible) return this.running ?? Promise.resolve()
    this.pending = field
    this.running ??= this.loop()
    return this.running
  }

  async setVisible(visible: boolean): Promise<void> {
    this.visible = visible
    await this.running
    if (this.id) {
      await this.api.setVisible('customMesh', [this.id], visible)
      // 关着期间数据变了：打开时直接跳到最新值
      if (visible && this.latest) await this.show(this.latest)
    } else if (visible && this.latest) {
      await this.show(this.latest)
    }
  }

  async clear(): Promise<void> {
    this.cleared = true
    this.pending = null
    this.latest = null
    await this.running
    if (this.id) {
      const id = this.id
      this.id = null
      this.layout = null
      this.shown = null
      await this.api.remove('customMesh', [id])
    }
  }

  /** 页面关闭时用：只发删除指令，不等待 */
  abandon(): void {
    this.cleared = true
    this.pending = null
    this.latest = null
    if (this.id) void this.api.remove('customMesh', [this.id]).catch(() => {})
    this.id = null
  }

  get currentId(): string | null {
    return this.id
  }

  private async loop(): Promise<void> {
    try {
      while (this.pending && !this.cleared) {
        const field = this.pending
        this.pending = null
        await this.apply(field)
      }
    } finally {
      this.running = null
    }
  }

  private async apply(field: HeatField): Promise<void> {
    const built = heatFieldMesh(`${this.o.id}-${this.slot ? 'a' : 'b'}`, field, { groupId: this.o.groupId, brightness: this.o.brightness, levels: this.o.levels, colors: this.o.colors, opacity: this.o.opacity, speed: this.o.speed })
    const sameShape = !!built && !!this.id && !!this.layout && built.layout.key === this.layout.key
    if (sameShape && this.api.update && this.shown) {
      await this.tween(field)
      return
    }
    // 第一次或拓扑变了：建新网格（先建后删）
    const old = this.id
    if (built) {
      await this.api.add('customMesh', [built.mesh])
      this.id = built.mesh.id
      this.layout = built.layout
      this.shown = Float32Array.from(field.values)
      this.slot = 1 - this.slot
    } else {
      this.id = null
      this.layout = null
      this.shown = null
    }
    if (old) await this.api.remove('customMesh', [old])
  }

  /** 从当前显示值插值到 field：每步发一次顶点颜色 */
  private async tween(field: HeatField): Promise<void> {
    const id = this.id as string
    const layout = this.layout as HeatFieldLayout
    const from = this.shown as Float32Array
    const to = field.values
    const steps = this.o.tweenSteps ?? 5
    const pause = (this.o.tweenMs ?? 320) / steps
    const now = new Float32Array(to.length)
    for (let k = 1; k <= steps; k++) {
      // 新数据到了：从当前值出发继续过渡到最新目标（外层循环处理）
      if (this.pending || this.cleared) return
      const t = ease(k / steps)
      for (let i = 0; i < to.length; i++) now[i] = from[i] + (to[i] - from[i]) * t
      await this.api.update?.('customMesh', [{ id, colors: heatFieldColors(field, layout, now) } as { id: string }])
      this.shown = Float32Array.from(now)
      if (k < steps) await wait(pause)
    }
  }
}
