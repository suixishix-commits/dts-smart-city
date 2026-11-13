import type { Alarm } from '@/types/smartCity'
import { defineStore } from 'pinia'

export const alarmStore = defineStore('alarmStore', {
  state: () => ({
    alarms: [] as Alarm[]
  }),
  getters: {
    /** 等级高的在前；同等级时间新的在前 */
    sorted: (state): Alarm[] => [...state.alarms].sort((a, b) => a.level - b.level || b.time.localeCompare(a.time)),
    total: (state): number => state.alarms.length
  },
  actions: {
    setAlarms(alarms: Alarm[]) {
      this.alarms = alarms
    },
    top(n: number): Alarm[] {
      return this.sorted.slice(0, n)
    }
  }
})

export default alarmStore
