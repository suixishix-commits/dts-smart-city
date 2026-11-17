/**
 * 图表的统一悬停提示：竖向虚线十字线 + 深色卡片（同详情卡的底色和描边），表头是时刻，下面每行一个系列：
 * 色点 · 系列名 · 加粗数值。x 轴是 0–24 的小时数值时，表头显示成 09:30。
 */

export interface TooltipParam {
  seriesName?: string
  color?: string
  value?: unknown
  axisValue?: unknown
  axisValueLabel?: string
}

/** 小时数（可带小数）→ HH:mm */
export function hourText(h: number): string {
  const total = Math.round(h * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0')
}

/** 数值最多保留两位小数；千位加逗号 */
export function numberText(v: number): string {
  return (Math.round(v * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function yOf(value: unknown): unknown {
  return Array.isArray(value) ? value[1] : value
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
}

/** 提示框内容。hourAxis 为 true 时表头按小时格式化；同名系列（同一条曲线拆成实测 + 预测两段）只列一次 */
export function tooltipHtml(params: TooltipParam[], hourAxis: boolean): string {
  if (!params.length) return ''
  const axis = params[0].axisValue
  const head = hourAxis && typeof axis === 'number' ? hourText(axis) : String(params[0].axisValueLabel ?? axis ?? '')
  const seen = new Set<string>()
  const rows = params.flatMap(p => {
    const y = yOf(p.value)
    const name = p.seriesName ?? ''
    if (y === null || y === undefined || y === '' || Number.isNaN(y) || seen.has(name)) return []
    seen.add(name)
    const value = typeof y === 'number' ? numberText(y) : escape(String(y))
    const dot = `<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color ?? '#4c9aff'};margin-right:8px"></i>`
    return [
      `<div style="display:flex;align-items:center;gap:16px;line-height:20px">` +
        `<span style="flex-grow:1;color:#9aa4b2">${dot}${escape(name)}</span>` +
        `<b style="color:#f3f5f8;font-weight:600">${value}</b></div>`
    ]
  })
  return `<div style="font-weight:600;color:#f3f5f8;margin-bottom:6px">${escape(head)}</div>` + rows.join('')
}

interface ChartOption {
  xAxis?: unknown
  tooltip?: Record<string, unknown>
  [key: string]: unknown
}

/** 默认的 tooltip 配置；option 里自己写了 tooltip 的，以它为准、缺的字段用这里的补上 */
export function withTooltip<T extends ChartOption>(option: T): T & { tooltip: Record<string, unknown> } {
  const x = (Array.isArray(option.xAxis) ? option.xAxis[0] : option.xAxis) as { type?: string; max?: number } | undefined
  const hourAxis = x?.type === 'value' && x?.max === 24
  const base = {
    trigger: 'axis',
    confine: true,
    backgroundColor: 'rgba(17,22,30,0.96)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    padding: [10, 12],
    textStyle: { color: '#e6eaf0', fontSize: 12 },
    extraCssText: 'border-radius:6px;box-shadow:0 6px 16px rgba(0,0,0,0.45);min-width:140px',
    axisPointer: { type: 'line', lineStyle: { color: 'rgba(255,255,255,0.35)', type: 'dashed', width: 1 } },
    formatter: (params: TooltipParam | TooltipParam[]) => tooltipHtml(Array.isArray(params) ? params : [params], hourAxis)
  }
  return { ...option, tooltip: { ...base, ...(option.tooltip ?? {}) } }
}
