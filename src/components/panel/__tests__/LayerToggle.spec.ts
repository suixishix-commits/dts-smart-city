import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LayerToggle from '../LayerToggle.vue'

const layers = [
  { key: 'heat', name: '人口热力' },
  { key: 'camera', name: '摄像头' }
]

describe('LayerToggle', () => {
  it('marks active layers as pressed', () => {
    const w = mount(LayerToggle, { props: { layers, modelValue: ['heat'] } })
    const buttons = w.findAll('button')
    expect(buttons[0].attributes('aria-pressed')).toBe('true')
    expect(buttons[1].attributes('aria-pressed')).toBe('false')
  })

  it('emits the new list when a layer is switched on', async () => {
    const w = mount(LayerToggle, { props: { layers, modelValue: ['heat'] } })
    await w.findAll('button')[1].trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual([['heat', 'camera']])
    expect(w.emitted('change')![0]).toEqual(['camera', true])
  })

  it('emits the new list when a layer is switched off', async () => {
    const w = mount(LayerToggle, { props: { layers, modelValue: ['heat'] } })
    await w.findAll('button')[0].trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual([[]])
    expect(w.emitted('change')![0]).toEqual(['heat', false])
  })
})
