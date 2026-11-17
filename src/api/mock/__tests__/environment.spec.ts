import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { GeoData } from '@/types/geo'
import {
  airLevel,
  alarmsAt,
  aqiOf,
  buildEnvironmentData,
  cityConcentrationsAt,
  cityHourly,
  citySeries,
  concentrationsAt,
  districtReadingsAt,
  formatHour,
  iaqi,
  isNight,
  isOverLimit,
  noiseDbAt,
  noiseSummary,
  noiseZoneRows,
  POLLUTANTS,
  readingOf,
  seeded,
  stationReadingsAt,
  stationSeries,
  waterDistribution,
  waterExceedance,
  WATER_LIMIT,
  waterSummary,
  worstHour
} from '../environment'

const geo: GeoData = JSON.parse(readFileSync('public/data/smart-city/geo.json', 'utf-8'))
const data = buildEnvironmentData(geo)
const district = (id: string) => data.districts.find(d => d.id === id)!
const station = (id: string) => data.stations.find(s => s.id === id)!

describe('buildEnvironmentData', () => {
  it('所有位置都引用 geo.json 里真实存在的对象', () => {
    const landmarks = new Set(geo.landmarks.map(l => l.id))
    const crossings = new Set(geo.intersections.map(i => i.id))
    const roads = new Set(geo.roads.map(r => r.id))
    expect(data.stations).toHaveLength(10)
    data.stations.forEach(s => expect(landmarks.has(s.place.landmark)).toBe(true))
    data.greenSpaces.forEach(g => expect(landmarks.has(g.place.landmark)).toBe(true))
    data.noisePoints.forEach(p => expect(crossings.has(p.place.intersection)).toBe(true))
    data.waterSamples.forEach(w => expect(roads.has(w.place.road)).toBe(true))
    data.sources.forEach(s => {
      if ('landmark' in s.place) expect(landmarks.has(s.place.landmark)).toBe(true)
      else if ('intersection' in s.place) expect(crossings.has(s.place.intersection)).toBe(true)
      else expect(roads.has(s.place.road)).toBe(true)
    })
  })

  it('数量符合场景规范：片区 16、污染源 4–6、噪声点约 15、生态空间 3、水质点 6–8', () => {
    expect(data.districts).toHaveLength(16)
    expect(data.sources.length).toBeGreaterThanOrEqual(4)
    expect(data.sources.length).toBeLessThanOrEqual(6)
    expect(data.noisePoints.length).toBeGreaterThanOrEqual(13)
    expect(data.noisePoints.length).toBeLessThanOrEqual(18)
    expect(data.greenSpaces).toHaveLength(3)
    expect(data.waterSamples.length).toBeGreaterThanOrEqual(6)
    expect(data.waterSamples.length).toBeLessThanOrEqual(8)
  })

  it('生态空间半径不超过 500 米，水质点只在两条海岸道路上', () => {
    data.greenSpaces.forEach(g => expect(g.radius).toBeLessThanOrEqual(500))
    data.waterSamples.forEach(w => {
      expect(['corniche', 'salam']).toContain(w.place.road)
      expect(w.place.t).toBeGreaterThanOrEqual(0)
      expect(w.place.t).toBeLessThanOrEqual(1)
    })
  })

  it('名称用真实的地标、路口名', () => {
    expect(station('mina-zayed').name).toBe('扎耶德港站')
    expect(station('mina-zayed').districtName).toBe('扎希亚')
    expect(data.sources.find(s => s.id === 'src-fume-hamdan')?.name).toBe('哈姆丹街与谢赫拉希德街口餐饮油烟')
    expect(data.noisePoints[0].name).toMatch(/街与.+口$/)
  })

  it('两次生成结果完全一样', () => {
    expect(buildEnvironmentData(geo)).toEqual(data)
  })

  it('geo 里没有的引用被跳过，不报错', () => {
    const small = buildEnvironmentData({ ...geo, landmarks: [], intersections: [], roads: [] })
    expect(small.stations).toEqual([])
    expect(small.sources).toEqual([])
    expect(small.noisePoints).toEqual([])
    expect(small.waterSamples).toEqual([])
    expect(small.districts).toHaveLength(16)
  })
})

