import type { GeoData } from '@/types/geo'
import type {
  AirIndex,
  AirLevel,
  AirReading,
  Concentrations,
  EmissionProfile,
  EnvDistrict,
  EnvironmentData,
  EnvStation,
  GreenSpace,
  NoisePoint,
  PlaceRef,
  PollutantKey,
  PollutionSource,
  WaterGrade,
  WaterSample
} from '@/types/environment'

/** 六项污染物的名称、单位和小时浓度二级限值（GB 3095-2012；PM 取日均限值作参考） */
export const POLLUTANTS: { key: PollutantKey; name: string; unit: string; limit: number }[] = [
  { key: 'pm25', name: 'PM2.5', unit: 'μg/m³', limit: 75 },
  { key: 'pm10', name: 'PM10', unit: 'μg/m³', limit: 150 },
  { key: 'o3', name: 'O₃', unit: 'μg/m³', limit: 200 },
  { key: 'no2', name: 'NO₂', unit: 'μg/m³', limit: 200 },
  { key: 'so2', name: 'SO₂', unit: 'μg/m³', limit: 500 },
  { key: 'co', name: 'CO', unit: 'mg/m³', limit: 10 }
]

/** 界面上可切换的指标。limit 是趋势图里的限值线：AQI 取「良」的上限，其余取二级限值 */
export const AIR_INDEXES: { key: AirIndex; name: string; unit: string; limit: number; limitName: string }[] = [
  { key: 'aqi', name: 'AQI', unit: '', limit: 100, limitName: '良上限' },
  { key: 'pm25', name: 'PM2.5', unit: 'μg/m³', limit: 75, limitName: '二级限值' },
  { key: 'pm10', name: 'PM10', unit: 'μg/m³', limit: 150, limitName: '二级限值' },
  { key: 'o3', name: 'O₃', unit: 'μg/m³', limit: 200, limitName: '二级限值' }
]

/** 等级名称，下标即 AirLevel */
export const AIR_LEVEL_NAMES = ['优', '良', '轻度污染', '中度及以上'] as const
/** 等级简称（列表、标注里用） */
export const AIR_LEVEL_SHORT = ['优', '良', '轻度', '中度'] as const
/** 水质类别名称 */
export const WATER_GRADE_NAMES: Record<WaterGrade, string> = { 1: '一类', 2: '二类', 3: '三类', 4: '四类' }

/** 交通干线两侧（4a 类声环境功能区）的噪声限值，dB(A) */
export const NOISE_LIMIT = { day: 70, night: 55 } as const

/** 片区排放特征：港区扬尘重，中心城区干道密、车多，公园和滨海片区干净 */
const DISTRICT_PROFILE: Record<string, EmissionProfile> = {
  rasakhdar: { traffic: 0.2, dust: 0.05, green: 0.9 },
  khalidiyah: { traffic: 0.55, dust: 0.1, green: 0.6 },
  danah: { traffic: 0.9, dust: 0.2, green: 0.25 },
  markaziyah: { traffic: 1, dust: 0.25, green: 0.15 },
  zahiyah: { traffic: 0.75, dust: 1, green: 0.1 },
  bateen: { traffic: 0.4, dust: 0.1, green: 0.6 },
  manhal: { traffic: 0.7, dust: 0.2, green: 0.3 },
  wahda: { traffic: 0.8, dust: 0.3, green: 0.2 },
  nahyan: { traffic: 0.7, dust: 0.45, green: 0.2 },
  mushrif: { traffic: 0.35, dust: 0.08, green: 1 },
  muroor: { traffic: 0.65, dust: 0.2, green: 0.3 },
  rawdah: { traffic: 0.4, dust: 0.1, green: 0.6 },
  qurm: { traffic: 0.3, dust: 0.08, green: 0.95 },
  safarat: { traffic: 0.3, dust: 0.1, green: 0.7 },
  zafranah: { traffic: 0.35, dust: 0.1, green: 0.85 },
  maqta: { traffic: 0.5, dust: 0.25, green: 0.4 }
}
const DEFAULT_PROFILE: EmissionProfile = { traffic: 0.5, dust: 0.2, green: 0.4 }

