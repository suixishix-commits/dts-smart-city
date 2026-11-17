import type { Alarm } from '@/types/smartCity'
import { defineStore } from 'pinia'

export const alarmStore = defineStore('alarmStore', {
  state: () => ({
    alarms: [] as Alarm[],
    /** 最近一条实时推送的告警（顶部通知用） */
    latest: null as Alarm | null,
    /** 通知上点了「查看」、等城市总览去选中的告警 id */
    pending: null as string | null
  }),
  getters: {
    /** 等级高的在前；同等级时间新的在前 */
    sorted: (state): Alarm[] => [...state.alarms].sort((a, b) => a.level - b.level || b.time.localeCompare(a.time)),
    total: (state): number => state.alarms.length
  },
  actions: {
    setAlarms(alarms: Alarm[]) {
      // 页面重新加载数据时保留已经推送过来的实时告警
      const live = this.alarms.filter(a => a.id.startsWith('live-'))
      this.alarms = [...live, ...alarms.filter(a => !live.some(l => l.id === a.id))]
    },
    /** 实时推送一条告警：放在最前，并作为顶部通知 */
    pushAlarm(alarm: Alarm) {
      this.alarms = [alarm, ...this.alarms.filter(a => a.id !== alarm.id)]
      this.latest = alarm
    },
    top(n: number): Alarm[] {
      return this.sorted.slice(0, n)
    }
  }
})

export default alarmStore
