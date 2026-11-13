import { heatPointsAt } from '@/api/mock/population'
import { ModuleScene } from '@/scene/ModuleScene'
import type { SceneApi } from '@/scene/SceneApi'
import type { OverviewData } from '@/types/smartCity'

export interface OverviewSceneOptions {
  /** [x, y, z, pitch, yaw]；为 null 时自动定位到片区 */
  cameraView: number[] | null
  /** 热力图垂直范围 [minZ, maxZ] */
  heatmapZ: [number, number]
}

const HEATMAP_ID = 'population-heat'
/** 热力值范围，万人/km² */
const HEAT_RANGE = [0, 3]

// RGBA，取值 0–1
const WHITE = [1, 1, 1, 1]
const PANEL = [0.07, 0.09, 0.12, 0.92]
const BLUE = [0.3, 0.6, 1, 0.9]
const HOT = [1, 0.42, 0.42, 0.95] // 热度 ≥ 90
const WARM = [1, 0.66, 0.3, 0.95] // 热度 ≥ 75
const MILD = [1, 0.83, 0.23, 0.95]

function heatColor(heat: number): number[] {
  return heat >= 90 ? HOT : heat >= 75 ? WARM : MILD
}

/** 文字标注的公共样式（不带图片）。字段含义见 DTS 文档 Marker.add */
function textMarker(id: string, groupId: string, coordinate: number[], text: string, background: number[], userId: string) {
  return {
    id,
    groupId,
    userData: JSON.stringify({ id: userId }),
    coordinate,
    coordinateType: 0,
    range: [1, 1000000],
    imagePath: '',
    imageSize: [0, 0],
    fixedSize: true,
    text,
    useTextAnimation: false,
    textRange: [1, 1000000],
    textOffset: [0, 0],
    textBackgroundColor: background,
    fontSize: 14,
    fontColor: WHITE,
    showLine: true,
    lineSize: [2, 30],
    lineColor: background,
    lineOffset: [0, 0],
    autoHeight: true,
    displayMode: 2,
    occlusionCull: false
  }
}

export class OverviewScene extends ModuleScene {
  private data: OverviewData | null = null
  private hour = 12
  /** 经纬度字符串 → 投影坐标，避免重复转换 */
  private projected = new Map<string, number[]>()

  constructor(
    api: SceneApi,
    private readonly options: OverviewSceneOptions
  ) {
    super(api)
  }

  /** 进入前设置数据和初始小时 */
  setData(data: OverviewData, hour: number) {
    this.data = data
    this.hour = hour
  }

  protected async onEnter(token: number): Promise<void> {
    const data = this.data
    if (!data) return
    await this.projectAll(data)

    await this.add(
      token,
      'polygon',
      data.districts.map(d => ({
        id: 'district-' + d.id,
        groupId: 'sc_district',
        coordinates: d.boundary.map(p => this.at(p)),
        coordinateType: 0,
        range: [1, 1000000],
        color: [0.3, 0.6, 1, 0.06],
        frameColor: [0.79, 0.82, 0.86, 0.8],
        frameThickness: 2,
        intensity: 1,
        style: 0,
        depthTest: false
      })),
      'district'
    )

    await this.add(token, 'heatmap', [this.buildHeatmap(data)], 'heat')

    await this.add(
      token,
      'marker',
      data.hotspots.map((h, i) => textMarker('hotspot-' + h.id, 'sc_hotspot', this.at(h.position), `${i + 1}  ${h.shortName}`, heatColor(h.heat), h.id)),
      'hotspot'
    )

    await this.add(
      token,
      'marker',
      data.cameras.map(c => textMarker('camera-' + c.id, 'sc_camera', this.at(c.position), c.id, c.online ? BLUE : PANEL, c.id)),
      'camera'
    )

    if (!this.isCurrent(token)) return
    if (this.options.cameraView) {
      await this.api.setCamera(this.options.cameraView)
    } else if (data.districts.length) {
      await this.api.focus('polygon', 'district-' + data.districts[0].id, 6000)
    }
  }

  /** 切换到某个小时：整体替换热力图 */
  async setHour(hour: number): Promise<void> {
    this.hour = hour
    if (!this.data) return
    await this.replaceLayer('heat', 'heatmap', [this.buildHeatmap(this.data)])
  }

  async focusHotspot(id: string): Promise<void> {
    await this.api.focus('marker', 'hotspot-' + id, 800)
  }

  async focusCamera(id: string): Promise<void> {
    await this.api.focus('marker', 'camera-' + id, 400)
  }

  private key(p: number[]): string {
    return p[0] + ',' + p[1]
  }

  private at(p: number[]): number[] {
    return this.projected.get(this.key(p)) as number[]
  }

  /** 一次性把所有经纬度转成投影坐标 */
  private async projectAll(data: OverviewData): Promise<void> {
    const all: number[][] = []
    data.districts.forEach(d => {
      all.push(d.center)
      d.boundary.forEach(p => all.push(p))
    })
    data.hotspots.forEach(h => all.push(h.position))
    data.cameras.forEach(c => all.push(c.position))
    const todo = all.filter(p => !this.projected.has(this.key(p)))
    if (todo.length === 0) return
    const result = await this.api.project(todo)
    todo.forEach((p, i) => this.projected.set(this.key(p), result[i]))
  }

  private buildHeatmap(data: OverviewData) {
    const points = heatPointsAt(this.hour, data.districts, data.hotspots).map(p => {
      const c = this.at(p.position)
      return { id: p.id, coordinate: [c[0], c[1], c[2] ?? 0], radius: p.radius, heatValue: Math.min(HEAT_RANGE[1], p.value) }
    })
    const xs = points.map(p => p.coordinate[0])
    const ys = points.map(p => p.coordinate[1])
    const pad = 1200
    const [minZ, maxZ] = this.options.heatmapZ
    return {
      id: HEATMAP_ID,
      groupId: 'sc_heat',
      bbox: [Math.min(...xs) - pad, Math.min(...ys) - pad, minZ, Math.max(...xs) + pad, Math.max(...ys) + pad, maxZ],
      range: HEAT_RANGE,
      data: points
    }
  }
}
