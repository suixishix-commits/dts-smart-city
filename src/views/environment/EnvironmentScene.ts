import { concentrationsAt, noiseDbAt, readingOf, stationReadingsAt, WATER_GRADE_NAMES } from '@/api/mock/environment'
import { ModuleScene } from '@/scene/ModuleScene'
import type { SceneApi, SceneObjectType } from '@/scene/SceneApi'
import { pointAt, type CityGeo } from '@/scene/geo'
import { area, circleRing, COLOR, column, focusView, LEVEL_COLOR, pin, rampColor, regionLayer, ripple, staggerHeights, STATUS_RAMP } from '@/scene/kit'
import type { AirIndex, AirLevel, EnvironmentData, PlaceRef, WaterGrade } from '@/types/environment'

export interface EnvironmentSceneOptions {
  /** [x, y, z, pitch, yaw]；为 null 时不动相机 */
  cameraView: number[] | null
  /** 效果总包是否可用；不可用时片区退回普通面 */
  pak: boolean
}

/** 图层清单：key、名称、是否默认打开。页面的图层开关和场景共用这一份 */
export const ENV_LAYERS = [
  { key: 'air', name: '空气质量', on: true },
  { key: 'station', name: '监测站点', on: true },
  { key: 'source', name: '污染源', on: true },
  { key: 'noise', name: '噪声监测', on: false },
  { key: 'green', name: '生态空间', on: false },
  { key: 'water', name: '水质', on: false }
] as const

/** 空气质量等级色：优、良、轻度、中度及以上 */
export const AIR_COLORS: readonly string[] = STATUS_RAMP
/** 水质类别色：一、二类达标用冷色（深、浅蓝），三、四类超标转暖 */
export const WATER_COLORS: Record<WaterGrade, string> = { 1: COLOR.accent, 2: COLOR.accentLight, 3: COLOR.caution, 4: COLOR.warn }
/** 噪声色带的范围，dB(A)：低于下限取最低档，高于上限取最高档 */
export const NOISE_RANGE: [number, number] = [45, 75]

/** 等级 → 颜色 */
export function airColor(level: AirLevel): string {
  return STATUS_RAMP[level]
}

/** 声级 → 色带颜色 */
export function noiseColor(db: number): string {
  return rampColor((db - NOISE_RANGE[0]) / (NOISE_RANGE[1] - NOISE_RANGE[0]))
}

const AIR_LAYER_ID = 'sc_environment_air'
/** 片区读数标注的图层 */
const AIR_LABEL_LAYER = 'airLabel'
/** 噪声柱半径，米 */
const NOISE_RADIUS = 110
/** 标注相距多近（米）时错开高度 */
const LABEL_STAGGER = 1800

/**
 * 生态环境的场景图层：
 * - air     空气质量：片区按所选指标、所选时刻的等级着色（效果总包可用时是点阵流光，否则普通面）；
 * - station 监测站点：标注，显示站名和当前读数，按等级着色；
 * - source  污染源与投诉：扩散波纹 + 标注，按告警等级用暖色；
 * - noise   噪声监测：路口上的立体柱，高度和颜色随所选时刻的声级变化（默认关闭）；
 * - green   生态空间：公园、红树林、海滩的范围面（默认关闭）；
 * - water   水质：沿岸水质采样点，按水质类别着色，超标点常显（默认关闭）。
 */
export class EnvironmentScene extends ModuleScene {
  private data: EnvironmentData | null = null
  private hour = 12
  private index: AirIndex = 'aqi'
  /** onEnter 已经创建完图层。在此之前 setHour / setIndex 只记录取值 */
  private entered = false
  private regions: Awaited<ReturnType<typeof regionLayer>> | null = null
  /** 污染源、监测站标注的引线高度（'source:id' / 'station:id' → 高度），进入时按位置算好 */
  private leads = new Map<string, number>()
  /** 各随时间变化的图层上一次的内容签名，内容没变就不重建（避免标注闪动） */
  private signatures = new Map<string, string>()
  /** 当前被关掉的图层。标注不在场景里时，定位改用相机直接飞 */
  private hidden = new Set<string>()

  constructor(
    api: SceneApi,
    private readonly geo: CityGeo,
    private readonly options: EnvironmentSceneOptions
  ) {
    super(api)
    // 默认关闭的图层先记成隐藏，进入时就不会创建
    for (const l of ENV_LAYERS) if (!l.on) void this.setLayerVisible(l.key, false)
  }

  /** 进入前设置数据、初始小时和指标 */
  setData(data: EnvironmentData, hour: number, index: AirIndex = 'aqi') {
    this.data = data
    this.hour = hour
    this.index = index
  }

