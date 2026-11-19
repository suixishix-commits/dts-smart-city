import { pointInRing } from '@/scene/geo'
import { labelWidth, pin, plainLine, staggerLabels } from '@/scene/kit'
import { ModuleScene } from '@/scene/ModuleScene'
import { districtZh } from './names'
import type { SceneApi } from '@/scene/SceneApi'

/** 片区热力数据（接口适配后，见 api/regionHeat.ts） */
export interface DemoRegion {
  code: string
  name: string
  value: number
  /** [lon, lat] */
  center: number[]
  /** 外环，[lon, lat][] */
  rings: number[][][]
}
export interface DemoData {
  min: number
  max: number
  regions: DemoRegion[]
}

/** 投影后的片区 */
export interface ProjectedRegion extends DemoRegion {
  xy: number[]
  ringsXY: number[][][]
  bbox: [number, number, number, number]
}

/**
 * 色板（低 → 高四个颜色），取自巡检项目 customerHeat.ts 的 heatRamps。
 * 着色按数值的绝对值（接口里的负值是同一量的另一种记法，界面上都显示为正的金额），值为 0 的片区不着色。
 */
export interface Palette {
  key: string
  name: string
  ramp: readonly string[]
}
export const PALETTES: Palette[] = [
  { key: 'warm', name: '绿到红', ramp: ['#A8E633', '#FFDB1F', '#FF850F', '#ED1F0F'] },
  { key: 'ocean', name: '深蓝到青', ramp: ['#0A1F5C', '#0D4A8F', '#1688B8', '#3FC9BF'] },
  { key: 'risk', name: '紫到深红', ramp: ['#5A35A5', '#B5368A', '#F04A3E', '#C8102E'] }
]

/**
 * 热力的画法和配色照搬 POPInspection（Inspection-POC/src/dts/heatmap.ts 的 full 模式）：
 * DTS heatmap3d 体积，贴花显示（displayMode 3、blendMode 1、亮度 8），贴在地面和屋顶上；
 * 色带四色转线性再乘 0.35（引擎自动曝光会把亮色洗成粉彩），透明度从低到高 0.35 / 0.55 / 0.75 / 0.95，值为 0 全透明。
 */
const LOOK = { displayMode: 3, blendMode: 1, brightness: 8 }
/**
 * 色带照搬 POPInspection 默认热力（heatmap.ts 的 RAMP，参考图）：低于 0.15 全透明；之后从薄薄一层绿（透明度 0.3）
 * 逐渐加厚到黄、橙，0.78 起是红（0.85–0.92）。warm 用原色；ocean / risk 在同样的位置换成各自色板的四色。
 * 颜色转线性再乘强度（引擎自动曝光会把亮色洗成粉彩）：warm、risk 0.22，ocean 同亮度下发光更强，压到 0.14。
 */
const RAMP: [number, number[]][] = [
  [0, [0.45, 0.8, 0.25, 0]],
  [0.15, [0.45, 0.8, 0.25, 0]],
  [0.26, [0.45, 0.8, 0.25, 0.3]],
  [0.38, [0.8, 0.85, 0.15, 0.45]],
  [0.5, [1, 0.75, 0.1, 0.6]],
  [0.64, [1, 0.42, 0.03, 0.75]],
  [0.78, [0.92, 0.14, 0, 0.85]],
  [1, [0.78, 0.05, 0, 0.92]]
]
/** 每个 RAMP 档位用色板的第几色 */
const PALETTE_STOP = [0, 0, 0, 0, 1, 2, 3, 3]
const PALETTE_INTENSITY: Record<string, number> = { warm: 0.22, ocean: 0.14, risk: 0.22 }
/** 体积的层数、底面和高度（米），同 POPInspection */
const LAYERS = 4
const FLOOR = -50
const HEIGHT = 500
/** 栅格间距（米）和每块体积的边长（格） */
const CELL = 300
/**
 * 不分块：整张热力一个体积。分块时引擎在块与块的交界处过渡不连续，会画出一圈圈细线（网格）。
 * 300 米一格，全酋长国约 430 × 470 格，一个体积装得下；高斯模糊 1.2 公里，格子大小看不出来。
 */
