/**
 * 生成阿布扎比主岛的地理底数据 public/data/smart-city/geo.json。
 *
 * 所有模块的 mock 数据都以它为骨架（片区、道路、路口、地标），保证热力、标注、管线落在真实的陆地和路网上，
 * 而不是随手写的坐标。海岸线和主干路是对着场景影像校准过的 WGS84 [lon, lat]。
 *
 * 运行：node scripts/build-geo.mjs
 */
import * as turf from '@turf/turf'
import { writeFileSync } from 'node:fs'

const r5 = n => Math.round(n * 1e5) / 1e5
const pt = c => [r5(c[0]), r5(c[1])]

// ---------- 主岛海岸线（顺时针，从科尼什西端起） ----------
const ISLAND = [
  [54.3265, 24.464], [54.334, 24.4725], [54.344, 24.483], [54.3535, 24.4905], [54.364, 24.499], [54.3755, 24.508],
  [54.38, 24.516], [54.392, 24.512], [54.387, 24.502], [54.3885, 24.495], [54.393, 24.488], [54.401, 24.48],
  [54.412, 24.47], [54.423, 24.46], [54.444, 24.448], [54.46, 24.44], [54.476, 24.433], [54.49, 24.425],
  [54.496, 24.408], [54.485, 24.4], [54.47, 24.399], [54.45, 24.404], [54.435, 24.409], [54.415, 24.418],
  [54.395, 24.427], [54.38, 24.433], [54.36, 24.44], [54.345, 24.448], [54.335, 24.454], [54.325, 24.457],
  [54.312, 24.456], [54.303, 24.461], [54.306, 24.468], [54.316, 24.467]
]
const island = turf.polygon([[...ISLAND, ISLAND[0]]])
/** 向内收 250 米的陆地范围：热力点、设备点只落在这里面，不会掉进海里 */
const land = turf.buffer(island, -0.25, { units: 'kilometers' })

// ---------- 纵向主干路（西北 → 东南，贯穿全岛） ----------
const LONG_ROADS = [
  { id: 'khaleej', name: '阿拉伯湾街', path: [[54.338, 24.476], [54.3518, 24.4622], [54.3671, 24.448], [54.39, 24.4375], [54.43, 24.4175], [54.472, 24.4005]] },
  { id: 'airport', name: '谢赫拉希德街', path: [[54.356, 24.4915], [54.376, 24.47], [54.405, 24.447], [54.44, 24.424], [54.478, 24.401]] },
  { id: 'muroor', name: '苏丹·本·扎耶德街', path: [[54.366, 24.499], [54.389, 24.476], [54.42, 24.452], [54.456, 24.43], [54.486, 24.412]] }
]
const COAST_ROADS = [
  { id: 'corniche', name: '滨海大道', path: [[54.3275, 24.4632], [54.3348, 24.4715], [54.3448, 24.482], [54.3543, 24.4895], [54.3648, 24.498], [54.3752, 24.5065]] },
  { id: 'salam', name: '谢赫扎耶德街', path: [[54.3752, 24.5065], [54.3862, 24.4945], [54.3915, 24.4872], [54.3995, 24.4792], [54.4105, 24.4692], [54.4215, 24.4592], [54.4425, 24.447], [54.4585, 24.439], [54.4745, 24.432], [54.488, 24.424], [54.4935, 24.409]] }
]

/** 首尾各延长 km 公里，保证能和所有横向街道相交 */
function extend(path, km) {
  const a = turf.destination(path[0], km, turf.bearing(path[1], path[0]), { units: 'kilometers' }).geometry.coordinates
  const n = path.length
  const b = turf.destination(path[n - 1], km, turf.bearing(path[n - 2], path[n - 1]), { units: 'kilometers' }).geometry.coordinates
  return [a, ...path, b]
}
const lanes = Object.fromEntries(LONG_ROADS.map(r => [r.id, turf.lineString(extend(r.path, 4))]))
// 西南侧再加一条辅助分界线（阿拉伯湾街向海一侧 1.3 km），用来把皇宫半岛和巴廷滨海分出来
{
  const a = turf.lineOffset(lanes.khaleej, 1.3, { units: 'kilometers' })
  const b = turf.lineOffset(lanes.khaleej, -1.3, { units: 'kilometers' })
  const mid = turf.along(lanes.airport, 6, { units: 'kilometers' })
  const far = l => turf.pointToLineDistance(mid, l, { units: 'kilometers' })
  lanes.west = far(a) > far(b) ? a : b
}

