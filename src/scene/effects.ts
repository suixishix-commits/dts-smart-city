/**
 * 效果总包（UE pak）和它的前端适配库。
 *
 * 总包里是做好的蓝图和材质：流动线、点阵流光、电子围栏、摄像头视域等。
 * 前端适配库在 public/libs 下（取自 dts-effect-kit 各效果的交付目录），是挂在 window 上的全局对象，按需加载。
 */

const LIBS = {
  'dynamic-lines': 'DTSDynamicLines',
  'flow-fx': 'DTSFlowFX',
  'region-dot-flow': 'RegionDotFlow',
  'electronic-fence': 'ElectronicFence',
  'view-frustum': 'ViewFrustum',
  'stream-flow': 'DTSStreamFlow',
  'spatial-flow': 'DTSSpatialFlow',
  'polygon-mask': 'PolygonMask',
  'dash-lines': 'DTSDashLines'
} as const
export type EffectLib = keyof typeof LIBS

/** 依赖：这些库内部用到 DTSDynamicLines，要先加载它 */
const NEEDS_DYNAMIC_LINES: EffectLib[] = ['flow-fx', 'stream-flow', 'spatial-flow']

const loading = new Map<EffectLib, Promise<any>>()

/** 加载一个效果适配库，返回它的全局对象。重复调用只加载一次 */
export function loadLib(name: EffectLib): Promise<any> {
  let p = loading.get(name)
  if (!p) {
    p = (async () => {
      if (NEEDS_DYNAMIC_LINES.includes(name)) await loadLib('dynamic-lines')
      const global = LIBS[name]
      if (!(window as any)[global]) {
        await new Promise<void>((resolve, reject) => {
          const el = document.createElement('script')
          el.src = `${import.meta.env.BASE_URL}libs/${name}.js`
          el.onload = () => resolve()
          el.onerror = () => reject(new Error(`效果库加载失败：libs/${name}.js`))
          document.head.appendChild(el)
        })
      }
      return (window as any)[global]
    })()
    loading.set(name, p)
    p.catch(() => loading.delete(name))
  }
  return p
}

const LOADER_ID = 'sc_pak_loader'
const LOADER_ASSET = '/JC_CustomAssets/ObjectLibrary/Exhibition/ElectronicFenceV1/BP_ElectronicFence_V1'
let mounted: Promise<boolean> | null = null

/**
 * 挂载效果总包。原理：用 pakFilePath 创建一个不可见的蓝图对象，渲染端会把整个 pak 挂载进来，
 * 之后包里的材质、蓝图都能按资源路径使用，不需要改 Cloud 的安装目录。
 * 返回是否挂载成功；没配置路径或挂载失败返回 false，调用方应退回内置样式。
 */
export function mountEffectsPak(): Promise<boolean> {
  mounted ??= (async () => {
    const path: string = gVar?.smartCity?.effectsPak ?? ''
    if (!path) return false
    try {
      await __xapi.customObject.delete([LOADER_ID])
      await __xapi.customObject.add({ id: LOADER_ID, pakFilePath: path, assetPath: LOADER_ASSET, location: [0, 0, -10000], coordinateType: 0, rotation: [0, 0, 0], scale: [1, 1, 1] })
      // add 返回成功不代表资源存在：能列出蓝图函数才说明挂载上了
      const fns = await __xapi.customObject.getBPFunction(LOADER_ID)
      const ok = !!fns?.data?.[0]?.params?.length
      if (!ok) console.warn('[effects] 效果总包没有挂载上，请检查 smart-city.js 里的 effectsPak 路径：', path)
      return ok
    } catch (e) {
      console.warn('[effects] 挂载效果总包失败', e)
      return false
    }
  })()
  return mounted
}

interface Ambience {
  tint: number[]
  saturation: number
  brightness: number
  contrast: number
  bloom: number
}
const DEFAULT_AMBIENCE: Ambience = { tint: [0.78, 0.88, 1, 1], saturation: 0.75, brightness: 0.2, contrast: 1.1, bloom: 0.7 }

/** 地形/影像图层的 id（图层树里 type 为 EPT_Scene 的项） */
async function terrainLayerIds(): Promise<string[]> {
  const res = await __xapi.infoTree.get()
  return (res?.infotree ?? []).filter((n: any) => n.type === 'EPT_Scene').map((n: any) => n.iD)
}

/**
 * 底图风格：影像压成偏冷的黄昏色调、关掉云、开一点泛光，让图层从底图里浮出来。
 * 参数在 public/config/smart-city.js 的 ambience 里。
 */
export async function applyAmbience(): Promise<void> {
  const a: Ambience = { ...DEFAULT_AMBIENCE, ...(gVar?.smartCity?.ambience ?? {}) }
  const ids = await terrainLayerIds()
  if (ids.length) await __xapi.tileLayer.setStyle(ids, 0, a.tint, a.saturation, a.brightness, a.contrast, 0.18)
  await __xapi.weather.setCloudDensity(0)
  await __xapi.weather.setDarkMode(false)
  await __xapi.settings.setBloomIntensity(a.bloom)
}

/** 开关黄昏底图风格：关掉后恢复影像原色 */
export async function setAmbienceEnabled(enabled: boolean): Promise<void> {
  if (enabled) return applyAmbience()
  const ids = await terrainLayerIds()
  if (ids.length) await __xapi.tileLayer.setStyle(ids, 0, [1, 1, 1, 1], 1, 1, 1, 0.18)
}

/** 截图：SDK 没有截图接口，直接把视频流当前帧画到 canvas 上，下载为 PNG */
export function downloadSnapshot(filename: string): boolean {
  const video = document.querySelector('video') as HTMLVideoElement | null
  if (!video || !video.videoWidth) return false
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d')?.drawImage(video, 0, 0)
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = filename
  a.click()
  return true
}
