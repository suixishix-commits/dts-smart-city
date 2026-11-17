/**
 * 热力场（UE 材质 HeatField V1，dts-effect-kit/projects/HeatField_20261117），替代 DTS 自带热力图。
 *
 * DTS 热力图每次换数据都要整张重新生成纹理，时间轴播放时一直闪。这里改成：
 * - 前端把热力点在规则网格上采样成一张平滑的密度面，作为一个 customMesh 发给渲染端（只发陆地上有热度的格子）；
 * - 顶点颜色的 A 是密度 0–1（线性 8 位，三角形内插值后就是连续的面），色带、等值线、高值呼吸都在材质里算；
 * - 换数据时新面以透明度 0 加上，和旧面交叉淡入淡出后再删旧面：画面始终有一张完整的热力面，不闪。
 */
import type { SceneApi } from './SceneApi'

export const HEAT_FIELD_MATERIAL = '/JC_CustomAssets/HeatField/MI_HeatField_V1'

export interface HeatSource {
  /** 投影坐标 [x, y]（米） */
  at: number[]
  /** 影响半径，米 */
  radius: number
  value: number
}

/** 规则网格上的密度场，values 按行排列（row * cols + col），已归一化到 0–1 */
export interface HeatField {
  origin: [number, number]
  step: number
  cols: number
  rows: number
  values: Float32Array
}

/**
 * 在规则网格上采样热力点。
 * points 做加权平均（高斯核，σ = 半径 × 0.6）：相邻格点的密度连成一张平滑的面，边缘随覆盖度淡出；
 * extra 直接叠加（热点事件这类局部峰值，平均会把它们冲淡）。结果按 range 归一化并截到 0–1。
 */
export function sampleHeatField(o: { points: HeatSource[]; extra?: HeatSource[]; range: [number, number]; step: number }): HeatField {
  const all = [...o.points, ...(o.extra ?? [])]
  if (all.length === 0) return { origin: [0, 0], step: o.step, cols: 0, rows: 0, values: new Float32Array(0) }
  const pad = Math.max(...all.map(p => p.radius)) * 1.5
  const step = o.step
  const x0 = Math.floor((Math.min(...all.map(p => p.at[0])) - pad) / step) * step
  const y0 = Math.floor((Math.min(...all.map(p => p.at[1])) - pad) / step) * step
  const cols = Math.ceil((Math.max(...all.map(p => p.at[0])) + pad - x0) / step) + 1
  const rows = Math.ceil((Math.max(...all.map(p => p.at[1])) + pad - y0) / step) + 1
  const n = cols * rows
  const wsum = new Float32Array(n)
  const vsum = new Float32Array(n)
  const add = new Float32Array(n)
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
  for (let i = 0; i < n; i++) {
    // 覆盖度不足 1 时（陆地边缘、海上）按覆盖度淡出，而不是把边上的一个点放大成整片
    const base = wsum[i] > 0 ? (vsum[i] / Math.max(wsum[i], 1)) : 0
    values[i] = Math.min(1, Math.max(0, (base + add[i] - lo) / span))
  }
  return { origin: [x0, y0], step, cols, rows, values }
}

/** 低于它的格子不发（四个角都低于时整格省掉） */
const CUTOFF = 0.03
/** 离地高度，米（材质关了深度测试，只影响透视下的位置） */
const FIELD_Z = 8

