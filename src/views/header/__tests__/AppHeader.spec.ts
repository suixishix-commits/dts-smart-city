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

  it('renders all five modules as links, in order', () => {
    const w = mountHeader()
    expect(w.findAll('nav a').map(a => a.text())).toEqual(['城市总览', '智慧交通', '公共安全', '生态环境', '城市生命线'])
  })

  it('links each module to its route', () => {
    const w = mountHeader()
    expect(w.findAll('nav a').map(a => a.attributes('href'))).toEqual(['/overview', '/traffic', '/security', '/environment', '/lifeline'])
  })

  it('has no disabled module left', () => {
    const w = mountHeader()
    expect(w.findAll('nav .tab.disabled')).toEqual([])
    expect(w.findAll('nav [aria-disabled="true"]')).toEqual([])
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
