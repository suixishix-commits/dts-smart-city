import dayjs, { type Dayjs } from 'dayjs'

/**
 * 全站统一的「现在」。
 *
 * 演示数据（告警、事件、工单、数据时刻）都写在白天的某个时段里。真实时间在夜里时，界面上就会出现
 * 「还没到的时刻发生的事件」，夜间的热力、路况、客流也几乎全空。所以 smart-city.js 可以配一个演示时刻 demoTime（'HH:mm'）：
 * 页面打开时时钟从这个时刻开始走，顶栏时钟、时间轴的「实时」、实时告警、监控画面的时间戳都从这里取，前后一致。
 * 不配（接真实数据时）就是真实时间。
 */
function demoOffset(): number {
  const cfg = (globalThis as { gVar?: { smartCity?: { demoTime?: string } } }).gVar?.smartCity?.demoTime
  const m = typeof cfg === 'string' ? /^(\d{1,2}):(\d{2})$/.exec(cfg.trim()) : null
  if (!m) return 0
  const target = dayjs().hour(Number(m[1])).minute(Number(m[2])).second(0).millisecond(0)
  return target.valueOf() - Date.now()
}

const offset = demoOffset()

/** 当前时刻 */
export function now(): Dayjs {
  return dayjs(Date.now() + offset)
}

/** 当前时刻（小时，带小数） */
export function currentHour(): number {
  const n = now()
  return n.hour() + n.minute() / 60
}

/** 当前时刻向下取到半小时（时间轴的刻度；不超过顶栏时钟） */
export function currentHalfHour(): number {
  return Math.floor(currentHour() * 2) / 2
}