describe('iaqi / aqiOf / airLevel', () => {
  it('分界点上取到对应的分指数', () => {
    expect(iaqi('pm25', 35)).toBe(50)
    expect(iaqi('pm25', 75)).toBe(100)
    expect(iaqi('pm10', 150)).toBe(100)
    expect(iaqi('pm10', 250)).toBe(150)
    expect(iaqi('o3', 160)).toBe(50)
    expect(iaqi('co', 5)).toBe(50)
  })

  it('分界点之间线性插值，超出上限封顶 500', () => {
    expect(iaqi('pm10', 100)).toBe(75)
    expect(iaqi('pm10', 9999)).toBe(500)
  })

  it('AQI 取最大的分指数并给出首要污染物', () => {
    expect(aqiOf({ pm25: 20, pm10: 200, o3: 60, no2: 30, so2: 5, co: 0.5 })).toEqual({ aqi: 125, primary: 'pm10' })
  })

  it('等级按 50 / 100 / 150 分档', () => {
    expect([50, 51, 100, 101, 150, 151].map(airLevel)).toEqual([0, 1, 1, 2, 2, 3])
  })

  it('单项模式显示浓度、按分指数定级', () => {
    const c = { pm25: 20, pm10: 200, o3: 60, no2: 30, so2: 5, co: 0.5 }
    expect(readingOf(c, 'pm10')).toEqual({ value: 200, index: 125, level: 2 })
    expect(readingOf(c, 'aqi')).toEqual({ value: 125, index: 125, level: 2 })
    expect(readingOf(c, 'pm25').level).toBe(0)
  })
})

describe('concentrationsAt：符合城市规律', () => {
  it('港区（扎希亚）作业时段 PM10 最高，达到轻度污染', () => {
    const rows = districtReadingsAt(data, 11, 'pm10')
    expect(rows[0].id).toBe('zahiyah')
    expect(rows[0].reading.level).toBe(2)
    expect(districtReadingsAt(data, 11, 'aqi')[0].id).toBe('zahiyah')
  })

  it('公园、滨海片区明显好于中心城区和港区', () => {
    for (const h of [3, 8.5, 11, 18]) {
      const aqi = (id: string) => readingOf(concentrationsAt(district(id), h), 'aqi').index
      for (const clean of ['mushrif', 'rasakhdar', 'qurm']) {
        expect(aqi(clean)).toBeLessThan(aqi('markaziyah'))
        expect(aqi(clean)).toBeLessThan(aqi('zahiyah'))
      }
    }
  })

  it('早晚高峰 NO₂ 和 PM2.5 高于平峰和深夜', () => {
    const d = district('markaziyah')
    const at = (h: number) => concentrationsAt(d, h)
    expect(at(8.5).no2).toBeGreaterThan(at(13).no2)
    expect(at(18).no2).toBeGreaterThan(at(3).no2)
    expect(at(8.5).pm25).toBeGreaterThan(at(3).pm25)
  })

  it('O₃ 午后最高，夜间最低', () => {
    const d = district('mushrif')
    expect(concentrationsAt(d, 15).o3).toBeGreaterThan(concentrationsAt(d, 9).o3)
    expect(concentrationsAt(d, 15).o3).toBeGreaterThan(concentrationsAt(d, 2).o3 * 3)
  })

  it('港区站白天最差（中度及以上），公园站全天优良', () => {
    expect(stationReadingsAt(data, 11, 'aqi')[0].station.id).toBe('mina-zayed')
    expect(readingOf(concentrationsAt(station('mina-zayed'), 11), 'aqi').level).toBe(3)
    for (let h = 0; h <= 24; h++) expect(readingOf(concentrationsAt(station('umm-al-emarat-park'), h), 'aqi').level).toBeLessThanOrEqual(1)
  })

  it('暖色（轻度及以上）片区不超过两成', () => {
    for (let h = 0; h <= 24; h += 0.5) {
      const warm = districtReadingsAt(data, h, 'aqi').filter(r => r.reading.level >= 2).length
      expect(warm / data.districts.length).toBeLessThanOrEqual(0.2)
    }
  })

  it('同一位置同一时刻结果固定，数值都为非负', () => {
    const a = concentrationsAt(district('danah'), 9.5)
    expect(concentrationsAt(district('danah'), 9.5)).toEqual(a)
    Object.values(a).forEach(v => expect(v).toBeGreaterThanOrEqual(0))
  })

  it('seeded 落在 0–1 且对同一 id 固定', () => {
    expect(seeded('abc')).toBe(seeded('abc'))
    expect(seeded('abc')).toBeGreaterThanOrEqual(0)
    expect(seeded('abc')).toBeLessThan(1)
    expect(seeded('abc')).not.toBe(seeded('abd'))
  })
})

