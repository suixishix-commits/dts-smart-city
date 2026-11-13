import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

vi.mock('@/stores', async () => {
  const { reactive } = await import('vue')
  return { default: { dtsStore: reactive({ sceneState: 'connecting' }) } }
})

import store from '@/stores'
import AppHeader from '../AppHeader.vue'

function mountHeader() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
  })
  return mount(AppHeader, { global: { plugins: [router] } })
}

describe('AppHeader', () => {
  beforeEach(() => {
    store.dtsStore.sceneState = 'connecting'
  })

  it('renders only ready modules as links', () => {
    const w = mountHeader()
    expect(w.findAll('nav a').map(a => a.text())).toEqual(['城市总览'])
  })

  it('renders modules that are not ready as disabled text that cannot be focused or activated', () => {
    const w = mountHeader()
    const disabled = w.findAll('nav span.tab.disabled')
    expect(disabled.map(s => s.text())).toEqual(['智慧交通', '公共安全', '生态环境', '城市生命线'])
    disabled.forEach(s => {
      expect(s.attributes('aria-disabled')).toBe('true')
      expect(s.attributes('href')).toBeUndefined()
      expect(s.attributes('tabindex')).toBeUndefined()
    })
  })

  it('announces the connection status', async () => {
    const w = mountHeader()
    expect(w.find('[role="status"]').text()).toBe('场景连接中…')
    store.dtsStore.sceneState = 'failed'
    await w.vm.$nextTick()
    expect(w.find('[role="status"]').text()).toBe('场景未连接')
    store.dtsStore.sceneState = 'ready'
    await w.vm.$nextTick()
    expect(w.find('[role="status"]').exists()).toBe(false)
  })
})
