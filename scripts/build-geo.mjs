/**
 * 生成阿布扎比主岛的地理底数据 public/data/smart-city/geo.json。
 *
 * 数据来源：OpenStreetMap 快照 scripts/osm/abu-dhabi-island.osm.json（用 scripts/osm/fetch-osm.mjs 下载）。
 * 海岸线、道路、地名、地标都取真实几何；所有模块的 mock 数据都以它为骨架（片区、道路、路口、地标），
 * 保证热力、标注、管线落在真实的陆地和路网上。
 * 数据 © OpenStreetMap contributors，ODbL 许可（https://www.openstreetmap.org/copyright）。
 *
 * 道路、路口、地标的 id 沿用一期的编号（各模块 mock 按 id 引用），名称和几何换成真实街道；对应关系见下面的 ROADS。
 *
 * 运行：node scripts/build-geo.mjs
 */
import * as turf from '@turf/turf'
import { readFileSync, writeFileSync } from 'node:fs'

const osm = JSON.parse(readFileSync(new URL('./osm/abu-dhabi-island.osm.json', import.meta.url), 'utf-8'))
const r5 = n => Math.round(n * 1e5) / 1e5
const pt = c => [r5(c[0]), r5(c[1])]
const nameOf = t => (t && (t['name:en'] || t.name)) || ''
const km = { units: 'kilometers' }

const ways = osm.elements.filter(e => e.type === 'way' && e.geometry?.length > 1)
const coords = w => w.geometry.map(p => [p.lon, p.lat])

/**
 * 把一组折线按端点首尾相接成尽量长的链。端点相距 tol 公里以内视为相连（OSM 在环岛、立交处常常断开）。
 */
function chains(lines, tol = 0.03) {
  const pool = lines.filter(l => l.length > 1).map(l => [...l])
  const out = []
  while (pool.length) {
    let chain = pool.shift()
    for (let grown = true; grown; ) {
      grown = false
      for (let i = 0; i < pool.length; i++) {
        const l = pool[i]
        const head = chain[0]
        const tail = chain[chain.length - 1]
        const near = (a, b) => turf.distance(a, b, km) <= tol
        if (near(tail, l[0])) chain = [...chain, ...l.slice(1)]
        else if (near(tail, l[l.length - 1])) chain = [...chain, ...[...l].reverse().slice(1)]
        else if (near(head, l[l.length - 1])) chain = [...l.slice(0, -1), ...chain]
        else if (near(head, l[0])) chain = [...[...l].reverse().slice(0, -1), ...chain]
        else continue
        pool.splice(i, 1)
        grown = true
        break
      }
    }
    out.push(chain)
  }
  return out
}
const lengthOf = c => turf.length(turf.lineString(c), km)

// ---------- 主岛海岸线：coastline 拼成闭合环，取包含岛心的那个 ----------
const ISLAND_CORE = [54.37, 24.475]
const coastRings = chains(ways.filter(w => w.tags?.natural === 'coastline').map(coords), 0.005)
  .filter(c => c.length > 3 && turf.distance(c[0], c[c.length - 1], km) < 0.05)
  .map(c => [...c.slice(0, -1), c[0]])
const islandRing = coastRings.find(r => turf.booleanPointInPolygon(ISLAND_CORE, turf.polygon([r])))
if (!islandRing) throw new Error(`OSM 快照里没有拼出包含岛心的闭合海岸线（共 ${coastRings.length} 个闭合环）`)
// 海岸线点很密，按约 25 米简化；面向城市级俯视足够
const island = turf.simplify(turf.polygon([islandRing]), { tolerance: 0.00022, highQuality: true })
const ISLAND = island.geometry.coordinates[0].slice(0, -1).map(pt)
/** 向内收 250 米的陆地范围：热力点、设备点只落在这里面，不会掉进海里 */
const land = turf.buffer(island, -0.25, km)
const inIsland = c => turf.booleanPointInPolygon(c, island)

