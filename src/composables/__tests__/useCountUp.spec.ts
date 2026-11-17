import { describe, expect, it } from 'vitest'
import { formatLike, parseNumeric } from '../useCountUp'

describe('useCountUp helpers', () => {
  it('parses numbers with separators and signs, and rejects text', () => {
    expect(parseNumeric('1,203')).toBe(1203)
    expect(parseNumeric('-2.5')).toBe(-2.5)
    expect(parseNumeric('62.4')).toBe(62.4)
    expect(parseNumeric('良')).toBeNull()
    expect(parseNumeric('+0.25')).toBeNull()
  })

  it('formats an in-between value like the target text', () => {
    expect(formatLike('1,203', 987.6)).toBe('988')
    expect(formatLike('48,620', 12345.4)).toBe('12,345')
    expect(formatLike('95.3', 40)).toBe('40.0')
    expect(formatLike('-2.50', -1)).toBe('-1.00')
  })
})
