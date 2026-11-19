import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SceneTools from '../SceneTools.vue'

const tools = (w: ReturnType<typeof mount>) => w.find('[aria-label="场景工具"]').findAll('button')
const view = (w: ReturnType<typeof mount>) => w.find('[aria-label="视角"]').findAll('button')

describe('SceneTools', () => {
  it('renders eight tools with accessible names', () => {
    const w = mount(SceneTools)
    expect(tools(w).map(b => b.attributes('aria-label'))).toEqual(['图层管理', '城市巡航', '测量', '昼夜切换', '天气模拟', '截图', '视角复位', '全屏'])
  })

  it('enables all eight tools, with no "later version" hint left in the tooltips', () => {
    const buttons = tools(mount(SceneTools))
    expect(buttons).toHaveLength(8)
    expect(buttons.filter(b => b.attributes('disabled') !== undefined)).toEqual([])
    expect(buttons.map(b => b.attributes('title'))).toEqual(buttons.map(b => b.attributes('aria-label')))
  })

  it('emits the key of every tool when clicked, in toolbar order', async () => {
    const w = mount(SceneTools)
    for (const b of tools(w)) await b.trigger('click')
    expect(w.emitted('tool')).toEqual([['layers'], ['tour'], ['measure'], ['night'], ['rain'], ['snapshot'], ['reset'], ['fullscreen']])
  })

  it('exposes both groups as toolbars and no scene tool is pressed by default', () => {
    const w = mount(SceneTools)
    expect(w.find('[aria-label="场景工具"]').attributes('role')).toBe('toolbar')
    expect(w.find('[aria-label="视角"]').attributes('role')).toBe('toolbar')
    expect(tools(w).filter(b => b.classes('on'))).toEqual([])
  })

  it('marks toggle tools as pressed when active', () => {
    const w = mount(SceneTools, { props: { active: ['night'] } })
    expect(w.find('button[aria-label="昼夜切换"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('button[aria-label="天气模拟"]').attributes('aria-pressed')).toBe('false')
  })

  it('can show several tools as pressed at once and follows prop changes', async () => {
    const w = mount(SceneTools, { props: { active: ['layers', 'tour', 'measure'] } })
    expect(tools(w).filter(b => b.classes('on')).map(b => b.attributes('aria-label'))).toEqual(['图层管理', '城市巡航', '测量'])
    await w.setProps({ active: ['rain'] })
    expect(tools(w).filter(b => b.classes('on')).map(b => b.attributes('aria-label'))).toEqual(['天气模拟'])
  })
})

describe('SceneTools view controls', () => {
  it('shows 2D / 3D with the current mode highlighted, then zoom and rotate', () => {
    const w = mount(SceneTools)
    expect(view(w).map(b => b.attributes('aria-label'))).toEqual(['俯视 2D', '斜视 3D', '拉近', '拉远', '向左旋转', '向右旋转'])
    expect(view(w).filter(b => b.classes('on')).map(b => b.text())).toEqual(['3D'])
  })

  it('switches mode only from the other button', async () => {
    const w = mount(SceneTools)
    await view(w)[1].trigger('click') // 已经是 3D，点 3D 不动
    expect(w.emitted('tool')).toBeUndefined()
    await view(w)[0].trigger('click')
    expect(w.emitted('tool')).toEqual([['topdown']])
    await w.setProps({ active: ['topdown'] })
    expect(view(w).filter(b => b.classes('on')).map(b => b.text())).toEqual(['2D'])
    await view(w)[1].trigger('click')
    expect(w.emitted('tool')).toEqual([['topdown'], ['topdown']])
  })

  it('emits zoom and rotate keys', async () => {
    const w = mount(SceneTools)
    for (const b of view(w).slice(2)) await b.trigger('click')
    expect(w.emitted('tool')).toEqual([['zoomIn'], ['zoomOut'], ['rotateLeft'], ['rotateRight']])
  })
})
