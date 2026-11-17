import { describe, expect, it } from 'vitest'
import type { GeoData } from '@/types/geo'
import type { Anchor } from '@/types/lifeline'
import geoJson from '../../../../public/data/smart-city/geo.json'
import { bridgeStatus, bridgeTrend, buildLifelineData, buildPipes, depthStatus, JOINT_LIMIT, lifelineSeries, loadStatus, powerLoadAt, powerLoadPeak, sortAlarms, waterPressureAt, waterSupplySeries } from '../lifeline'

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

describe('今日供水量', () => {
  const s = waterSupplySeries(14.5)

  it('昨日 25 个整点，今日只到数据时刻', () => {
    expect(s.yesterday).toHaveLength(25)
    expect(s.today).toHaveLength(15)
    expect(s.today[s.today.length - 1][0]).toBe(14)
  })

  it('早晚两个用水高峰，夜间最低；数值在 1–4 万 m³/时', () => {
    const at = (h: number) => s.yesterday[h][1]
    expect(at(8)).toBeGreaterThan(at(4))
    expect(at(19)).toBeGreaterThan(at(14))
    expect(at(4)).toBeLessThan(at(12))
    for (const [, v] of [...s.today, ...s.yesterday]) {
      expect(v).toBeGreaterThan(0.9)
      expect(v).toBeLessThan(4)
    }
  })

  it('累计量是数据时刻之前各整点之和，结果可重复', () => {
    expect(s.todayTotal).toBeCloseTo(s.today.slice(0, 15).reduce((n, p) => n + p[1], 0), 1)
    expect(s.yesterdaySameTime).toBeCloseTo(s.yesterday.slice(0, 15).reduce((n, p) => n + p[1], 0), 1)
    expect(waterSupplySeries(14.5)).toEqual(s)
    expect(data.supply).toEqual(s)
  })
})

describe('桥梁监测曲线', () => {
  it('每半小时一个点到数据时刻，午后位移最大', () => {
    const t = bridgeTrend('maqta-bridge', 14.5)
    expect(t).toHaveLength(30)
    expect(t[28][1]).toBeGreaterThan(t[8][1])
  })

  it('穆萨法桥午后超过阈值（与伸缩缝位移告警一致），其余两座不超', () => {
    const peak = (id: string) => Math.max(...bridgeTrend(id).map(p => p[1]))
    expect(peak('mussafah-bridge')).toBeGreaterThan(JOINT_LIMIT)
    expect(peak('zayed-bridge')).toBeLessThan(JOINT_LIMIT)
    expect(peak('maqta-bridge')).toBeLessThan(JOINT_LIMIT)
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
    expect(data.alarms.length).toBeLessThanOrEqual(9)
    expect(data.coolingPlants.length).toBeGreaterThanOrEqual(3)
  })

  it('所有设施和告警都落在 geo.json 的道路、路口或地标上', () => {
    const valves = data.alarms.flatMap(a => a.analysis?.valves ?? [])
    const anchors = [...data.substations, ...data.gasStations, ...data.floodPoints, ...data.pumpStations, ...data.coolingPlants, ...data.alarms, ...valves].map(x => x.anchor)
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
    data.coolingPlants.forEach(c => expect(onNetwork('cooling', c.anchor)).toBe(true))
  })

  it('区域供冷：主管沿滨海大道，支管只铺市中心一段，供冷站有一座回水温度偏高并对应一条告警', () => {
    const cooling = data.pipes.filter(p => p.system === 'cooling')
    expect(cooling.find(p => p.grade === 'trunk')?.roadId).toBe('corniche')
    for (const p of cooling.filter(p => p.grade === 'branch')) {
      expect(p.from).toBeGreaterThan(0)
      expect(p.to).toBe(1)
    }
    const hot = data.coolingPlants.filter(c => c.status > 0)
    expect(hot).toHaveLength(1)
    expect(hot[0].name).toBe('扎希亚 2 号供冷站')
    expect(data.alarms.find(a => a.system === 'cooling')).toMatchObject({ id: 'c1', facilityId: hot[0].id, area: '扎希亚' })
    expect(new Set(data.coolingPlants.map(c => c.id)).size).toBe(data.coolingPlants.length)
  })

  it('每条告警都有处置建议；除桥梁外都有影响分析，用户数等于各小区之和', () => {
    for (const a of data.alarms) {
      expect(a.advice.length).toBeGreaterThan(4)
      if (a.system === 'bridge') {
        expect(a.analysis).toBeUndefined()
        continue
      }
      const an = a.analysis
      expect(an, a.id).toBeTruthy()
      expect(an?.users).toBe(an?.communities.reduce((n, c) => n + c.users, 0))
      expect(an?.communities.length).toBeGreaterThanOrEqual(2)
      expect(an?.recovery).toMatch(/^\d\d:\d\d$/)
      expect(an?.radius).toBeGreaterThanOrEqual(250)
      expect(an?.radius).toBeLessThanOrEqual(800)
    }
  })

  it('爆管的影响分析：3 个小区 2,140 户，17:30 恢复，关闭的两个阀门在管段两端的路口，建议里写明阀门', () => {
    const a1 = data.alarms.find(a => a.id === 'a1')
    expect(a1?.analysis).toMatchObject({ users: 2140, recovery: '17:30' })
    expect(a1?.analysis?.communities).toHaveLength(3)
    expect(a1?.analysis?.communities[0].name).toBe('哈利迪亚 · 阿拉伯湾街 12–18 号')
    expect(a1?.analysis?.valves.map(v => [v.name, v.anchor])).toEqual([
      ['V-1023', { kind: 'intersection', id: a1?.segment?.from }],
      ['V-1027', { kind: 'intersection', id: a1?.segment?.to }]
    ])
    expect(a1?.advice).toContain('V-1023')
    expect(a1?.advice).toContain('V-1027')
    const ids = data.alarms.flatMap(a => a.analysis?.valves ?? []).map(v => v.id)
    expect(new Set(ids).size).toBe(ids.length)
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
    const facilityIds = new Set([...data.substations, ...data.gasStations, ...data.floodPoints, ...data.pumpStations, ...data.coolingPlants, ...data.bridges].map(x => x.id))
    data.alarms.filter(a => a.facilityId).forEach(a => expect(facilityIds.has(a.facilityId as string)).toBe(true))
  })

  it('工单都关联到存在的告警', () => {
    expect(data.orders.length).toBeGreaterThanOrEqual(4)
    for (const o of data.orders) {
      expect(o.kind).toBe('repair')
      expect(o.targetId).toBe(o.alarmId)
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

  it('五个分系统各有一行，状态取该系统最严重的告警', () => {
    expect(data.systems.map(s => s.key)).toEqual(['water', 'power', 'gas', 'drain', 'cooling'])
    expect(data.systems.map(s => s.unit)).toEqual(['MPa', '%', 'kPa', '台', '%'])
    expect(data.systems[4]).toMatchObject({ name: '区域供冷', level: 4, note: `供冷站 ${data.coolingPlants.length} 座` })
    expect(data.summary.kmBySystem.cooling).toBeGreaterThan(0)
    expect(data.systems[0]).toMatchObject({ level: 1, status: '告警', value: waterPressureAt(data.hour).toFixed(2) })
    expect(data.systems[3].value).toBe('6 / 9')
  })

  it('geo 里缺少引用的对象时报错', () => {
    expect(() => buildLifelineData({ ...geo, landmarks: geo.landmarks.filter(l => l.id !== 'zayed-bridge') })).toThrow(/zayed-bridge/)
  })
})