const VOLUME_ID = 'heatdemo-volume'
/** 换数值时引擎的过渡时长，秒（heatmap3d 的 updateTime） */
const TWEEN_SECONDS = 1
/** 等值线的档位（热力强度）：色带的黄绿、黄、橙、橙红、红 */
const ISO_LEVELS = [0.3, 0.45, 0.6, 0.75, 0.9]

/** marching squares 每种角组合的线段：b 下边、r 右边、t 上边、l 左边 */
const CASES: Record<number, string[][]> = {
  1: [['l', 'b']],
  2: [['b', 'r']],
  3: [['l', 'r']],
  4: [['r', 't']],
  5: [['l', 't'], ['b', 'r']],
  6: [['b', 't']],
  7: [['l', 't']],
  8: [['t', 'l']],
  9: [['t', 'b']],
  10: [['t', 'r'], ['l', 'b']],
  11: [['t', 'r']],
  12: [['r', 'l']],
  13: [['r', 'b']],
  14: [['b', 'l']]
}

/**
 * marching squares：栅格上 level 的等值线，拼成折线（坐标是格点下标，可带小数）。
 * 每个格子按四个角是否高于 level 得到线段，再按端点把线段首尾相接。
 */
export function contour(grid: Float32Array, nx: number, ny: number, level: number): number[][][] {
  const key = (p: number[]) => p[0].toFixed(3) + ',' + p[1].toFixed(3)
  const at = (a: number, b: number) => (level - a) / (b - a || 1e-9)
  const segs: number[][][] = []
  for (let j = 0; j + 1 < ny; j++) {
    for (let i = 0; i + 1 < nx; i++) {
      const v0 = grid[j * nx + i]
      const v1 = grid[j * nx + i + 1]
      const v2 = grid[(j + 1) * nx + i + 1]
      const v3 = grid[(j + 1) * nx + i]
      const c = (v0 > level ? 1 : 0) | (v1 > level ? 2 : 0) | (v2 > level ? 4 : 0) | (v3 > level ? 8 : 0)
      if (c === 0 || c === 15) continue
      const edge: Record<string, number[]> = {
        b: [i + at(v0, v1), j],
        r: [i + 1, j + at(v1, v2)],
        t: [i + at(v3, v2), j + 1],
        l: [i, j + at(v0, v3)]
      }
      for (const [a, b] of CASES[c]) segs.push([edge[a], edge[b]])
    }
  }
  // 按端点首尾相接
  const ends = new Map<string, number[]>()
  segs.forEach((sg, k) => {
    for (const p of sg) {
      const kk = key(p)
      const list = ends.get(kk)
      if (list) list.push(k)
      else ends.set(kk, [k])
    }
  })
  const used = new Uint8Array(segs.length)
  const chains: number[][][] = []
  for (let k = 0; k < segs.length; k++) {
    if (used[k]) continue
    used[k] = 1
    const chain = [segs[k][0], segs[k][1]]
    for (const forward of [true, false]) {
      for (;;) {
        const tip = forward ? chain[chain.length - 1] : chain[0]
        const next = (ends.get(key(tip)) ?? []).find(n => !used[n])
        if (next === undefined) break
        used[next] = 1
        const [a, b] = segs[next]
        const other = key(a) === key(tip) ? b : a
        if (forward) chain.push(other)
        else chain.unshift(other)
      }
    }
    chains.push(chain)
  }
  return chains
}
/** heatmap3d 的回应最多等多久，毫秒（体积建得慢） */
const ANSWER_MS = 45000

/**
 * 用回调拿 heatmap3d 的回应：这一版 SDK 的 addByVoxels 返回的 Promise 永远不结束（POPInspection heatmap.ts 实测），
 * await 它会把后续步骤全卡住。超时按没有回应处理（返回 undefined）。
 */
function answer(send: (done: (r: { result?: number } | undefined) => void) => void): Promise<{ result?: number } | undefined> {
  return new Promise(resolve => {
    const timer = window.setTimeout(() => resolve(undefined), ANSWER_MS)
    send(r => {
      window.clearTimeout(timer)
      resolve(r)
    })
  })
}
/** 热力的扩散：高斯核的标准差，米 */
const BLUR_SIGMA = 1200

