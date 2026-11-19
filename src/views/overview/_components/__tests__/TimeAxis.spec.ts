import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TimeAxis from '../TimeAxis.vue'

const emitted = (w: ReturnType<typeof mount>) => (w.emitted('update:modelValue') ?? []).map(e => e[0] as number)

describe('TimeAxis', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] }))
  afterEach(() => vi.useRealTimers())

  it('shows the current time as HH:mm', () => {
    const w = mount(TimeAxis, { props: { modelValue: 14.5, peakHour: 19.5 } })
    expect(w.find('.now').text()).toBe('14:30')
  })

  it('emits the keyboard slider value', async () => {
    const w = mount(TimeAxis, { props: { modelValue: 14.5, peakHour: 19.5 } })
    await w.find('input[type="range"]').setValue('8')
    expect(emitted(w)).toEqual([8])
  })

  it('moves the clock continuously while playing, but only emits on half-hour boundaries', async () => {
    const w = mount(TimeAxis, { props: { modelValue: 14.5, peakHour: 19.5 } })
    await w.find('button.play').trigger('click')
    // 每秒 0.8 小时：1 秒后约 15:18，分钟在走；对外只发过 15:00
    vi.advanceTimersByTime(1000)
    await w.vm.$nextTick()
    const shown = w.find('.now').text()
    expect(shown > '15:00' && shown < '15:30').toBe(true)
    expect(emitted(w)).toEqual([15])
  })

  it('plays faster at a higher rate and cycles 1× → 2× → 4× → 1×', async () => {
    const w = mount(TimeAxis, { props: { modelValue: 10, peakHour: 19.5 } })
    const speed = w.find('button.speed')
    expect(speed.text()).toBe('1×')
    await speed.trigger('click')
    await speed.trigger('click')
    expect(speed.text()).toBe('4×')
    await w.find('button.play').trigger('click')
    // 4 倍：1 秒走 3.2 小时，从 10:00 到约 13:12，对外发过 10:30 … 13:00
    vi.advanceTimersByTime(1000)
    await w.vm.$nextTick()
    expect(emitted(w).at(-1)).toBe(13)
    await speed.trigger('click')
    expect(speed.text()).toBe('1×')
  })

  it('wraps to 0 after 24', async () => {
    const w = mount(TimeAxis, { props: { modelValue: 24, peakHour: 19.5 } })
    await w.find('button.play').trigger('click')
    vi.advanceTimersByTime(1000)
    expect(emitted(w)[0]).toBe(0)
  })

  it('snaps to the half hour and stops after pause', async () => {
    const w = mount(TimeAxis, { props: { modelValue: 10, peakHour: 19.5 } })
    await w.find('button.play').trigger('click')
    vi.advanceTimersByTime(400)
    await w.find('button.play').trigger('click')
    const count = emitted(w).length
    vi.advanceTimersByTime(3000)
    expect(emitted(w).length).toBe(count)
    expect(w.find('.now').text()).toMatch(/:(00|30)$/)
  })

  it('marks the live time and labels it when the axis is at it', () => {
    const w = mount(TimeAxis, { props: { modelValue: 10, peakHour: 19.5, nowHour: 10 } })
    expect(w.find('.live-mark').exists()).toBe(true)
    expect(w.find('.mode').text()).toBe('实时')
    const other = mount(TimeAxis, { props: { modelValue: 8, peakHour: 19.5, nowHour: 10 } })
    expect(other.find('.mode').text()).toBe('历史时刻')
  })

  it('follows the pointer while dragging and snaps on release', async () => {
    const w = mount(TimeAxis, { props: { modelValue: 0, peakHour: 19.5 }, attachTo: document.body })
    const track = w.find('.track').element as HTMLElement
    track.getBoundingClientRect = () => ({ left: 0, width: 240, top: 0, height: 64, right: 240, bottom: 64, x: 0, y: 0, toJSON: () => ({}) })
    // jsdom 没有 PointerEvent：用带坐标的 MouseEvent 冒充
    track.dispatchEvent(new MouseEvent('pointerdown', { clientX: 101, button: 0, bubbles: true, cancelable: true }))
    await w.vm.$nextTick()
    // 101 / 240 × 24 = 10.1 时：跟手显示 10:06，对外发 10
    expect(w.find('.now').text()).toBe('10:06')
    expect(emitted(w)).toEqual([10])
    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()
    expect(w.find('.now').text()).toBe('10:00')
    w.unmount()
  })
})
