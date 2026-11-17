import type { LifelineAlarm, WorkOrder } from '@/types/lifeline'

/** 工单号的前缀（日期） */
const PREFIX = 'WO-1113-'
/** 催办一次推进的进度，%；完工由现场确认，催办最多推进到 95% */
const ADVANCE_STEP = 10
const ADVANCE_MAX = 95

/** 某个对象（告警、设施、桥梁）未完成的工单 */
export function openOrderFor(orders: WorkOrder[], targetId: string): WorkOrder | undefined {
  return orders.find(o => o.targetId === targetId && o.progress < 100)
}

function nextId(orders: WorkOrder[]): string {
  const max = orders.reduce((n, o) => Math.max(n, Number(o.id.slice(PREFIX.length)) || 0), 0)
  return PREFIX + String(max + 1).padStart(2, '0')
}

/** 催办：进度推进一档，状态改为「已催办」 */
function advance(orders: WorkOrder[], order: WorkOrder): WorkOrder[] {
  const next = { ...order, progress: Math.max(order.progress, Math.min(ADVANCE_MAX, order.progress + ADVANCE_STEP)), status: '已催办' }
  return orders.map(o => (o.id === order.id ? next : o))
}

/** 告警的预计恢复时间：影响分析里的恢复时间，否则取最后一个处置步骤的时间 */
function alarmEta(alarm: LifelineAlarm): string {
  return alarm.analysis?.recovery ?? alarm.steps[alarm.steps.length - 1]?.time.replace(/^预计\s*/, '') ?? '待定'
}

/** 派发抢修工单：告警还没有未完成的工单时新建一张放在最前，已有则催办推进 */
export function dispatchRepair(orders: WorkOrder[], alarm: LifelineAlarm): WorkOrder[] {
  const open = openOrderFor(orders, alarm.id)
  if (open) return advance(orders, open)
  const order: WorkOrder = {
    id: nextId(orders),
    kind: 'repair',
    alarmId: alarm.id,
    targetId: alarm.id,
    title: alarm.title,
    crew: alarm.crew.replace(/（.*$/, ''),
    eta: alarmEta(alarm),
    progress: 5,
    status: '已派单'
  }
  return [order, ...orders]
}

/** 派发巡检工单（设施、桥梁）：没有未完成的工单时新建一张放在最前，已有则催办推进 */
export function dispatchInspection(orders: WorkOrder[], target: { id: string; name: string; crew: string; eta: string }): WorkOrder[] {
  const open = openOrderFor(orders, target.id)
  if (open) return advance(orders, open)
  const order: WorkOrder = { id: nextId(orders), kind: 'inspect', targetId: target.id, title: `${target.name}巡检`, crew: target.crew, eta: target.eta, progress: 5, status: '待巡检' }
  return [order, ...orders]
}
