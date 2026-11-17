import { getGeoData } from '@/api/geo'
import { DtsSceneApi } from './DtsSceneApi'
import { applyAmbience, mountEffectsPak, mountHeatFieldPak, mountPointBeaconPak } from './effects'
import { buildCityGeo, type CityGeo } from './geo'
import { lineScaler } from './lineScale'
import { COLOR, plainLine, rgba } from './kit'
import { whenSceneReady } from './sceneReady'

const CLEARABLE = ['marker', 'marker3d', 'polygon', 'polygon3d', 'polyline', 'odline', 'beam', 'radiationPoint', 'heatmap', 'customObject'] as const
const ROAD_PREFIX = 'sc_base_road_'
const COAST_ID = 'sc_base_coast'
/** 真实街道按等级的样式：快速路/主干路最亮最粗，支路细而淡，只勾出街区肌理 */
const STREET_STYLE: Record<number, { color: string; width: number; brightness: number; alpha: number }> = {
  1: { color: COLOR.accentLight, width: 28, brightness: 1.3, alpha: 0.8 },
  2: { color: COLOR.accent, width: 20, brightness: 1.1, alpha: 0.7 },
  3: { color: COLOR.accent, width: 14, brightness: 0.9, alpha: 0.55 },
  4: { color: COLOR.accent, width: 10, brightness: 0.8, alpha: 0.4 }
}

/** 压暗时底座道路的不透明度 */
const DIM_ALPHA = 0.28
/** polyline.update 每批的条数 */
const UPDATE_CHUNK = 200

/** 开场相机飞行时间，秒 */
const INTRO_SECONDS = 4.5
/** 次干路、次要道路、支路依次点亮前的等待，毫秒（逐级累加） */
const INTRO_REVEAL = [900, 1100, 1100]

/** public/config/smart-city.js 的配置；没加载（单元测试）时为空对象 */
const smartCityConfig = (): { cameras?: Record<string, number[]>; intro?: boolean } => (typeof gVar === 'undefined' ? {} : (gVar?.smartCity ?? {}))

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** 当前路由对应模块在 smart-city.js 里配置的默认机位，没有配置时为 undefined */
export function introHome(hash = location.hash): number[] | undefined {
  const cameras = smartCityConfig().cameras ?? {}
  const module = /^#\/(\w+)/.exec(hash)?.[1] ?? 'overview'
  return cameras[module] ?? cameras.overview
}

/**
 * 开场起点：看向同一地面点，但更高、更陡，并绕目标转开 35°，飞回来时带一点环绕感。
 * cam 为 [x, y, z, pitch, yaw]；朝向约定同 kit.focusView（视线方向 (cos yaw, -sin yaw)）。
 */
export function introStart(cam: number[]): [number, number, number, number, number] {
  const [x, y, z, pitch, yaw] = cam
  const rad = Math.PI / 180
  const reach = z / Math.tan(-pitch * rad)
  const target = [x + Math.cos(yaw * rad) * reach, y - Math.sin(yaw * rad) * reach]
  const h = z * 2.6
  const p = -62
  const w = yaw + 35
  const d = h / Math.tan(-p * rad)
  return [target[0] - Math.cos(w * rad) * d, target[1] + Math.sin(w * rad) * d, h, p, w]
}

/**
 * 城市底座：所有模块共用、切换模块时不重建的东西——底图风格、效果总包、投影后的地理数据、
 * 路网流光和海岸线。场景就绪后启动一次；各模块进入前 await cityBase.start() 拿到 CityGeo。
 */
class CityBase {
  /** 投影后的地理数据；场景没连上时为 null */
  geo: CityGeo | null = null
  /** 效果总包是否挂载成功。没挂载时各模块用 kit 里的内置样式兜底 */
  pak = false
  /** 分级点位效果的材质包是否挂上。没挂上时各模块的告警点用 DTS 自带的扩散波纹 */
  beacons = false
  /** 热力场材质包是否挂上。没挂上时热力图用 DTS 自带的 heatmap */
  heatField = false
  private starting: Promise<CityGeo | null> | null = null
  private roadIds: string[] = []
  private roadsShown = true
  /** 每条底座道路画出时的颜色和亮度，压暗后按它恢复 */
  private roadTone = new Map<string, { color: number[]; intensity: number }>()
  private roadsDimmed = false

  /** 启动底座（只执行一次）。场景连接失败时返回 null */
  start(): Promise<CityGeo | null> {
    this.starting ??= this.run()
    return this.starting
  }

