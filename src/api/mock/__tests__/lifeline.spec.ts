import { describe, expect, it } from 'vitest'
import type { GeoData } from '@/types/geo'
import type { Anchor } from '@/types/lifeline'
import geoJson from '../../../../public/data/smart-city/geo.json'
import { bridgeStatus, buildLifelineData, buildPipes, depthStatus, lifelineSeries, loadStatus, powerLoadAt, powerLoadPeak, sortAlarms, waterPressureAt } from '../lifeline'

const geo = geoJson as unknown as GeoData
const data = buildLifelineData(geo)

const roadIds = new Set(geo.roads.map(r => r.id))
const intersectionIds = new Set(geo.intersections.map(i => i.id))
const landmarkIds = new Set(geo.landmarks.map(l => l.id))

/** 位置引用的道路、路口、地标都必须在 geo.json 里 */
function expectOnGeo(a: Anchor) {
  if (a.kind === 'intersection') expect(intersectionIds.has(a.id)).toBe(true)
  else if (a.kind === 'landmark') expect(landmarkIds.has(a.id)).toBe(true)
  else {
    expect(roadIds.has(a.roadId)).toBe(true)
    expect(a.t).toBeGreaterThanOrEqual(0)
    expect(a.t).toBeLessThanOrEqual(1)
    if (a.kind === 'between') {
      for (const id of [a.from, a.to]) {
        const i = geo.intersections.find(x => x.id === id)
        expect(i?.roads).toContain(a.roadId)
      }
    }
  }
}

describe('24 小时曲线', () => {
  it('水压和负荷都有早晚两个高峰，夜间最低', () => {
    expect(waterPressureAt(7.5)).toBeGreaterThan(waterPressureAt(13))
    expect(waterPressureAt(19)).toBeGreaterThan(waterPressureAt(13))
    expect(waterPressureAt(4)).toBeLessThan(waterPressureAt(13))
    expect(powerLoadAt(9.5)).toBeGreaterThan(powerLoadAt(12))
    expect(powerLoadAt(20.5)).toBeGreaterThan(powerLoadAt(17))
    expect(powerLoadAt(4)).toBeLessThan(powerLoadAt(12))
  })

  it('控制点之间线性插值，超出范围取端点', () => {
    expect(waterPressureAt(5)).toBeCloseTo(0.28)
    expect(powerLoadAt(-2)).toBe(620)
    expect(powerLoadAt(30)).toBe(640)
  })

  it('序列每半小时一个点，共 49 个', () => {
    const s = lifelineSeries()
    expect(s.pressure).toHaveLength(49)
    expect(s.load).toHaveLength(49)
    expect(s.load[0]).toEqual([0, 620])
    expect(s.pressure[48][0]).toBe(24)
  })

  it('负荷峰值在晚高峰', () => {
    expect(powerLoadPeak()).toEqual({ hour: 20.5, value: 985 })
  })
})

describe('状态分级', () => {
  it('变电站负荷率', () => {
    expect([48, 77, 92, 97].map(loadStatus)).toEqual([0, 1, 2, 3])
  })
  it('积水深度', () => {
    expect([3, 18, 25, 60].map(depthStatus)).toEqual([0, 1, 2, 3])
  })
  it('桥梁健康评分', () => {
    expect([95, 85, 78].map(bridgeStatus)).toEqual([0, 0, 1])
  })
})

describe('buildPipes', () => {
  const pipes = buildPipes(geo)
  const roadsOf = (system: string, grade?: string) => pipes.filter(p => p.system === system && (!grade || p.grade === grade)).map(p => p.roadId)

  it('供水主干管沿三条纵向主干路，配水干管沿全部次干路横街', () => {
    expect(roadsOf('water', 'trunk')).toEqual(['khaleej', 'airport', 'muroor'])
    expect(roadsOf('water', 'branch')).toEqual(geo.roads.filter(r => r.direction === 'cross' && r.level === 2).map(r => r.id))
  })

  it('电力沿海岸两条路和两条横街，燃气只走横街', () => {
    expect(roadsOf('power', 'trunk')).toEqual(['corniche', 'salam'])
    expect(roadsOf('power', 'branch')).toHaveLength(2)
    for (const id of roadsOf('gas')) {
      const r = geo.roads.find(x => x.id === id)
      expect(r?.direction).toBe('cross')
      expect(r?.level).toBeGreaterThanOrEqual(2)
    }
  })

  it('每段都在真实道路上，长度等于道路长度，id 不重复', () => {
    expect(new Set(pipes.map(p => p.id)).size).toBe(pipes.length)
    for (const p of pipes) {
      const road = geo.roads.find(r => r.id === p.roadId)
      expect(road).toBeTruthy()
      expect(p.lengthKm).toBeCloseTo((road?.lengthKm ?? 0) * (p.to - p.from))
      expect(p.name).toContain(road?.name)
    }
  })
})