/** 可分离高斯模糊（先横后竖），边界外按 0 算 */
export function gaussianBlur(src: Float32Array, nx: number, ny: number, sigma: number): Float32Array {
  const r = Math.ceil(sigma * 3)
  const k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)))
  const sum = k.reduce((a, b) => a + b, 0)
  const w = k.map(v => v / sum)
  const tmp = new Float32Array(nx * ny)
  const out = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let v = 0
      for (let d = -r; d <= r; d++) {
        const x = i + d
        if (x >= 0 && x < nx) v += src[j * nx + x] * w[d + r]
      }
      tmp[j * nx + i] = v
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let v = 0
      for (let d = -r; d <= r; d++) {
        const y = j + d
        if (y >= 0 && y < ny) v += tmp[y * nx + i] * w[d + r]
      }
      out[j * nx + i] = v
    }
  }
  return out
}

/** POPInspection 的色带（见 RAMP）：warm 用参考图原色，其余色板在同样的档位换成自己的四色；透明度沿用 RAMP */
export function volumeColors(palette: Palette) {
  const hex = (h: string) => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16) / 255)
  const intensity = PALETTE_INTENSITY[palette.key] ?? 0.22
  return {
    gradient: true,
    invalidColor: [0, 0, 0, 0],
    colorStops: RAMP.map(([value, color], k) => ({
      value,
      color: (palette.key === 'warm' ? color : [...hex(palette.ramp[PALETTE_STOP[k]]), color[3]]).map((v, c) => (c < 3 ? intensity * v ** 2.2 : v))
    }))
  }
}
/** 标注几个：绝对值最大的几个片区 */
const LABELS = 10

/** 着色用的范围：非零绝对值的最小、最大 */
export function magnitudeRange(regions: { value: number }[]): [number, number] {
  const mags = regions.map(r => Math.abs(r.value)).filter(v => v > 0)
  return mags.length ? [Math.min(...mags), Math.max(...mags)] : [0, 0]
}

/** 数值在色板里的位置 0–1；值为 0 返回 null（不着色） */
export function rampPosition(v: number, range: [number, number]): number | null {
  const m = Math.abs(v)
  if (!m) return null
  return range[1] > range[0] ? Math.min(1, Math.max(0, (m - range[0]) / (range[1] - range[0]))) : 1
}

/** 色板上 t 处的颜色（相邻两色线性插值），#rrggbb */
export function rampColorAt(ramp: readonly string[], t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (ramp.length - 1)
  const i = Math.min(ramp.length - 2, Math.floor(x))
  const f = x - i
  const a = parseInt(ramp[i].slice(1), 16)
  const b = parseInt(ramp[i + 1].slice(1), 16)
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f)
  return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('')
}

/** 金额文字（中文）：按绝对值，亿以上写「x 亿迪拉姆」，否则写「x 万迪拉姆」 */
export function aed(v: number): string {
  const m = Math.abs(v)
  if (m >= 1e8) return `${+(m / 1e8).toFixed(1)} 亿迪拉姆`
  if (m >= 1e4) return `${+(m / 1e4).toFixed(0)} 万迪拉姆`
  return `${Math.round(m)} 迪拉姆`
}

/**
 * 片区热力演示的场景：
 * - 热力：各片区按数值绝对值取强度，高斯模糊成连续的热力，越高越红；值为 0 的片区不着色；
 */
export class HeatDemoScene extends ModuleScene {
  private regions: ProjectedRegion[] = []
  private range: [number, number] = [0, 0]
  palette: Palette = PALETTES[0]
  /** 主页机位：投影后按全部片区的范围算 */
  camera: number[] = []
  private entered = false

  constructor(
    api: SceneApi,
    private readonly data: DemoData
  ) {
    super(api)
    this.range = magnitudeRange(data.regions)
  }