// ---------- 横向街道（垂直于岛轴，按沿谢赫拉希德街的里程定位） ----------
const spine = turf.lineString(extend(LONG_ROADS[1].path, 4))
const SPINE_START = 4 // 延长了 4 km，所以真实起点在里程 4
const CROSS = [
  { id: 'hamdan', name: '哈姆丹街', at: 0.7, level: 3 },
  { id: 'zayed1', name: '扎耶德一世街', at: 1.6, level: 2 },
  { id: 'falah', name: '法拉赫街', at: 2.5, level: 3 },
  { id: 'hazza', name: '哈扎·本·扎耶德街', at: 3.4, level: 2 },
  { id: 'delma', name: '德尔马街', at: 4.4, level: 3 },
  { id: 'mbk', name: '穆罕默德·本·哈利法街', at: 5.4, level: 2 },
  { id: 'karamah', name: '卡拉马街', at: 6.5, level: 3 },
  { id: 'saada', name: '萨阿达街', at: 7.6, level: 2 },
  { id: 'dhafeer', name: '达菲尔街', at: 8.9, level: 3 },
  { id: 'rabdan', name: '拉布丹街', at: 10.2, level: 2 },
  { id: 'sportcity', name: '体育城街', at: 12.2, level: 3 },
  { id: 'mosque', name: '清真寺街', at: 14, level: 3 }
]
function crossLine(at) {
  const d = SPINE_START + at
  const p = turf.along(spine, d, { units: 'kilometers' }).geometry.coordinates
  const q = turf.along(spine, d + 0.2, { units: 'kilometers' }).geometry.coordinates
  const b = turf.bearing(p, q)
  const sw = turf.destination(p, 7, b + 90, { units: 'kilometers' }).geometry.coordinates
  const ne = turf.destination(p, 7, b - 90, { units: 'kilometers' }).geometry.coordinates
  return { sw, ne, line: turf.lineString([sw, ne]) }
}
/** 把一条线裁到陆地内，保留最长的一段 */
function clipToIsland(coords) {
  const line = turf.lineString(coords)
  const len = turf.length(line, { units: 'kilometers' })
  const runs = []
  let run = []
  for (let d = 0; d <= len; d += 0.05) {
    const c = turf.along(line, d, { units: 'kilometers' }).geometry.coordinates
    if (turf.booleanPointInPolygon(c, island)) run.push(c)
    else if (run.length) (runs.push(run), (run = []))
  }
  if (run.length) runs.push(run)
  const best = runs.sort((a, b) => b.length - a.length)[0] ?? []
  if (best.length < 2) return []
  return turf.simplify(turf.lineString(best), { tolerance: 0.00005 }).geometry.coordinates.map(pt)
}
function hit(cross, laneId) {
  const f = turf.lineIntersect(cross.line, lanes[laneId]).features[0]
  if (!f) throw new Error(`横街与 ${laneId} 没有交点`)
  return f.geometry.coordinates
}