  /** 位置引用 → 投影坐标；引用的对象不存在时返回 null */
  private locate(place: PlaceRef): number[] | null {
    if ('landmark' in place) return this.geo.landmark(place.landmark)?.xy ?? null
    if ('intersection' in place) return this.geo.intersections.find(i => i.id === place.intersection)?.xy ?? null
    const road = this.geo.road(place.road)
    return road ? pointAt(road.line, place.t) : null
  }

  /** 各片区在当前时刻、当前指标下的颜色 */
  private districtColors(data: EnvironmentData): Record<string, string> {
    const byId = new Map(data.districts.map(d => [d.id, d]))
    return Object.fromEntries(
      this.geo.districts.map(d => {
        const env = byId.get(d.id)
        return [d.id, env ? airColor(readingOf(concentrationsAt(env, this.hour), this.index).level) : COLOR.muted]
      })
    )
  }

  protected async onEnter(token: number): Promise<void> {
    this.entered = false
    this.signatures.clear()
    const data = this.data
    if (!data) return
    const geo = this.geo

    if (this.options.cameraView) await this.api.setCamera(this.options.cameraView)

    if (this.options.pak) {
      const colors = this.districtColors(data)
      await this.effect(token, 'air', async () => {
        this.regions = await regionLayer(
          AIR_LAYER_ID,
          geo.districts.map(d => ({ id: d.id, color: colors[d.id], ring: d.ring })),
          { pattern: 'dots', scale: 3, fill: 0.1 }
        )
        return this.regions
      })
    }

    // 污染源与投诉：波纹大小和颜色按告警等级
    const sources = data.sources.flatMap(s => {
      const at = this.locate(s.place)
      return at ? [{ s, at }] : []
    })
    await this.add(token, 'radiationPoint', sources.map(({ s, at }) => ripple({ id: 'source-ripple-' + s.id, groupId: 'sc_environment_source_ripple', at, radius: s.level <= 2 ? 560 : 380, color: LEVEL_COLOR[s.level] })), 'source')
    // 污染源和监测站的标注一起错开引线高度（顺序固定：污染源按等级在前，监测站随后），拖动时间轴时不跳动
    const stations = data.stations.flatMap(s => {
      const at = this.locate(s.place)
      return at ? [{ id: 'station:' + s.id, at }] : []
    })
    const ordered = [...[...sources].sort((a, b) => a.s.level - b.s.level).map(({ s, at }) => ({ id: 'source:' + s.id, at })), ...stations]
    const heights = staggerHeights(
      ordered.map(o => o.at),
      44,
      34,
      LABEL_STAGGER
    )
    this.leads = new Map(ordered.map((o, k) => [o.id, heights[k]]))
    // 一、二级污染源常显，其余拉近才显示
    await this.add(
      token,
      'marker',
      sources.map(({ s, at }) => pin({ id: 'source-' + s.id, groupId: 'sc_environment_source', at, text: s.shortName, color: LEVEL_COLOR[s.level], userId: s.id, lineHeight: this.leads.get('source:' + s.id), priority: s.level <= 2 ? 8 : 2 })),
      'source'
    )

    // 生态空间：范围面
    await this.add(
      token,
      'polygon',
      data.greenSpaces.flatMap(g => {
        const at = this.locate(g.place)
        return at ? [area({ id: 'green-' + g.id, groupId: 'sc_environment_green', ring: circleRing(at, g.radius), color: COLOR.ok, fill: 0.12, frame: 0.8, frameWidth: 8 })] : []
      }),
      'green'
    )
    await this.add(
      token,
      'marker',
      data.waterSamples.flatMap(w => {
        const at = this.locate(w.place)
        // 超标（三、四类）的点常显，其余参与避让
        return at ? [pin({ id: 'water-' + w.id, groupId: 'sc_environment_water', at, text: `${w.id} ${WATER_GRADE_NAMES[w.grade]}`, color: WATER_COLORS[w.grade], userId: w.id, lineHeight: 26, fontSize: 11, priority: w.grade >= 3 ? 10 : 5 })] : []
      }),
      'water'
    )

    if (!this.isCurrent(token)) return
    // 随时间、指标变化的图层最后创建，用进入期间记录的最新取值；此后 setHour / setIndex 直接替换
    this.entered = true
    await this.apply(data)
  }

  protected async onLeave(): Promise<void> {
    this.entered = false
    this.regions = null
    this.signatures.clear()
  }

  /** 切换到某个小时。进入完成前只记录，由 onEnter 应用最新值 */
  async setHour(hour: number): Promise<void> {
    this.hour = hour
    if (this.entered && this.data) await this.apply(this.data)
  }