describe('全岛均值与序列', () => {
  it('全岛均值介于最好和最差的片区之间', () => {
    const city = cityConcentrationsAt(data, 11).pm10
    const all = data.districts.map(d => concentrationsAt(d, 11).pm10)
    expect(city).toBeGreaterThan(Math.min(...all))
    expect(city).toBeLessThan(Math.max(...all))
  })

  it('序列每小时一个点，共 25 个，与单点读数一致', () => {
    const s = citySeries(data, 'pm10')
    expect(s).toHaveLength(25)
    expect(s[0][0]).toBe(0)
    expect(s[24][0]).toBe(24)
    expect(s[11][1]).toBe(cityConcentrationsAt(data, 11).pm10)
    expect(stationSeries(station('wtc'), 'aqi')[8][1]).toBe(readingOf(concentrationsAt(station('wtc'), 8), 'aqi').value)
  })

  it('最差时刻：O₃ 在午后，AQI 在白天', () => {
    expect(worstHour(data, 'o3')).toBe(15)
    expect(worstHour(data, 'aqi')).toBeGreaterThanOrEqual(7)
    expect(worstHour(data, 'aqi')).toBeLessThanOrEqual(19)
  })
})

describe('噪声与水质', () => {
  it('高峰最吵，深夜最安静', () => {
    const p = data.noisePoints[0]
    expect(noiseDbAt(p, 8.5)).toBeGreaterThan(noiseDbAt(p, 13))
    expect(noiseDbAt(p, 13)).toBeGreaterThan(noiseDbAt(p, 3))
    expect(noiseDbAt(p, 8.5) - noiseDbAt(p, 3)).toBeGreaterThan(10)
  })

  it('两条干道相交的路口平均比干道与支路相交的路口更吵', () => {
    const level = (id: string) => geo.intersections.find(i => i.id === id)!.level
    const major = data.noisePoints.filter(p => level(p.id) === 2)
    const minor = data.noisePoints.filter(p => level(p.id) === 3)
    const avg = (ps: typeof major) => ps.reduce((n, p) => n + p.base, 0) / ps.length
    expect(major.length).toBeGreaterThan(0)
    expect(minor.length).toBeGreaterThan(0)
    expect(avg(major)).toBeGreaterThan(avg(minor))
  })

  it('声级落在合理范围 40–80 dB', () => {
    for (const p of data.noisePoints) {
      for (let h = 0; h < 24; h++) {
        expect(noiseDbAt(p, h)).toBeGreaterThan(40)
        expect(noiseDbAt(p, h)).toBeLessThan(80)
      }
    }
  })

  it('夜间判定：22 点到次日 6 点', () => {
    expect([21.5, 22, 0, 5.5, 6, 12].map(isNight)).toEqual([false, true, true, true, false, false])
  })

  it('概况：昼间高于夜间，达标率在 0–100 之间', () => {
    const s = noiseSummary(data.noisePoints)
    expect(s.day).toBeGreaterThan(s.night)
    expect(s.compliance).toBeGreaterThan(50)
    expect(s.compliance).toBeLessThanOrEqual(100)
    expect(noiseSummary([])).toEqual({ day: 0, night: 0, compliance: 0 })
  })

  it('水质分布四类齐全，数量之和等于采样点数', () => {
    const dist = waterDistribution(data.waterSamples)
    expect(dist.map(d => d.name)).toEqual(['一类', '二类', '三类', '四类'])
    expect(dist.reduce((n, d) => n + d.count, 0)).toBe(data.waterSamples.length)
  })
})

describe('逐小时柱状图与污染物网格', () => {
  it('cityHourly：0–23 时 24 根柱，读数与全岛均值一致，等级按分指数', () => {
    const bars = cityHourly(data, 'aqi')
    expect(bars.map(b => b.hour)).toEqual(Array.from({ length: 24 }, (_, h) => h))
    for (const b of bars) {
      const r = readingOf(cityConcentrationsAt(data, b.hour), 'aqi')
      expect(b.value).toBe(r.value)
      expect(b.level).toBe(r.level)
    }
    // 白天比深夜差
    expect(bars[9].value).toBeGreaterThan(bars[3].value)
    expect(cityHourly(data, 'pm10')[11].value).toBe(cityConcentrationsAt(data, 11).pm10)
  })

  it('isOverLimit 按国标二级限值判断，六项都有限值', () => {
    expect(POLLUTANTS.map(p => p.key)).toEqual(['pm25', 'pm10', 'o3', 'no2', 'so2', 'co'])
    expect(isOverLimit('pm10', 150)).toBe(false)
    expect(isOverLimit('pm10', 151)).toBe(true)
    expect(isOverLimit('co', 10.5)).toBe(true)
  })

  it('formatHour 补零到 HH:mm', () => {
    expect([0, 8.5, 13, 23.5].map(formatHour)).toEqual(['00:00', '08:30', '13:00', '23:30'])
  })
})

