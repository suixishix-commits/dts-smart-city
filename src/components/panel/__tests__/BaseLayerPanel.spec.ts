import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BaseLayerPanel from '../BaseLayerPanel.vue'

const state = { roads: true, ambience: true, cloud: false }

describe('BaseLayerPanel', () => {
  it('lists the three base layers with their names', () => {
    const w = mount(BaseLayerPanel, { props: { state } })
    expect(w.findAll('.name').map(n => n.text())).toEqual(['路网流光', '黄昏底图', '云层'])
    expect(w.attributes('role')).toBe('group')
    expect(w.attributes('aria-label')).toBe('底图图层')
  })

  it('reflects the state in the checkboxes', () => {
    const w = mount(BaseLayerPanel, { props: { state } })
    expect(w.findAll('input[type="checkbox"]').map(i => (i.element as HTMLInputElement).checked)).toEqual([true, true, false])
  })

  it('follows state changes from the parent', async () => {
    const w = mount(BaseLayerPanel, { props: { state } })
    await w.setProps({ state: { roads: false, ambience: true, cloud: true } })
    expect(w.findAll('input[type="checkbox"]').map(i => (i.element as HTMLInputElement).checked)).toEqual([false, true, true])
  })

  it('emits change with the layer key and the new value when a box is unticked', async () => {
    const w = mount(BaseLayerPanel, { props: { state } })
    await w.findAll('input[type="checkbox"]')[0].setValue(false)
    expect(w.emitted('change')).toEqual([['roads', false]])
  })

  it('emits change for each layer with its own key', async () => {
    const w = mount(BaseLayerPanel, { props: { state } })
    const boxes = w.findAll('input[type="checkbox"]')
    await boxes[1].setValue(false)
    await boxes[2].setValue(true)
    expect(w.emitted('change')).toEqual([
      ['ambience', false],
      ['cloud', true]
    ])
  })

  it('does not change the state object itself', async () => {
    const own = { ...state }
    const w = mount(BaseLayerPanel, { props: { state: own } })
    await w.findAll('input[type="checkbox"]')[0].setValue(false)
    expect(own).toEqual(state)
  })

  it('makes the whole row clickable by wrapping each checkbox in a label', () => {
    const w = mount(BaseLayerPanel, { props: { state } })
    const labels = w.findAll('label')
    expect(labels).toHaveLength(3)
    labels.forEach(l => expect(l.find('input[type="checkbox"]').exists()).toBe(true))
  })
})
