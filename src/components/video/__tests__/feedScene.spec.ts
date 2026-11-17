import { describe, expect, it } from 'vitest'
import { feedLayout, seeded } from '../feedScene'

describe('feedScene', () => {
  it('gives the same random sequence for the same seed', () => {
    const a = seeded('CAM-0218')
    const b = seeded('CAM-0218')
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(seeded('CAM-0342')()).not.toBe(seeded('CAM-0218')())
  })

  it('lays out a camera the same way every time, with 2–4 lanes and traffic in every lane range', () => {
    const l = feedLayout('CAM-0218')
    expect(feedLayout('CAM-0218')).toEqual(l)
    expect(l.lanes).toBeGreaterThanOrEqual(2)
    expect(l.lanes).toBeLessThanOrEqual(4)
    expect(l.cars.length).toBeGreaterThanOrEqual(6)
    l.cars.forEach(c => {
      expect(c.lane).toBeGreaterThanOrEqual(0)
      expect(c.lane).toBeLessThan(l.lanes)
    })
    l.walkers.forEach(w => expect([-1, l.lanes]).toContain(w.lane))
  })

  it('fills the horizon with buildings across the whole width', () => {
    const b = feedLayout('CAM-0409').buildings
    expect(b[0].x).toBe(0)
    const last = b[b.length - 1]
    expect(last.x + last.w).toBeGreaterThanOrEqual(1)
  })
})
