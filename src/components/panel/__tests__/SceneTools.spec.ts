import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SceneTools from '../SceneTools.vue'

describe('SceneTools', () => {
  it('renders eight tools with accessible names', () => {
    const w = mount(SceneTools)
    const names = w.findAll('button').map(b => b.attributes('aria-label'))
    expect(names).toEqual(['图层管理', '城市巡航', '测量', '昼夜切换', '天气模拟', '截图', '视角复位', '全屏'])
  })

  it('disables tools that are not implemented yet', () => {
    const w = mount(SceneTools)
    const disabled = w.findAll('button').filter(b => b.attributes('disabled') !== undefined).map(b => b.attributes('aria-label'))
    expect(disabled).toEqual(['图层管理', '城市巡航', '测量', '截图'])
  })

  it('emits the tool key when an enabled tool is clicked', async () => {
    const w = mount(SceneTools)
    await w.find('button[aria-label="视角复位"]').trigger('click')
    expect(w.emitted('tool')![0]).toEqual(['reset'])
  })

  it('marks toggle tools as pressed when active', () => {
    const w = mount(SceneTools, { props: { active: ['night'] } })
    expect(w.find('button[aria-label="昼夜切换"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('button[aria-label="天气模拟"]').attributes('aria-pressed')).toBe('false')
  })
})
