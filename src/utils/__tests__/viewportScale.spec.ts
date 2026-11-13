import { afterEach, describe, expect, it } from 'vitest'
import { designPxToRem, getReViewportScale, scaleOptionSizes, scalePx } from '../viewportScale'

/** 一个按设计稿 px 写的折线图 option */
function designOption() {
  const formatter = (v: number) => v + ' 万人'
  const data = [
    [0, 62],
    [12, 80],
    [24, 66]
  ]
  const categories = ['00:00', '12:00', '24:00']
  return {
    grid: { left: 40, right: 16, top: 24, bottom: '12%', containLabel: true },
    legend: { left: 10, itemWidth: 12, itemHeight: 8, itemGap: 16, textStyle: { fontSize: 12 } },
    tooltip: { trigger: 'axis', padding: [8, 12], textStyle: { fontSize: 13 }, formatter },
    xAxis: { type: 'category', data: categories, axisLabel: { fontSize: 12, margin: 10 }, axisLine: { lineStyle: { width: 1, color: '#2a3340' } } },
    yAxis: { type: 'value', min: 50, max: 100, splitNumber: 5, axisLabel: { fontSize: 12, formatter } },
    series: [
      { type: 'line', smooth: true, symbolSize: 6, lineStyle: { width: 2, color: '#4c9aff' }, areaStyle: { opacity: 0.2 }, data },
      { type: 'bar', barWidth: 10, itemStyle: { borderRadius: [4, 4, 0, 0] }, label: { show: true, distance: 6, fontSize: 11 }, data: [{ value: 5, symbolSize: 10, itemStyle: { borderWidth: 2 } }] }
    ]
  }
}

