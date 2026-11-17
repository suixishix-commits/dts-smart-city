import { afterEach, describe, expect, it, vi } from 'vitest'

const g = globalThis as { gVar?: unknown }

describe('clock', () => {
  afterEach(() => {
    delete g.gVar
    vi.resetModules()
  })

  it('starts from the configured demo time', async () => {
    g.gVar = { smartCity: { demoTime: '14:45' } }
    const clock = await import('../clock')
    expect(clock.now().format('HH:mm')).toBe('14:45')
    expect(clock.currentHalfHour()).toBe(14.5)
  })

  it('uses the real time without a demo time', async () => {
    g.gVar = { smartCity: {} }
    const clock = await import('../clock')
    expect(Math.abs(clock.now().valueOf() - Date.now())).toBeLessThan(1000)
  })
})