describe('buildLifelineData', () => {
  it('同一份 geo 每次生成的结果相同', () => {
    expect(buildLifelineData(geo)).toEqual(data)
  })

  it('设施数量符合要求', () => {
    expect(data.substations.length).toBeGreaterThanOrEqual(5)
    expect(data.substations.length).toBeLessThanOrEqual(6)
    expect(data.gasStations.length).toBeGreaterThanOrEqual(4)
    expect(data.floodPoints.length).toBeGreaterThanOrEqual(4)
    expect(data.pumpStations.length).toBeGreaterThanOrEqual(3)
    expect(data.bridges.map(b => b.id).sort()).toEqual(['maqta-bridge', 'mussafah-bridge', 'zayed-bridge'])
    expect(data.alarms.length).toBeGreaterThanOrEqual(6)
    expect(data.alarms.length).toBeLessThanOrEqual(8)
  })

  it('所有设施和告警都落在 geo.json 的道路、路口或地标上', () => {
    const anchors = [...data.substations, ...data.gasStations, ...data.floodPoints, ...data.pumpStations, ...data.alarms].map(x => x.anchor)
    anchors.forEach(expectOnGeo)
    data.floodPoints.forEach(f => {
      expect(f.radius).toBeGreaterThanOrEqual(220)
      expect(f.radius).toBeLessThanOrEqual(320)
    })
  })

  it('站点都在本系统管线经过的道路上', () => {
    const onNetwork = (system: string, a: Anchor) => {
      const roads = data.pipes.filter(p => p.system === system).map(p => p.roadId)
      const own = a.kind === 'intersection' ? (geo.intersections.find(i => i.id === a.id)?.roads ?? []) : a.kind === 'landmark' ? [] : [a.roadId]
      return own.some(r => roads.includes(r))
    }
    data.substations.forEach(s => expect(onNetwork('power', s.anchor)).toBe(true))
    data.gasStations.forEach(g => expect(onNetwork('gas', g.anchor)).toBe(true))
    data.pumpStations.forEach(p => expect(onNetwork('drain', p.anchor)).toBe(true))
    data.floodPoints.forEach(f => expect(onNetwork('drain', f.anchor)).toBe(true))
  })

  it('包含总览告警列表里的三条生命线告警，标题、等级、时间一致', () => {
    const find = (id: string) => data.alarms.find(a => a.id === id)
    expect(find('a1')).toMatchObject({ level: 1, title: '阿拉伯湾街 DN600 供水主管爆管', area: '哈利迪亚', time: '14:26', districtId: 'khalidiyah' })
    expect(find('a1')?.anchor).toMatchObject({ kind: 'between', roadId: 'khaleej' })
    expect(find('a1')?.segment).toEqual({ roadId: 'khaleej', from: 'hamdan-khaleej', to: 'zayed1-khaleej' })
    expect(find('a5')).toMatchObject({ level: 3, title: '苏丹·本·扎耶德街下穿通道积水 18 cm', area: '纳哈扬', time: '13:57' })
    expect(find('a5')?.anchor).toMatchObject({ roadId: 'muroor' })
    expect(find('a6')).toMatchObject({ level: 4, title: '巴廷 3 号变电站负荷偏高', area: '巴廷', time: '13:42' })
  })

  it('变电站告警对应的变电站在巴廷片区，负荷状态为预警', () => {
    const a6 = data.alarms.find(a => a.id === 'a6')
    const sub = data.substations.find(s => s.id === a6?.facilityId)
    expect(sub).toMatchObject({ name: '巴廷 3 号变电站', districtId: 'bateen', status: 2 })
  })

  it('告警按等级、再按时间从新到旧排序，详情字段齐全', () => {
    expect(data.alarms).toEqual(sortAlarms(data.alarms))
    expect(data.alarms[0].id).toBe('a1')
    for (const a of data.alarms) {
      expect(a.readings.length).toBeGreaterThan(0)
      expect(a.steps.length).toBeGreaterThan(1)
      expect(a.location && a.facility && a.impact && a.crew && a.status).toBeTruthy()
    }
    const facilityIds = new Set([...data.substations, ...data.gasStations, ...data.floodPoints, ...data.pumpStations, ...data.bridges].map(x => x.id))
    data.alarms.filter(a => a.facilityId).forEach(a => expect(facilityIds.has(a.facilityId as string)).toBe(true))
  })

  it('工单都关联到存在的告警', () => {
    expect(data.orders.length).toBeGreaterThanOrEqual(4)
    for (const o of data.orders) {
      const a = data.alarms.find(x => x.id === o.alarmId)
      expect(a?.title).toBe(o.title)
      expect(o.progress).toBeGreaterThan(0)
      expect(o.progress).toBeLessThan(100)
    }
  })

  it('管网总长由实际绘制的管段长度累加', () => {
    const sum = data.pipes.reduce((n, p) => n + p.lengthKm, 0)
    expect(data.summary.totalKm).toBeCloseTo(sum, 1)
    const water = data.pipes.filter(p => p.system === 'water').reduce((n, p) => n + p.lengthKm, 0)
    expect(data.summary.kmBySystem.water).toBeCloseTo(water, 1)
    expect(data.summary.alarmsToday).toBe(data.alarms.length)
    expect(data.summary.integrity).toBeGreaterThan(90)
    expect(data.summary.integrity).toBeLessThan(100)
  })

  it('四个分系统各有一行，状态取该系统最严重的告警', () => {
    expect(data.systems.map(s => s.key)).toEqual(['water', 'power', 'gas', 'drain'])
    expect(data.systems.map(s => s.unit)).toEqual(['MPa', '%', 'kPa', '台'])
    expect(data.systems[0]).toMatchObject({ level: 1, status: '告警', value: waterPressureAt(data.hour).toFixed(2) })
    expect(data.systems[3].value).toBe('6 / 9')
  })

  it('geo 里缺少引用的对象时报错', () => {
    expect(() => buildLifelineData({ ...geo, landmarks: geo.landmarks.filter(l => l.id !== 'zayed-bridge') })).toThrow(/zayed-bridge/)
  })
})
