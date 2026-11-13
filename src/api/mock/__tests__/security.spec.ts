import { describe, expect, it } from 'vitest'
import { pointInRing } from '@/scene/geo'
import type { GeoData } from '@/types/geo'
import type { SecurityPeriod } from '@/types/security'
import geoJson from '../../../../public/data/smart-city/geo.json'
import { buildSecurityData, dailyIncidents, distanceMeters, hourlyIncidents, incidentHeatGrid, incidentTrend, INCIDENT_TYPES, isActive, periodTotal, typeDistribution } from '../security'

const geo = geoJson as unknown as GeoData
const data = buildSecurityData(geo, 14.5)
/** geo.json 里出现过的全部点位（地标 + 路口） */
const known = new Set([...geo.landmarks, ...geo.intersections].map(p => p.position.join(',')))
const PERIODS: SecurityPeriod[] = ['today', 'week', 'month']

describe('buildSecurityData', () => {
  it('每次生成的数据完全一样', () => {
    expect(buildSecurityData(geo, 14.5)).toEqual(data)
  })

  it('五个重点防护区都是真实地标，半径和高度在约定范围内', () => {
    expect(data.zones.map(z => z.id)).toEqual(['emirates-palace', 'qasr-al-watan', 'grand-mosque', 'bateen-airport', 'mina-zayed'])
    for (const z of data.zones) {
      const l = geo.landmarks.find(x => x.id === z.id)
      expect(l).toBeDefined()
      expect(z.name).toBe(l?.name)
      expect(z.position).toEqual(l?.position)
      expect(z.radius).toBeGreaterThanOrEqual(350)
      expect(z.radius).toBeLessThanOrEqual(600)
      expect(z.height).toBeGreaterThanOrEqual(120)
      expect(z.height).toBeLessThanOrEqual(200)
    }
  })

  it('离一、二级在办警情近的防护区转入加强警戒', () => {
    const status = Object.fromEntries(data.zones.map(z => [z.id, z.status]))
    expect(status['emirates-palace']).toBe('加强警戒')
    expect(status['grand-mosque']).toBe('正常')
  })

  it('警情有 6–8 条，位置都是 geo.json 的地标或路口，等级 1–4', () => {
    expect(data.incidents.length).toBeGreaterThanOrEqual(6)
    expect(data.incidents.length).toBeLessThanOrEqual(8)
    for (const i of data.incidents) {
      expect(known.has(i.position.join(','))).toBe(true)
      expect([1, 2, 3, 4]).toContain(i.level)
      expect(INCIDENT_TYPES).toContain(i.type)
      expect(i.place).not.toBe('')
      expect(i.time).toMatch(/^\d{2}:\d{2}$/)
    }
    expect(new Set(data.incidents.map(i => i.type)).size).toBe(5)
  })

  it('暖色等级（一至三级）的警情不超过一半多一点，场景里暖色对象才压得住', () => {
    expect(data.incidents.filter(i => i.level <= 3).length).toBeLessThanOrEqual(4)
  })

  it('处置进度与状态一致，时间不晚于当前时刻', () => {
    for (const i of data.incidents) {
      expect(i.timeline.map(s => s.name)).toEqual(['接警', '派单', '到场', '处置', '办结'])
      const done = i.timeline.filter(s => s.done)
      // 已完成的步骤连续排在前面
      expect(i.timeline.slice(0, done.length).every(s => s.done)).toBe(true)
      expect(i.timeline[0].time).toBe(i.time)
      expect(i.timeline[4].done).toBe(i.status === '已办结')
      expect(i.timeline[1].done).toBe(i.status !== '待派单')
      for (const s of i.timeline) {
        if (s.done) expect(s.time <= '14:30').toBe(true)
        else expect(s.time).toBe('')
      }
      if (i.status === '待派单') expect(i.units).toEqual([])
      else expect(i.units.length).toBeGreaterThan(0)
    }
  })

  it('警情时间随当前时刻推算，跨零点时回绕', () => {
    const early = buildSecurityData(geo, 0.25)
    expect(early.incidents.find(i => i.id === 'inc-06')?.time).toBe('23:04')
    expect(early.incidents.find(i => i.id === 'inc-05')?.time).toBe('00:11')
  })

  it('派出的巡逻单元真实存在，不重复派给两条警情，在办的标为出警中', () => {
    const units = data.patrols.flatMap(r => r.units)
    const sent = data.incidents.flatMap(i => i.units.filter(u => u.startsWith('巡逻 ')).map(u => ({ id: u.slice(3), active: isActive(i) })))
    expect(new Set(sent.map(s => s.id)).size).toBe(sent.length)
    for (const s of sent) {
      const unit = units.find(u => u.id === s.id)
      expect(unit).toBeDefined()
      expect(unit?.status).toBe(s.active ? '出警中' : '巡逻中')
    }
  })

  it('巡逻路线有 4–5 条，都沿真实道路，每条有巡逻单元', () => {
    expect(data.patrols.length).toBeGreaterThanOrEqual(4)
    expect(data.patrols.length).toBeLessThanOrEqual(5)
    expect(data.patrols.map(r => r.roadId)).toEqual(expect.arrayContaining(['corniche', 'hamdan', 'salam']))
    for (const r of data.patrols) {
      const road = geo.roads.find(x => x.id === r.roadId)
      expect(road).toBeDefined()
      expect(r.name).toContain(road?.name)
      expect(r.from).toBeGreaterThanOrEqual(0)
      expect(r.to).toBeLessThanOrEqual(1)
      expect(r.from).toBeLessThan(r.to)
      expect(r.units.length).toBeGreaterThan(0)
      r.units.forEach(u => {
        expect(u.at).toBeGreaterThanOrEqual(0)
        expect(u.at).toBeLessThanOrEqual(1)
      })
    }
    const ids = data.patrols.flatMap(r => r.units.map(u => u.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('摄像头约 40 路，都在地标或路口上，id 不重复，大部分在线', () => {
    expect(data.cameras.length).toBeGreaterThanOrEqual(36)
    expect(data.cameras.length).toBeLessThanOrEqual(44)
    expect(new Set(data.cameras.map(c => c.id)).size).toBe(data.cameras.length)
    data.cameras.forEach(c => expect(known.has(c.position.join(','))).toBe(true))
    const online = data.cameras.filter(c => c.online).length
    expect(online).toBeLessThan(data.cameras.length)
    expect(online / data.cameras.length).toBeGreaterThan(0.8)
  })

  it('每条警情带最近的 4 路摄像头，由近到远', () => {
    for (const i of data.incidents) {
      expect(i.cameraIds).toHaveLength(4)
      const d = i.cameraIds.map(id => distanceMeters((data.cameras.find(c => c.id === id) as { position: number[] }).position, i.position))
      expect([...d].sort((a, b) => a - b)).toEqual(d)
      const nearest = Math.min(...data.cameras.map(c => distanceMeters(c.position, i.position)))
      expect(d[0]).toBeCloseTo(nearest)
    }
  })

  it('视域 4–6 个：在线摄像头对准一、二级在办警情，不与警情同点，摄像头不复用', () => {
    expect(data.viewCones.length).toBeGreaterThanOrEqual(4)
    expect(data.viewCones.length).toBeLessThanOrEqual(6)
    expect(new Set(data.viewCones.map(v => v.cameraId)).size).toBe(data.viewCones.length)
    for (const v of data.viewCones) {
      const cam = data.cameras.find(c => c.id === v.cameraId)
      const inc = data.incidents.find(i => i.id === v.incidentId)
      expect(cam?.online).toBe(true)
      expect(inc && isActive(inc) && inc.level <= 2).toBe(true)
      expect(distanceMeters(cam?.position as number[], inc?.position as number[])).toBeGreaterThan(150)
    }
  })

  it('视频巡查取 4 路不同的摄像头，都来自在办警情周边', () => {
    expect(data.featuredCameraIds).toHaveLength(4)
    expect(new Set(data.featuredCameraIds).size).toBe(4)
    const near = new Set(data.incidents.filter(isActive).flatMap(i => i.cameraIds))
    data.featuredCameraIds.forEach(id => expect(near.has(id)).toBe(true))
  })

  it('在线警力和平均到场时间由明细算出', () => {
    const crew = data.patrols.flatMap(r => r.units).reduce((n, u) => n + u.crew, 0)
    expect(data.onlineForce).toBe(data.zones.reduce((n, z) => n + z.guards, 0) + crew)
    const arrived = data.incidents.flatMap(i => (i.arriveMinutes === null ? [] : [i.arriveMinutes]))
    expect(data.avgArriveMinutes).toBeCloseTo(arrived.reduce((a, b) => a + b, 0) / arrived.length, 1)
  })
})

describe('警情统计', () => {
  it('hourlyIncidents 是确定的非负整数，夜间高于凌晨', () => {
    for (let h = 0; h < 24; h++) {
      const v = hourlyIncidents(0, h)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(hourlyIncidents(0, h)).toBe(v)
    }
    expect(hourlyIncidents(0, 20)).toBeGreaterThan(hourlyIncidents(0, 4))
  })

  it('今天只算到当前小时，往日算全天', () => {
    expect(dailyIncidents(0, 6)).toBeLessThan(dailyIncidents(0, 18))
    expect(dailyIncidents(0, 23.5)).toBe(dailyIncidents(0, 24))
    expect(dailyIncidents(3, 6)).toBe(dailyIncidents(3, 18))
  })

  it('今日趋势：24 个点，当前小时之后为空，对比上周同日', () => {
    const t = incidentTrend('today', 14.5)
    expect(t.labels).toHaveLength(24)
    expect(t.current.slice(0, 15).every(v => v !== null)).toBe(true)
    expect(t.current.slice(15).every(v => v === null)).toBe(true)
    expect(t.previous).toEqual(Array.from({ length: 24 }, (_, h) => hourlyIncidents(7, h)))
    expect(t.current.reduce<number>((n, v) => n + (v ?? 0), 0)).toBe(dailyIncidents(0, 14.5))
    expect(t.previousName).toBe('上周同日')
  })

  it('近 7 / 30 日趋势：逐日，从最早排到今日，合计等于周期总数', () => {
    for (const [period, days] of [['week', 7], ['month', 30]] as [SecurityPeriod, number][]) {
      const t = incidentTrend(period, 14.5)
      expect(t.labels).toHaveLength(days)
      expect(t.labels[days - 1]).toBe('今日')
      expect(t.current).toHaveLength(days)
      expect(t.previous).toHaveLength(days)
      expect(t.current[days - 1]).toBe(dailyIncidents(0, 14.5))
      expect(t.previous[days - 1]).toBe(dailyIncidents(days))
      expect(t.current.reduce<number>((n, v) => n + (v ?? 0), 0)).toBe(periodTotal(period, 14.5))
    }
  })

  it('周期越长总数越大', () => {
    expect(periodTotal('today', 14.5)).toBeLessThan(periodTotal('week', 14.5))
    expect(periodTotal('week', 14.5)).toBeLessThan(periodTotal('month', 14.5))
  })

  it('类型分布覆盖五种类型，合计等于周期总数', () => {
    for (const period of PERIODS) {
      const rows = typeDistribution(period, 14.5)
      expect(rows.map(r => r.type)).toEqual(INCIDENT_TYPES)
      rows.forEach(r => expect(r.count).toBeGreaterThanOrEqual(0))
      expect(rows.reduce((n, r) => n + r.count, 0)).toBe(periodTotal(period, 14.5))
    }
  })
})

describe('incidentHeatGrid', () => {
  const districts = [
    { id: 'danah', baseDensity: 2 },
    { id: 'mushrif', baseDensity: 0.9 }
  ]
  const grid = [
    { xy: [0, 0], districtId: 'danah' },
    { xy: [5000, 0], districtId: 'danah' },
    { xy: [5000, 5000], districtId: 'mushrif' }
  ]
  const incidents = [{ level: 1, xy: [0, 0] }]

  it('每个网格点一个热力点，值在 0–1 之间', () => {
    for (const period of PERIODS) {
      const pts = incidentHeatGrid(period, grid, districts, incidents, 500)
      expect(pts).toHaveLength(3)
      pts.forEach((p, i) => {
        expect(p.at).toEqual(grid[i].xy)
        expect(p.radius).toBeCloseTo(550)
        expect(p.value).toBeGreaterThanOrEqual(0)
        expect(p.value).toBeLessThanOrEqual(1)
      })
    }
  })

  it('警情所在的点比同片区的远处更热', () => {
    const pts = incidentHeatGrid('today', grid, districts, incidents, 500)
    expect(pts[0].value).toBeGreaterThan(pts[1].value)
  })

  it('等级越高的警情贡献越大', () => {
    const severe = incidentHeatGrid('today', grid, districts, [{ level: 1, xy: [0, 0] }], 500)[0].value
    const minor = incidentHeatGrid('today', grid, districts, [{ level: 4, xy: [0, 0] }], 500)[0].value
    expect(severe).toBeGreaterThan(minor)
  })

  it('周期变化时热力不同：周期越长，远离警情处的常态热力越高', () => {
    const far = (period: SecurityPeriod) => incidentHeatGrid(period, grid, districts, incidents, 500)
    const today = far('today')
    const month = far('month')
    expect(today.map(p => p.value)).not.toEqual(month.map(p => p.value))
    // 繁忙片区的常态上限：今日 0.3×1.5，近 30 日 0.8×0.5 起
    expect(today[1].value).toBeLessThanOrEqual(0.45)
    expect(month[1].value).toBeGreaterThanOrEqual(0.4)
  })

  it('繁忙片区的常态热力高于普通居住片区（同样的位置扰动下）', () => {
    const a = incidentHeatGrid('month', [{ xy: [100, 100], districtId: 'danah' }], districts, [], 500)[0].value
    const b = incidentHeatGrid('month', [{ xy: [100, 100], districtId: 'mushrif' }], districts, [], 500)[0].value
    expect(a).toBeGreaterThan(b)
  })

  it('没有网格时返回空数组', () => {
    expect(incidentHeatGrid('today', [], districts, incidents, 500)).toEqual([])
  })
})

describe('数据落在主岛上', () => {
  it('警情、防护区、摄像头的经纬度都在主岛海岸线以内或紧邻（桥头除外）', () => {
    // 海岸线外扩约 600 米的宽松检查：点位取自 geo.json，这里只防止引用到错误的数据
    const [minLon, minLat, maxLon, maxLat] = geo.bbox
    const points = [...data.incidents, ...data.zones, ...data.cameras].map(p => p.position)
    points.forEach(p => {
      expect(p[0]).toBeGreaterThanOrEqual(minLon)
      expect(p[0]).toBeLessThanOrEqual(maxLon)
      expect(p[1]).toBeGreaterThanOrEqual(minLat)
      expect(p[1]).toBeLessThanOrEqual(maxLat)
    })
    // 警情发生地都在岛内
    data.incidents.forEach(i => expect(pointInRing(i.position, geo.island)).toBe(true))
  })
})
