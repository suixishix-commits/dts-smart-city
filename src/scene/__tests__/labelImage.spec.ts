import { describe, expect, it } from 'vitest'
import { drawLabel, labelLayout } from '../labelImage'

describe('labelLayout', () => {
  it('is a 28 px pill for 13 px text, with a dot, the text and the lead line below it', () => {
    const l = labelLayout({ fontSize: 13, textW: 60, lead: 40 })
    expect(l.pillH).toBe(28)
    expect(l.tagW).toBe(0)
    // 左内边距 10 + 圆点 8 + 间距 6
    expect(l.textX).toBe(24)
    expect(l.pillW).toBe(24 + 60 + 12)
    // 落点 = 留白 9 + 胶囊 28 + 引线 40
    expect(l.groundY).toBe(77)
    expect(l.height).toBeGreaterThan(l.groundY)
    expect(l.width).toBe(l.pillW + 18)
  })

  it('puts a tag before the text and the value after it', () => {
    const l = labelLayout({ fontSize: 13, textW: 60, tagTextW: 22, valueW: 30, lead: 40 })
    expect(l.tagW).toBe(34)
    expect(l.padL).toBe(5)
    expect(l.textX).toBe(5 + 34 + 7)
    expect(l.valueX).toBe(l.textX + 60 + 8)
    expect(l.pillW).toBe(Math.ceil(l.valueX + 30 + 12))
  })

  it('makes compact pills for small text', () => {
    const l = labelLayout({ fontSize: 11, textW: 30, lead: 16 })
    expect(l.pillH).toBe(24)
    expect(l.dot).toBe(6)
  })
})

describe('drawLabel', () => {
  it('returns null without a canvas so callers fall back to text markers', () => {
    expect(drawLabel({ text: 'A', color: '#ff0000', lead: 30 })).toBeNull()
  })
})
