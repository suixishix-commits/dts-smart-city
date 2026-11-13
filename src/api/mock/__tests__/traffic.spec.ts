import { describe, expect, it } from 'vitest'
import type { GeoData } from '@/types/geo'
import geoJson from '../../../../public/data/smart-city/geo.json'
import {
  buildIncidents,
  buildOdFlows,
  buildParkings,
  buildSegments,
  buildSignals,
  buildTrafficData,
  commuteAt,
  congestionAt,
  congestionLevel,
  districtCongestionAt,
  networkPeak,
  networkSeries,
  networkStatsAt,
  parkingOccupancyAt,
  rankSegmentsAt,
  segmentSpeedAt,
  transitStatsAt
} from '../traffic'

const geo = geoJson as unknown as GeoData
const data = buildTrafficData(geo)
const DOWNTOWN = ['danah', 'markaziyah', 'zahiyah', 'wahda']
const levelAt = (s: (typeof data.segments)[number], h: number) => congestionLevel(congestionAt(s, h))

describe('buildSegments', () => {
  const segments = buildSegments(geo)

  it('每条道路都被切成了路段，id 和名称不重复', () => {
    for (const road of geo.roads) expect(segments.some(s => s.roadId === road.id)).toBe(true)
    expect(new Set(segments.map(s => s.id)).size).toBe(segments.length)
    expect(new Set(segments.map(s => s.name)).size).toBe(segments.length)
  })

  it('同一条道路的路段首尾相接、不重叠', () => {
    for (const road of geo.roads) {
      const list = segments.filter(s => s.roadId === road.id)
      list.forEach((s, i) => {
        expect(s.from).toBeGreaterThanOrEqual(0)
        expect(s.to).toBeLessThanOrEqual(1)
        expect(s.to).toBeGreaterThan(s.from)
        if (i > 0) expect(s.from).toBeCloseTo(list[i - 1].to, 10)
      })
    }
  })

  it('有路口的道路在路口处断开：三个路口的横街切成 4 段，十二个路口的纵向主干路切成 13 段', () => {
    expect(segments.filter(s => s.roadId === 'hamdan')).toHaveLength(4)
    expect(segments.filter(s => s.roadId === 'khaleej')).toHaveLength(13)
    expect(segments.find(s => s.id === 'khaleej-2')?.name).toBe('阿拉伯湾街（哈姆丹街—扎耶德一世街）')
  })

  it('没有路口的道路按长度等分，用所在片区命名', () => {
    const corniche = segments.filter(s => s.roadId === 'corniche')
    expect(corniche.length).toBeGreaterThanOrEqual(2)
    corniche.forEach(s => expect(s.to - s.from).toBeCloseTo(1 / corniche.length, 10))
    expect(corniche[0].name).toMatch(/^滨海大道（.+段）$/)
  })

  it('路段长度之和不超过道路长度，且只少掉很短的端头', () => {
    for (const road of geo.roads) {
      const sum = segments.filter(s => s.roadId === road.id).reduce((n, s) => n + s.lengthKm, 0)
      expect(sum).toBeLessThanOrEqual(road.lengthKm + 0.05)
      expect(sum).toBeGreaterThan(road.lengthKm - 0.6)
    }
  })

  it('片区取自 geo.json；纵向主干路东南端的最后一段是桥头，用桥命名', () => {
    const ids = geo.districts.map(d => d.id)
    segments.forEach(s => expect(ids).toContain(s.districtId))
    const bridges = segments.filter(s => s.bridge)
    expect(bridges.map(s => s.roadId).sort()).toEqual(['airport', 'khaleej', 'muroor', 'salam'])
    expect(bridges.find(s => s.roadId === 'muroor')?.name).toContain('马克塔桥')
  })

  it('结果是确定的：两次生成完全相同', () => {
    expect(buildTrafficData(geo)).toEqual(data)
  })
})

