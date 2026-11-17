import { liveAlarmAt, liveAlarmDelay } from '@/api/mock/liveAlarms'
import store from '@/stores'
import { onBeforeUnmount, onMounted } from 'vue'

/** 首条推送在进入页面后多久到达，毫秒：让开场动画先播完 */
const FIRST_DELAY = 25_000

/**
 * 模拟实时告警推送：进入页面后每隔 40–75 秒推一条到告警 store，顶部通知和城市总览的「实时告警」列表随之更新。
 * smart-city.js 里 liveAlarms: false 可关掉。
 */
export function useLiveAlarms() {
  let timer: ReturnType<typeof setTimeout> | undefined
  let seq = 0

  const schedule = (delay: number) => {
    timer = setTimeout(() => {
      store.alarmStore.pushAlarm(liveAlarmAt(seq, new Date()))
      seq += 1
      schedule(liveAlarmDelay(seq))
    }, delay)
  }

  onMounted(() => {
    const enabled = typeof gVar === 'undefined' || gVar?.smartCity?.liveAlarms !== false
    if (enabled) schedule(FIRST_DELAY)
  })
  onBeforeUnmount(() => clearTimeout(timer))
}
