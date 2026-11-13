import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BarRow from '../BarRow.vue'

function fillWidth(percent: number) {
  const w = mount(BarRow, { props: { name: 'a', value: 1, percent } })
  return (w.find('.fill').element as HTMLElement).style.width
}

describe('BarRow', () => {
  it('uses the percent as the bar width', () => {
    expect(fillWidth(42)).toBe('42%')
  })

  it('clamps the bar width to the 0-100 range', () => {
    expect(fillWidth(150)).toBe('100%')
    expect(fillWidth(-20)).toBe('0%')
  })
})
