import { describe, expect, it } from 'vitest'
import type { GeoData } from '@/types/geo'
import geoJson from '../../../../public/data/smart-city/geo.json'
import {
  buildIncidents,
  buildOdFlows,
  buildParkings,
  buildSegments,
  buildDetour,
  buildHourlyFlow,
  buildSignals,
  buildTrafficData,
  buildVehicles,
  signalControlCount,
  signalControlOf,
  transitModesAt,
  vehicleStateAt,
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

  it('有路口的道路在路口处断开：相邻两个路口之间是一段，两端再各留一段端头（端头太短时省略）', () => {
    for (const id of ['hamdan', 'khaleej']) {
      const junctions = geo.intersections.filter(i => i.roads.includes(id)).length
      const n = segments.filter(s => s.roadId === id).length
      expect(n).toBeGreaterThanOrEqual(junctions - 1)
      expect(n).toBeLessThanOrEqual(junctions + 1)
    }
    // 两个路口之间的路段用两头的横街命名
    const between = segments.find(s => s.roadId === 'khaleej' && s.junctions.length === 2)!
    const names = between.junctions.map(id => geo.roads.find(r => r.id === geo.intersections.find(i => i.id === id)!.roads[0])!.name)
    expect(between.name).toBe(`阿拉伯湾街（${names[0]}—${names[1]}）`)
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
    // 纵向主干路的最后一段都算桥头（进出岛的咽喉）；离桥 2.5 公里以内的用桥命名
    const bridges = segments.filter(s => s.bridge)
    expect(bridges.map(s => s.roadId).sort()).toEqual(geo.roads.filter(r => r.level === 1 && r.direction === 'long').map(r => r.id).sort())
    const bridgeNames = geo.landmarks.filter(l => l.type === 'bridge').map(l => l.name)
    expect(bridges.some(s => bridgeNames.some(n => s.name.includes(n)))).toBe(true)
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
    const index = districtCongestionAt(data.segments, 18, geo.districts.map(d => d.id))
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

describe('路段端点路口', () => {
  it('路段两端的路口都在这条道路上；有路口的道路每段至少一端是路口', () => {
    for (const s of data.segments) {
      s.junctions.forEach(id => expect(geo.intersections.find(i => i.id === id)?.roads).toContain(s.roadId))
      if (geo.intersections.some(i => i.roads.includes(s.roadId))) expect(s.junctions.length).toBeGreaterThan(0)
      else expect(s.junctions).toEqual([])
    }
    // 哈姆丹街从阿拉伯湾街起：第一段就是阿拉伯湾街到谢赫拉希德街
    expect(data.segments.find(s => s.roadId === 'hamdan' && s.junctions.includes('hamdan-khaleej'))?.junctions).toEqual(['hamdan-khaleej', 'hamdan-airport'])
  })
})

describe('周边摄像头与绕行方案', () => {
  it('每个事件有 3 个由近到远的周边摄像头，第一个是事件路口自己的', () => {
    for (const i of data.incidents) {
      expect(i.cameras).toHaveLength(3)
      expect(i.cameras[0]).toMatchObject({ id: i.cameraId, intersectionId: i.intersectionId, distance: i.cameraDistance })
      i.cameras.forEach((c, k) => {
        expect(c.id).toMatch(/^TC-\d{3}$/)
        expect(geo.intersections.some(x => x.id === c.intersectionId)).toBe(true)
        if (k > 0) expect(c.distance).toBeGreaterThanOrEqual(i.cameras[k - 1].distance)
      })
      expect(new Set(i.cameras.map(c => c.id)).size).toBe(3)
    }
  })

  it('摄像头编号与信号路口一致，信号机离线的路口摄像头也离线', () => {
    const signal = new Map(data.signals.map(s => [s.id, s]))
    for (const c of data.incidents.flatMap(i => i.cameras)) {
      expect(signal.get(c.intersectionId)?.cameraId).toBe(c.id)
      expect(c.online).toBe(signal.get(c.intersectionId)?.status !== 'offline')
    }
  })

  it('绕行沿真实道路：三段首尾相接，起止在被堵路口前后相邻的两个路口上，避开事件路口', () => {
    const withDetour = data.incidents.filter(i => i.detour)
    expect(withDetour.length).toBeGreaterThanOrEqual(data.incidents.length - 1)
    const meet = (a: string, b: string) => geo.intersections.find(i => i.roads.includes(a) && i.roads.includes(b))
    for (const i of withDetour) {
      const d = i.detour as NonNullable<typeof i.detour>
      expect(d.legs).toHaveLength(3)
      for (const l of d.legs) {
        expect(geo.roads.some(r => r.id === l.roadId && r.name === l.roadName)).toBe(true)
        for (const t of [l.from, l.to]) {
          expect(t).toBeGreaterThanOrEqual(0)
          expect(t).toBeLessThanOrEqual(1)
        }
      }
      // 相邻两段在两条道路的交点处衔接
      for (let k = 1; k < 3; k++) expect(meet(d.legs[k - 1].roadId, d.legs[k].roadId)).toBeTruthy()
      // 被堵的是事件路口所在的道路，绕行不再走它
      const x = geo.intersections.find(n => n.id === i.intersectionId) as (typeof geo.intersections)[number]
      expect(x.roads).toContain(d.blockedRoadId)
      d.legs.forEach(l => expect(l.roadId).not.toBe(d.blockedRoadId))
      const start = meet(d.legs[0].roadId, d.blockedRoadId)
      const end = meet(d.legs[2].roadId, d.blockedRoadId)
      expect(start?.name).toBe(d.fromName)
      expect(end?.name).toBe(d.toName)
      expect(start?.id).not.toBe(x.id)
      expect(end?.id).not.toBe(x.id)
      expect(d.via).toBe(d.legs.map(l => l.roadName).join(' → '))
      expect(d.lengthKm).toBeGreaterThan(d.directKm)
      expect(d.minutes).toBeGreaterThan(0)
      expect(d.directMinutes).toBeGreaterThan(0)
    }
  })

  it('纵向主干路中段的路口优先绕开主干路；路口不存在时返回 null', () => {
    const d = buildDetour(geo, 'zayed1-airport', 640)
    expect(d?.blockedRoadId).toBe('airport')
    expect(d?.fromName).toBe(geo.intersections.find(i => i.id === 'hamdan-airport')?.name)
    expect(d?.toName).toBe(geo.intersections.find(i => i.id === 'falah-airport')?.name)
    expect(['khaleej', 'muroor']).toContain(d?.legs[1].roadId)
    // 排队越长，原路越慢
    const slow = buildDetour(geo, 'zayed1-airport', 900)
    const free = buildDetour(geo, 'zayed1-airport', 0)
    expect(slow?.directMinutes).toBeGreaterThan(free?.directMinutes as number)
    expect(buildDetour(geo, '不存在')).toBeNull()
  })
})

describe('信号控制方式', () => {
  it('自适应 / 定时 / 离线 合计等于路口数，自适应占多数，离线与 offline 状态一致', () => {
    const n = signalControlCount(data.signals)
    expect(n.自适应 + n.定时 + n.离线).toBe(data.signals.length)
    expect(n.离线).toBe(data.signals.filter(s => s.status === 'offline').length)
    expect(n.自适应).toBeGreaterThan(n.定时)
    expect(n.定时).toBeGreaterThan(0)
    expect(signalControlOf({ status: 'manual', mode: '定时' })).toBe('定时')
    expect(signalControlOf({ status: 'offline', mode: '自适应' })).toBe('离线')
    // 主次干路交叉口都是自适应
    for (const s of data.signals) if ((geo.intersections.find(i => i.id === s.id)?.level as number) <= 2) expect(s.mode).toBe('自适应')
  })
})

describe('分时车流量与公共交通客流', () => {
  it('今日、昨日各 25 个小时值，早晚两个峰，夜间低；结果确定', () => {
    const f = buildHourlyFlow()
    expect(f).toEqual(buildHourlyFlow())
    for (const series of [f.today, f.yesterday]) {
      expect(series).toHaveLength(25)
      series.forEach(v => expect(v).toBeGreaterThan(0))
      expect(series[8]).toBeGreaterThan(series[3] * 4)
      expect(series[18]).toBeGreaterThan(series[13])
      expect(series[8]).toBeGreaterThan(series[12])
    }
    // 今昨两天形状相同但不完全一样
    expect(f.today).not.toEqual(f.yesterday)
    f.today.forEach((v, h) => expect(Math.abs(v - f.yesterday[h]) / v).toBeLessThan(0.2))
  })

  it('四种方式的累计客流随时间只增不减，公交与公交累计客运量一致', () => {
    const modes = transitModesAt(data.segments, 24)
    expect(modes.map(m => m.name)).toEqual(['公交', '出租网约', '水上巴士', '共享单车'])
    expect(modes[0].value).toBeCloseTo(21.6, 1)
    expect(transitModesAt(data.segments, 0).every(m => m.value === 0)).toBe(true)
    expect(transitModesAt(data.segments, 14)[0].value).toBeCloseTo(transitStatsAt(data.segments, 14).passengers, 1)
    let last = transitModesAt(data.segments, 0)
    for (let h = 1; h <= 24; h++) {
      const now = transitModesAt(data.segments, h)
      now.forEach((m, k) => expect(m.value).toBeGreaterThanOrEqual(last[k].value))
      last = now
    }
  })
})

describe('重点车辆', () => {
  const vehicles = buildVehicles(geo)

  it('包含公交 034、急救 A12、清障 T05，都在真实道路上，沿途路口按比例排序', () => {
    const names = vehicles.map(v => v.name)
    for (const n of ['公交 034', '急救 A12', '清障 T05']) expect(names).toContain(n)
    expect(new Set(vehicles.map(v => v.id)).size).toBe(vehicles.length)
    for (const v of vehicles) {
      const road = geo.roads.find(r => r.id === v.roadId)
      expect(road?.name).toBe(v.roadName)
      expect(v.route).not.toMatch(/[{}]/)
      expect(v.stops.length).toBeGreaterThan(0)
      v.stops.forEach((s, k) => {
        expect(geo.intersections.find(i => i.id === s.intersectionId)?.roads).toContain(v.roadId)
        if (k > 0) expect(s.ratio).toBeGreaterThanOrEqual(v.stops[k - 1].ratio)
      })
    }
    expect(vehicles.find(v => v.kind === 'ambulance')?.route).toContain('谢赫哈利法医疗城')
  })

  it('位置随小时推进：比例在 0–1，轨迹在车辆身后，相同小时结果相同', () => {
    for (const v of vehicles) {
      const positions = new Set<number>()
      for (let h = 0; h <= 24; h += 0.5) {
        const st = vehicleStateAt(v, data.segments, h)
        expect(st).toEqual(vehicleStateAt(v, data.segments, h))
        expect(st.ratio).toBeGreaterThanOrEqual(0)
        expect(st.ratio).toBeLessThanOrEqual(1)
        expect(st.trail[1]).toBe(st.ratio)
        if (st.forward) expect(st.trail[0]).toBeLessThanOrEqual(st.ratio)
        else expect(st.trail[0]).toBeGreaterThanOrEqual(st.ratio)
        expect(Math.abs(st.trail[1] - st.trail[0])).toBeLessThan(0.2)
        expect(st.speed).toBeGreaterThan(0)
        expect(st.speed).toBeLessThanOrEqual(v.freeSpeed)
        expect(v.stops).toContain(st.nearest)
        if (st.segmentId) expect(data.segments.find(s => s.id === st.segmentId)?.roadId).toBe(v.roadId)
        positions.add(Math.round(st.ratio * 1000))
      }
      expect(positions.size).toBeGreaterThan(10)
    }
  })

  it('车速随所在路段拥堵变化，急救车受拥堵影响较小', () => {
    const at = (v: (typeof vehicles)[number], h: number) => {
      const st = vehicleStateAt(v, data.segments, h)
      const seg = data.segments.find(s => s.id === st.segmentId)
      return { st, c: seg ? congestionAt(seg, h) : 1 }
    }
    const bus = vehicles.find(v => v.id === 'bus-008') as (typeof vehicles)[number]
    for (let h = 0; h <= 24; h += 1) {
      const { st, c } = at(bus, h)
      expect(st.speed).toBe(Math.round(bus.freeSpeed / c))
    }
    const amb = vehicles.find(v => v.kind === 'ambulance') as (typeof vehicles)[number]
    const { st, c } = at(amb, 18)
    expect(st.speed).toBe(Math.round(amb.freeSpeed / Math.sqrt(c)))
  })
})
