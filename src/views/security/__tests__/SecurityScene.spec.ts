import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildSecurityData, isActive } from '@/api/mock/security'
import type { SceneApi, SceneObjectType } from '@/scene/SceneApi'
import { buildCityGeo, pointInRing, type CityGeo } from '@/scene/geo'
import { COLOR, focusView, LABEL_TIERS, LEVEL_COLOR, rgba } from '@/scene/kit'
import type { GeoData } from '@/types/geo'
import geoJson from '../../../../public/data/smart-city/geo.json'
import { SECURITY_GROUP, SECURITY_LAYERS, SecurityScene, sectorRing } from '../SecurityScene'

/** 严格的场景替身：重复添加同一个 id、删除不存在的 id 都会抛错 */
class FakeApi implements SceneApi {
  store = new Map<string, any>()
  visible = new Map<string, boolean>()
  cameraCalls: number[][] = []
  /** 设置后 setCamera() 会等它 resolve，用来停在“正在进入”的状态 */
  cameraGate: Promise<void> | null = null
  async add(type: SceneObjectType, objects: { id: string }[]) {
    objects.forEach(o => {
      const key = `${type}:${o.id}`
      if (this.store.has(key)) throw new Error('add: id already exists: ' + key)
      this.store.set(key, o)
      this.visible.set(key, true)
    })
  }
  async remove(type: SceneObjectType, ids: string[]) {
    ids.forEach(id => {
      const key = `${type}:${id}`
      if (!this.store.has(key)) throw new Error('remove: id does not exist: ' + key)
      this.store.delete(key)
      this.visible.delete(key)
    })
  }
  async setVisible(type: SceneObjectType, ids: string[], visible: boolean) {
    ids.forEach(id => this.visible.set(`${type}:${id}`, visible))
  }
  async setCamera(view: number[]) {
    if (this.cameraGate) await this.cameraGate
    this.cameraCalls.push(view)
  }
  async focus() {}
  async project(lonLat: number[][]) {
    return lonLat.map(p => [p[0] * 1e5, p[1] * 1e5, 0])
  }
  ids(type: string, prefix = '') {
    return [...this.store.keys()].filter(k => k.startsWith(`${type}:${prefix}`)).sort()
  }
  get(key: string) {
    return this.store.get(key)
  }
}

const raw = geoJson as unknown as GeoData
const data = buildSecurityData(raw, 14.5)
const units = data.patrols.flatMap(r => r.units)
/** 默认打开的三个图层的对象数：防护区面 + 标注、警情波纹 + 标注、巡逻路线 + 单元 */
const DEFAULT_COUNT = data.zones.length * 2 + data.incidents.length * 2 + data.patrols.length + units.length

