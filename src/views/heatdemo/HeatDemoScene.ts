import { pointInRing } from '@/scene/geo'
import { labelWidth, pin, staggerLabels } from '@/scene/kit'
import { HEAT_LINES_OFF, HeatFieldLayer, type HeatField } from '@/scene/heatField'
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
 * 热力用自研热力场材质（customMesh，见 scene/heatField.ts）：网格只建一次，换数值时原地改顶点颜色并插值过渡，不闪；
 * 等值线（热力值的线）由材质参数 Levels 控制，可以随时开关；色带是材质的六个色位 C0–C5（密度 0.35 / 0.55 / 0.68 / 0.8 / 0.9 / 1.0）。
 *
 * 颜色取 POPInspection 默认热力（heatmap.ts 的 RAMP）：低端一层浅绿、往上黄、橙，高端红；
 * ocean / risk 在同样的色位换成各自色板的四色。材质低于 0.2 透明、往上逐渐变实。
 */
const FIELD_COLORS: Record<string, readonly string[]> = {
  warm: ['#73cc40', '#9ad13a', '#ccd926', '#ffbf1a', '#ff6b08', '#eb2400'],
  ocean: ['#0a1f5c', '#0a1f5c', '#0d4a8f', '#1688b8', '#2aa9bb', '#3fc9bf'],
  risk: ['#5a35a5', '#5a35a5', '#b5368a', '#f04a3e', '#dc2d36', '#c8102e']
}
/** 色板 → 热力场材质的六个色位 */
export function fieldColors(palette: Palette): readonly string[] {
  return FIELD_COLORS[palette.key] ?? FIELD_COLORS.warm
}
/** 等值线开着时的条数 */
export const HEAT_LINE_LEVELS = 8
/** 格距，米：顶点颜色插值本身是平滑的，500 米一格全酋长国约 2.6 × 2.8 百格，每次换值只发几十万个数 */
const CELL = 500
/** 换值的过渡时长，毫秒 */
const TWEEN_MS = 900

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

  /** 覆盖范围（只和片区位置有关，换数值时不变，网格拓扑不变才能原地过渡） */
  private grid: { x0: number; y0: number; nx: number; ny: number; covered: Uint8Array } | null = null

  private gridFrame() {
    if (this.grid) return this.grid
    // 外扩一圈，模糊后的外缘有地方渐隐
    const pad = BLUR_SIGMA * 3
    const x0 = Math.floor((Math.min(...this.regions.map(r => r.bbox[0])) - pad) / CELL) * CELL
    const y0 = Math.floor((Math.min(...this.regions.map(r => r.bbox[1])) - pad) / CELL) * CELL
    const nx = Math.ceil((Math.max(...this.regions.map(r => r.bbox[2])) + pad - x0) / CELL) + 1
    const ny = Math.ceil((Math.max(...this.regions.map(r => r.bbox[3])) + pad - y0) / CELL) + 1
    const inside = new Float32Array(nx * ny)
    this.cellRegion = new Array(nx * ny).fill(null)
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const r = this.regionAt([x0 + i * CELL, y0 + j * CELL])
        if (r) {
          inside[j * nx + i] = 1
          this.cellRegion[j * nx + i] = r
        }
      }
    }
    const reach = gaussianBlur(inside, nx, ny, BLUR_SIGMA / CELL)
    const covered = Uint8Array.from(reach, v => (v > 0.02 ? 1 : 0))
    this.grid = { x0, y0, nx, ny, covered }
    return this.grid
  }

  /** 每个格点所在的片区（算一次） */
  private cellRegion: (ProjectedRegion | null)[] = []

  /**
   * 热力场：每格取所在片区数值的强度（0.3–1，值为 0 不着色），高斯模糊成连续的热力，外缘渐隐。
   * 拓扑（覆盖范围）固定，所以换数值时 HeatFieldLayer 原地插值过渡。
   */
  buildField(): HeatField {
    const { x0, y0, nx, ny, covered } = this.gridFrame()
    const raw = new Float32Array(nx * ny)
    for (let k = 0; k < raw.length; k++) {
      const r = this.cellRegion[k]
      const t = r ? rampPosition(r.value, this.range) : null
      if (t !== null) raw[k] = 0.3 + 0.7 * t
    }
    const values = gaussianBlur(raw, nx, ny, BLUR_SIGMA / CELL)
    for (let k = 0; k < values.length; k++) values[k] = Math.min(1, values[k])
    return { origin: [x0, y0], step: CELL, cols: nx, rows: ny, values, covered }
  }

  private field: HeatFieldLayer | null = null
  private lines = false

  /** 标注：绝对值最大的几个片区 */
  private labels(): { id: string }[] {
    const marked = [...this.regions].filter(r => r.value !== 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, LABELS)
    const leads = staggerLabels(marked.map(r => ({ at: r.xy, width: labelWidth(districtZh(r.name), { value: aed(r.value) }) })), 40, 34, { camera: this.camera })
    return marked.map((r, i) =>
      pin({ id: `heatdemo-${this.palette.key}-${r.code}`, groupId: 'sc_heatdemo_region', at: r.xy, text: districtZh(r.name), value: aed(r.value), color: this.colorOf(r.value) ?? '#ffffff', userId: r.code, lineHeight: leads[i], priority: 10 })
    )
  }

  private makeField(): HeatFieldLayer {
    return new HeatFieldLayer(this.api, {
      id: 'heatdemo-field',
      groupId: 'sc_heatdemo_field',
      colors: fieldColors(this.palette),
      levels: this.lines ? HEAT_LINE_LEVELS : HEAT_LINES_OFF,
      brightness: 0.85,
      opacity: 1,
      speed: 0,
      tweenMs: TWEEN_MS,
      tweenSteps: 8
    })
  }

  protected async onEnter(token: number): Promise<void> {
    if (!this.regions.length) await this.project()
    if (!this.isCurrent(token)) return
    // 不动镜头：用户自己控制视角；fitCamera 只留给需要「框住全部」的场合
    this.camera = this.fitCamera()
    this.field ??= this.makeField()
    await this.field.show(this.buildField())
    if (!this.isCurrent(token)) return
    this.entered = true
  }

  protected async onLeave(): Promise<void> {
    this.entered = false
    await this.field?.clear()
  }

  protected onAbandon(): void {
    this.field?.abandon()
  }

  async setLayerVisible(layer: string, visible: boolean): Promise<void> {
    if (layer !== 'fill') return super.setLayerVisible(layer, visible)
    await this.field?.setVisible(visible)
  }

  /** 换色板：原地改材质色位，不重建、不闪 */
  async setPalette(key: string): Promise<void> {
    const next = PALETTES.find(p => p.key === key)
    if (!next || next === this.palette) return
    this.palette = next
    await this.field?.setParams({ colors: fieldColors(next) })
  }

  /** 热力值的线（等值线）开关：原地改材质参数 */
  async setLines(on: boolean): Promise<void> {
    this.lines = on
    await this.field?.setParams({ levels: on ? HEAT_LINE_LEVELS : HEAT_LINES_OFF })
  }

  /** 换数据（接口刷新）：片区不变时原地插值过渡到新值 */
  async setValues(values: Record<string, number>): Promise<void> {
    for (const r of this.regions) if (r.code in values) r.value = values[r.code]
    this.range = magnitudeRange(this.regions)
    if (this.entered) await this.field?.show(this.buildField())
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
