import { describe, expect, it } from 'vitest'
import { hourText, numberText, tooltipHtml, withTooltip } from '../chartTooltip'

describe('chartTooltip', () => {
  it('formats hours and numbers', () => {
    expect(hourText(9.5)).toBe('09:30')
    expect(hourText(0)).toBe('00:00')
    expect(numberText(28640)).toBe('28,640')
    expect(numberText(1.23456)).toBe('1.23')
  })

  it('lists each series once, with the hour as the heading', () => {
    const html = tooltipHtml(
      [
        { seriesName: '今日', color: '#4c9aff', value: [9.5, 1.234], axisValue: 9.5 },
        { seriesName: '今日', color: '#4c9aff', value: [9.5, 1.234], axisValue: 9.5 },
        { seriesName: '昨日', color: '#5f6b7a', value: [9.5, null], axisValue: 9.5 },
        { seriesName: '<b>', value: 3, axisValue: 9.5 }
      ],
      true
    )
    expect(html).toContain('09:30')
    expect(html.match(/今日/g)).toHaveLength(1)
    expect(html).not.toContain('昨日')
    expect(html).toContain('1.23')
    expect(html).toContain('&lt;b&gt;')
  })

  it('adds an axis tooltip but keeps fields the chart set itself', () => {
    const o = withTooltip({ xAxis: { type: 'value', max: 24 }, tooltip: { trigger: 'item' } })
    expect(o.tooltip.trigger).toBe('item')
    expect(o.tooltip.confine).toBe(true)
    expect(typeof o.tooltip.formatter).toBe('function')
  })
})
