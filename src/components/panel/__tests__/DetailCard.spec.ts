import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DetailCard from '../DetailCard.vue'

const stubs = { CameraFeed: { props: ['cameraId', 'online'], template: '<div class="feed-stub">{{ cameraId }}</div>' } }

describe('DetailCard', () => {
  it('shows the title, stats and rows', () => {
    const w = mount(DetailCard, { props: { detail: { title: '多车追尾', stats: [{ label: '排队', value: 640, unit: 'm' }], rows: [{ label: '位置', value: '科尼什路' }] } }, global: { stubs } })
    expect(w.text()).toContain('多车追尾')
    expect(w.text()).toContain('640')
    expect(w.text()).toContain('科尼什路')
    expect(w.find('.feed-stub').exists()).toBe(false)
    expect(w.find('.actions').exists()).toBe(false)
  })

  it('shows the linked camera feed', () => {
    const w = mount(DetailCard, { props: { detail: { title: 'x', rows: [], camera: { id: 'CAM-0218', online: true } } }, global: { stubs } })
    expect(w.find('.feed-stub').text()).toBe('CAM-0218')
  })

  it('renders at most two actions, the first as primary, and emits the key on click', async () => {
    const actions = [
      { key: 'video', label: '查看周边视频' },
      { key: 'detour', label: '绕行方案' },
      { key: 'extra', label: '多余' }
    ]
    const w = mount(DetailCard, { props: { detail: { title: 'x', rows: [], actions } }, global: { stubs } })
    const buttons = w.findAll('.actions button')
    expect(buttons.map(b => b.text())).toEqual(['查看周边视频', '绕行方案'])
    expect(buttons[0].classes()).toContain('primary')
    await buttons[1].trigger('click')
    expect(w.emitted('action')![0]).toEqual(['detour'])
  })
})