describe('SecurityScene', () => {
  let geo: CityGeo
  let api: FakeApi
  let scene: SecurityScene

  beforeAll(async () => {
    geo = await buildCityGeo(raw, async ll => ll.map(p => [p[0] * 1e5, p[1] * 1e5, 0]))
  })

  beforeEach(() => {
    api = new FakeApi()
    scene = new SecurityScene(api, geo, { cameraView: null, heatmapZ: [-50, 300], pak: false })
    scene.setData(data, 'today')
  })

  it('图层定义：六个图层，防护区/警情/巡逻默认开，摄像头/监控视域/热力默认关', () => {
    expect(SECURITY_LAYERS.map(l => l.key)).toEqual(['fence', 'incident', 'patrol', 'camera', 'cone', 'heat'])
    expect(SECURITY_LAYERS.find(l => l.key === 'cone')?.name).toBe('监控视域')
    expect(SECURITY_LAYERS.filter(l => l.on).map(l => l.key)).toEqual(['fence', 'incident', 'patrol'])
  })

  it('进入时压暗底座街道，离开时恢复', async () => {
    const dim: boolean[] = []
    scene = new SecurityScene(api, geo, { cameraView: null, heatmapZ: [-50, 300], pak: false, dimBaseRoads: async d => void dim.push(d) })
    scene.setData(data, 'today')
    await scene.enter()
    expect(dim).toEqual([true])
    await scene.leave()
    expect(dim).toEqual([true, false])
  })

  it('进入后只创建默认打开的图层', async () => {
    await scene.enter()
    expect(api.ids('polygon')).toHaveLength(data.zones.length)
    expect(api.ids('radiationPoint')).toHaveLength(data.incidents.length)
    expect(api.ids('polyline')).toHaveLength(data.patrols.length)
    expect(api.ids('marker', 'zone-')).toHaveLength(data.zones.length)
    expect(api.ids('marker', 'incident-')).toHaveLength(data.incidents.length)
    expect(api.ids('marker', 'unit-')).toHaveLength(units.length)
    expect(api.ids('marker', 'camera-')).toEqual([])
    expect(api.ids('heatmap')).toEqual([])
    expect(api.store.size).toBe(DEFAULT_COUNT)
    expect(scene.objectCount()).toBe(DEFAULT_COUNT)
  })

  it('默认画面的标注不超过 30 个，暖色对象不超过两成', async () => {
    await scene.enter()
    expect(api.ids('marker').length).toBeLessThanOrEqual(30)
    const warm = [COLOR.danger, COLOR.warn, COLOR.caution].map(c => JSON.stringify(rgba(c, 0.9)))
    const warmLine = [COLOR.danger, COLOR.warn, COLOR.caution].map(c => JSON.stringify(rgba(c, 0.95)))
    const warmCount = [...api.store.values()].filter(o => warm.includes(JSON.stringify(o.color)) || warmLine.includes(JSON.stringify(o.lineColor))).length
    expect(warmCount).toBeGreaterThan(0)
    expect(warmCount / api.store.size).toBeLessThanOrEqual(0.2)
  })

  it('防护区（兜底）：以地标为圆心的范围面，半径与数据一致，另有名称和防护等级标注', async () => {
    await scene.enter()
    for (const z of data.zones) {
      const center = geo.xy(z.position)
      const poly = api.get('polygon:zone-area-' + z.id)
      expect(poly.color).toEqual(rgba(COLOR.accent, 0.12))
      for (const p of poly.coordinates) expect(Math.hypot(p[0] - center[0], p[1] - center[1])).toBeCloseTo(z.radius, 3)
      const marker = api.get('marker:zone-' + z.id)
      expect(marker.coordinate.slice(0, 2)).toEqual(center)
      expect(marker.text).toContain(z.name)
      expect(marker.text).toContain('级防护')
      expect(marker.groupId).toBe(SECURITY_GROUP.zone)
      expect(JSON.parse(marker.userData)).toEqual({ id: z.id })
    }
  })

  it('警情：波纹半径和颜色按等级，标注可点击', async () => {
    await scene.enter()
    for (const i of data.incidents) {
      const xy = geo.xy(i.position)
      const r = api.get('radiationPoint:incident-ripple-' + i.id)
      expect(r.coordinate.slice(0, 2)).toEqual(xy)
      expect(r.color).toEqual(rgba(LEVEL_COLOR[i.level], 0.9))
      expect(r.radius).toBeGreaterThanOrEqual(250)
      expect(r.radius).toBeLessThanOrEqual(800)
      const m = api.get('marker:incident-' + i.id)
      expect(m.text).toBe(`${['', '一级', '二级', '三级', '四级'][i.level]} · ${i.title}`)
      expect(m.groupId).toBe(SECURITY_GROUP.incident)
      expect(JSON.parse(m.userData)).toEqual({ id: i.id })
      expect(m.lineColor).toEqual(rgba(LEVEL_COLOR[i.level], 0.95))
      // 在办的一、二级警情始终显示（优先级 ≥ 10），其余参与避让
      const urgent = isActive(i) && i.level <= 2
      expect(m.priority).toBe(urgent ? 15 - i.level : 8 - i.level)
      expect(m.viewHeightRange).toEqual(urgent ? undefined : [1, LABEL_TIERS.normal])
    }
    const radius = (id: string) => api.get('radiationPoint:incident-ripple-' + id).radius
    const [most, least] = [data.incidents.find(i => i.level === 1), data.incidents.find(i => i.level === 4)]
    expect(radius(most?.id as string)).toBeGreaterThan(radius(least?.id as string))
  })

  it('巡逻（兜底）：路线是道路的一段、绿色普通线，巡逻单元落在路线上', async () => {
    await scene.enter()
    for (const route of data.patrols) {
      const road = geo.road(route.roadId)
      const line = api.get('polyline:patrol-' + route.id)
      expect(line.color).toEqual(rgba(COLOR.ok, 1))
      expect(line.thickness).toBeGreaterThanOrEqual(30)
      expect(line.coordinates.length).toBeGreaterThanOrEqual(2)
      // 路线的每个顶点都在原道路的折线上（到某一段的距离约为 0）
      const roadLine = road?.line as number[][]
      const onRoad = (p: number[]) =>
        roadLine.slice(1).some((b, k) => {
          const a = roadLine[k]
          const len = Math.hypot(b[0] - a[0], b[1] - a[1])
          const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (len * len)))
          return Math.hypot(a[0] + (b[0] - a[0]) * t - p[0], a[1] + (b[1] - a[1]) * t - p[1]) < 1
        })
      for (const p of line.coordinates) expect(onRoad(p)).toBe(true)
      for (const u of route.units) {
        const m = api.get('marker:unit-' + u.id)
        expect(onRoad(m.coordinate)).toBe(true)
        expect(m.text).toContain(u.id)
        expect(m.lineColor).toEqual(rgba(COLOR.ok, 0.95))
        expect(m.groupId).toBe(SECURITY_GROUP.unit)
      }
    }
  })

  it('打开摄像头图层后创建全部摄像头标注，在线蓝色、离线灰色；兜底分支不画视域', async () => {
    await scene.enter()
    await scene.setLayerVisible('camera', true)
    expect(api.ids('marker', 'camera-')).toHaveLength(data.cameras.length)
    for (const c of data.cameras) {
      const m = api.get('marker:camera-' + c.id)
      expect(m.coordinate.slice(0, 2)).toEqual(geo.xy(c.position))
      expect(m.lineColor).toEqual(rgba(c.online ? COLOR.accent : COLOR.muted, 0.95))
      expect(m.groupId).toBe(SECURITY_GROUP.camera)
    }
    expect(api.ids('customObject')).toEqual([])
    expect(api.store.size).toBe(DEFAULT_COUNT + data.cameras.length)
  })

  it('打开热力图层后创建一张热力图，点都在陆地上', async () => {
    await scene.enter()
    await scene.setLayerVisible('heat', true)
    expect(api.ids('heatmap')).toEqual(['heatmap:security-heat'])
    const hm = api.get('heatmap:security-heat')
    expect(hm.data.length).toBeGreaterThan(100)
    expect(hm.range).toEqual([0, 1])
    expect(hm.bbox[2]).toBe(-50)
    expect(hm.bbox[5]).toBe(300)
    for (const p of hm.data) {
      expect(pointInRing(p.coordinate, geo.land)).toBe(true)
      expect(p.heatValue).toBeGreaterThanOrEqual(0)
      expect(p.heatValue).toBeLessThanOrEqual(1)
    }
  })

  it('热力在警情附近更高', async () => {
    await scene.enter()
    await scene.setLayerVisible('heat', true)
    const hm = api.get('heatmap:security-heat')
    const worst = data.incidents.find(i => i.level === 1 && isActive(i))
    const at = geo.xy(worst?.position as number[])
    const near = hm.data.filter((p: any) => Math.hypot(p.coordinate[0] - at[0], p.coordinate[1] - at[1]) < 500)
    const avg = hm.data.reduce((n: number, p: any) => n + p.heatValue, 0) / hm.data.length
    expect(near.length).toBeGreaterThan(0)
    expect(Math.max(...near.map((p: any) => p.heatValue))).toBeGreaterThan(avg * 2)
  })

  it('切换统计周期会重建热力图，值随周期变化，始终只有一张', async () => {
    await scene.enter()
    await scene.setLayerVisible('heat', true)
    const today = api.get('heatmap:security-heat').data.map((p: any) => p.heatValue)
    await scene.setPeriod('month')
    const month = api.get('heatmap:security-heat').data.map((p: any) => p.heatValue)
    expect(api.ids('heatmap')).toHaveLength(1)
    expect(month).not.toEqual(today)
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
    expect(sum(month)).toBeGreaterThan(sum(today))
  })

  it('热力图层关闭时切换周期不创建对象，打开后用的是最新周期', async () => {
    await scene.enter()
    await scene.setPeriod('week')
    expect(api.ids('heatmap')).toEqual([])
    await scene.setLayerVisible('heat', true)
    const week = api.get('heatmap:security-heat').data.map((p: any) => p.heatValue)

    const other = new FakeApi()
    const fresh = new SecurityScene(other, geo, { cameraView: null, heatmapZ: [-50, 300], pak: false })
    fresh.setData(data, 'week')
    await fresh.setLayerVisible('heat', true)
    await fresh.enter()
    expect(other.get('heatmap:security-heat').data.map((p: any) => p.heatValue)).toEqual(week)
  })

  it('进入过程中切换的周期在进入完成后生效', async () => {
    let open!: () => void
    api.cameraGate = new Promise<void>(resolve => (open = resolve))
    scene = new SecurityScene(api, geo, { cameraView: [1, 2, 3, -38, -38], heatmapZ: [-50, 300], pak: false })
    scene.setData(data, 'today')
    await scene.setLayerVisible('heat', true)
    const entering = scene.enter()
    await scene.setPeriod('month')
    expect(api.ids('heatmap')).toEqual([])
    open()
    await entering
    const got = api.get('heatmap:security-heat').data.map((p: any) => p.heatValue)

    const other = new FakeApi()
    const fresh = new SecurityScene(other, geo, { cameraView: null, heatmapZ: [-50, 300], pak: false })
    fresh.setData(data, 'month')
    await fresh.setLayerVisible('heat', true)
    await fresh.enter()
    expect(got).toEqual(other.get('heatmap:security-heat').data.map((p: any) => p.heatValue))
  })

  it('图层开关：关闭后隐藏该图层的全部对象，其它图层不受影响', async () => {
    await scene.enter()
    await scene.setLayerVisible('incident', false)
    const inc = data.incidents[0].id
    expect(api.visible.get('marker:incident-' + inc)).toBe(false)
    expect(api.visible.get('radiationPoint:incident-ripple-' + inc)).toBe(false)
    expect(api.visible.get('marker:zone-' + data.zones[0].id)).toBe(true)
    expect(api.visible.get('polyline:patrol-' + data.patrols[0].id)).toBe(true)

    await scene.setLayerVisible('fence', false)
    expect(api.visible.get('polygon:zone-area-' + data.zones[0].id)).toBe(false)
    expect(api.visible.get('marker:zone-' + data.zones[0].id)).toBe(false)

    await scene.setLayerVisible('patrol', false)
    expect(api.visible.get('polyline:patrol-' + data.patrols[0].id)).toBe(false)
    expect(api.visible.get('marker:unit-' + units[0].id)).toBe(false)

    await scene.setLayerVisible('incident', true)
    expect(api.visible.get('marker:incident-' + inc)).toBe(true)
    expect(api.visible.get('radiationPoint:incident-ripple-' + inc)).toBe(true)
  })

  it('进入前关闭的图层不创建对象', async () => {
    await scene.setLayerVisible('patrol', false)
    await scene.setLayerVisible('camera', true)
    await scene.enter()
    expect(api.ids('polyline')).toEqual([])
    expect(api.ids('marker', 'unit-')).toEqual([])
    expect(api.ids('marker', 'camera-')).toHaveLength(data.cameras.length)
  })

  it('配置了默认机位时进入会设置相机，没有配置时不动相机', async () => {
    await scene.enter()
    expect(api.cameraCalls).toEqual([])
    scene = new SecurityScene(new FakeApi(), geo, { cameraView: [1, 2, 3, -45, 0], heatmapZ: [-50, 300], pak: false })
    const other = new FakeApi()
    scene = new SecurityScene(other, geo, { cameraView: [1, 2, 3, -45, 0], heatmapZ: [-50, 300], pak: false })
    scene.setData(data, 'today')
    await scene.enter()
    expect(other.cameraCalls).toEqual([[1, 2, 3, -45, 0]])
  })

  it('巡航机位：五个防护区（3600 米）+ 最严重的三条在办警情（3000 米），都是统一的俯瞰机位', async () => {
    expect(scene.tourViews()).toEqual([])
    await scene.enter()
    const views = scene.tourViews()
    expect(views).toHaveLength(data.zones.length + 3)
    const worst = [...data.incidents]
      .filter(isActive)
      .sort((a, b) => a.level - b.level)
      .slice(0, 3)
    expect(views).toEqual([...data.zones.map(z => focusView(geo.xy(z.position), 3600)), ...worst.map(i => focusView(geo.xy(i.position)))])
    // 机位在目标的西南上方
    const first = geo.xy(data.zones[0].position)
    expect(views[0][0]).toBeLessThan(first[0])
    expect(views[0][1]).toBeLessThan(first[1])
    expect(views[0].slice(2)).toEqual([3600, -42, -38])
    expect(views[data.zones.length].slice(2)).toEqual([3000, -42, -38])
  })

  it('定位警情、防护区、摄像头：不论图层开关都飞到统一的俯瞰机位，高度按对象大小；未知 id 不动相机', async () => {
    await scene.enter()
    const targets: [() => Promise<void>, number[], number][] = [
      [() => scene.focusIncident(data.incidents[0].id), geo.xy(data.incidents[0].position), 3000],
      [() => scene.focusZone(data.zones[2].id), geo.xy(data.zones[2].position), 3600],
      [() => scene.focusCamera(data.cameras[5].id), geo.xy(data.cameras[5].position), 2400]
    ]
    const check = async () => {
      for (const [fly, p, height] of targets) {
        api.cameraCalls = []
        await fly()
        expect(api.cameraCalls).toEqual([focusView(p, height)])
        expect(api.cameraCalls[0][2]).toBe(height)
      }
    }
    // 默认：警情、防护区图层开着，摄像头图层关着
    await check()
    // 全部反过来，机位不变
    await scene.setLayerVisible('incident', false)
    await scene.setLayerVisible('fence', false)
    await scene.setLayerVisible('camera', true)
    await check()

    api.cameraCalls = []
    await scene.focusIncident('不存在')
    await scene.focusZone('不存在')
    await scene.focusCamera('不存在')
    expect(api.cameraCalls).toEqual([])
  })

  it('离开后清空全部对象', async () => {
    await scene.enter()
    await scene.setLayerVisible('camera', true)
    await scene.setLayerVisible('cone', true)
    await scene.setLayerVisible('heat', true)
    await scene.projectCamera(data.cameras[0].id)
    expect(api.store.size).toBe(DEFAULT_COUNT + data.cameras.length + data.viewCones.length + 2)
    await scene.leave()
    expect(api.store.size).toBe(0)
    expect(scene.objectCount()).toBe(0)
  })

  it('离开后切换周期不创建对象，再次进入时用的是最新周期', async () => {
    await scene.enter()
    await scene.setLayerVisible('heat', true)
    await scene.setPeriod('month')
    const month = api.get('heatmap:security-heat').data.map((p: any) => p.heatValue)
    await scene.leave()
    await scene.setPeriod('today')
    expect(api.store.size).toBe(0)
    await scene.setPeriod('month')
    await scene.enter()
    expect(api.get('heatmap:security-heat').data.map((p: any) => p.heatValue)).toEqual(month)
  })

  it('反复进入、离开不会越积越多', async () => {
    for (let i = 0; i < 4; i++) {
      await scene.enter()
      await scene.setLayerVisible('heat', i % 2 === 0)
      await scene.setPeriod(i % 2 ? 'week' : 'month')
      await scene.leave()
      expect(api.store.size).toBe(0)
    }
    await scene.setLayerVisible('heat', false)
    await scene.enter()
    expect(api.store.size).toBe(DEFAULT_COUNT)
    expect(scene.objectCount()).toBe(DEFAULT_COUNT)
  })

  it('监控视域（兜底）：默认不创建；打开后每个视域一个从摄像头张开、朝向警情的蓝色扇形；关闭隐藏', async () => {
    await scene.enter()
    expect(api.ids('polygon', 'cone-')).toEqual([])
    await scene.setLayerVisible('cone', true)
    expect(api.ids('polygon', 'cone-')).toHaveLength(data.viewCones.length)
    for (const c of data.viewCones) {
      const poly = api.get('polygon:cone-' + c.cameraId)
      const cam = geo.xy((data.cameras.find(x => x.id === c.cameraId) as { position: number[] }).position)
      const inc = geo.xy((data.incidents.find(x => x.id === c.incidentId) as { position: number[] }).position)
      expect(poly.coordinates[0].slice(0, 2)).toEqual(cam)
      expect(poly.color).toEqual(rgba(COLOR.accent, 0.22))
      // 扇形中线指向警情
      const mid = poly.coordinates[Math.floor(poly.coordinates.length / 2)]
      const a1 = Math.atan2(mid[1] - cam[1], mid[0] - cam[0])
      const a2 = Math.atan2(inc[1] - cam[1], inc[0] - cam[0])
      expect(Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2)))).toBeLessThan(0.01)
    }
    // 摄像头图层与视域图层互不影响
    expect(api.ids('marker', 'camera-')).toEqual([])
    await scene.setLayerVisible('cone', false)
    expect(api.visible.get('polygon:cone-' + data.viewCones[0].cameraId)).toBe(false)
    expect(api.ids('customObject')).toEqual([])
    await scene.leave()
    expect(api.store.size).toBe(0)
  })

  it('sectorRing：首点是镜头，弧上的点到镜头的距离都是 range，张角为 hfov', () => {
    const ring = sectorRing([100, 200], [100, 1200], 900, 60, 12)
    expect(ring).toHaveLength(14)
    expect(ring[0]).toEqual([100, 200])
    for (const p of ring.slice(1)) expect(Math.hypot(p[0] - 100, p[1] - 200)).toBeCloseTo(900, 6)
    const angle = (p: number[]) => (Math.atan2(p[1] - 200, p[0] - 100) * 180) / Math.PI
    expect(angle(ring[1])).toBeCloseTo(60)
    expect(angle(ring[13])).toBeCloseTo(120)
  })

  it('摄像头瞄准点：有视域的对准它的警情，其余落在 150–2500 米内或固定方向上，未知摄像头为 null', async () => {
    expect(scene.cameraTarget(data.cameras[0].id)).toBeNull()
    await scene.enter()
    const cone = data.viewCones[0]
    expect(scene.cameraTarget(cone.cameraId)).toEqual(geo.xy((data.incidents.find(i => i.id === cone.incidentId) as { position: number[] }).position))
    for (const c of data.cameras) {
      const t = scene.cameraTarget(c.id) as number[]
      const d = Math.hypot(t[0] - geo.xy(c.position)[0], t[1] - geo.xy(c.position)[1])
      expect(d).toBeGreaterThanOrEqual(150)
      expect(d).toBeLessThanOrEqual(2500)
    }
    expect(scene.cameraTarget('不存在')).toBeNull()
  })

  it('投射（兜底）：画一个贴地扇形，同一时刻只有一路，取消或离开后清除', async () => {
    expect(await scene.projectCamera(data.cameras[0].id)).toBe(false)
    expect(api.store.size).toBe(0)
    await scene.enter()
    const [a, b] = [data.cameras[3], data.cameras[7]]
    expect(await scene.projectCamera(a.id)).toBe(true)
    expect(scene.projectedCamera()).toBe(a.id)
    expect(api.ids('polygon', 'projection-')).toEqual(['polygon:projection-' + a.id])
    const poly = api.get('polygon:projection-' + a.id)
    expect(poly.coordinates[0].slice(0, 2)).toEqual(geo.xy(a.position))
    expect(poly.color).toEqual(rgba(COLOR.accent, 0.22))
    // 投射不受图层开关影响：摄像头、视域图层都关着
    expect(api.ids('marker', 'camera-')).toEqual([])
    expect(await scene.projectCamera(b.id)).toBe(true)
    expect(api.ids('polygon', 'projection-')).toEqual(['polygon:projection-' + b.id])
    await scene.clearProjection()
    expect(scene.projectedCamera()).toBeNull()
    expect(api.ids('polygon', 'projection-')).toEqual([])
    expect(api.store.size).toBe(DEFAULT_COUNT)

    expect(await scene.projectCamera('不存在')).toBe(false)
    expect(await scene.projectCamera(a.id)).toBe(true)
    await scene.leave()
    expect(api.store.size).toBe(0)
    expect(scene.projectedCamera()).toBeNull()
  })

  it('投射后马上取消：过期的投射不留下对象', async () => {
    await scene.enter()
    const projecting = scene.projectCamera(data.cameras[2].id)
    await scene.clearProjection()
    expect(await projecting).toBe(false)
    expect(api.ids('polygon', 'projection-')).toEqual([])
  })

  it('定位片区：飞到片区质心上空 3600 米，未知片区不动相机', async () => {
    await scene.enter()
    const d = geo.districts[3]
    await scene.focusDistrict(d.id)
    expect(api.cameraCalls).toEqual([focusView(geo.xy(d.centroid), 3600)])
    api.cameraCalls = []
    await scene.focusDistrict('不存在')
    expect(api.cameraCalls).toEqual([])
  })

  it('没有设置数据时进入不创建任何对象', async () => {
    const empty = new SecurityScene(api, geo, { cameraView: null, heatmapZ: [-50, 300], pak: false })
    await empty.enter()
    expect(api.store.size).toBe(0)
    expect(empty.tourViews()).toEqual([])
  })
})
