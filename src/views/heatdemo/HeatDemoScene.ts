import { pointInRing } from '@/scene/geo'
import { area, labelWidth, pin, plainLine, staggerLabels } from '@/scene/kit'
import { ModuleScene } from '@/scene/ModuleScene'
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

/** 片区填充的不透明度：底图（路网、建筑）要透得出来 */
const FILL_ALPHA = 0.55
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

/** 金额文字：按绝对值，十亿以上写 B，否则写 M */
export function aed(v: number): string {
  const m = Math.abs(v)
  if (m >= 1e9) return `AED ${+(m / 1e9).toFixed(2)}B`
  if (m >= 1e6) return `AED ${+(m / 1e6).toFixed(1)}M`
  return `AED ${Math.round(m)}`
}

/**
 * 片区热力演示的场景：
 * - 片区填色：每个片区一个面，按数值绝对值在色板里取色，边界清楚；值为 0 的片区不着色；
 * - 片区边界：细线；
 * - 标注：数值最大的几个片区。
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

  /** 片区填色面（每个外环一个面；值为 0 的片区不出面）。id 带色板，换色板时先建后删不闪 */
  private fills(): { id: string }[] {
    return this.regions.flatMap(r => {
      const color = this.colorOf(r.value)
      if (!color) return []
      return r.ringsXY.map((ring, i) => area({ id: `heatdemo-fill-${this.palette.key}-${r.code}-${i}`, groupId: 'sc_heatdemo_fill', ring, color, fill: FILL_ALPHA, frame: 0, frameWidth: 0 }))
    })
  }

  /** 标注：绝对值最大的几个片区 */
  private labels(): { id: string }[] {
    const marked = [...this.regions].filter(r => r.value !== 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, LABELS)
    const leads = staggerLabels(marked.map(r => ({ at: r.xy, width: labelWidth(title(r.name), { value: aed(r.value) }) })), 40, 34, { camera: this.camera })
    return marked.map((r, i) =>
      pin({ id: `heatdemo-${this.palette.key}-${r.code}`, groupId: 'sc_heatdemo_region', at: r.xy, text: title(r.name), value: aed(r.value), color: this.colorOf(r.value) ?? '#ffffff', userId: r.code, lineHeight: leads[i], priority: 10 })
    )
  }

  protected async onEnter(token: number): Promise<void> {
    if (!this.regions.length) await this.project()
    if (!this.isCurrent(token)) return
    this.camera = this.fitCamera()
    await this.api.setCamera(this.camera)
    if (!this.isCurrent(token)) return
    await this.add(token, 'polygon', this.fills(), 'fill')
    await this.add(
      token,
      'polyline',
      this.regions.flatMap(r => r.ringsXY.map((ring, i) => plainLine({ id: `heatdemo-outline-${r.code}-${i}`, groupId: 'sc_heatdemo_outline', path: [...ring, ring[0]], height: 8, color: '#f3f5f8', width: 40, brightness: 0.5, alpha: 0.5 }))),
      'outline'
    )
    await this.add(token, 'marker', this.labels(), 'label')
    this.entered = true
  }

  protected async onLeave(): Promise<void> {
    this.entered = false
  }

  /** 换色板：填色面和标注整层替换（新 id 先建后删） */
  async setPalette(key: string): Promise<void> {
    const next = PALETTES.find(p => p.key === key)
    if (!next || next === this.palette) return
    this.palette = next
    if (!this.entered) return
    await Promise.all([this.replaceLayer('fill', 'polygon', this.fills()), this.replaceLayer('label', 'marker', this.labels())])
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
