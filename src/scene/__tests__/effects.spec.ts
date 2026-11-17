import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** effects.ts 在模块级缓存挂载结果和已加载的库，每个用例重新加载模块 */
async function load() {
  vi.resetModules()
  return import('../effects')
}

const PAK = 'D:/effects/bundle.pak'

function stubXapi(overrides: Record<string, unknown> = {}) {
  const xapi = {
    customObject: {
      delete: vi.fn(async () => ({ result: 0 })),
      add: vi.fn(async () => ({ result: 0 })),
      getBPFunction: vi.fn(async () => ({ data: [{ params: [{ name: 'fn' }] }] }))
    },
    infoTree: {
      get: vi.fn(async () => ({
        infotree: [
          { iD: 'terrain-1', type: 'EPT_Scene' },
          { iD: 'folder', type: 'EPT_Folder' },
          { iD: 'terrain-2', type: 'EPT_Scene' }
        ]
      }))
    },
    tileLayer: { setStyle: vi.fn(async () => ({ result: 0 })) },
    weather: { setCloudDensity: vi.fn(async () => ({})), setDarkMode: vi.fn(async () => ({})), setDateTime: vi.fn(async () => ({})) },
    settings: { setBloomIntensity: vi.fn(async () => ({})) },
    ...overrides
  }
  vi.stubGlobal('__xapi', xapi)
  return xapi
}