/** 监测站：设在地标上，排放特征反映站点周边的小环境 */
const STATION_SPECS: { landmark: string; shortName: string; kind: string; profile: EmissionProfile }[] = [
  { landmark: 'mina-zayed', shortName: '扎耶德港', kind: '港区站', profile: { traffic: 0.7, dust: 1.6, green: 0 } },
  { landmark: 'abu-dhabi-mall', shortName: '阿布扎比购物中心', kind: '商业区站', profile: { traffic: 0.9, dust: 0.6, green: 0.1 } },
  { landmark: 'wtc', shortName: '世贸中心', kind: '交通站', profile: { traffic: 1.05, dust: 0.25, green: 0.1 } },
  { landmark: 'wahda-mall', shortName: '瓦赫达购物中心', kind: '交通站', profile: { traffic: 0.9, dust: 0.25, green: 0.15 } },
  { landmark: 'corniche-beach', shortName: '科尼什海滩', kind: '滨海站', profile: { traffic: 0.45, dust: 0.05, green: 0.8 } },
  { landmark: 'emirates-palace', shortName: '酋长皇宫', kind: '滨海站', profile: { traffic: 0.2, dust: 0.05, green: 0.9 } },
  { landmark: 'skmc', shortName: '医疗城', kind: '敏感点站', profile: { traffic: 0.5, dust: 0.1, green: 0.6 } },
  { landmark: 'umm-al-emarat-park', shortName: '乌姆阿联酋公园', kind: '公园站', profile: { traffic: 0.25, dust: 0.05, green: 1.1 } },
  { landmark: 'eastern-mangroves', shortName: '东部红树林', kind: '生态站', profile: { traffic: 0.2, dust: 0.05, green: 1.1 } },
  { landmark: 'grand-mosque', shortName: '大清真寺', kind: '敏感点站', profile: { traffic: 0.5, dust: 0.3, green: 0.4 } }
]

/** 污染源与投诉。name 里的 {place} 会换成所在地标、路口或道路的真实名称 */
const SOURCE_SPECS: (Pick<PollutionSource, 'id' | 'type' | 'level' | 'place' | 'note' | 'time' | 'shortName'> & { name: string; district?: string })[] = [
  { id: 'src-port-dust', type: '港区扬尘', level: 2, place: { road: 'salam', t: 0.04 }, district: 'zahiyah', name: '扎耶德港散货堆场扬尘', shortName: '港区扬尘', note: 'PM10 小时值超标 · 已通知港务喷淋', time: '10:15' },
  { id: 'src-site-wahda', type: '施工工地', level: 2, place: { intersection: 'hazza-muroor' }, name: '{place}工地扬尘', shortName: '工地扬尘', note: '裸土未覆盖 · 已派单', time: '09:48' },
  { id: 'src-fume-hamdan', type: '餐饮油烟', level: 3, place: { intersection: 'hamdan-airport' }, name: '{place}餐饮油烟', shortName: '餐饮油烟', note: '净化设施未运行 · 待复查', time: '12:30' },
  { id: 'src-noise-khalidiyah', type: '噪声投诉', level: 3, place: { intersection: 'hamdan-khaleej' }, name: '{place}夜间施工噪声', shortName: '噪声投诉', note: '居民投诉 6 起 · 已约谈施工方', time: '02:10' },
  { id: 'src-site-adnec', type: '施工工地', level: 3, place: { landmark: 'adnec' }, name: '{place}扩建工地扬尘', shortName: '工地扬尘', note: '在线监测偏高 · 已办结', time: '08:20' }
]

/** 生态空间：以公园、红树林、海滩地标为圆心。半径不超过 500 米，保证落在陆地上 */
const GREEN_SPECS: { landmark: string; radius: number }[] = [
  { landmark: 'umm-al-emarat-park', radius: 450 },
  { landmark: 'eastern-mangroves', radius: 480 },
  { landmark: 'corniche-beach', radius: 260 }
]

/** 近岸水质采样点：沿滨海大道（西北岸）和谢赫扎耶德街（东岸）。靠近港区的两个点较差，红树林和海滩最好 */
const WATER_SPECS: { road: string; t: number; grade: WaterGrade }[] = [
  { road: 'corniche', t: 0.3, grade: 1 },
  { road: 'corniche', t: 0.5, grade: 2 },
  { road: 'corniche', t: 0.7, grade: 2 },
  { road: 'corniche', t: 0.92, grade: 3 },
  { road: 'salam', t: 0.12, grade: 4 },
  { road: 'salam', t: 0.3, grade: 2 },
  { road: 'salam', t: 0.47, grade: 1 },
  { road: 'salam', t: 0.75, grade: 2 }
]

