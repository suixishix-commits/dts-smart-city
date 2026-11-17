import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { GeoData } from '@/types/geo'
import { liveAlarmAt, liveAlarmDelay } from '../liveAlarms'

const geo: GeoData = JSON.parse(readFileSync('public/data/smart-city/geo.json', 'utf-8'))

describe('liveAlarms', () => {
  const now = new Date(2026, 10, 17, 9, 5)

  it('is deterministic per sequence number and stamped with the push time', () => {
    expect(liveAlarmAt(3, now)).toEqual(liveAlarmAt(3, now))
    expect(liveAlarmAt(0, now)).toMatchObject({ id: 'live-0', time: '09:05' })
    expect(liveAlarmAt(1, now).id).not.toBe(liveAlarmAt(2, now).id)
  })

  it('never pushes a level-1 alarm and every area is a real district (the overview flies there)', () => {
    const names = new Set(geo.districts.map(d => d.name))
    for (let i = 0; i < 20; i++) {
      const a = liveAlarmAt(i, now)
      expect(a.level).toBeGreaterThanOrEqual(2)
      expect(names.has(a.area), a.area).toBe(true)
    }
  })

  it('waits 40–75 s between pushes', () => {
    for (let i = 0; i < 50; i++) {
      expect(liveAlarmDelay(i)).toBeGreaterThanOrEqual(40_000)
      expect(liveAlarmDelay(i)).toBeLessThan(75_000)
    }
  })
})
