import { getGeoData } from '@/api/geo'
import { DtsSceneApi } from './DtsSceneApi'
import { applyAmbience, mountEffectsPak } from './effects'
import { buildCityGeo, type CityGeo } from './geo'
import { COLOR, flowLine, plainLine, prepareFlowLines } from './kit'
import { whenSceneReady } from './sceneReady'

const CLEARABLE = ['marker', 'marker3d', 'polygon', 'polygon3d', 'polyline', 'odline', 'beam', 'radiationPoint', 'heatmap', 'customObject'] as const
const ROAD_PREFIX = 'sc_base_road_'
const COAST_ID = 'sc_base_coast'

/**
 * 城市底座：所有模块共用、切换模块时不重建的东西——底图风格、效果总包、投影后的地理数据、
 * 路网流光和海岸线。场景就绪后启动一次；各模块进入前 await cityBase.start() 拿到 CityGeo。
 */
class CityBase {
  /** 投影后的地理数据；场景没连上时为 null */
  geo: CityGeo | null = null
  /** 效果总包是否挂载成功。没挂载时各模块用 kit 里的内置样式兜底 */
  pak = false
  private starting: Promise<CityGeo | null> | null = null
  private roadIds: string[] = []
  private roadsShown = true

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
    this.geo = await buildCityGeo(await getGeoData(), ll => api.project(ll))
    await this.drawRoads(api)
    return this.geo
  }

  /** 路网：主干路是带脉冲的粒子流，次干路和支路是更细更暗的粒子流；外加一圈海岸线 */
  private async drawRoads(api: DtsSceneApi): Promise<void> {
    const geo = this.geo as CityGeo
    if (this.pak) await prepareFlowLines()
    const roads = geo.roads.map(r => {
      const main = r.level === 1
      const o = { id: ROAD_PREFIX + r.id, groupId: 'sc_base', path: r.line, color: main ? COLOR.accentLight : COLOR.accent, width: main ? 70 : 36, brightness: main ? 3 : 1.6 }
      return this.pak ? flowLine({ ...o, style: main ? 'pulse' : 'particles', spacing: main ? 160 : 120, speed: main ? 0.3 : 0.22 }) : plainLine({ ...o, flow: true })
    })
    this.roadIds = roads.map(r => r.id)
    await api.add('polyline', [...roads, plainLine({ id: COAST_ID, groupId: 'sc_base', path: [...geo.island, geo.island[0]], color: COLOR.ice, width: 18, brightness: 1.2, alpha: 0.55, height: 4 })])
    if (!this.roadsShown) await api.setVisible('polyline', this.roadIds, false)
  }

  /** 显示/隐藏底座路网。需要自己画路况的模块（交通）进入时隐藏、离开时恢复 */
  async setRoadsVisible(visible: boolean): Promise<void> {
    this.roadsShown = visible
    if (this.roadIds.length) await new DtsSceneApi().setVisible('polyline', this.roadIds, visible)
  }
}

export const cityBase = new CityBase()
