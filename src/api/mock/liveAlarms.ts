import type { Alarm, AlarmLevel } from '@/types/smartCity'

/**
 * 实时告警推送的模拟数据：按序号确定性地从模板池里取，时刻用推送时的当前时间。
 * 以三、四级为主，偶尔二级；不推一级（一级告警由各模块的业务数据给出，不随机冒出来）。
 */
const TEMPLATES: { module: Alarm['module']; level: AlarmLevel; title: string; area: string }[] = [
  { module: '交通', level: 3, title: '穆罗尔路南段车辆抛锚', area: '马卡齐亚' },
  { module: '环境', level: 4, title: '扎希亚港区 PM10 小时值偏高', area: '扎希亚' },
  { module: '生命线', level: 3, title: '哈利迪亚 W-08 供水压力波动', area: '哈利迪亚' },
  { module: '安全', level: 2, title: '科尼什海滩入口人员聚集', area: '哈利迪亚' },
  { module: '交通', level: 4, title: '哈姆丹街信号机通信中断', area: '达纳' },
  { module: '生命线', level: 4, title: '巴廷 2 号变电站负荷 86%', area: '巴廷' },
  { module: '安全', level: 3, title: '世贸中心周边可疑物品', area: '马卡齐亚' },
  { module: '环境', level: 3, title: '纳哈扬工地扬尘在线超标', area: '纳哈扬' },
  { module: '交通', level: 2, title: '扎耶德一世街多车追尾', area: '曼哈尔' },
  { module: '生命线', level: 3, title: '穆鲁尔路下穿通道积水 12 cm', area: '穆鲁尔' }
]

/** 第 seq 条推送的告警（seq 从 0 开始） */
export function liveAlarmAt(seq: number, now: Date): Alarm {
  const t = TEMPLATES[seq % TEMPLATES.length]
  const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
  return { id: 'live-' + seq, module: t.module, level: t.level, title: t.title, area: t.area, time }
}

/** 下一条推送的等待时间，毫秒：40–75 秒之间，按序号错开，不像定时器那样整齐 */
export function liveAlarmDelay(seq: number): number {
  return 40_000 + ((seq * 7919) % 35) * 1000
}