  /** 把全部片区投影到场景坐标（一次请求） */
  async project(): Promise<ProjectedRegion[]> {
    const lonlat = this.data.regions.flatMap(r => [r.center, ...r.rings.flat()])
    const xy = await this.api.project(lonlat)
    let k = 0
    this.regions = this.data.regions.map(r => {
      const center = xy[k++]
      const ringsXY = r.rings.map(ring => ring.map(() => xy[k++].slice(0, 2)))
      const pts = ringsXY.flat()
      const xs = pts.map(p => p[0])
      const ys = pts.map(p => p[1])
      return { ...r, xy: center.slice(0, 2), ringsXY, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }
    })
    return this.regions
  }

  /** 场景坐标落在哪个片区（先比外包框再精确判断） */
  regionAt(p: number[]): ProjectedRegion | null {
    for (const r of this.regions) {
      const [x0, y0, x1, y1] = r.bbox
      if (p[0] < x0 || p[0] > x1 || p[1] < y0 || p[1] > y1) continue
      if (r.ringsXY.some(ring => pointInRing(p, ring))) return r
    }
    return null
  }

  /**
   * 框住全部片区的机位：正北朝上斜看，落点在外包框中心偏南一点（斜视时远处被压扁），
   * 视距让范围落在两侧面板之间（场景区约占屏宽一半，水平视场 90°）。
   */
  fitCamera(): number[] {
    const x0 = Math.min(...this.regions.map(r => r.bbox[0]))
    const y0 = Math.min(...this.regions.map(r => r.bbox[1]))
    const x1 = Math.max(...this.regions.map(r => r.bbox[2]))
    const y1 = Math.max(...this.regions.map(r => r.bbox[3]))
    const span = Math.max(x1 - x0, (y1 - y0) * 0.8)
    const pitch = -60
    const yaw = -90
    const dist = span * 1.15
    const rad = Math.PI / 180
    const target = [(x0 + x1) / 2, (y0 + y1) / 2 - (y1 - y0) * 0.05]
    const z = dist * Math.sin(-pitch * rad)
    const g = dist * Math.cos(-pitch * rad)
    return [target[0] - Math.cos(yaw * rad) * g, target[1] + Math.sin(yaw * rad) * g, z, pitch, yaw]
  }

  /** 片区在当前色板下的颜色；值为 0 返回 null */
  colorOf(value: number): string | null {
    const t = rampPosition(value, this.range)
    return t === null ? null : rampColorAt(this.palette.ramp, t)
  }

  /** 栅格范围（只和片区位置有关，算一次） */
  private frame: { x0: number; y0: number; nx: number; ny: number; cell: (ProjectedRegion | null)[] } | null = null