describe('effects', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
    vi.unstubAllGlobals()
    document.head.querySelectorAll('script').forEach(s => s.remove())
    document.body.innerHTML = ''
  })

  describe('mountEffectsPak', () => {
    it('returns false without touching the scene when no pak path is configured', async () => {
      const xapi = stubXapi()
      vi.stubGlobal('gVar', { smartCity: { effectsPak: '' } })
      const { mountEffectsPak } = await load()
      expect(await mountEffectsPak()).toBe(false)
      expect(xapi.customObject.add).not.toHaveBeenCalled()
    })

    it('returns false when smart-city.js is not loaded at all', async () => {
      stubXapi()
      vi.stubGlobal('gVar', {})
      const { mountEffectsPak } = await load()
      expect(await mountEffectsPak()).toBe(false)
    })

    it('mounts the pak through an invisible loader custom object', async () => {
      const xapi = stubXapi()
      vi.stubGlobal('gVar', { smartCity: { effectsPak: PAK } })
      const { mountEffectsPak } = await load()
      expect(await mountEffectsPak()).toBe(true)
      // 先删后加：页面刷新后上一次的加载器还在渲染实例里
      expect(xapi.customObject.delete).toHaveBeenCalledWith(['sc_pak_loader'])
      expect(xapi.customObject.delete.mock.invocationCallOrder[0]).toBeLessThan(xapi.customObject.add.mock.invocationCallOrder[0])
      const loader = (xapi.customObject.add.mock.calls[0] as unknown[])[0] as Record<string, unknown>
      expect(loader).toMatchObject({ id: 'sc_pak_loader', pakFilePath: PAK, coordinateType: 0 })
      expect(typeof loader.assetPath).toBe('string')
      // 放在地下，画面里看不到
      expect((loader.location as number[])[2]).toBeLessThan(0)
      expect(xapi.customObject.getBPFunction).toHaveBeenCalledWith('sc_pak_loader')
      expect(warn).not.toHaveBeenCalled()
    })

    it('reports false and warns when the loader has no blueprint functions (pak not found)', async () => {
      const xapi = stubXapi()
      xapi.customObject.getBPFunction.mockResolvedValue({ data: [] } as never)
      vi.stubGlobal('gVar', { smartCity: { effectsPak: PAK } })
      const { mountEffectsPak } = await load()
      expect(await mountEffectsPak()).toBe(false)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]).toContain(PAK)
    })

    it('reports false instead of throwing when the SDK call fails', async () => {
      const xapi = stubXapi()
      xapi.customObject.add.mockRejectedValue(new Error('boom'))
      vi.stubGlobal('gVar', { smartCity: { effectsPak: PAK } })
      const { mountEffectsPak } = await load()
      expect(await mountEffectsPak()).toBe(false)
      expect(warn).toHaveBeenCalledTimes(1)
    })

    it('mounts only once', async () => {
      const xapi = stubXapi()
      vi.stubGlobal('gVar', { smartCity: { effectsPak: PAK } })
      const { mountEffectsPak } = await load()
      const [a, b] = await Promise.all([mountEffectsPak(), mountEffectsPak()])
      expect([a, b, await mountEffectsPak()]).toEqual([true, true, true])
      expect(xapi.customObject.add).toHaveBeenCalledTimes(1)
    })
  })

  describe('applyAmbience', () => {
    it('styles the terrain layers with the configured values merged over the defaults', async () => {
      const xapi = stubXapi()
      vi.stubGlobal('gVar', { smartCity: { ambience: { saturation: 0.5, bloom: 1.5 } } })
      const { applyAmbience } = await load()
      await applyAmbience()
      expect(xapi.tileLayer.setStyle).toHaveBeenCalledWith(['terrain-1', 'terrain-2'], 0, [0.78, 0.88, 1, 1], 0.5, 0.2, 1.1, 0.18)
      expect(xapi.weather.setCloudDensity).toHaveBeenCalledWith(0)
      expect(xapi.weather.setDarkMode).toHaveBeenCalledWith(false)
      expect(xapi.settings.setBloomIntensity).toHaveBeenCalledWith(1.5)
    })

    it('uses the defaults when nothing is configured', async () => {
      const xapi = stubXapi()
      vi.stubGlobal('gVar', {})
      const { applyAmbience } = await load()
      await applyAmbience()
      expect(xapi.tileLayer.setStyle).toHaveBeenCalledWith(['terrain-1', 'terrain-2'], 0, [0.78, 0.88, 1, 1], 0.75, 0.2, 1.1, 0.18)
      expect(xapi.settings.setBloomIntensity).toHaveBeenCalledWith(0.7)
    })

    it('skips the tile style when the scene has no terrain layer', async () => {
      const xapi = stubXapi({ infoTree: { get: vi.fn(async () => ({ infotree: [] })) } })
      vi.stubGlobal('gVar', {})
      const { applyAmbience } = await load()
      await applyAmbience()
      expect(xapi.tileLayer.setStyle).not.toHaveBeenCalled()
      expect(xapi.settings.setBloomIntensity).toHaveBeenCalled()
    })
  })

  describe('setNight', () => {
    const hourOf = (xapi: ReturnType<typeof stubXapi>) => (xapi.weather.setDateTime.mock.calls.at(-1) as unknown as number[])[3]

    it('puts the scene into daytime when the base starts', async () => {
      const xapi = stubXapi()
      vi.stubGlobal('gVar', {})
      const { applyAmbience } = await load()
      await applyAmbience()
      expect(hourOf(xapi)).toBeLessThan(17)
    })

    it('moves the clock past dusk and lifts the dark imagery with the night style', async () => {
      const xapi = stubXapi()
      vi.stubGlobal('gVar', {})
      const { setNight } = await load()
      await setNight(true)
      expect(hourOf(xapi)).toBeGreaterThanOrEqual(19)
      const [, , tint, saturation, brightness] = xapi.tileLayer.setStyle.mock.calls[0] as unknown as number[]
      expect(tint).toEqual([0.7, 0.85, 1, 1])
      expect(saturation).toBe(0.6)
      expect(brightness).toBeGreaterThan(1)
      expect(xapi.settings.setBloomIntensity).toHaveBeenCalledWith(1.2)

      await setNight(false)
      expect(hourOf(xapi)).toBeLessThan(17)
      expect((xapi.tileLayer.setStyle.mock.calls.at(-1) as unknown as number[])[3]).toBe(0.75)
    })

    it('keeps the night style while the ambience is switched off and on again', async () => {
      const xapi = stubXapi()
      vi.stubGlobal('gVar', { smartCity: { nightAmbience: { brightness: 3 } } })
      const { setNight, setAmbienceEnabled } = await load()
      await setNight(true)
      await setAmbienceEnabled(true)
      expect((xapi.tileLayer.setStyle.mock.calls.at(-1) as unknown as number[])[4]).toBe(3)
    })

    it('only changes the time when the ambience style is off', async () => {
      const xapi = stubXapi()
      vi.stubGlobal('gVar', {})
      const { setNight } = await load()
      await setNight(true, false)
      expect(hourOf(xapi)).toBeGreaterThanOrEqual(19)
      expect(xapi.tileLayer.setStyle).not.toHaveBeenCalled()
    })
  })

  describe('setAmbienceEnabled', () => {
    it('restores the original imagery colours when switched off', async () => {
      const xapi = stubXapi()
      vi.stubGlobal('gVar', {})
      const { setAmbienceEnabled } = await load()
      await setAmbienceEnabled(false)
      expect(xapi.tileLayer.setStyle).toHaveBeenCalledWith(['terrain-1', 'terrain-2'], 0, [1, 1, 1, 1], 1, 1, 1, 0.18)
      expect(xapi.settings.setBloomIntensity).not.toHaveBeenCalled()
    })

    it('re-applies the ambience when switched on', async () => {
      const xapi = stubXapi()
      vi.stubGlobal('gVar', {})
      const { setAmbienceEnabled } = await load()
      await setAmbienceEnabled(true)
      expect((xapi.tileLayer.setStyle.mock.calls[0] as unknown[])[3]).toBe(0.75)
      expect(xapi.settings.setBloomIntensity).toHaveBeenCalledWith(0.7)
    })
  })

  describe('loadLib', () => {
    it('returns the global without injecting a script when the library is already on the page', async () => {
      const lib = { create: vi.fn() }
      vi.stubGlobal('ElectronicFence', lib)
      const { loadLib } = await load()
      expect(await loadLib('electronic-fence')).toBe(lib)
      expect(document.head.querySelector('script')).toBeNull()
    })

    it('injects libs/<name>.js once and resolves with the global it defines', async () => {
      const { loadLib } = await load()
      const first = loadLib('view-frustum')
      const second = loadLib('view-frustum')
      expect(second).toBe(first)
      await Promise.resolve()
      const scripts = document.head.querySelectorAll('script')
      expect(scripts).toHaveLength(1)
      expect(scripts[0].getAttribute('src')).toMatch(/libs\/view-frustum\.js$/)
      const lib = { create: vi.fn() }
      vi.stubGlobal('ViewFrustum', lib)
      scripts[0].dispatchEvent(new Event('load'))
      expect(await first).toBe(lib)
    })

    it('loads dynamic-lines before a library that depends on it', async () => {
      const { loadLib } = await load()
      const loading = loadLib('flow-fx')
      await Promise.resolve()
      let scripts = document.head.querySelectorAll('script')
      expect([...scripts].map(s => s.getAttribute('src'))).toEqual([expect.stringMatching(/libs\/dynamic-lines\.js$/)])
      vi.stubGlobal('DTSDynamicLines', {})
      scripts[0].dispatchEvent(new Event('load'))
      await new Promise(resolve => setTimeout(resolve))
      scripts = document.head.querySelectorAll('script')
      expect(scripts).toHaveLength(2)
      expect(scripts[1].getAttribute('src')).toMatch(/libs\/flow-fx\.js$/)
      const lib = { preparePolyline: vi.fn() }
      vi.stubGlobal('DTSFlowFX', lib)
      scripts[1].dispatchEvent(new Event('load'))
      expect(await loading).toBe(lib)
    })

    it('rejects when the script fails to load and retries on the next call', async () => {
      const { loadLib } = await load()
      const failed = loadLib('polygon-mask')
      await Promise.resolve()
      document.head.querySelector('script')!.dispatchEvent(new Event('error'))
      await expect(failed).rejects.toThrow('libs/polygon-mask.js')
      const lib = {}
      vi.stubGlobal('PolygonMask', lib)
      expect(await loadLib('polygon-mask')).toBe(lib)
    })
  })

  describe('downloadSnapshot', () => {
    it('returns false when there is no video stream on the page', async () => {
      const { downloadSnapshot } = await load()
      expect(downloadSnapshot('a.png')).toBe(false)
    })

    it('returns false while the video has no frame yet', async () => {
      document.body.appendChild(document.createElement('video'))
      const { downloadSnapshot } = await load()
      expect(downloadSnapshot('a.png')).toBe(false)
    })

    it('draws the current frame to a canvas and downloads it as a PNG', async () => {
      const video = document.createElement('video')
      Object.defineProperty(video, 'videoWidth', { value: 1920 })
      Object.defineProperty(video, 'videoHeight', { value: 1080 })
      document.body.appendChild(video)
      const drawImage = vi.fn()
      const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as never)
      const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA')
      const clicked: HTMLAnchorElement[] = []
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this)
      })

      const { downloadSnapshot } = await load()
      expect(downloadSnapshot('场景.png')).toBe(true)
      expect(drawImage).toHaveBeenCalledWith(video, 0, 0)
      expect(clicked).toHaveLength(1)
      expect(clicked[0].download).toBe('场景.png')
      expect(clicked[0].href).toBe('data:image/png;base64,AAAA')

      getContext.mockRestore()
      toDataURL.mockRestore()
      click.mockRestore()
    })
  })
})
