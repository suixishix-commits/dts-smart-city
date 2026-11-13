import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TimeAxis from '../TimeAxis.vue'

describe('TimeAxis', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows the current time as HH:mm', () => {
    const w = mount(TimeAxis, { props: { modelValue: 14.5, peakHour: 19.5 } })
    expect(w.find('.now').text()).toBe('14:30')
  })

  it('emits the slider value on input', async () => {
    const w = mount(TimeAxis, { props: { modelValue: 14.5, peakHour: 19.5 } })
    const input = w.find('input[type="range"]')
    await input.setValue('8')
    expect(w.emitted('update:modelValue')![0]).toEqual([8])
  })

  it('advances half an hour per tick while playing', async () => {
    const w = mount(TimeAxis, { props: { modelValue: 14.5, peakHour: 19.5 } })
    await w.find('button.play').trigger('click')
    vi.advanceTimersByTime(800)
    expect(w.emitted('update:modelValue')![0]).toEqual([15])
  })

  it('wraps to 0 after 24', async () => {
    const w = mount(TimeAxis, { props: { modelValue: 24, peakHour: 19.5 } })
    await w.find('button.play').trigger('click')
    vi.advanceTimersByTime(800)
    expect(w.emitted('update:modelValue')![0]).toEqual([0])
  })

  it('stops emitting after pause', async () => {
    const w = mount(TimeAxis, { props: { modelValue: 10, peakHour: 19.5 } })
    await w.find('button.play').trigger('click')
    await w.find('button.play').trigger('click')
    vi.advanceTimersByTime(2000)
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})
