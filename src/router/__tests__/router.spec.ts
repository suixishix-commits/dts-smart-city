import { describe, expect, it } from 'vitest'
import router from '../index'

describe('router', () => {
  it('redirects unknown paths to the overview instead of leaving the layout', () => {
    for (const path of ['/traffic', '/no/such/page']) {
      const matched = router.resolve(path).matched
      expect(matched).toHaveLength(1)
      expect(matched[0].redirect).toBe('/overview')
    }
  })

  it('still resolves the overview inside the layout', () => {
    expect(router.resolve('/overview').matched.map(r => r.name)).toEqual(['app', 'overview'])
  })
})