  private gridFrame() {
    if (this.frame) return this.frame
    // 外扩一圈，模糊后的外缘有地方渐隐
    const pad = BLUR_SIGMA * 3
    const x0 = Math.floor((Math.min(...this.regions.map(r => r.bbox[0])) - pad) / CELL) * CELL
    const y0 = Math.floor((Math.min(...this.regions.map(r => r.bbox[1])) - pad) / CELL) * CELL
    const nx = Math.ceil((Math.max(...this.regions.map(r => r.bbox[2])) + pad - x0) / CELL)
    const ny = Math.ceil((Math.max(...this.regions.map(r => r.bbox[3])) + pad - y0) / CELL)
    const cell: (ProjectedRegion | null)[] = new Array(nx * ny).fill(null)
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) cell[j * nx + i] = this.regionAt([x0 + (i + 0.5) * CELL, y0 + (j + 0.5) * CELL])
    this.frame = { x0, y0, nx, ny, cell }
    return this.frame
  }

  /** 热力栅格：每格取所在片区数值的强度（0.3–1，值为 0 不着色），高斯模糊后片区之间平滑过渡，< 0.15 不着色 */
  heatGrid(): { x0: number; y0: number; nx: number; ny: number; grid: Float32Array } {
    const { x0, y0, nx, ny, cell } = this.gridFrame()
    const raw = new Float32Array(nx * ny)
    for (let k = 0; k < raw.length; k++) {
      const r = cell[k]
      const t = r ? rampPosition(r.value, this.range) : null
      if (t !== null) raw[k] = 0.3 + 0.7 * t
    }
    const grid = gaussianBlur(raw, nx, ny, BLUR_SIGMA / CELL)
    for (let k = 0; k < grid.length; k++) grid[k] = grid[k] < 0.15 ? 0 : Math.min(1, grid[k])
    return { x0, y0, nx, ny, grid }
  }

  /** 体积的热力值数组（4 层；纹理的行和投影坐标的北向相反） */
  private heatValues(grid: Float32Array, nx: number, ny: number): number[] {
    const values = new Array<number>(nx * ny * LAYERS).fill(0)
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const v = grid[j * nx + i]
        if (!v) continue
        const t = Math.round(v * 1000) / 1000
        for (let l = 0; l < LAYERS; l++) values[(l * ny + (ny - 1 - j)) * nx + i] = t
      }
    }
    return values
  }

  /** 整张一个 heatmap3d 体积（分块会在块的交界处画出接缝网格） */
  volumes(): { id: string }[] {
    const { x0, y0, nx, ny, grid } = this.heatGrid()
    const [wm, hm] = [nx * CELL, ny * CELL]
    return [
      {
        id: VOLUME_ID,
        groupId: 'sc_heatdemo_volume',
        heatValues: { size: [nx, ny, LAYERS], values: this.heatValues(grid, nx, ny) },
        bbox: [0, 0, 0, wm, hm, HEIGHT],
        volumeBoxLocation: [x0 + wm / 2, y0 + hm / 2, FLOOR],
        volumeBoxSize: [wm, hm, HEIGHT],
        volumeBoxRotation: [0, 0, 0],
        ...LOOK,
        heatValueMode: 0,
        heatValueRange: [0, 1],
        updateTime: TWEEN_SECONDS,
        colors: volumeColors(this.palette)
      } as { id: string }
    ]
  }

  /** 热力值的线（等值线）：在热力栅格上求色带各档的等值线，拼成折线；每档一个颜色（色板对应位置的颜色） */
  isolines(): { id: string }[] {
    const { x0, y0, nx, ny, grid } = this.heatGrid()
    const out: { id: string }[] = []
    ISO_LEVELS.forEach((level, li) => {
      const color = rampColorAt(this.palette.ramp, li / (ISO_LEVELS.length - 1))
      contour(grid, nx, ny, level).forEach((c, ci) => {
        if (c.length < 4) return
        const path = c.map(([i, j]) => [x0 + (i + 0.5) * CELL, y0 + (j + 0.5) * CELL])
        out.push(plainLine({ id: `heatdemo-iso-${li}-${ci}`, groupId: 'sc_heatdemo_iso', path, color, width: 30, brightness: 0.9, alpha: 0.9, height: 10 }))
      })
    })
    return out
  }

  /**
   * 换数值（接口刷新）：用 heatmap3d.update 原地换热力值，updateTime 让引擎在 1 秒内过渡过去，不删不建、不闪；等值线跟着换。
   */
  async setValues(values: Record<string, number>): Promise<void> {
    for (const r of this.regions) if (r.code in values) r.value = values[r.code]
    this.range = magnitudeRange(this.regions)
    if (!this.entered || !this.volumeIds.length) return
    const { nx, ny, grid } = this.heatGrid()
    const res = await answer(done => __xapi.heatmap3d.update([{ id: VOLUME_ID, heatValues: { size: [nx, ny, LAYERS], values: this.heatValues(grid, nx, ny) }, updateTime: TWEEN_SECONDS }], done))
    if (!res || res.result) console.warn('[片区热力] 热力值更新失败', res ?? '渲染端没有回应')
    if (this.lines) await this.replaceLayer('iso', 'polyline', this.isolines())
  }

  /** 热力值的线开关 */
  async setLines(on: boolean): Promise<void> {
    this.lines = on
    if (!this.entered) return
    await this.replaceLayer('iso', 'polyline', on ? this.isolines() : [])
  }

  private lines = false

  /** 画（或按当前色板重画）热力体积：先删本页的旧体积，再一次发全部 */
  private async drawVolumes(): Promise<void> {
    const next = this.volumes()
    await this.removeVolumes()
    this.volumeIds = next.map(v => v.id)
    let res = await answer(done => __xapi.heatmap3d.addByVoxels(next, done))
    // 6 = IDExists：上一次页面留下的同 id 体积还在渲染实例里，删掉再加一次
    if (res?.result === 6) {
      await answer(done => __xapi.heatmap3d.delete(this.volumeIds, done))
      res = await answer(done => __xapi.heatmap3d.addByVoxels(next, done))
    }
    if (!res || res.result) console.warn('[片区热力] 热力体积创建失败', res ?? '渲染端没有回应')
    if (!this.volumeVisible) await __xapi.heatmap3d.hide?.(this.volumeIds)
  }

  private async removeVolumes(): Promise<void> {
    const ids = this.volumeIds
    this.volumeIds = []
    if (ids.length) await answer(done => __xapi.heatmap3d.delete(ids, done))
  }

  private volumeIds: string[] = []
  private volumeVisible = true

  /** 标注：绝对值最大的几个片区 */
  private labels(): { id: string }[] {
    const marked = [...this.regions].filter(r => r.value !== 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, LABELS)
    const leads = staggerLabels(marked.map(r => ({ at: r.xy, width: labelWidth(districtZh(r.name), { value: aed(r.value) }) })), 40, 34, { camera: this.camera })
    return marked.map((r, i) =>
      pin({ id: `heatdemo-${this.palette.key}-${r.code}`, groupId: 'sc_heatdemo_region', at: r.xy, text: districtZh(r.name), value: aed(r.value), color: this.colorOf(r.value) ?? '#ffffff', userId: r.code, lineHeight: leads[i], priority: 10 })
    )
  }

  protected async onEnter(token: number): Promise<void> {
    if (!this.regions.length) await this.project()
    if (!this.isCurrent(token)) return
    // 不动镜头：用户自己控制视角；fitCamera 只留给需要「框住全部」的场合
    this.camera = this.fitCamera()
    await this.drawVolumes()
    if (!this.isCurrent(token)) return
    this.entered = true
    if (this.lines) await this.replaceLayer('iso', 'polyline', this.isolines())
  }

  protected async onLeave(): Promise<void> {
    this.entered = false
    await this.removeVolumes()
  }

  protected onAbandon(): void {
    if (this.volumeIds.length) void __xapi.heatmap3d.delete(this.volumeIds).catch(() => null)
    this.volumeIds = []
  }

  async setLayerVisible(layer: string, visible: boolean): Promise<void> {
    if (layer !== 'fill') return super.setLayerVisible(layer, visible)
    this.volumeVisible = visible
    if (this.volumeIds.length) await (visible ? __xapi.heatmap3d.show?.(this.volumeIds) : __xapi.heatmap3d.hide?.(this.volumeIds))
  }

  /** 换色板：填色面和标注整层替换（新 id 先建后删） */
  async setPalette(key: string): Promise<void> {
    const next = PALETTES.find(p => p.key === key)
    if (!next || next === this.palette) return
    this.palette = next
    if (!this.entered) return
    await this.drawVolumes()
  }

  /** 飞到某个片区 */
  async focusRegion(code: string): Promise<void> {
    const r = this.regions.find(x => x.code === code)
    if (!r || !this.camera.length) return
    const span = Math.max(r.bbox[2] - r.bbox[0], r.bbox[3] - r.bbox[1])
    const h = Math.min(40000, Math.max(3000, span * 1.6))
    const rad = Math.PI / 180
    const [pitch, yaw] = [this.camera[3], this.camera[4]]
    const d = h / Math.tan(-pitch * rad)
    await this.api.setCamera([r.xy[0] - Math.cos(yaw * rad) * d, r.xy[1] + Math.sin(yaw * rad) * d, h, pitch, yaw], 1.5)
  }
}

/** 片区名：全大写转成首字母大写 */
export function title(name: string): string {
  return name.toLowerCase().replace(/(^|[\s\-'`(])([a-z])/g, (_, s: string, c: string) => s + c.toUpperCase())
}
