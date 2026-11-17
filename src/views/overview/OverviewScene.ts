import { districtDensityAt, heatGridAt, hotspotActivityAt } from '@/api/mock/population'
import { ModuleScene } from '@/scene/ModuleScene'
import type { SceneApi } from '@/scene/SceneApi'
import type { CityGeo } from '@/scene/geo'
import { alarmPoints, area, COLOR, focusView, heatmap, pin, rampColor, regionLayer, ripple, staggerHeights } from '@/scene/kit'
import type { OverviewData } from '@/types/smartCity'

export interface OverviewSceneOptions {
  /** [x, y, z, pitch, yaw]；为 null 时不动相机 */
  cameraView: number[] | null
  /** 热力图垂直范围 [minZ, maxZ] */
  heatmapZ: [number, number]
  /** 效果总包是否可用；不可用时片区退回普通面 */
  pak: boolean
  /** 分级点位材质包是否可用；可用时热点用光环 + 光柱（大小固定），否则用随时刻缩放的扩散波纹 */
  beacons?: boolean
}

/** 密度色带的上限，万人/km² */
const DENSITY_MAX = 2.8
/** 热力网格间距，米 */
const HEAT_STEP = 480
const DISTRICT_LAYER_ID = 'sc_overview_districts'
/** 人口热力图交替使用的两个 id */
const HEAT_IDS = ['population-heat', 'population-heat-b'] as const
/** 热点相距多近（米）时错开标注高度 */
const HOTSPOT_STAGGER = 1800

/** 热度 → 分级点位的等级：90 以上一级（光柱 + 信标），75 以上二级，其余三级 */
function heatLevel(heat: number): 1 | 2 | 3 {
  return heat >= 90 ? 1 : heat >= 75 ? 2 : 3
}

function heatColor(heat: number): string {
  return heat >= 90 ? COLOR.danger : heat >= 75 ? COLOR.warn : COLOR.caution
}

/**
 * 城市总览的场景图层：
 * - district 片区：点阵流光，颜色随所选时刻的人口密度变化；
 * - heat     人口热力：只落在陆地上的网格热力，叠加热点事件的人群；
 * - hotspot  热点事件：扩散波纹 + 标注，波纹大小随事件活跃度变化；
 * - camera   摄像头：标注。
 */
export class OverviewScene extends ModuleScene {
  private data: OverviewData | null = null
  private hour = 12
  /** onEnter 已经创建完图层。在此之前 setHour 只记录小时 */
  private entered = false
  private hotspotXY = new Map<string, number[]>()
  private cameraXY = new Map<string, number[]>()
  private districts: Awaited<ReturnType<typeof regionLayer>> | null = null
  private grid: { xy: number[]; districtId: string }[] = []
  private heatSlot = 1

  constructor(
    api: SceneApi,
    private readonly geo: CityGeo,
    private readonly options: OverviewSceneOptions
  ) {
    super(api)
  }

  /** 进入前设置数据和初始小时 */
  setData(data: OverviewData, hour: number) {
    this.data = data
    this.hour = hour
  }

  private densityColor(districtId: string): string {
    const d = this.geo.district(districtId)
    return d ? rampColor(districtDensityAt(d, this.hour) / DENSITY_MAX) : COLOR.accent
  }

  protected async onEnter(token: number): Promise<void> {
    this.entered = false
    const data = this.data
    if (!data) return
    const geo = this.geo

    // 热点、摄像头的坐标不在 geo.json 里，单独投影一次
    const points = [...data.hotspots.map((h) => h.position), ...data.cameras.map((c) => c.position)]
    const xy = await this.api.project(points)
    data.hotspots.forEach((h, i) => this.hotspotXY.set(h.id, xy[i]))
    data.cameras.forEach((c, i) => this.cameraXY.set(c.id, xy[data.hotspots.length + i]))
    const cameraXY = this.cameraXY
    this.grid = geo.landGrid(HEAT_STEP)

    if (this.options.cameraView) await this.api.setCamera(this.options.cameraView)

    if (this.options.pak) {
      await this.effect(token, 'district', async () => {
        this.districts = await regionLayer(
          DISTRICT_LAYER_ID,
          geo.districts.map((d) => ({ id: d.id, color: this.densityColor(d.id), ring: d.ring })),
          { pattern: 'dots', scale: 3, fill: 0.04 }
        )
        return this.districts
      })
    } else {
      await this.add(
        token,
        'polygon',
        geo.districts.map((d) => area({ id: 'district-' + d.id, groupId: 'sc_district', ring: d.ring, color: this.densityColor(d.id), fill: 0.14 })),
        'district'
      )
    }

    const ranked = [...data.hotspots].sort((a, b) => b.heat - a.heat)
    // 热点集中在商业区，挨得近的错开引线高度；热度最高的排最低一档
    const heights = staggerHeights(
      ranked.map((h) => this.hotspotXY.get(h.id) as number[]),
      56,
      34,
      HOTSPOT_STAGGER
    )
    await this.add(
      token,
      'marker',
      ranked.map((h, i) =>
        pin({
          id: 'hotspot-' + h.id,
          groupId: 'sc_hotspot',
          at: this.hotspotXY.get(h.id) as number[],
          tag: String(i + 1),
          text: h.shortName,
          color: heatColor(h.heat),
          userId: h.id,
          lineHeight: heights[i],
          priority: 10
        })
      ),
      'hotspot'
    )
    await this.add(
      token,
      'marker',
      data.cameras.map((c) =>
        pin({
          id: 'camera-' + c.id,
          groupId: 'sc_camera',
          at: cameraXY.get(c.id) as number[],
          text: c.id,
          icon: 'camera',
          color: c.online ? COLOR.accent : COLOR.muted,
          userId: c.id,
          lineHeight: 26,
          fontSize: 11
        })
      ),
      'camera'
    )

    if (this.options.beacons) {
      const marks = alarmPoints({
        id: 'hotspot-ripple',
        groupId: 'sc_hotspot_ripple',
        beacons: true,
        points: data.hotspots.map((h) => ({
          id: h.id,
          at: this.hotspotXY.get(h.id) as number[],
          level: heatLevel(h.heat),
          color: heatColor(h.heat),
          radius: 400
        }))
      })
      await this.add(token, marks.type, marks.objects, 'hotspot-ripple')
    }

    if (!this.isCurrent(token)) return
    // 随时间变化的图层最后创建，用进入期间记录的最新小时；此后 setHour 直接替换
    this.entered = true
    await this.applyHour(data)
  }