// ---------- 片区：由主干路和横街围合，再裁到海岸线 ----------
// from/to 是沿谢赫拉希德街的里程；left/right 是西南侧/东北侧的边界（'sw'/'ne' 表示一直到海）
const DISTRICTS = [
  { id: 'rasakhdar', name: '拉斯阿赫达尔', from: -3, to: 1.6, left: 'sw', right: 'west', baseDensity: 0.3 },
  { id: 'khalidiyah', name: '哈利迪亚', from: -3, to: 1.6, left: 'west', right: 'khaleej', baseDensity: 1.7 },
  { id: 'danah', name: '达纳', from: -3, to: 1.6, left: 'khaleej', right: 'airport', baseDensity: 2.0 },
  { id: 'markaziyah', name: '马卡齐亚', from: -3, to: 1.6, left: 'airport', right: 'muroor', baseDensity: 2.3 },
  { id: 'zahiyah', name: '扎希亚', from: -3, to: 1.6, left: 'muroor', right: 'ne', baseDensity: 1.9 },
  { id: 'bateen', name: '巴廷', from: 1.6, to: 3.4, left: 'sw', right: 'khaleej', baseDensity: 0.7 },
  { id: 'manhal', name: '曼哈尔', from: 1.6, to: 3.4, left: 'khaleej', right: 'airport', baseDensity: 1.4 },
  { id: 'wahda', name: '瓦赫达', from: 1.6, to: 3.4, left: 'airport', right: 'muroor', baseDensity: 1.8 },
  { id: 'nahyan', name: '纳哈扬', from: 1.6, to: 3.4, left: 'muroor', right: 'ne', baseDensity: 1.5 },
  { id: 'mushrif', name: '穆什里夫', from: 3.4, to: 5.4, left: 'sw', right: 'airport', baseDensity: 0.9 },
  { id: 'muroor', name: '穆鲁尔', from: 3.4, to: 5.4, left: 'airport', right: 'ne', baseDensity: 1.3 },
  { id: 'rawdah', name: '劳达', from: 5.4, to: 7.6, left: 'sw', right: 'airport', baseDensity: 0.8 },
  { id: 'qurm', name: '古尔姆', from: 5.4, to: 7.6, left: 'airport', right: 'ne', baseDensity: 1.0 },
  { id: 'safarat', name: '使馆区', from: 7.6, to: 10.2, left: 'sw', right: 'airport', baseDensity: 0.5 },
  { id: 'zafranah', name: '扎法兰', from: 7.6, to: 10.2, left: 'airport', right: 'ne', baseDensity: 0.9 },
  { id: 'maqta', name: '马克塔', from: 10.2, to: 17, left: 'sw', right: 'ne', baseDensity: 0.6 }
]
const side = (cross, s) => (s === 'sw' ? cross.sw : s === 'ne' ? cross.ne : hit(cross, s))
const districts = DISTRICTS.map(d => {
  const a = crossLine(d.from)
  const b = crossLine(d.to)
  const quad = turf.polygon([[side(a, d.left), side(a, d.right), side(b, d.right), side(b, d.left), side(a, d.left)]])
  const clipped = turf.intersect(turf.featureCollection([quad, island]))
  if (!clipped) throw new Error(`片区 ${d.id} 不在岛内`)
  // 裁出多块时取最大的一块
  const polys = clipped.geometry.type === 'Polygon' ? [clipped.geometry.coordinates] : clipped.geometry.coordinates
  const ring = polys.map(p => p[0]).sort((x, y) => turf.area(turf.polygon([y])) - turf.area(turf.polygon([x])))[0]
  const poly = turf.polygon([ring])
  return {
    id: d.id,
    name: d.name,
    center: pt(turf.pointOnFeature(turf.buffer(poly, -0.2, { units: 'kilometers' }) ?? poly).geometry.coordinates),
    centroid: pt(turf.centroid(poly).geometry.coordinates),
    areaKm2: Math.round(turf.area(poly) / 1e4) / 100,
    baseDensity: d.baseDensity,
    boundary: ring.slice(0, -1).map(pt)
  }
})

// ---------- 道路 ----------
const roads = [
  ...COAST_ROADS.map(r => ({ id: r.id, name: r.name, level: 1, direction: r.id === 'corniche' ? 'cross' : 'long', path: r.path.map(pt) })),
  ...LONG_ROADS.map(r => ({ id: r.id, name: r.name, level: 1, direction: 'long', path: clipToIsland(extend(r.path, 4)) })),
  ...CROSS.map(c => {
    const x = crossLine(c.at)
    return { id: c.id, name: c.name, level: c.level, direction: 'cross', path: clipToIsland([x.sw, x.ne]) }
  })
].map(r => ({ ...r, lengthKm: Math.round(turf.length(turf.lineString(r.path), { units: 'kilometers' }) * 100) / 100 }))