  /** 切换着色指标（AQI / PM2.5 / PM10 / O₃） */
  async setIndex(index: AirIndex): Promise<void> {
    this.index = index
    if (this.entered && this.data) await this.apply(this.data)
  }

  /** 内容变了才替换图层 */
  private async replaceIfChanged(layer: string, type: SceneObjectType, objects: { id: string }[]): Promise<void> {
    const signature = JSON.stringify(objects)
    if (this.signatures.get(layer) === signature) return
    this.signatures.set(layer, signature)
    await this.replaceLayer(layer, type, objects)
  }

  /** 片区标注：片区名 + 所选指标的读数，标在片区中心，全城视角下的主要信息（站点细节拉近再看） */
  private districtLabels(data: EnvironmentData): { id: string }[] {
    const byId = new Map(data.districts.map(d => [d.id, d]))
    return this.geo.districts.flatMap(d => {
      const env = byId.get(d.id)
      if (!env) return []
      const r = readingOf(concentrationsAt(env, this.hour), this.index)
      return [pin({ id: 'air-label-' + d.id, groupId: 'sc_environment_air_label', at: d.centerXY, text: d.name, value: String(r.value), color: airColor(r.level), userId: d.id, lineHeight: 18, fontSize: 12, priority: 6 })]
    })
  }

  private async apply(data: EnvironmentData): Promise<void> {
    const colors = this.districtColors(data)
    await Promise.all([
      this.replaceIfChanged(AIR_LABEL_LAYER, 'marker', this.districtLabels(data)),
      // 点阵流光只换颜色；没有效果总包（或创建失败）时用普通面
      this.regions
        ? this.regions.setColors(colors)
        : this.replaceIfChanged('air', 'polygon', this.geo.districts.map(d => area({ id: 'air-' + d.id, groupId: 'sc_environment_air', ring: d.ring, color: colors[d.id], fill: 0.16 }))),
      this.replaceIfChanged(
        'station',
        'marker',
        data.stations.flatMap(s => {
          const at = this.locate(s.place)
          if (!at) return []
          // 空气质量差的站点常显；其余拉近才显示（老城区站点密，全城视角下全显示会挤成一片）
          const r = readingOf(concentrationsAt(s, this.hour), this.index)
          return [pin({ id: 'station-' + s.id, groupId: 'sc_environment_station', at, text: s.shortName, value: String(r.value), color: airColor(r.level), userId: s.id, lineHeight: this.leads.get('station:' + s.id) ?? 44, priority: r.level >= 2 ? 10 : 2 })]
        })
      ),
      this.replaceIfChanged(
        'noise',
        'polygon3d',
        data.noisePoints.flatMap(p => {
          const at = this.locate(p.place)
          if (!at) return []
          const db = noiseDbAt(p, this.hour)
          // 40 dB 以下基本听不出差别，从 40 起算，每分贝 25 米
          return [column({ id: 'noise-' + p.id, groupId: 'sc_environment_noise', at, radius: NOISE_RADIUS, height: (db - 40) * 25, color: noiseColor(db) })]
        })
      )
    ])
  }

  /** 城市巡航的机位：先看当前最差的三个监测站，再看各污染源（按告警等级） */
  tourViews(): number[][] {
    const data = this.data
    if (!data) return []
    const places: PlaceRef[] = [
      ...stationReadingsAt(data, this.hour, 'aqi').slice(0, 3).map(r => r.station.place),
      ...[...data.sources].sort((a, b) => a.level - b.level).slice(0, 3).map(s => s.place)
    ]
    return places.flatMap(place => {
      const p = this.locate(place)
      return p ? [focusView(p)] : []
    })
  }

  async setLayerVisible(layer: string, visible: boolean): Promise<void> {
    if (visible) this.hidden.delete(layer)
    else this.hidden.add(layer)
    await super.setLayerVisible(layer, visible)
    // 「空气质量」开关同时控制片区着色和片区标注
    if (layer === 'air') await super.setLayerVisible(AIR_LABEL_LAYER, visible)
  }

  /** 飞到某个位置 */
  private async flyTo(place: PlaceRef | undefined): Promise<void> {
    const p = place && this.locate(place)
    if (p) await this.api.setCamera(focusView(p), 1.5)
  }

  /** 飞到某个监测站 */
  async focusStation(id: string): Promise<void> {
    await this.flyTo(this.data?.stations.find(s => s.id === id)?.place)
  }

  /** 飞到某个污染源 */
  async focusSource(id: string): Promise<void> {
    await this.flyTo(this.data?.sources.find(s => s.id === id)?.place)
  }

  /** 飞到某个近岸水质采样点 */
  async focusWater(id: string): Promise<void> {
    await this.flyTo(this.data?.waterSamples.find(w => w.id === id)?.place)
  }
}