/** 把密度场转成 customMesh 参数；没有任何格子有热度时返回 null */
export function heatFieldMesh(id: string, field: HeatField, o: { groupId?: string; opacity?: number; brightness?: number; levels?: number } = {}): Record<string, unknown> | null {
  const { cols, rows, values, step } = field
  const [x0, y0] = field.origin
  const index = new Int32Array(cols * rows).fill(-1)
  const coordinates: number[][] = []
  const colors: number[][] = []
  const indices: number[] = []
  const vertex = (r: number, c: number) => {
    const i = r * cols + c
    if (index[i] < 0) {
      index[i] = coordinates.length
      coordinates.push([x0 + c * step, y0 + r * step, FIELD_Z])
      colors.push([1, 1, 1, Math.round(values[i] * 1000) / 1000])
    }
    return index[i]
  }
  for (let r = 0; r + 1 < rows; r++) {
    for (let c = 0; c + 1 < cols; c++) {
      const a = r * cols + c
      if (Math.max(values[a], values[a + 1], values[a + cols], values[a + cols + 1]) < CUTOFF) continue
      const v00 = vertex(r, c)
      const v10 = vertex(r, c + 1)
      const v11 = vertex(r + 1, c + 1)
      const v01 = vertex(r + 1, c)
      indices.push(v00, v10, v11, v00, v11, v01)
    }
  }
  if (indices.length === 0) return null
  const scalarParameters = [{ name: 'Opacity', value: o.opacity ?? 1 }]
  if (o.brightness !== undefined) scalarParameters.push({ name: 'Brightness', value: o.brightness })
  if (o.levels !== undefined) scalarParameters.push({ name: 'Levels', value: o.levels })
  return {
    id,
    groupId: o.groupId,
    coordinateType: 0,
    coordinates,
    colors,
    indices,
    color: [1, 1, 1, 1],
    createCollision: false,
    material: HEAT_FIELD_MATERIAL,
    scalarParameters
  }
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
const ease = (t: number) => t * t * (3 - 2 * t)

/**
 * 一个热力场图层：show() 换数据时交叉淡入淡出，重叠调用只保留最新一次。
 * 需要 SceneApi.update（改材质参数）；没有时直接替换。
 */
export class HeatFieldLayer {
  private live: string | null = null
  private slot = 0
  private pending: HeatField | null = null
  private running: Promise<void> | null = null
  private visible = true
  private cleared = false
  /** 图层关着时收到的最新数据：不创建对象（创建后再隐藏会闪一帧），打开时再创建 */
  private deferred: HeatField | null = null

  constructor(
    private readonly api: SceneApi,
    private readonly o: { id: string; groupId?: string; brightness?: number; levels?: number; fadeMs?: number; fadeSteps?: number }
  ) {}

  /** 换成新的密度场（第一次直接出现，之后交叉淡入淡出） */
  show(field: HeatField): Promise<void> {
    this.cleared = false
    this.pending = field
    this.running ??= this.loop()
    return this.running
  }

  async setVisible(visible: boolean): Promise<void> {
    this.visible = visible
    await this.running
    if (visible && this.deferred) {
      const field = this.deferred
      this.deferred = null
      await this.show(field)
      return
    }
    if (this.live) await this.api.setVisible('customMesh', [this.live], visible)
  }

  /** 删除图层（离开模块时） */
  async clear(): Promise<void> {
    this.cleared = true
    this.pending = null
    this.deferred = null
    await this.running
    if (this.live) {
      const id = this.live
      this.live = null
      await this.api.remove('customMesh', [id])
    }
  }

  get currentId(): string | null {
    return this.live
  }

  private async loop(): Promise<void> {
    try {
      while (this.pending && !this.cleared) {
        const field = this.pending
        this.pending = null
        await this.swap(field)
      }
    } finally {
      this.running = null
    }
  }

  private async swap(field: HeatField): Promise<void> {
    if (!this.visible) {
      // 关着的图层：删掉旧面，记住最新数据，打开时再建
      this.deferred = field
      if (this.live) {
        const id = this.live
        this.live = null
        await this.api.remove('customMesh', [id])
      }
      return
    }
    const old = this.live
    const fade = !!old && !!this.api.update
    this.slot = 1 - this.slot
    const id = `${this.o.id}-${this.slot ? 'b' : 'a'}`
    const mesh = heatFieldMesh(id, field, { groupId: this.o.groupId, opacity: fade ? 0 : 1, brightness: this.o.brightness, levels: this.o.levels })
    if (mesh) {
      await this.api.add('customMesh', [mesh as { id: string }])
      this.live = id
      if (fade && old) await this.crossFade(id, old)
    } else {
      this.live = null
    }
    if (old) await this.api.remove('customMesh', [old])
  }

  private async crossFade(inId: string, outId: string): Promise<void> {
    const steps = this.o.fadeSteps ?? 6
    const pause = (this.o.fadeMs ?? 480) / steps
    for (let k = 1; k <= steps; k++) {
      // 已有更新的数据在等：直接跳到终态，马上换下一张
      const a = this.pending || this.cleared ? 1 : ease(k / steps)
      const opacity = (id: string, value: number) => ({ id, scalarParameters: [{ name: 'Opacity', value }] })
      await this.api.update?.('customMesh', [opacity(inId, a), opacity(outId, 1 - a)])
      if (a >= 1) return
      await wait(pause)
    }
  }
}