  protected async onLeave(): Promise<void> {
    this.entered = false
    this.districts = null
  }

  /** 切换到某个小时。进入完成前只记录小时，由 onEnter 应用最新值 */
  async setHour(hour: number): Promise<void> {
    this.hour = hour
    if (!this.entered || !this.data) return
    await this.applyHour(this.data)
  }

  private async applyHour(data: OverviewData): Promise<void> {
    const geo = this.geo
    await Promise.all([
      this.replaceLayer('heat', 'heatmap', [this.buildHeatmap(data)]),
      // 分级点位大小固定，进入时画一次；扩散波纹的半径随时刻的活跃度变化，每个时刻重画
      this.options.beacons
        ? undefined
        : this.replaceLayer(
            'hotspot-ripple',
            'radiationPoint',
            data.hotspots.map((h) =>
              ripple({
                id: 'hotspot-ripple-' + h.id,
                groupId: 'sc_hotspot_ripple',
                at: this.hotspotXY.get(h.id) as number[],
                radius: 260 + 520 * hotspotActivityAt(h, this.hour),
                color: heatColor(h.heat)
              })
            )
          ),
      this.districts?.setColors(Object.fromEntries(geo.districts.map((d) => [d.id, this.densityColor(d.id)])))
    ])
  }

  private buildHeatmap(data: OverviewData) {
    const hotspots = data.hotspots.map((h) => ({ id: h.id, heat: h.heat, xy: this.hotspotXY.get(h.id) as number[] }))
    // 两个 id 交替：新热力图先加上、旧的再删（ModuleScene 先建后删），时间轴播放时不闪
    this.heatSlot = 1 - this.heatSlot
    return heatmap({
      id: HEAT_IDS[this.heatSlot],
      groupId: 'sc_heat',
      points: heatGridAt(this.hour, this.grid, this.geo.districts, hotspots, HEAT_STEP),
      range: [0, 3.4],
      z: this.options.heatmapZ
    })
  }

  /** 热点事件图层的开关同时控制标注和波纹 */
  async setLayerVisible(layer: string, visible: boolean): Promise<void> {
    await super.setLayerVisible(layer, visible)
    if (layer === 'hotspot') await super.setLayerVisible('hotspot-ripple', visible)
  }

  /** 城市巡航的机位：依次从西南方向俯瞰各热点事件（按热度从高到低） */
  tourViews(): number[][] {
    const ranked = [...(this.data?.hotspots ?? [])].sort((a, b) => b.heat - a.heat)
    return ranked.flatMap((h) => {
      const p = this.hotspotXY.get(h.id)
      return p ? [focusView(p)] : []
    })
  }

  /** 飞到某个热点事件 */
  async focusHotspot(id: string): Promise<void> {
    const p = this.hotspotXY.get(id)
    if (p) await this.api.setCamera(focusView(p), 1.5)
  }

  /** 飞到某个片区（按名称，告警只带片区名）。找不到返回 false */
  async focusDistrict(name: string): Promise<boolean> {
    const d = this.geo.districts.find((x) => x.name === name)
    if (!d) return false
    await this.api.setCamera(focusView(d.centerXY, 3600), 1.5)
    return true
  }

  /** 飞到某路摄像头 */
  async focusCamera(id: string): Promise<void> {
    const p = this.cameraXY.get(id)
    if (p) await this.api.setCamera(focusView(p, 2400), 1.5)
  }
}