describe('scaleOptionSizes', () => {
  it('scales font sizes wherever they appear', () => {
    const out = scaleOptionSizes(designOption(), 2)
    expect(out.legend.textStyle.fontSize).toBe(24)
    expect(out.tooltip.textStyle.fontSize).toBe(26)
    expect(out.xAxis.axisLabel.fontSize).toBe(24)
    expect(out.yAxis.axisLabel.fontSize).toBe(24)
    expect(out.series[1].label.fontSize).toBe(22)
  })

  it('scales numeric grid offsets and leaves percentages alone', () => {
    const out = scaleOptionSizes(designOption(), 2)
    expect(out.grid).toEqual({ left: 80, right: 32, top: 48, bottom: '12%', containLabel: true })
  })

  it('treats left/right/top/bottom as pixel offsets only directly inside grid', () => {
    const out = scaleOptionSizes({ ...designOption(), title: { left: 10, top: 6 }, grid: { left: 40, nested: { left: 40 } } }, 2)
    expect(out.legend.left).toBe(10)
    expect(out.title).toEqual({ left: 10, top: 6 })
    expect(out.grid.left).toBe(80)
    expect(out.grid.nested.left).toBe(40)
  })

  it('scales every grid of a multi-grid option', () => {
    const out = scaleOptionSizes({ grid: [{ left: 10 }, { left: 20, top: '5%' }] }, 1.5)
    expect(out.grid).toEqual([{ left: 15 }, { left: 30, top: '5%' }])
  })

  it('scales lineStyle.width and other pixel sizes', () => {
    const out = scaleOptionSizes(designOption(), 2)
    expect(out.series[0].lineStyle.width).toBe(4)
    expect(out.xAxis.axisLine.lineStyle.width).toBe(2)
    expect(out.series[0].symbolSize).toBe(12)
    expect(out.series[1].barWidth).toBe(20)
    expect(out.series[1].label.distance).toBe(12)
    expect(out.xAxis.axisLabel.margin).toBe(20)
    expect(out.legend).toMatchObject({ itemWidth: 24, itemHeight: 16, itemGap: 32 })
  })

  it('scales numeric arrays of size fields element by element', () => {
    const out = scaleOptionSizes(designOption(), 2)
    expect(out.tooltip.padding).toEqual([16, 24])
    expect(out.series[1].itemStyle.borderRadius).toEqual([8, 8, 0, 0])
  })

  it('leaves data arrays untouched, including size-like fields inside data items', () => {
    const option = designOption()
    const out = scaleOptionSizes(option, 2)
    expect(out.series[0].data).toBe(option.series[0].data)
    expect(out.xAxis.data).toBe(option.xAxis.data)
    expect(out.series[1].data).toBe(option.series[1].data)
    expect(out.series[1].data[0]).toEqual({ value: 5, symbolSize: 10, itemStyle: { borderWidth: 2 } })
  })

  it('leaves formatter functions untouched', () => {
    const option = designOption()
    const out = scaleOptionSizes(option, 2)
    expect(out.tooltip.formatter).toBe(option.tooltip.formatter)
    expect(out.yAxis.axisLabel.formatter).toBe(option.yAxis.axisLabel.formatter)
    expect(out.yAxis.axisLabel.formatter(80)).toBe('80 万人')
  })

  it('leaves non-size values untouched', () => {
    const out = scaleOptionSizes(designOption(), 2)
    expect(out.yAxis).toMatchObject({ type: 'value', min: 50, max: 100, splitNumber: 5 })
    expect(out.series[0]).toMatchObject({ type: 'line', smooth: true, areaStyle: { opacity: 0.2 } })
    expect(out.series[0].lineStyle.color).toBe('#4c9aff')
    expect(out.tooltip.trigger).toBe('axis')
  })

  it('keeps string sizes and falls back to recursion for non-numeric size values', () => {
    const symbolSize = (v: number[]) => v[1] / 10
    const out = scaleOptionSizes({ series: [{ width: '60%', symbolSize, padding: { fontSize: 10 } }] }, 2)
    expect(out.series[0].width).toBe('60%')
    expect(out.series[0].symbolSize).toBe(symbolSize)
    expect(out.series[0].padding).toEqual({ fontSize: 20 })
  })

  it('rounds to one decimal place', () => {
    expect(scaleOptionSizes({ fontSize: 13 }, 1.25).fontSize).toBe(16.3)
    expect(scaleOptionSizes({ fontSize: 12 }, 0.5625).fontSize).toBe(6.8)
  })

  it('returns a copy and does not modify the design option', () => {
    const option = designOption()
    const snapshot = JSON.stringify(option)
    const out = scaleOptionSizes(option, 2)
    expect(out).not.toBe(option)
    expect(out.series).not.toBe(option.series)
    expect(out.grid).not.toBe(option.grid)
    expect(JSON.stringify(option)).toBe(snapshot)
  })

  it('is the identity for a ratio of 1', () => {
    const option = designOption()
    expect(scaleOptionSizes(option, 1)).toEqual(option)
  })

  it('passes through primitives, null and class instances', () => {
    const date = new Date(0)
    expect(scaleOptionSizes(5, 2)).toBe(5)
    expect(scaleOptionSizes('a', 2)).toBe('a')
    expect(scaleOptionSizes(null, 2)).toBeNull()
    expect(scaleOptionSizes({ when: date, fontSize: 10 }, 2)).toEqual({ when: date, fontSize: 20 })
  })
})

describe('跟随根字号的缩放倍数', () => {
  afterEach(() => {
    document.documentElement.style.fontSize = ''
  })

  it('derives the scale from the root font size (10px = 1)', () => {
    document.documentElement.style.fontSize = '10px'
    expect(getReViewportScale()).toBe(1)
    document.documentElement.style.fontSize = '12.5px'
    expect(getReViewportScale()).toBe(1.25)
    document.documentElement.style.fontSize = '7.5px'
    expect(getReViewportScale()).toBe(0.75)
  })

  it('scalePx rounds design px to whole viewport px', () => {
    document.documentElement.style.fontSize = '12.5px'
    expect(scalePx(12)).toBe(15)
    expect(scalePx(13)).toBe(16)
  })

  it('scaleOptionSizes uses the current root font size by default', () => {
    document.documentElement.style.fontSize = '20px'
    expect(scaleOptionSizes({ grid: { left: 40 }, textStyle: { fontSize: 12 } })).toEqual({ grid: { left: 80 }, textStyle: { fontSize: 24 } })
  })
})

describe('designPxToRem', () => {
  it('converts design px to rem at 10px per rem', () => {
    expect(designPxToRem(800)).toBe('80rem')
    expect(designPxToRem('800px')).toBe('80rem')
    expect(designPxToRem(' 12.5px ')).toBe('1.25rem')
  })

  it('returns other units unchanged', () => {
    for (const v of ['50%', '10vw', '2rem', 'calc(100% - 20px)', 'auto']) expect(designPxToRem(v)).toBe(v)
  })
})
