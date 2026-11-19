import { describe, expect, it } from 'vitest'
import router from '../index'

describe('router', () => {
  it('redirects unknown paths to the overview instead of leaving the layout', () => {
    for (const path of ['/no/such/page', '/overview/extra', '/app/unknown']) {
      const matched = router.resolve(path).matched
      expect(matched).toHaveLength(1)
      expect(matched[0].redirect).toBe('/overview')
    }
  })

  it('redirects the root to the overview', () => {
    const matched = router.resolve('/').matched
    expect(matched).toHaveLength(1)
    expect(matched[0].redirect).toBe('/overview')
  })

  it('still resolves the overview inside the layout', () => {
    expect(router.resolve('/overview').matched.map(r => r.name)).toEqual(['app', 'overview'])
  })

  it('resolves the four other modules inside the same layout', () => {
    for (const name of ['traffic', 'security', 'environment', 'lifeline']) {
      const route = router.resolve('/' + name)
      expect(route.name).toBe(name)
      expect(route.matched.map(r => r.name)).toEqual(['app', name])
    }
  })

  it('registers the five module routes and the heat demo under the layout', () => {
    const modules = router.getRoutes().filter(r => r.name && r.name !== 'app')
    expect(modules.map(r => r.name).sort()).toEqual(['environment', 'heatmap', 'lifeline', 'overview', 'security', 'traffic'])
    expect(modules.every(r => typeof r.components?.default === 'function')).toBe(true)
  })
})