describe('congestionAt', () => {
  it('分级阈值：1.5 缓行、2.0 拥堵、2.6 严重拥堵', () => {
    expect([1, 1.49, 1.5, 1.99, 2, 2.59, 2.6, 3.4].map(congestionLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
  })

  it('夜间全部畅通', () => {
    for (const h of [0, 2, 4, 23.5, 24]) data.segments.forEach(s => expect(levelAt(s, h)).toBe(0))
  })

  it('市中心路段在 08:00 和 18:00 达到拥堵，比午间和相邻时刻都堵', () => {
    const downtown = data.segments.filter(s => s.downtown)
    expect(downtown.length).toBeGreaterThan(8)
    for (const s of downtown) {
      expect(DOWNTOWN).toContain(s.districtId)
      for (const peak of [8, 18]) {
        expect(levelAt(s, peak)).toBeGreaterThanOrEqual(2)
        expect(congestionAt(s, peak)).toBeGreaterThan(congestionAt(s, 13))
        expect(congestionAt(s, peak)).toBeGreaterThan(congestionAt(s, peak - 1.5))
        expect(congestionAt(s, peak)).toBeGreaterThan(congestionAt(s, peak + 1.5))
      }
    }
  })

  it('纵向主干路高峰至少缓行，且比同片区外围的横街堵', () => {
    const arterials = data.segments.filter(s => s.arterial && !s.downtown && !s.bridge)
    const side = data.segments.filter(s => !s.arterial && !s.downtown)
    for (const peak of [8, 18]) {
      arterials.forEach(s => expect(levelAt(s, peak)).toBeGreaterThanOrEqual(1))
      const mean = (list: typeof side) => list.reduce((n, s) => n + congestionAt(s, peak), 0) / list.length
      expect(mean(arterials)).toBeGreaterThan(mean(side))
    }
  })

  it('桥头路段早晚高峰都拥堵', () => {
    for (const s of data.segments.filter(x => x.bridge)) {
      expect(levelAt(s, 8)).toBeGreaterThanOrEqual(2)
      expect(levelAt(s, 18)).toBeGreaterThanOrEqual(2)
    }
  })

  it('通勤方向：上午进城，下午出城', () => {
    expect([6, 8, 12.5].map(commuteAt)).toEqual(['in', 'in', 'in'])
    expect([13, 18, 23].map(commuteAt)).toEqual(['out', 'out', 'out'])
  })

  it('越堵车速越低', () => {
    const s = data.segments.find(x => x.downtown) as (typeof data.segments)[number]
    expect(segmentSpeedAt(s, 18)).toBeLessThan(segmentSpeedAt(s, 3))
    expect(segmentSpeedAt(s, 3)).toBeLessThanOrEqual(72)
  })
})

describe('路网指标', () => {
  it('高峰时拥堵指数高、车速低、在途车辆多、公交准点率低', () => {
    const night = networkStatsAt(data.segments, 3)
    const peak = networkStatsAt(data.segments, 18)
    expect(night.level).toBe(0)
    expect(peak.index).toBeGreaterThan(1.8)
    expect(peak.speed).toBeLessThan(night.speed)
    expect(peak.vehicles).toBeGreaterThan(night.vehicles * 5)
    expect(peak.busOnTime).toBeLessThan(night.busOnTime)
    expect(peak.busOnTime).toBeGreaterThan(60)
  })

  it('全天曲线每半小时一个点，有早晚两个峰，峰值在晚高峰', () => {
    const series = networkSeries(data.segments)
    expect(series).toHaveLength(49)
    expect(series[0][0]).toBe(0)
    expect(series[48][0]).toBe(24)
    const at = (h: number) => series[h * 2][1]
    expect(at(8)).toBeGreaterThan(at(6))
    expect(at(8)).toBeGreaterThan(at(11))
    expect(at(18)).toBeGreaterThan(at(15))
    expect(at(18)).toBeGreaterThan(at(21))
    expect(networkPeak(data.segments)).toEqual({ hour: 18, value: at(18) })
  })

  it('排行按拥堵指数从高到低，晚高峰最堵的在市中心或桥头', () => {
    const top = rankSegmentsAt(data.segments, 18, 6)
    expect(top).toHaveLength(6)
    top.forEach((r, i) => {
      if (i > 0) expect(r.index).toBeLessThanOrEqual(top[i - 1].index)
      expect(r.segment.downtown || r.segment.bridge).toBe(true)
      expect(r.level).toBe(congestionLevel(r.index))
    })
  })

  it('片区平均拥堵：每个片区都有值，晚高峰市中心高于外围', () => {
    const index = districtCongestionAt(data.segments, 18)
    expect(Object.keys(index).sort()).toEqual(geo.districts.map(d => d.id).sort())
    for (const id of DOWNTOWN) {
      expect(index[id]).toBeGreaterThan(index.mushrif)
      expect(index[id]).toBeGreaterThan(index.rasakhdar)
    }
  })
})

describe('事件、信号、OD、停车', () => {
  it('交通事件 5–7 起，都在真实路口上', () => {
    const incidents = buildIncidents(geo)
    expect(incidents.length).toBeGreaterThanOrEqual(5)
    expect(incidents.length).toBeLessThanOrEqual(7)
    expect(new Set(incidents.map(i => i.id)).size).toBe(incidents.length)
    const roadNames = geo.roads.map(r => r.name)
    for (const i of incidents) {
      const x = geo.intersections.find(n => n.id === i.intersectionId)
      expect(x).toBeTruthy()
      expect(i.position).toEqual(x?.position)
      expect(i.intersectionName).toBe(x?.name)
      i.roadNames.forEach(n => expect(roadNames).toContain(n))
      expect(i.time).toMatch(/^\d\d:\d\d$/)
      expect(i.lanes).toBeGreaterThan(0)
      expect(i.queue).toBeGreaterThan(0)
      expect(i.cameraId).toMatch(/^TC-\d{3}$/)
    }
    expect(new Set(incidents.map(i => i.type))).toEqual(new Set(['accident', 'construction', 'breakdown', 'control']))
  })

  it('路口在地理数据里不存在时跳过对应事件', () => {
    expect(buildIncidents({ ...geo, intersections: geo.intersections.filter(i => i.id !== 'zayed1-airport') })).toHaveLength(data.incidents.length - 1)
  })

  it('信号路口与路口一一对应，少数离线或手动控制', () => {
    const signals = buildSignals(geo, data.incidents)
    expect(signals.map(s => s.id)).toEqual(geo.intersections.map(i => i.id))
    const count = (st: string) => signals.filter(s => s.status === st).length
    expect(count('offline')).toBe(2)
    expect(count('manual')).toBe(2)
    expect(count('normal')).toBe(geo.intersections.length - 4)
    // 管制事件所在的路口由交警手动控制
    const control = data.incidents.find(i => i.type === 'control')
    expect(signals.find(s => s.id === control?.intersectionId)?.status).toBe('manual')
    signals.forEach(s => expect(s.note === '').toBe(s.status === 'normal'))
  })

  it('通勤 OD 取 8 条：从居住片区到就业片区，按通勤量从大到小', () => {
    const flows = buildOdFlows(geo)
    expect(flows).toHaveLength(8)
    const work = [...DOWNTOWN, 'manhal']
    flows.forEach((f, i) => {
      expect(work).toContain(f.workId)
      expect(work).not.toContain(f.homeId)
      expect(geo.districts.some(d => d.id === f.homeId)).toBe(true)
      if (i > 0) expect(f.volume).toBeLessThanOrEqual(flows[i - 1].volume)
    })
    expect(flows[0].volume).toBe(2.4)
    expect(new Set(flows.map(f => f.id)).size).toBe(8)
  })

  it('停车场是真实地标；商务楼白天满，商场傍晚满', () => {
    const lots = buildParkings(geo)
    expect(lots.map(l => l.name)).toEqual(['瓦赫达购物中心', '阿布扎比购物中心', '世贸中心', '哈利迪亚购物中心'])
    for (const l of lots) {
      for (let h = 0; h <= 24; h += 0.5) {
        expect(parkingOccupancyAt(l, h)).toBeGreaterThan(0)
        expect(parkingOccupancyAt(l, h)).toBeLessThan(1)
      }
    }
    const wtc = lots.find(l => l.id === 'wtc') as (typeof lots)[number]
    const mall = lots.find(l => l.id === 'wahda-mall') as (typeof lots)[number]
    expect(parkingOccupancyAt(wtc, 13)).toBeGreaterThan(parkingOccupancyAt(wtc, 21))
    expect(parkingOccupancyAt(mall, 20.5)).toBeGreaterThan(parkingOccupancyAt(mall, 10))
  })

  it('公交累计客运量随时间只增不减，全天约 21.6 万人次', () => {
    let last = -1
    for (let h = 0; h <= 24; h += 0.5) {
      const t = transitStatsAt(data.segments, h)
      expect(t.passengers).toBeGreaterThanOrEqual(last)
      expect(t.buses).toBeGreaterThan(0)
      last = t.passengers
    }
    expect(transitStatsAt(data.segments, 0).passengers).toBe(0)
    expect(last).toBeCloseTo(21.6, 5)
    expect(transitStatsAt(data.segments, 18).onTime).toBeCloseTo(networkStatsAt(data.segments, 18).busOnTime)
  })
})