  private async run(): Promise<CityGeo | null> {
    if (!(await whenSceneReady())) return null
    const api = new DtsSceneApi()
    // 场景对象存在渲染实例里，页面刷新后不会消失。启动时先清掉上一次页面留下的全部接口对象
    // （逐类 clear：实测 reset(ClearObjects) 清不掉热力图）
    await Promise.all(CLEARABLE.map(type => __xapi[type].clear()))
    await applyAmbience()
    this.pak = await mountEffectsPak()
    this.beacons = await mountPointBeaconPak()
    this.heatField = await mountHeatFieldPak()
    this.geo = await buildCityGeo(await getGeoData(), ll => api.project(ll))
    await this.drawRoads(api)
    lineScaler.start()
    // 开场动画不阻塞模块进入：模块在相机飞行的同时画自己的图层
    this.intro(api).catch(e => console.warn('[CityBase] 开场动画失败', e))
    return this.geo
  }

  /**
   * 路网骨架 + 海岸线。geo.json 带 OSM 真实街道时画全部街道（按等级分粗细、亮度），否则退回 17 条主要道路。
   * 底座路网只是城市骨架，要比各模块自己的图层暗一档、细一档。
   */
  private async drawRoads(api: DtsSceneApi): Promise<void> {
    const geo = this.geo as CityGeo
    const roads = geo.streets.length
      ? geo.streets.map(s => plainLine({ id: ROAD_PREFIX + s.id, groupId: 'sc_base', path: s.line, ...STREET_STYLE[s.level] }))
      : geo.roads.map(r => {
          const main = r.level === 1
          return plainLine({ id: ROAD_PREFIX + r.id, groupId: 'sc_base', path: r.line, color: main ? COLOR.accentLight : COLOR.accent, width: main ? 30 : 16, brightness: main ? 1.3 : 0.9, alpha: main ? 0.8 : 0.6 })
        })
    this.roadIds = roads.map(r => r.id)
    this.roadTone = new Map(roads.map(r => [r.id, { color: r.color, intensity: r.intensity }]))
    await api.add('polyline', [...roads, plainLine({ id: COAST_ID, groupId: 'sc_base', path: [...geo.island, geo.island[0]], color: COLOR.ice, width: 18, brightness: 1.2, alpha: 0.55, height: 4 })])
    if (!this.roadsShown) await api.setVisible('polyline', this.roadIds, false)
  }

  /**
   * 开场：相机从高空、侧后方俯冲到当前模块的默认机位，路网按等级从主干路到支路逐级点亮。
   * 页面每次连上场景播一次；smart-city.js 里 intro: false 可关掉。
   */
  private async intro(api: DtsSceneApi): Promise<void> {
    const geo = this.geo as CityGeo
    if (smartCityConfig().intro === false || !geo.streets.length) return
    // 终点用当前模块配置的默认机位：当前相机可能停在上一次页面留下的任意位置（渲染实例不随刷新复位）
    const cam: number[] | undefined = introHome() ?? (await __xapi.camera.get())?.camera
    if (!cam || cam.length < 5) return
    const ids = (lv: number) => geo.streets.filter(s => s.level === lv).map(s => ROAD_PREFIX + s.id)
    const later = [2, 3, 4].map(ids)
    if (this.roadsShown) await api.setVisible('polyline', later.flat(), false)
    await __xapi.camera.set(...introStart(cam), 0)
    void __xapi.camera.set(cam[0], cam[1], cam[2], cam[3], cam[4], INTRO_SECONDS)
    for (const [i, group] of later.entries()) {
      await delay(INTRO_REVEAL[i])
      // 期间模块可能把底座路网整体关掉（交通模块），这时不再点亮
      if (this.roadsShown) await api.setVisible('polyline', group, true)
    }
  }

  /**
   * 压暗/恢复底座路网：颜色换成低透明度的灰、亮度减半，只留街区肌理。
   * 自己有大量线状图层的模块（生命线管网）进入时压暗，免得蓝色街道和管线混在一起；离开时恢复。
   */
  async setRoadsDimmed(dim: boolean): Promise<void> {
    if (dim === this.roadsDimmed) return
    this.roadsDimmed = dim
    const updates = this.roadIds.map(id => {
      const tone = this.roadTone.get(id) as { color: number[]; intensity: number }
      return dim ? { id, color: rgba(COLOR.muted, DIM_ALPHA), intensity: tone.intensity * 0.5 } : { id, ...tone }
    })
    for (let i = 0; i < updates.length; i += UPDATE_CHUNK) await __xapi.polyline.update(updates.slice(i, i + UPDATE_CHUNK))
  }

  /** 显示/隐藏底座路网。需要自己画路况的模块（交通）进入时隐藏、离开时恢复 */
  async setRoadsVisible(visible: boolean): Promise<void> {
    this.roadsShown = visible
    if (this.roadIds.length) await new DtsSceneApi().setVisible('polyline', this.roadIds, visible)
  }
}

export const cityBase = new CityBase()
