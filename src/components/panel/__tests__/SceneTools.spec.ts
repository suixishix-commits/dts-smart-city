import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SceneTools from '../SceneTools.vue'

describe('SceneTools', () => {
  it('renders eight tools with accessible names', () => {
    const w = mount(SceneTools)
    const names = w.findAll('button').map(b => b.attributes('aria-label'))
    expect(names).toEqual(['图层管理', '城市巡航', '测量', '昼夜切换', '天气模拟', '截图', '视角复位', '全屏'])
  })

  it('enables all eight tools, with no "later version" hint left in the tooltips', () => {
    const w = mount(SceneTools)
    const buttons = w.findAll('button')
    expect(buttons).toHaveLength(8)
    expect(buttons.filter(b => b.attributes('disabled') !== undefined)).toEqual([])
    expect(buttons.map(b => b.attributes('title'))).toEqual(buttons.map(b => b.attributes('aria-label')))
  })

  it('emits the key of every tool when clicked, in toolbar order', async () => {
    const w = mount(SceneTools)
    for (const b of w.findAll('button')) await b.trigger('click')
    expect(w.emitted('tool')).toEqual([['layers'], ['tour'], ['measure'], ['night'], ['rain'], ['snapshot'], ['reset'], ['fullscreen']])
  })

  it('is exposed as a toolbar and no tool is pressed by default', () => {
    const w = mount(SceneTools)
    expect(w.attributes('role')).toBe('toolbar')
    expect(w.findAll('button[aria-pressed="true"]')).toEqual([])
    expect(w.findAll('button.on')).toEqual([])
  })

  it('marks toggle tools as pressed when active', () => {
    const w = mount(SceneTools, { props: { active: ['night'] } })
    expect(w.find('button[aria-label="昼夜切换"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('button[aria-label="天气模拟"]').attributes('aria-pressed')).toBe('false')
  })

  it('can show several tools as pressed at once and follows prop changes', async () => {
    const w = mount(SceneTools, { props: { active: ['layers', 'tour', 'measure'] } })
    expect(w.findAll('button.on').map(b => b.attributes('aria-label'))).toEqual(['图层管理', '城市巡航', '测量'])
    await w.setProps({ active: ['rain'] })
    expect(w.findAll('button.on').map(b => b.attributes('aria-label'))).toEqual(['天气模拟'])
  })
})
