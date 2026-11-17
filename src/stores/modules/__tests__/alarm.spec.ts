import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Alarm } from '@/types/smartCity'
import alarmStoreDefine from '../alarm'

const list: Alarm[] = [
  { id: 'a3', module: '环境', level: 3, title: 'c', area: 'x', time: '14:15' },
  { id: 'a1', module: '生命线', level: 1, title: 'a', area: 'x', time: '13:00' },
  { id: 'a2', module: '交通', level: 1, title: 'b', area: 'x', time: '14:21' }
]

describe('alarm store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('sorts by level first, then newest first', () => {
    const s = alarmStoreDefine()
    s.setAlarms(list)
    expect(s.sorted.map(a => a.id)).toEqual(['a2', 'a1', 'a3'])
  })

  it('returns the top N', () => {
    const s = alarmStoreDefine()
    s.setAlarms(list)
    expect(s.top(2).map(a => a.id)).toEqual(['a2', 'a1'])
  })

  it('counts alarms', () => {
    const s = alarmStoreDefine()
    s.setAlarms(list)
    expect(s.total).toBe(3)
  })

  it('puts a pushed alarm first and remembers it as the latest', () => {
    const s = alarmStoreDefine()
    s.setAlarms(list)
    const live: Alarm = { id: 'live-0', module: '交通', level: 4, title: 'n', area: 'x', time: '15:00' }
    s.pushAlarm(live)
    expect(s.alarms[0]).toEqual(live)
    expect(s.latest).toEqual(live)
    expect(s.total).toBe(4)
  })

  it('keeps pushed alarms when the page reloads its data', () => {
    const s = alarmStoreDefine()
    s.pushAlarm({ id: 'live-0', module: '交通', level: 4, title: 'n', area: 'x', time: '15:00' })
    s.setAlarms(list)
    expect(s.alarms.map(a => a.id)).toEqual(['live-0', 'a3', 'a1', 'a2'])
  })
})