describe('近岸水质', () => {
  it('达标率 = 一、二类占比，超标 = 三、四类', () => {
    const s = waterSummary(data.waterSamples)
    expect(s.grade1 + s.grade2 + s.over).toBe(data.waterSamples.length)
    expect(s.rate).toBeCloseTo(((s.grade1 + s.grade2) / data.waterSamples.length) * 100, 1)
    expect(s.over).toBe(2)
    expect(waterSummary([])).toEqual({ rate: 0, grade1: 0, grade2: 0, over: 0 })
  })

  it('各指标落在类别对应的标准区间，采样时间在上午', () => {
    for (const w of data.waterSamples) {
      const i = w.indicators
      if (w.grade <= 2) {
        expect(i.do, w.id).toBeGreaterThan(WATER_LIMIT.do)
        expect(i.din, w.id).toBeLessThanOrEqual(WATER_LIMIT.din)
        expect(i.po4, w.id).toBeLessThanOrEqual(WATER_LIMIT.po4)
        expect(waterExceedance(w)).toBeNull()
      } else {
        expect(waterExceedance(w), w.id).not.toBeNull()
      }
      expect(w.sampledAt >= '08:00' && w.sampledAt <= '11:50', w.sampledAt).toBe(true)
    }
    const worst = data.waterSamples.find(w => w.grade === 4)!
    expect(waterExceedance(worst)).toMatchObject({ name: '无机氮', limit: 0.3, unit: 'mg/L' })
  })
})

describe('功能区噪声', () => {
  it('四个功能区各有昼、夜两行，限值按 GB 3096', () => {
    const rows = noiseZoneRows(data)
    expect(rows).toHaveLength(8)
    expect([...new Set(rows.map(r => r.name))]).toEqual(['居住区', '商业区', '港区仓储', '交通干线'])
    expect(rows.map(r => r.limit)).toEqual([55, 45, 60, 50, 65, 55, 70, 55])
    rows.forEach(r => expect(r.over).toBe(r.db > r.limit))
  })

  it('昼间高于夜间，越靠近交通和港区越吵；超标的只是少数（暖色不超过两成）', () => {
    const rows = noiseZoneRows(data)
    const day = rows.filter(r => r.period === '昼').map(r => r.db)
    for (let i = 0; i < rows.length; i += 2) expect(rows[i].db).toBeGreaterThan(rows[i + 1].db)
    expect([...day].sort((a, b) => a - b)).toEqual(day)
    expect(rows.filter(r => r.over).length / rows.length).toBeLessThanOrEqual(0.2)
    // 交通干线两行与路口噪声点的统计一致
    const s = noiseSummary(data.noisePoints)
    expect(rows[6].db).toBeCloseTo(s.day, 0)
    expect(rows[7].db).toBeCloseTo(s.night, 0)
  })
})

describe('超标告警', () => {
  it('上午港区站 PM10 超标为二级告警，指向监测站，带实测值和限值', () => {
    const alarms = alarmsAt(data, 11)
    const port = alarms.find(a => a.id === 'station:mina-zayed:pm10')!
    const c = concentrationsAt(station('mina-zayed'), 11)
    expect(port).toMatchObject({ kind: 'station', targetId: 'mina-zayed', level: 2, time: '11:00', status: '待处置' })
    expect(port.metric).toEqual({ name: 'PM10', value: c.pm10, limit: 150, unit: 'μg/m³' })
    // 每条监测站告警都确实超过限值
    alarms.filter(a => a.kind === 'station').forEach(a => expect(a.metric!.value).toBeGreaterThan(a.metric!.limit))
  })

  it('污染源与投诉全部并入，等级和状态沿用；超标水质点各一条', () => {
    const alarms = alarmsAt(data, 3)
    for (const s of data.sources) expect(alarms.find(a => a.id === 'source:' + s.id)).toMatchObject({ kind: 'source', targetId: s.id, level: s.level, status: s.status, time: s.time })
    const water = alarms.filter(a => a.kind === 'water')
    expect(water.map(a => a.targetId).sort()).toEqual(data.waterSamples.filter(w => w.grade >= 3).map(w => w.id).sort())
  })

  it('按等级从高到低排序，id 不重复，结果固定', () => {
    for (const h of [3, 8.5, 11, 18]) {
      const alarms = alarmsAt(data, h)
      for (let i = 1; i < alarms.length; i++) expect(alarms[i].level).toBeGreaterThanOrEqual(alarms[i - 1].level)
      expect(new Set(alarms.map(a => a.id)).size).toBe(alarms.length)
      expect(alarmsAt(data, h)).toEqual(alarms)
    }
    // 深夜港区作业少，监测站告警比上午少
    expect(alarmsAt(data, 3).filter(a => a.kind === 'station').length).toBeLessThan(alarmsAt(data, 11).filter(a => a.kind === 'station').length)
  })
})