/** 以字符串为种子的确定性伪随机数 0–1：同一个 id 每次得到同样的值 */
export function seeded(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

function interpolate(points: [number, number][], hour: number): number {
  const h = Math.min(24, Math.max(0, hour))
  for (let i = 1; i < points.length; i++) {
    const [h0, v0] = points[i - 1]
    const [h1, v1] = points[i]
    if (h <= h1) return v0 + ((v1 - v0) * (h - h0)) / (h1 - h0)
  }
  return points[points.length - 1][1]
}

/** 车流强度：早晚两个高峰 */
const TRAFFIC_CURVE: [number, number][] = [[0, 0.18], [5, 0.15], [7, 0.7], [8.5, 1], [11, 0.6], [14, 0.55], [16.5, 0.8], [18, 1], [20, 0.6], [22, 0.35], [24, 0.18]]
/** 港口、工地作业强度：白天作业，夜间只有少量 */
const WORK_CURVE: [number, number][] = [[0, 0.2], [6, 0.25], [8, 0.9], [11, 1], [13, 0.8], [16, 1], [18, 0.7], [20, 0.35], [24, 0.2]]
/** 光化学反应强度：午后最强，决定 O₃ */
const SUN_CURVE: [number, number][] = [[0, 0.05], [7, 0.05], [10, 0.4], [13, 0.85], [15, 1], [17, 0.75], [19, 0.3], [21, 0.1], [24, 0.05]]
/** 噪声相对昼间平峰的增减，dB */
const NOISE_CURVE: [number, number][] = [[0, -13], [5, -12], [7, 0], [8.5, 5], [11, 1], [16.5, 3], [18, 5], [20, 0], [22, -7], [24, -13]]

/**
 * 某处某时刻的六项污染物浓度。
 * 车流抬高 NO₂、CO 和颗粒物（早晚高峰），扬尘主要抬高 PM10（作业时段），
 * O₃ 午后最高且车多的地方反而略低（被 NO 消耗），绿地和海风整体压低颗粒物。
 */
export function concentrationsAt(site: { id: string; profile: EmissionProfile }, hour: number): Concentrations {
  const { traffic, dust, green } = site.profile
  const t = traffic * interpolate(TRAFFIC_CURVE, hour)
  const w = dust * interpolate(WORK_CURVE, hour)
  const s = interpolate(SUN_CURVE, hour)
  // 每个位置固定的 ±3% 偏差，避免同类位置数值完全一样
  const k = 0.97 + 0.06 * seeded(site.id)
  return {
    pm25: Math.round(Math.max(5, 16 + 38 * t + 14 * w - 7 * green) * k),
    pm10: Math.round(Math.max(12, 42 + 50 * t + 135 * w - 16 * green) * k),
    o3: Math.round((30 + 135 * s * (1 - 0.25 * traffic) + 8 * green * s) * k),
    no2: Math.round(Math.max(4, 10 + 62 * t - 4 * green) * k),
    so2: Math.round((4 + 16 * w + 3 * t) * k),
    co: Math.round((0.3 + 0.9 * t) * k * 10) / 10
  }
}

/** 空气质量分指数的浓度分界点（HJ 633-2012），对应 IAQI 0/50/100/150/200/300/400/500 */
const IAQI_STEPS = [0, 50, 100, 150, 200, 300, 400, 500]
const BREAKPOINTS: Record<PollutantKey, number[]> = {
  pm25: [0, 35, 75, 115, 150, 250, 350, 500],
  pm10: [0, 50, 150, 250, 350, 420, 500, 600],
  o3: [0, 160, 200, 300, 400, 800, 1000, 1200],
  no2: [0, 100, 200, 700, 1200, 2340, 3090, 3840],
  so2: [0, 150, 500, 650, 800, 1600, 2100, 2620],
  co: [0, 5, 10, 35, 60, 90, 120, 150]
}

/** 单项污染物的空气质量分指数 IAQI */
export function iaqi(key: PollutantKey, value: number): number {
  const bp = BREAKPOINTS[key]
  for (let i = 1; i < bp.length; i++) {
    if (value <= bp[i]) return Math.round(IAQI_STEPS[i - 1] + ((IAQI_STEPS[i] - IAQI_STEPS[i - 1]) * (value - bp[i - 1])) / (bp[i] - bp[i - 1]))
  }
  return 500
}

/** AQI（各分指数的最大值）和首要污染物 */
export function aqiOf(c: Concentrations): { aqi: number; primary: PollutantKey } {
  let primary: PollutantKey = 'pm25'
  let aqi = -1
  for (const p of POLLUTANTS) {
    const v = iaqi(p.key, c[p.key])
    if (v > aqi) {
      aqi = v
      primary = p.key
    }
  }
  return { aqi, primary }
}

/** 指数 → 等级：0 优（≤50）、1 良（≤100）、2 轻度（≤150）、3 中度及以上 */
export function airLevel(index: number): AirLevel {
  return index <= 50 ? 0 : index <= 100 ? 1 : index <= 150 ? 2 : 3
}

/** 按所选指标读数：AQI 模式显示 AQI，单项模式显示浓度，等级都按分指数定 */
export function readingOf(c: Concentrations, index: AirIndex): AirReading {
  if (index === 'aqi') {
    const { aqi } = aqiOf(c)
    return { value: aqi, index: aqi, level: airLevel(aqi) }
  }
  const sub = iaqi(index, c[index])
  return { value: c[index], index: sub, level: airLevel(sub) }
}

/** 污染物名称 */
export function pollutantName(key: PollutantKey): string {
  return POLLUTANTS.find(p => p.key === key)?.name ?? key
}

/** 各片区某时刻的读数，按指数从高到低排 */
export function districtReadingsAt(data: EnvironmentData, hour: number, index: AirIndex): { id: string; name: string; reading: AirReading }[] {
  return data.districts.map(d => ({ id: d.id, name: d.name, reading: readingOf(concentrationsAt(d, hour), index) })).sort((a, b) => b.reading.index - a.reading.index)
}

/** 各监测站某时刻的读数，按指数从高到低排 */
export function stationReadingsAt(data: EnvironmentData, hour: number, index: AirIndex): { station: EnvStation; reading: AirReading }[] {
  return data.stations.map(station => ({ station, reading: readingOf(concentrationsAt(station, hour), index) })).sort((a, b) => b.reading.index - a.reading.index)
}

/** 全岛某时刻的平均浓度（按片区面积加权） */
export function cityConcentrationsAt(data: EnvironmentData, hour: number): Concentrations {
  const sum: Concentrations = { pm25: 0, pm10: 0, o3: 0, no2: 0, so2: 0, co: 0 }
  let area = 0
  for (const d of data.districts) {
    const c = concentrationsAt(d, hour)
    for (const p of POLLUTANTS) sum[p.key] += c[p.key] * d.areaKm2
    area += d.areaKm2
  }
  if (area === 0) return sum
  for (const p of POLLUTANTS) sum[p.key] = p.key === 'co' ? Math.round((sum.co / area) * 10) / 10 : Math.round(sum[p.key] / area)
  return sum
}

/** 全岛均值的 24 小时序列：[小时, 展示值]，每小时一个点（0–24） */
export function citySeries(data: EnvironmentData, index: AirIndex): [number, number][] {
  return Array.from({ length: 25 }, (_, h) => [h, readingOf(cityConcentrationsAt(data, h), index).value])
}

/** 某个站点的 24 小时序列：[小时, 展示值] */
export function stationSeries(station: EnvStation, index: AirIndex): [number, number][] {
  return Array.from({ length: 25 }, (_, h) => [h, readingOf(concentrationsAt(station, h), index).value])
}

/** 全岛均值最差的时刻（半小时粒度），时间轴上标出来 */
export function worstHour(data: EnvironmentData, index: AirIndex): number {
  let worst = 0
  let max = -1
  for (let h = 0; h <= 24; h += 0.5) {
    const v = readingOf(cityConcentrationsAt(data, h), index).index
    if (v > max) {
      max = v
      worst = h
    }
  }
  return worst
}

/** 按等级给出健康建议 */
export function healthAdvice(level: AirLevel): string {
  return [
    '空气质量令人满意，各类人群可正常户外活动。',
    '空气质量可接受，极少数异常敏感人群应减少户外活动。',
    '儿童、老年人及心肺疾病患者应减少长时间、高强度的户外锻炼。',
    '易感人群避免户外活动，一般人群减少户外运动，外出建议佩戴口罩。'
  ][level]
}

/** 噪声监测点某时刻的声级，dB(A)，保留一位小数 */
export function noiseDbAt(point: Pick<NoisePoint, 'base'>, hour: number): number {
  return Math.round((point.base + interpolate(NOISE_CURVE, hour)) * 10) / 10
}

/** 是否夜间（22:00–06:00），夜间执行更严的噪声限值 */
export function isNight(hour: number): boolean {
  const h = ((hour % 24) + 24) % 24
  return h >= 22 || h < 6
}

/** 全天噪声概况：昼间、夜间平均声级和达标率（按 监测点 × 小时 统计） */
export function noiseSummary(points: NoisePoint[]): { day: number; night: number; compliance: number } {
  let daySum = 0
  let dayN = 0
  let nightSum = 0
  let nightN = 0
  let ok = 0
  for (const p of points) {
    for (let h = 0; h < 24; h++) {
      const db = noiseDbAt(p, h)
      if (isNight(h)) {
        nightSum += db
        nightN++
        if (db <= NOISE_LIMIT.night) ok++
      } else {
        daySum += db
        dayN++
        if (db <= NOISE_LIMIT.day) ok++
      }
    }
  }
  const round1 = (v: number) => Math.round(v * 10) / 10
  return { day: dayN ? round1(daySum / dayN) : 0, night: nightN ? round1(nightSum / nightN) : 0, compliance: dayN + nightN ? round1((ok / (dayN + nightN)) * 100) : 0 }
}

/** 近岸水质各类别的采样点数量 */
export function waterDistribution(samples: WaterSample[]): { grade: WaterGrade; name: string; count: number }[] {
  return ([1, 2, 3, 4] as WaterGrade[]).map(grade => ({ grade, name: WATER_GRADE_NAMES[grade], count: samples.filter(s => s.grade === grade).length }))
}

/** 路口名「甲街 / 乙街」→「甲街与乙街口」 */
function crossingName(name: string): string {
  return name.replace(' / ', '与') + '口'
}

/** 位置引用对应的名称和片区；引用的对象不在 geo 里时返回 null */
function describePlace(geo: GeoData, place: PlaceRef): { name: string; districtId: string | null } | null {
  if ('landmark' in place) {
    const l = geo.landmarks.find(x => x.id === place.landmark)
    return l ? { name: l.name, districtId: l.districtId } : null
  }
  if ('intersection' in place) {
    const i = geo.intersections.find(x => x.id === place.intersection)
    return i ? { name: crossingName(i.name), districtId: i.districtId } : null
  }
  const r = geo.roads.find(x => x.id === place.road)
  return r ? { name: r.name, districtId: null } : null
}

/**
 * 由地理底数据生成生态环境模块的全部 mock 数据。
 * 所有位置都引用 geo.json 里的地标、路口或道路，geo 里没有的引用会被跳过。
 */
export function buildEnvironmentData(geo: GeoData): EnvironmentData {
  const districtName = (id: string | null | undefined) => geo.districts.find(d => d.id === id)?.name ?? '主岛'
  const profileOf = (id: string | null) => (id && DISTRICT_PROFILE[id]) || DEFAULT_PROFILE

  const districts: EnvDistrict[] = geo.districts.map(d => ({ id: d.id, name: d.name, areaKm2: d.areaKm2, profile: profileOf(d.id) }))

  const stations: EnvStation[] = STATION_SPECS.flatMap(s => {
    const l = geo.landmarks.find(x => x.id === s.landmark)
    return l ? [{ id: l.id, name: l.name + '站', shortName: s.shortName, kind: s.kind, place: { landmark: l.id }, districtName: districtName(l.districtId), profile: s.profile }] : []
  })

  const sources: PollutionSource[] = SOURCE_SPECS.flatMap(s => {
    const at = describePlace(geo, s.place)
    if (!at) return []
    return [{ id: s.id, name: s.name.replace('{place}', at.name), shortName: s.shortName, type: s.type, level: s.level, place: s.place, districtName: districtName(s.district ?? at.districtId), note: s.note, time: s.time }]
  })

  // 噪声点：阿拉伯湾街、苏丹·本·扎耶德街上与次干路相交的路口，加上谢赫拉希德街上与支路相交的路口
  const noisePoints: NoisePoint[] = geo.intersections
    .filter(i => (i.level === 2 ? i.roads[1] !== 'airport' : i.roads[1] === 'airport'))
    .map(i => ({
      id: i.id,
      name: crossingName(i.name),
      place: { intersection: i.id },
      // 两条干道相交的路口更吵；所在片区车越多越吵；再加 ±1.5 dB 的固定偏差
      base: Math.round((57 + (i.level === 2 ? 5 : 1) + 5 * profileOf(i.districtId).traffic + 3 * (seeded(i.id) - 0.5)) * 10) / 10
    }))

  const greenSpaces: GreenSpace[] = GREEN_SPECS.flatMap(g => {
    const l = geo.landmarks.find(x => x.id === g.landmark)
    return l ? [{ id: l.id, name: l.name, place: { landmark: l.id }, radius: g.radius }] : []
  })

  const waterSamples: WaterSample[] = WATER_SPECS.flatMap((w, i) => {
    const r = geo.roads.find(x => x.id === w.road)
    const id = 'W-' + String(i + 1).padStart(2, '0')
    return r ? [{ id, name: r.name + '近岸 ' + id, place: { road: w.road, t: w.t }, grade: w.grade }] : []
  })

  return { districts, stations, sources, noisePoints, greenSpaces, waterSamples, goodDays: { good: 27, total: 31 } }
}