/** 一条线留在岛内的部分（按 25 米采样切开，保留各段），每段再简化 */
function clipRuns(line, minKm = 0.15, tolerance = 0.00005) {
  const ls = turf.lineString(line)
  const len = turf.length(ls, km)
  const runs = []
  let run = []
  const step = 0.025
  for (let d = 0; d <= len + step / 2; d += step) {
    const c = turf.along(ls, Math.min(d, len), km).geometry.coordinates
    if (inIsland(c)) run.push(c)
    else if (run.length) {
      runs.push(run)
      run = []
    }
  }
  if (run.length) runs.push(run)
  return runs
    .filter(r => r.length > 1 && lengthOf(r) >= minKm)
    .map(r => turf.simplify(turf.lineString(r), { tolerance }).geometry.coordinates.map(pt))
}

// 局部平面坐标（公里），只用来求道路中心线
const LON0 = 54.4
const LAT0 = 24.45
const KX = 111.32 * Math.cos((LAT0 * Math.PI) / 180)
const KY = 110.57
const toXY = c => [(c[0] - LON0) * KX, (c[1] - LAT0) * KY]
const toLL = p => [LON0 + p[0] / KX, LAT0 + p[1] / KY]
const median = a => {
  const s = [...a].sort((x, y) => x - y)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

/** 沿折线每隔 step 公里加密取点，让分桶时每段路都有足够的点 */
function densify(line, step = 0.04) {
  const out = []
  for (let i = 1; i < line.length; i++) {
    const n = Math.max(1, Math.ceil(turf.distance(line[i - 1], line[i], km) / step))
    for (let k = 0; k < n; k++) out.push([line[i - 1][0] + ((line[i][0] - line[i - 1][0]) * k) / n, line[i - 1][1] + ((line[i][1] - line[i - 1][1]) * k) / n])
  }
  out.push(line[line.length - 1])
  return out
}

/**
 * 按名称取一条真实道路的中心线。
 * OSM 里一条路常被拆成几十段：双向分隔的两幅各一条、在立交和环岛处断开，按端点接链会把两幅接成来回的环。
 * 这里不接链：把同名路段的点投影到这条路自己的主方向上（主成分），每 150 米分一个桶，取桶内横向偏移的中位数，
 * 得到两幅之间的一条中心线；中位数也能忽略零星的同名支路。桶之间断开超过 600 米时只保留最长的连续部分。
 */
function realRoad(names) {
  const re = new RegExp('^(' + names.join('|') + ')$', 'i')
  const parts = ways.filter(w => w.tags?.highway && !/_link$/.test(w.tags.highway) && re.test(nameOf(w.tags))).map(coords)
  if (!parts.length) throw new Error('OSM 快照里没有道路：' + names.join(' / '))
  const pts = parts.flatMap(p => densify(p)).filter(inIsland).map(toXY)
  if (pts.length < 10) throw new Error('道路不在岛内：' + names.join(' / '))
  // 主方向
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const my = pts.reduce((s, p) => s + p[1], 0) / pts.length
  let sxx = 0, sxy = 0, syy = 0
  for (const [x, y] of pts) {
    sxx += (x - mx) ** 2
    sxy += (x - mx) * (y - my)
    syy += (y - my) ** 2
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  const ax = [Math.cos(theta), Math.sin(theta)]
  const pr = [-ax[1], ax[0]]
  const BIN = 0.15
  const bins = new Map()
  for (const [x, y] of pts) {
    const u = (x - mx) * ax[0] + (y - my) * ax[1]
    const v = (x - mx) * pr[0] + (y - my) * pr[1]
    const k = Math.round(u / BIN)
    if (!bins.has(k)) bins.set(k, { u: [], v: [] })
    bins.get(k).u.push(u)
    bins.get(k).v.push(v)
  }
  const keys = [...bins.keys()].sort((a, b) => a - b)
  // 按连续性切段
  const runs = [[]]
  keys.forEach((k, i) => {
    if (i && k - keys[i - 1] > Math.round(0.6 / BIN)) runs.push([])
    runs[runs.length - 1].push(k)
  })
  const best = runs.sort((a, b) => b.length - a.length)[0]
  const line = best.map(k => {
    const b = bins.get(k)
    const u = median(b.u)
    const v = median(b.v)
    return toLL([mx + u * ax[0] + v * pr[0], my + u * ax[1] + v * pr[1]])
  })
  // 中心线沿主方向的顺序：long 路从西北到东南，cross 路从西南到东北（与一期一致，mock 按比例取点时方向不变）
  const smooth = turf.simplify(turf.lineString(line), { tolerance: 0.00006 }).geometry.coordinates.map(pt)
  return smooth
}

// ---------- 道路：id 沿用一期编号，几何取 OSM 同名街道 ----------
// direction：long 沿岛轴（西北 → 东南），cross 垂直于岛轴
const ROADS = [
  // 沿岛轴的主干路
  { id: 'khaleej', name: '阿拉伯湾街', osm: ['Al Khaleej Al Arabi Street'], level: 1, direction: 'long' },
  { id: 'airport', name: '谢赫拉希德街', osm: ['Sheikh Rashid Bin Saeed Street'], level: 1, direction: 'long' },
  { id: 'muroor', name: '苏丹·本·扎耶德街', osm: ['Sultan Bin Zayed The First Street'], level: 1, direction: 'long' },
  { id: 'salam', name: '谢赫扎耶德街', osm: ['Sheikh Zayed Bin Sultan Street', 'Sheikh Zayed Tunnel'], level: 1, direction: 'long' },
  { id: 'corniche', name: '滨海大道', osm: ['Corniche Street'], level: 1, direction: 'cross' },
  // 横街（按沿岛轴的位置从西北到东南）
  { id: 'hamdan', name: '哈姆丹街', osm: ['Hamdan Bin Mohammed Street'], level: 3, direction: 'cross' },
  { id: 'zayed1', name: '扎耶德一世街', osm: ['Zayed The First Street'], level: 2, direction: 'cross' },
  { id: 'falah', name: '法拉赫街', osm: ['Al Falah Street'], level: 3, direction: 'cross' },
  { id: 'hazza', name: '哈扎·本·扎耶德街', osm: ["Hazza' Bin Zayed The First Street"], level: 2, direction: 'cross' },
  { id: 'delma', name: '法蒂玛·宾特·穆巴拉克街', osm: ['Sheikha Fatima bint Mubarak Street'], level: 3, direction: 'cross' },
  { id: 'mbk', name: '穆罕默德·本·哈利法街', osm: ['Mohammed Bin Khalifa Street'], level: 2, direction: 'cross' },
  { id: 'karamah', name: '沙赫布特·本·苏尔坦街', osm: ['Shakhbout Bin Sultan Street'], level: 3, direction: 'cross' },
  { id: 'saada', name: '萨拉玛·宾特·布提街', osm: ['Salama Bint Butti Street'], level: 2, direction: 'cross' },
  { id: 'dhafeer', name: '扎夫拉街', osm: ['Ad Dhafrah Street'], level: 3, direction: 'cross' },
  { id: 'rabdan', name: '拉布丹街', osm: ['Rabdan Street'], level: 2, direction: 'cross' },
  { id: 'sportcity', name: '大通布街', osm: ['Tunb Al Kubra Street'], level: 3, direction: 'cross' },
  { id: 'mosque', name: '清真寺街', osm: ["Al Jami' Al Kabeer Street"], level: 3, direction: 'cross' }
]
const roads = ROADS.map(r => {
  let path = realRoad(r.osm)
  // 方向与一期一致：沿轴的路从西北到东南（经度递增），横街从西南到东北（纬度递增）；mock 按比例在路上取点，方向不能变
  const first = path[0]
  const last = path[path.length - 1]
  if (r.direction === 'long' ? first[0] > last[0] : first[1] > last[1]) path = [...path].reverse()
  return { id: r.id, name: r.name, nameEn: r.osm[0], level: r.level, direction: r.direction, path, lengthKm: Math.round(lengthOf(path) * 100) / 100 }
})
const road = id => roads.find(r => r.id === id)

// ---------- 路口：横街 × 三条纵向主干路（找不到真实交点时把横街两端顺延 800 米再找：中心线在立交处会提前截止） ----------
/** 首尾各延长 kmLen 公里 */
function extend(path, kmLen) {
  const a = turf.destination(path[0], kmLen, turf.bearing(path[1], path[0]), km).geometry.coordinates
  const n = path.length
  const b = turf.destination(path[n - 1], kmLen, turf.bearing(path[n - 2], path[n - 1]), km).geometry.coordinates
  return [a, ...path, b]
}
const LONG = ['khaleej', 'airport', 'muroor']
const CROSS = ROADS.filter(r => r.direction === 'cross' && r.id !== 'corniche').map(r => r.id)

// ---------- 片区：以 OSM 的街区地名点为种子做泰森多边形，裁到海岸线 ----------
const places = osm.elements.filter(e => e.type === 'node' && e.tags?.place && nameOf(e.tags))
const DISTRICTS = [
  { id: 'rasakhdar', name: '拉斯阿赫达尔', osm: 'Al Ras Al Akhdar', baseDensity: 0.3 },
  { id: 'khalidiyah', name: '哈利迪亚', osm: 'Al Khalidiyah', baseDensity: 1.7 },
  { id: 'danah', name: '达纳', osm: 'Al Danah', baseDensity: 2.0 },
  { id: 'markaziyah', name: '马卡齐亚', osm: 'Al Markaziyah West', baseDensity: 2.3 },
  { id: 'zahiyah', name: '扎希亚', osm: 'Al Zahiyah', baseDensity: 1.9 },
  { id: 'bateen', name: '巴廷', osm: 'Al Bateen', baseDensity: 0.7 },
  { id: 'manhal', name: '曼哈尔', osm: 'Al Manhal', baseDensity: 1.4 },
  { id: 'wahda', name: '瓦赫达', osm: 'Al Wahda', baseDensity: 1.8 },
  { id: 'nahyan', name: '纳哈扬', osm: 'Al Nahyan', baseDensity: 1.5 },
  { id: 'mushrif', name: '穆什里夫', osm: 'Al Mushrif', baseDensity: 0.9 },
  { id: 'muroor', name: '穆鲁尔', osm: 'Al Sa\' adah', baseDensity: 1.3 },
  { id: 'rawdah', name: '劳达', osm: 'Al Rawdah', baseDensity: 0.8 },
  { id: 'qurm', name: '古尔姆', osm: 'Al Qurm', baseDensity: 1.0 },
  { id: 'safarat', name: '使馆区', osm: 'Al Safarat', baseDensity: 0.5 },
  { id: 'zafranah', name: '扎法兰', osm: "Hadbat Al Za'faranah", baseDensity: 0.9 },
  { id: 'maqta', name: '马克塔', osm: 'Al Maqtaa Village', baseDensity: 0.6 }
]
const seeds = DISTRICTS.map(d => {
  const hits = places.filter(p => nameOf(p.tags) === d.osm && inIsland([p.lon, p.lat]))
  // 同名的取 suburb 级别的点
  const p = hits.sort((a, b) => (a.tags.place === 'suburb' ? -1 : 1) - (b.tags.place === 'suburb' ? -1 : 1))[0]
  if (!p) throw new Error(`OSM 快照里没有岛内的地名点：${d.osm}（片区 ${d.id}）`)
  return turf.point([p.lon, p.lat], { id: d.id })
})
const [bx0, by0, bx1, by1] = turf.bbox(island)
const cells = turf.voronoi(turf.featureCollection(seeds), { bbox: [bx0 - 0.05, by0 - 0.05, bx1 + 0.05, by1 + 0.05] })
const districtPolys = DISTRICTS.map((d, i) => {
  const cell = cells.features[i]
  if (!cell) throw new Error('泰森多边形缺失：' + d.id)
  const clipped = turf.intersect(turf.featureCollection([cell, island]))
  if (!clipped) throw new Error(`片区 ${d.id} 不在岛内`)
  const polys = clipped.geometry.type === 'Polygon' ? [clipped.geometry.coordinates] : clipped.geometry.coordinates
  return polys.map(p => p[0]).sort((x, y) => turf.area(turf.polygon([y])) - turf.area(turf.polygon([x])))[0]
})
const districts = DISTRICTS.map((d, i) => {
  const ring = districtPolys[i]
  const poly = turf.polygon([ring])
  // 中心点要落在内收 250 米的陆地范围里（热力、标注都以它为准），再离片区边界 100 米
  const onLand = turf.intersect(turf.featureCollection([poly, land]))
  const inner = onLand ? turf.buffer(onLand, -0.1, km) : turf.buffer(poly, -0.2, km)
  return {
    id: d.id,
    name: d.name,
    nameEn: d.osm,
    center: pt(turf.pointOnFeature(inner && inner.geometry.coordinates.length ? inner : poly).geometry.coordinates),
    centroid: pt(turf.centroid(poly).geometry.coordinates),
    areaKm2: Math.round(turf.area(poly) / 1e4) / 100,
    baseDensity: d.baseDensity,
    boundary: dedupe(ring.map(pt))
  }
})
/** 取整后相邻重复的点去掉，首尾相同也去掉（环不重复首点） */
function dedupe(points) {
  const out = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1])
  while (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop()
  return out
}
const districtOf = c => districts.find(d => turf.booleanPointInPolygon(c, turf.polygon([[...d.boundary, d.boundary[0]]])))?.id ?? null

const intersections = []
const missing = []
for (const c of CROSS) {
  for (const l of LONG) {
    const a = road(c).path
    const b = road(l).path
    let f = turf.lineIntersect(turf.lineString(a), turf.lineString(b)).features[0]
    let extended = false
    if (!f) {
      f = turf.lineIntersect(turf.lineString(extend(a, 0.8)), turf.lineString(b)).features[0]
      extended = true
    }
    if (!f) {
      missing.push(`${c}-${l}`)
      continue
    }
    const p = pt(f.geometry.coordinates)
    // 顺延找到的交点：把横街接到交点，路口才落在道路上（交通按路口切路段）
    if (extended) {
      const r = road(c)
      r.path = turf.distance(p, r.path[0], km) < turf.distance(p, r.path[r.path.length - 1], km) ? [p, ...r.path] : [...r.path, p]
      r.lengthKm = Math.round(lengthOf(r.path) * 100) / 100
    }
    intersections.push({ id: `${c}-${l}`, name: `${road(c).name} / ${road(l).name}`, roads: [c, l], level: Math.max(road(c).level, 1), position: p, districtId: districtOf(p) })
  }
}
if (missing.length) console.warn('没有交点的路口（未生成）：', missing.join(', '))

// ---------- 地标：OSM 里能明确对上的用真实位置，其余沿用一期坐标 ----------
const pois = osm.elements.filter(e => e.tags && !e.tags.highway && !e.tags.natural && nameOf(e.tags))
const poiAt = re => {
  const p = pois.find(e => re.test(nameOf(e.tags)) || re.test(e.tags.name || ''))
  if (!p) return null
  const c = p.center ?? p
  return [c.lon, c.lat]
}
const LANDMARKS = [
  ['emirates-palace', '酋长皇宫', 'landmark', [54.3173, 24.4615], null],
  ['qasr-al-watan', '国家宫', 'landmark', [54.3065, 24.4625], /^Qasr Al Watan$/i],
  ['corniche-beach', '科尼什海滩', 'beach', [54.334, 24.4712], null],
  ['qasr-al-hosn', '霍森宫', 'landmark', [54.3548, 24.4822], /^Qasr Al Hosn$/i],
  ['wtc', '世贸中心', 'mall', [54.3573, 24.4875], /^World Trade Center/i],
  ['khalidiyah-mall', '哈利迪亚购物中心', 'mall', [54.3492, 24.4712], /^Khalidiyah Mall$/i],
  ['abu-dhabi-mall', '阿布扎比购物中心', 'mall', [54.3823, 24.4958], /^Abu Dhabi Mall$/i],
  ['mina-zayed', '扎耶德港', 'port', [54.381, 24.512], null],
  ['wahda-mall', '瓦赫达购物中心', 'mall', [54.3729, 24.4705], /^Al Wahda Mall$/i],
  ['bus-station', '中央汽车站', 'transit', [54.3752, 24.4668], null],
  ['skmc', '谢赫哈利法医疗城', 'hospital', [54.3805, 24.4655], /^Sheikh Khalifa Medical City$/i],
  ['umm-al-emarat-park', '乌姆阿联酋公园', 'park', [54.3845, 24.453], /Umm Al Emarat/i],
  ['mushrif-mall', '穆什里夫购物中心', 'mall', [54.4133, 24.4343], /^Mushrif Mall$/i],
  ['eastern-mangroves', '东部红树林', 'park', [54.4405, 24.4455], null],
  ['adnec', '国家展览中心', 'venue', [54.4344, 24.4188], /ADNEC|National Exhibition Cent/i],
  ['bateen-airport', '巴廷机场', 'transit', [54.455, 24.4275], /Al Bateen (Executive )?Airport/i],
  ['zayed-sports-city', '扎耶德体育城', 'venue', [54.4536, 24.4161], /^Zayed Sports City Stadium$/i],
  ['grand-mosque', '谢赫扎耶德大清真寺', 'landmark', [54.475, 24.4128], /^Sheikh Zayed Grand Mosque$/i],
  ['maqta-bridge', '马克塔桥', 'bridge', [54.4945, 24.4075], null],
  ['mussafah-bridge', '穆萨法桥', 'bridge', [54.4775, 24.3998], null],
  ['zayed-bridge', '谢赫扎耶德桥', 'bridge', [54.4915, 24.4215], null]
]
const moved = []
const landmarks = LANDMARKS.map(([id, name, type, fallback, re]) => {
  const real = re ? poiAt(re) : null
  // 只采用岛内、离一期坐标 2 公里以内的匹配，防止同名对象串位
  const use = real && (type === 'bridge' || inIsland(real)) && turf.distance(real, fallback, km) < 2 ? pt(real) : fallback
  let position = use
  // 海滩、红树林这类地标在真实海岸线上或岸外小岛上：挪到最近岸点向岛内 200 米，保证落在陆地上（桥除外）
  if (type !== 'bridge' && !inIsland(position)) {
    const shore = turf.nearestPointOnLine(turf.lineString([...ISLAND, ISLAND[0]]), position).geometry.coordinates
    const inward = turf.destination(shore, 0.2, turf.bearing(shore, turf.centroid(island).geometry.coordinates), km).geometry.coordinates
    position = pt(inward)
    moved.push(`${id} 移到岸内 ${Math.round(turf.distance(position, fallback, km) * 1000)}m`)
  } else if (use !== fallback) moved.push(`${id} ${Math.round(turf.distance(use, fallback, km) * 1000)}m`)
  return { id, name, type, position, districtId: districtOf(position) }
})

// ---------- 底图街道：岛内全部主次干路和支路（按名称接成链，裁到岛内） ----------
const LEVEL = { motorway: 1, trunk: 1, primary: 2, secondary: 3, tertiary: 4 }
const streetGroups = new Map()
for (const w of ways) {
  const lv = LEVEL[w.tags?.highway]
  if (!lv) continue
  const k = lv + '|' + (nameOf(w.tags) || 'w' + w.id)
  if (!streetGroups.has(k)) streetGroups.set(k, [])
  streetGroups.get(k).push(coords(w))
}
const streets = []
for (const [k, parts] of streetGroups) {
  const level = Number(k.split('|')[0])
  for (const c of chains(parts)) for (const run of clipRuns(c, level <= 2 ? 0.2 : 0.3, 0.00008)) streets.push({ id: 's' + streets.length, level, path: run })
}

const landRing = (land.geometry.type === 'Polygon' ? land.geometry.coordinates : land.geometry.coordinates.sort((a, b) => b[0].length - a[0].length)[0])[0]
const geo = {
  note: '由 scripts/build-geo.mjs 从 OpenStreetMap 快照生成，不要手改。坐标均为 WGS84 [lon, lat]。',
  attribution: '© OpenStreetMap contributors (ODbL)',
  osmTimestamp: osm.osm3s?.timestamp_osm_base ?? null,
  // 范围包含岛、全部道路和地标（桥头在岛外）
  bbox: turf.bbox(turf.featureCollection([island, ...roads.map(r => turf.lineString(r.path)), ...landmarks.map(l => turf.point(l.position))])).map(r5),
  center: pt(turf.centroid(island).geometry.coordinates),
  island: ISLAND,
  land: turf.simplify(turf.polygon([landRing]), { tolerance: 0.0003 }).geometry.coordinates[0].slice(0, -1).map(pt),
  districts,
  roads,
  intersections,
  landmarks,
  streets
}
writeFileSync(new URL('../public/data/smart-city/geo.json', import.meta.url), JSON.stringify(geo))
console.log(`island ${ISLAND.length} pts, districts ${districts.length}, roads ${roads.length}, intersections ${intersections.length}, landmarks ${landmarks.length}, streets ${streets.length} (${streets.reduce((s, x) => s + x.path.length, 0)} pts)`)
console.log('地标改用 OSM 位置：', moved.join(', ') || '无')
console.log(districts.map(d => `${d.id}:${d.areaKm2}km²`).join('  '))
console.log(roads.map(r => `${r.id}:${r.lengthKm}km`).join('  '))