// ---------- 路口：横街 × 纵向主干路 ----------
const districtOf = c => districts.find(d => turf.booleanPointInPolygon(c, turf.polygon([[...d.boundary, d.boundary[0]]])))?.id ?? null
const intersections = []
for (const c of CROSS) {
  const x = crossLine(c.at)
  for (const r of LONG_ROADS) {
    const p = hit(x, r.id)
    if (!turf.booleanPointInPolygon(p, island)) continue
    intersections.push({ id: `${c.id}-${r.id}`, name: `${c.name} / ${r.name}`, roads: [c.id, r.id], level: Math.max(c.level, 1), position: pt(p), districtId: districtOf(p) })
  }
}

// ---------- 地标（真实位置） ----------
const LANDMARKS = [
  ['emirates-palace', '酋长皇宫', 'landmark', 54.3173, 24.4615],
  ['qasr-al-watan', '国家宫', 'landmark', 54.3065, 24.4625],
  ['corniche-beach', '科尼什海滩', 'beach', 54.334, 24.4712],
  ['qasr-al-hosn', '霍森宫', 'landmark', 54.3548, 24.4822],
  ['wtc', '世贸中心', 'mall', 54.3573, 24.4875],
  ['khalidiyah-mall', '哈利迪亚购物中心', 'mall', 54.3492, 24.4712],
  ['abu-dhabi-mall', '阿布扎比购物中心', 'mall', 54.3823, 24.4958],
  ['mina-zayed', '扎耶德港', 'port', 54.381, 24.512],
  ['wahda-mall', '瓦赫达购物中心', 'mall', 54.3729, 24.4705],
  ['bus-station', '中央汽车站', 'transit', 54.3752, 24.4668],
  ['skmc', '谢赫哈利法医疗城', 'hospital', 54.3805, 24.4655],
  ['umm-al-emarat-park', '乌姆阿联酋公园', 'park', 54.3845, 24.453],
  ['mushrif-mall', '穆什里夫购物中心', 'mall', 54.4133, 24.4343],
  ['eastern-mangroves', '东部红树林', 'park', 54.4405, 24.4455],
  ['adnec', '国家展览中心', 'venue', 54.4344, 24.4188],
  ['bateen-airport', '巴廷机场', 'transit', 54.455, 24.4275],
  ['zayed-sports-city', '扎耶德体育城', 'venue', 54.4536, 24.4161],
  ['grand-mosque', '谢赫扎耶德大清真寺', 'landmark', 54.475, 24.4128],
  ['maqta-bridge', '马克塔桥', 'bridge', 54.4945, 24.4075],
  ['mussafah-bridge', '穆萨法桥', 'bridge', 54.4775, 24.3998],
  ['zayed-bridge', '谢赫扎耶德桥', 'bridge', 54.4915, 24.4215]
]
const landmarks = LANDMARKS.map(([id, name, type, lon, lat]) => {
  const inside = turf.booleanPointInPolygon([lon, lat], island)
  if (!inside && type !== 'bridge') console.warn('地标不在岛内：', id)
  return { id, name, type, position: [lon, lat], districtId: districtOf([lon, lat]) }
})

const landRing = (land.geometry.type === 'Polygon' ? land.geometry.coordinates : land.geometry.coordinates.sort((a, b) => b[0].length - a[0].length)[0])[0]
const bbox = turf.bbox(island)
const geo = {
  note: '由 scripts/build-geo.mjs 生成，不要手改。坐标均为 WGS84 [lon, lat]。',
  bbox: bbox.map(r5),
  center: pt(turf.centroid(island).geometry.coordinates),
  island: ISLAND.map(pt),
  land: turf.simplify(turf.polygon([landRing]), { tolerance: 0.0003 }).geometry.coordinates[0].slice(0, -1).map(pt),
  districts,
  roads,
  intersections,
  landmarks
}
writeFileSync(new URL('../public/data/smart-city/geo.json', import.meta.url), JSON.stringify(geo))
console.log(`districts ${districts.length}, roads ${roads.length}, intersections ${intersections.length}, landmarks ${landmarks.length}`)
console.log(districts.map(d => `${d.id}:${d.areaKm2}km²/${d.boundary.length}pts`).join('  '))
console.log(roads.map(r => `${r.id}:${r.lengthKm}km/${r.path.length}pts`).join('  '))
