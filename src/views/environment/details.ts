import { WATER_GRADE_NAMES, WATER_LIMIT, waterExceedance } from '@/api/mock/environment'
import { COLOR, LEVEL_COLOR } from '@/scene/kit'
import type { DetailModel } from '@/types/detail'
import type { HandleStatus, PollutionSource, WaterSample } from '@/types/environment'
import { WATER_COLORS } from './EnvironmentScene'

/** 详情卡片上的操作：定位、派发核查（待处置 → 核查中）、标记办结（核查中 → 已办结） */
export type EnvAction = 'locate' | 'dispatch' | 'close'

const LEVEL_NAMES: Record<number, string> = { 1: '一级', 2: '二级', 3: '三级', 4: '四级' }

/** 处置状态的颜色：待处置用暖色提醒，核查中用强调色，已办结用灰色 */
export const STATUS_COLOR: Record<HandleStatus, string> = { 待处置: COLOR.warn, 核查中: COLOR.accent, 已办结: COLOR.muted }

/** 执行处置操作后的状态；不改变状态的操作原样返回 */
export function nextStatus(status: HandleStatus, action: EnvAction): HandleStatus {
  if (action === 'dispatch' && status === '待处置') return '核查中'
  if (action === 'close' && status === '核查中') return '已办结'
  return status
}

/** 按处置状态给出的操作按钮（最多两个，第一个为主按钮） */
function statusActions(status: HandleStatus, dispatchLabel: string, locateLabel: string): { key: EnvAction; label: string }[] {
  const locate = { key: 'locate' as const, label: locateLabel }
  if (status === '待处置') return [{ key: 'dispatch', label: dispatchLabel }, locate]
  if (status === '核查中') return [{ key: 'close', label: '标记办结' }, locate]
  return [locate]
}

/** 污染源与投诉的详情卡片内容 */
export function sourceDetail(source: PollutionSource, status: HandleStatus): DetailModel {
  return {
    tag: { text: LEVEL_NAMES[source.level], color: LEVEL_COLOR[source.level] },
    title: source.name,
    rows: [
      { label: '类型', value: source.type },
      { label: '所在片区', value: source.districtName },
      { label: '发现时间', value: source.time },
      { label: '处置进度', value: source.note },
      { label: '处置状态', value: status }
    ],
    actions: statusActions(status, '派发核查', '定位污染源')
  }
}

/** 近岸水质采样点的详情卡片内容；超标点（三、四类）带处置状态和派发复测 */
export function waterDetail(sample: WaterSample, status: HandleStatus | null): DetailModel {
  const w = sample.indicators
  const over = waterExceedance(sample)
  const rows = [
    { label: '水质类别', value: WATER_GRADE_NAMES[sample.grade] + (over ? ` · 超二类标准（${over.name}）` : ' · 达标') },
    { label: 'pH', value: w.ph.toFixed(2) },
    { label: '采样时间', value: '今日 ' + sample.sampledAt },
    { label: '考核标准', value: '二类：溶解氧 > 5、无机氮 ≤ 0.3、活性磷酸盐 ≤ 0.03 mg/L' }
  ]
  if (over && status) rows.push({ label: '处置状态', value: status })
  return {
    tag: { text: WATER_GRADE_NAMES[sample.grade], color: WATER_COLORS[sample.grade] },
    title: sample.name,
    stats: [
      { label: '溶解氧', value: w.do.toFixed(1), unit: 'mg/L', color: w.do <= WATER_LIMIT.do ? COLOR.warn : undefined },
      { label: '无机氮', value: w.din.toFixed(2), unit: 'mg/L', color: w.din > WATER_LIMIT.din ? COLOR.warn : undefined },
      { label: '活性磷酸盐', value: w.po4.toFixed(3), unit: 'mg/L', color: w.po4 > WATER_LIMIT.po4 ? COLOR.warn : undefined }
    ],
    rows,
    actions: over && status ? statusActions(status, '派发复测', '定位采样点') : [{ key: 'locate', label: '定位采样点' }]
  }
}
