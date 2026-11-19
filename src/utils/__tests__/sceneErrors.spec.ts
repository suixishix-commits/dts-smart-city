import { afterEach, describe, expect, it, vi } from 'vitest'
import { installSceneErrorHandling, isDisconnected, resetDisconnectWarning, warnDisconnected } from '../sceneErrors'

describe('sceneErrors', () => {
  afterEach(() => {
    resetDisconnectWarning()
    vi.restoreAllMocks()
  })

  it('recognises the renderer disconnect error only', () => {
    expect(isDisconnected(new Error('Not connected!'))).toBe(true)
    expect(isDisconnected('Not connected!')).toBe(true)
    expect(isDisconnected(new Error('add: id already exists'))).toBe(false)
  })

  it('warns once per disconnect', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnDisconnected()
    warnDisconnected()
    expect(warn).toHaveBeenCalledTimes(1)
    resetDisconnectWarning()
    warnDisconnected()
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('swallows disconnect errors in Vue and passes others on', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const previous = vi.fn()
    const app = { config: { errorHandler: previous as unknown } }
    installSceneErrorHandling(app)
    const handler = app.config.errorHandler as (err: unknown, i: unknown, info: string) => void
    handler(new Error('Not connected!'), null, 'watcher callback')
    expect(previous).not.toHaveBeenCalled()
    const other = new Error('boom')
    handler(other, null, 'setup')
    expect(previous).toHaveBeenCalledWith(other, null, 'setup')
  })
})
