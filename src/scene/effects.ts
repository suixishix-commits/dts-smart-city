import { BEACON_MATERIAL } from './pointBeacon'
import { HEAT_FIELD_MATERIAL } from './heatField'
import { ROAD_FLOW_MATERIAL } from './trafficFlow'
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
 * 挂载只有材质的 PAK（没有蓝图）。customObject 用 pakFilePath 创建时渲染端会先挂载整个包，
 * 再按 assetPath 生成对象——材质不是蓝图，生成会报错，但包已经挂上了。用 misc.getMaterial 能列出参数来确认。
 */
async function mountMaterialPak(id: string, path: string, material: string): Promise<boolean> {
  if (!path) return false
  try {
    await __xapi.customObject.delete([id])
    await __xapi.customObject.add({ id, pakFilePath: path, assetPath: material, location: [0, 0, -10000], coordinateType: 0, rotation: [0, 0, 0], scale: [1, 1, 1] })
    await __xapi.customObject.delete([id])
    const res = await __xapi.misc.getMaterial(material)
    const ok = !!res?.data?.[0]?.params?.length
    if (!ok) console.warn('[effects] 材质包没有挂载上：', path)
    return ok
  } catch (e) {
    console.warn('[effects] 挂载材质包失败', path, e)
    return false
  }
}

let trafficMounted: Promise<boolean> | null = null
/** 挂载交通流光材质包（smart-city.js 的 trafficFlowPak）；返回是否可用 */
export function mountTrafficFlowPak(): Promise<boolean> {
  trafficMounted ??= mountMaterialPak('sc_traffic_loader', gVar?.smartCity?.trafficFlowPak ?? '', ROAD_FLOW_MATERIAL)
  return trafficMounted
}

let heatMounted: Promise<boolean> | null = null
/** 挂载热力场材质包（smart-city.js 的 heatFieldPak）；返回是否可用 */
export function mountHeatFieldPak(): Promise<boolean> {
  heatMounted ??= mountMaterialPak('sc_heat_loader', gVar?.smartCity?.heatFieldPak ?? '', HEAT_FIELD_MATERIAL)
  return heatMounted
}

let beaconMounted: Promise<boolean> | null = null
/** 挂载分级点位效果的材质包（smart-city.js 的 pointBeaconPak）；返回是否可用 */
export function mountPointBeaconPak(): Promise<boolean> {
  beaconMounted ??= mountMaterialPak('sc_beacon_loader', gVar?.smartCity?.pointBeaconPak ?? '', BEACON_MATERIAL)
  return beaconMounted
}

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
/**
 * 夜景：场景时间拨到入夜后，影像本身几乎全黑；把影像亮度提上来、饱和度压低，
 * 城市肌理还看得出来，发光路网和图层从暗底里浮出来。
 */
const DEFAULT_NIGHT: Ambience = { tint: [0.7, 0.85, 1, 1], saturation: 0.6, brightness: 4, contrast: 1.2, bloom: 1.2 }
/** 白天和夜景对应的场景时刻 [时, 分]。白天取傍晚前的低角度阳光：正午光照会把影像冲白、压淡图层 */
const DAY_TIME = [16, 45]
const NIGHT_TIME = [20, 30]

/** 夜景是否打开；底图风格开关要按它选白天还是夜景的参数 */
let night = false

/** 地形/影像图层的 id（图层树里 type 为 EPT_Scene 的项） */
async function terrainLayerIds(): Promise<string[]> {
  const res = await __xapi.infoTree.get()
  return (res?.infotree ?? []).filter((n: any) => n.type === 'EPT_Scene').map((n: any) => n.iD)
}

function ambienceFor(isNight: boolean): Ambience {
  const cfg = gVar?.smartCity ?? {}
  return isNight ? { ...DEFAULT_NIGHT, ...(cfg.nightAmbience ?? {}) } : { ...DEFAULT_AMBIENCE, ...(cfg.ambience ?? {}) }
}

/** 场景时刻拨到白天或入夜。场景时间留在渲染实例里，页面刷新也不会恢复，所以底座启动时也要拨一次 */
async function setSceneTime(isNight: boolean): Promise<void> {
  const [h, m] = isNight ? NIGHT_TIME : DAY_TIME
  const d = new Date()
  await __xapi.weather.setDateTime(d.getFullYear(), d.getMonth() + 1, d.getDate(), h, m, 0, false)
}

/**
 * 底图风格：影像压成偏冷的色调、关掉云、开一点泛光，让图层从底图里浮出来。夜景打开时用夜景参数。
 * 参数在 public/config/smart-city.js 的 ambience / nightAmbience 里。
 */
export async function applyAmbience(): Promise<void> {
  const a = ambienceFor(night)
  await setSceneTime(night)
  const ids = await terrainLayerIds()
  if (ids.length) await __xapi.tileLayer.setStyle(ids, 0, a.tint, a.saturation, a.brightness, a.contrast, 0.18)
  await __xapi.weather.setCloudDensity(0)
  await __xapi.weather.setDarkMode(false)
  await __xapi.settings.setBloomIntensity(a.bloom)
}

/** 开关底图风格：关掉后恢复影像原色（夜景下只保留时间，不再提亮影像） */
export async function setAmbienceEnabled(enabled: boolean): Promise<void> {
  if (enabled) return applyAmbience()
  const ids = await terrainLayerIds()
  if (ids.length) await __xapi.tileLayer.setStyle(ids, 0, [1, 1, 1, 1], 1, 1, 1, 0.18)
}

/**
 * 切换夜景：把场景时间拨到入夜 / 白天，再按昼夜换底图参数。
 * ambience 为 false（用户在图层面板关了底图风格）时只拨时间，不改影像。
 */
export async function setNight(on: boolean, ambience = true): Promise<void> {
  night = on
  if (ambience) return applyAmbience()
  await setSceneTime(on)
  await __xapi.settings.setBloomIntensity(ambienceFor(on).bloom)
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
