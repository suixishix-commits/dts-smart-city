import { describe, expect, it } from 'vitest'
import { drawLabel, labelLayout } from '../labelImage'

describe('labelLayout', () => {
  it('draws facilities as a 36 px icon capsule with the lead line and ground ring below it', () => {
    const l = labelLayout({ fontSize: 13, textW: 60, lead: 40 })
    expect(l.kind).toBe('pill')
    expect(l.boxH).toBe(36)
    expect(l.icon).toBe(28)
    // 左内边距 4 + 图标 28 + 间距 8
    expect(l.textX).toBe(40)
    expect(l.boxW).toBe(40 + 60 + 14)
    // 落点 = 留白 9 + 胶囊 36 + 引线 40
    expect(l.groundY).toBe(85)
    expect(l.height).toBeGreaterThan(l.groundY)
    expect(l.width).toBe(l.boxW + 18)
  })

  it('draws alarms (with a tag) as a chamfered data card: tag, text, then value', () => {
    const l = labelLayout({ fontSize: 13, textW: 60, tagTextW: 22, valueW: 30, lead: 40 })
    expect(l.kind).toBe('card')
    expect(l.boxH).toBe(34)
    expect(l.tagW).toBe(34)
    expect(l.padL).toBe(11)
    expect(l.textX).toBe(11 + 34 + 8)
    expect(l.valueX).toBe(l.textX + 60 + 10)
    expect(l.boxW).toBe(Math.ceil(l.valueX + 30 + 9 + 6))
  })

  it('makes compact capsules for small text', () => {
    const l = labelLayout({ fontSize: 11, textW: 30, lead: 16 })
    expect(l.boxH).toBe(32)
    expect(l.icon).toBe(24)
  })
})

describe('drawLabel', () => {
  it('returns null without a canvas so callers fall back to text markers', () => {
    expect(drawLabel({ text: 'A', color: '#ff0000', lead: 30 })).toBeNull()
  })
})
