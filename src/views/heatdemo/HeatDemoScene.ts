import { pointInRing } from '@/scene/geo'
import { labelWidth, pin, staggerLabels } from '@/scene/kit'
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
 * 颜色强度和透明度比 POPInspection 低：它画的是零散的热点，这里是成片铺满的片区，原样会把卫星底图整片盖死、
 * 颜色发荧光（用户 2026-11-19：配色太丑）。压暗、半透明后底图的地块和道路透得出来，接近参考图的效果。
 */
const INTENSITY = 0.16
const ALPHAS = [0.28, 0.36, 0.44, 0.52]
const STOPS = [0.01, 0.4, 0.7, 1]
/** 体积的层数、底面和高度（米），同 POPInspection */
const LAYERS = 4
const FLOOR = -50
const HEIGHT = 500
/** 栅格间距（米）和每块体积的边长（格）：全酋长国约 610 × 665 格，按 64 × 64 分块，只发有值的块 */
const CELL = 200
const TILE = 64
const VOLUME_PREFIX = 'heatdemo-volume-'
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

/** POPInspection 的色带：0 透明，其后四色（线性、压暗），透明度递增 */
export function volumeColors(ramp: readonly string[]) {
  const linear = (hex: string) => [0, 2, 4].map(i => INTENSITY * (parseInt(hex.slice(1 + i, 3 + i), 16) / 255) ** 2.2)
  return {
    gradient: true,
    invalidColor: [0, 0, 0, 0],
    colorStops: [{ value: 0, color: [0, 0, 0, 0] }, ...STOPS.map((value, i) => ({ value, color: [...linear(ramp[i]), ALPHAS[i]] }))]
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

  /**
   * 栅格：每格取所在片区数值在色板里的位置（0.01–1；值为 0 或在片区外为 0，不着色）。
   * 按 64 × 64 格分块，只留有值的块，每块一个 heatmap3d 体积。
   */
  volumes(): { id: string }[] {
    // 外扩一圈，模糊后的外缘有地方渐隐
    const pad = BLUR_SIGMA * 3
    const x0 = Math.floor((Math.min(...this.regions.map(r => r.bbox[0])) - pad) / CELL) * CELL
    const y0 = Math.floor((Math.min(...this.regions.map(r => r.bbox[1])) - pad) / CELL) * CELL
    const nx = Math.ceil((Math.max(...this.regions.map(r => r.bbox[2])) + pad - x0) / CELL)
    const ny = Math.ceil((Math.max(...this.regions.map(r => r.bbox[3])) + pad - y0) / CELL)
    const raw = new Float32Array(nx * ny)
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const r = this.regionAt([x0 + (i + 0.5) * CELL, y0 + (j + 0.5) * CELL])
        const t = r ? rampPosition(r.value, this.range) : null
        if (t !== null) raw[j * nx + i] = 0.15 + 0.85 * t
      }
    }
    // 热力：高斯模糊后片区之间平滑过渡，外缘渐隐；太弱的（< 0.03）不着色
    const grid = gaussianBlur(raw, nx, ny, BLUR_SIGMA / CELL)
    for (let k = 0; k < grid.length; k++) if (grid[k] < 0.03) grid[k] = 0
    const colors = volumeColors(this.palette.ramp)
    const out: { id: string }[] = []
    for (let tj = 0; tj < ny; tj += TILE) {
      for (let ti = 0; ti < nx; ti += TILE) {
        const w = Math.min(TILE, nx - ti)
        const h = Math.min(TILE, ny - tj)
        const values = new Array<number>(w * h * LAYERS).fill(0)
        let any = false
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) {
            const v = grid[(tj + j) * nx + ti + i]
            if (!v) continue
            any = true
            const t = Math.round(v * 1000) / 1000
            // 纹理的行和投影坐标的北向相反
            for (let l = 0; l < LAYERS; l++) values[(l * h + (h - 1 - j)) * w + i] = t
          }
        }
        if (!any) continue
        const [wm, hm] = [w * CELL, h * CELL]
        out.push({
          id: `${VOLUME_PREFIX}${ti / TILE}-${tj / TILE}`,
          groupId: 'sc_heatdemo_volume',
          heatValues: { size: [w, h, LAYERS], values },
          bbox: [0, 0, 0, wm, hm, HEIGHT],
          volumeBoxLocation: [x0 + ti * CELL + wm / 2, y0 + tj * CELL + hm / 2, FLOOR],
          volumeBoxSize: [wm, hm, HEIGHT],
          volumeBoxRotation: [0, 0, 0],
          ...LOOK,
          heatValueMode: 0,
          heatValueRange: [0, 1],
          updateTime: 0,
          colors
        } as { id: string })
      }
    }
    return out
  }

  /** 画（或按当前色板重画）热力体积：先删本页的旧体积，再一次发全部 */
  private async drawVolumes(): Promise<void> {
    const next = this.volumes()
    await this.removeVolumes()
    this.volumeIds = next.map(v => v.id)
    const res = await __xapi.heatmap3d.addByVoxels(next)
    if (res?.result) console.warn('[片区热力] 热力体积创建失败', res)
    if (!this.volumeVisible) await __xapi.heatmap3d.hide?.(this.volumeIds)
  }

  private async removeVolumes(): Promise<void> {
    const ids = this.volumeIds
    this.volumeIds = []
    if (ids.length) await __xapi.heatmap3d.delete(ids).catch(() => null)
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
    this.camera = this.fitCamera()
    await this.api.setCamera(this.camera)
    if (!this.isCurrent(token)) return
    await this.drawVolumes()
    if (!this.isCurrent(token)) return
    this.entered = true
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
