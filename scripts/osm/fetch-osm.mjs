/**
 * 下载阿布扎比主岛的 OpenStreetMap 快照（道路、海岸线、地名、地标）到 scripts/osm/abu-dhabi-island.osm.json。
 * 公共 Overpass 服务经常满载，这里按指数退避重试，并轮流尝试几个公开镜像。
 * 只在需要更新底数据时运行：node scripts/osm/fetch-osm.mjs；平时 build-geo.mjs 直接读快照。
 * 数据 © OpenStreetMap contributors，ODbL 许可。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const here = new URL('.', import.meta.url)
const query = readFileSync(new URL('query.overpassql', here), 'utf-8')
const out = new URL('abu-dhabi-island.osm.json', here)
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
const MAX_TRIES = 12

const sleep = ms => new Promise(r => setTimeout(r, ms))

for (let i = 0, wait = 15000; i < MAX_TRIES; i++, wait = Math.min(wait * 2, 240000)) {
  const url = ENDPOINTS[i % ENDPOINTS.length]
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'dts-smart-city-geo-build/0.1' },
      body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.timeout(240000)
    })
    const text = await res.text()
    if (res.ok && text.trimStart().startsWith('{')) {
      const json = JSON.parse(text)
      writeFileSync(out, JSON.stringify(json))
      console.log(`[osm] ${url} → ${json.elements.length} 个要素，已保存 ${out.pathname}`)
      process.exit(0)
    }
    console.warn(`[osm] ${url} 第 ${i + 1} 次：HTTP ${res.status}，${text.slice(0, 80).replace(/\s+/g, ' ')}`)
  } catch (e) {
    console.warn(`[osm] ${url} 第 ${i + 1} 次：${e.message}`)
  }
  console.warn(`[osm] ${wait / 1000} 秒后重试`)
  await sleep(wait)
}
console.error('[osm] 多次重试仍失败')
process.exit(1)
