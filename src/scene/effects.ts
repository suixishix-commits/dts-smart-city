import { BEACON_MATERIAL } from './pointBeacon'
import { HEAT_FIELD_MATERIAL } from './heatField'
import { ROAD_FLOW_MATERIAL } from './trafficFlow'
import { LINE_FLOW_MATERIAL } from './lineFlow'
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

/**
 * 效果资源的「先查后挂」。
 *
 * 渲染端资源目录里有一个资源总包（smart-city.js 的 resourcePak，例如 dts-resource-v1.0.6.pak），收齐了各项目的效果材质和蓝图，
 * 可能已经被别的项目挂上。从同一个插件打出的包再挂第二个，会让先挂的包里没在用的资源按路径查不到，所以：
 *   1. 先查：资源已经在（别人挂过、或者渲染端自带）就直接用，不挂任何包；
 *   2. 查不到就挂资源总包（只挂一次，各效果共用），再查；
 *   3. 还查不到，才退回各效果自己的单独包（effectsPak、heatFieldPak 等，旧配置，可以留空）。
 * 查法：材质用 misc.getMaterial 能列出参数；效果总包里取一个流动线材质代表整包。
 */

/** 挂载用的不可见对象（放在地下）。用 pakFilePath 创建对象时渲染端会先挂整个包；资源不是蓝图时生成会报错，但包已经挂上 */
const LOADER_ID = 'sc_pak_loader'
const RESOURCE_LOADER_ID = 'sc_resource_loader'
/** 效果总包的代表资源：在它就说明流动线、点阵流光、电子围栏、视域都可用 */
export const EFFECTS_PROBE = '/JC_CustomAssets/PolylineLibrary/Exhibition/AIStudio/MI_StreamFlow_V4_0'
/** 挂资源总包时作为生成目标的蓝图 */
const RESOURCE_LOADER_ASSET = '/JC_CustomAssets/ObjectLibrary/Exhibition/ElectronicFenceV1/BP_ElectronicFence_V1'

/** 挂载包：整体尝试次数；每次挂载后确认资源可用的查询次数和间隔（渲染端忙时挂载要好几秒才生效） */
const MOUNT_ATTEMPTS = 3
const MOUNT_CHECKS = 6
const MOUNT_RETRY_MS = 1000

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** 材质现在能不能按路径查到 */
async function hasMaterial(material: string): Promise<boolean> {
  const res = await __xapi.misc.getMaterial(material).catch(() => null)
  return !!res?.data?.[0]?.params?.length
}

/** 用 pakFilePath 挂一个包，挂完等到 material 可查；返回是否可用 */
async function mountPak(id: string, path: string, asset: string, material: string): Promise<boolean> {
  if (!path) return false
  // 渲染端忙（启动、刚重启）时请求可能超时，连挂载请求本身都可能丢：挂载 + 确认整体重试几次，免得误判后整页退回旧画法
  for (let attempt = 0; attempt < MOUNT_ATTEMPTS; attempt++) {
    try {
      await __xapi.customObject.delete([id])
      await __xapi.customObject.add({ id, pakFilePath: path, assetPath: asset, location: [0, 0, -10000], coordinateType: 0, rotation: [0, 0, 0], scale: [1, 1, 1] }).catch(() => null)
      await __xapi.customObject.delete([id])
      for (let check = 0; check < MOUNT_CHECKS; check++) {
        if (await hasMaterial(material)) return true
        await sleep(MOUNT_RETRY_MS)
      }
    } catch (e) {
      console.warn('[effects] 挂载资源包出错，重试', path, e)
    }
  }
  console.warn('[effects] 资源包没有挂载上：', path)
  return false
}

let resourceMounted: Promise<boolean> | null = null
/** 挂资源总包（只挂一次，各效果共用）。没配置时返回 false */
function mountResourcePak(material: string): Promise<boolean> {
  resourceMounted ??= mountPak(RESOURCE_LOADER_ID, gVar?.smartCity?.resourcePak ?? '', RESOURCE_LOADER_ASSET, material)
  return resourceMounted
}

/** 先查后挂：已有就用；否则挂资源总包再查；还没有才挂单独的旧包 */
async function ensure(material: string, legacy: { id: string; path: string; asset: string }): Promise<boolean> {
  try {
    const name = material.split('/').pop()
    if (await hasMaterial(material)) {
      console.info(`[effects] ${name}：渲染端已有，不挂包`)
      return true
    }
    if (gVar?.smartCity?.resourcePak) {
      await mountResourcePak(material)
      if (await hasMaterial(material)) {
        console.info(`[effects] ${name}：来自资源总包`)
        return true
      }
    }
    const ok = await mountPak(legacy.id, legacy.path, legacy.asset, material)
    if (ok) console.info(`[effects] ${name}：来自单独包 ${legacy.path}`)
    return ok
  } catch (e) {
    console.warn('[effects] 检查效果资源失败', material, e)
    return false
  }
}

let trafficMounted: Promise<boolean> | null = null
/** 交通流光材质是否可用（先查后挂；旧配置 trafficFlowPak） */
export function mountTrafficFlowPak(): Promise<boolean> {
  trafficMounted ??= ensure(ROAD_FLOW_MATERIAL, { id: 'sc_traffic_loader', path: gVar?.smartCity?.trafficFlowPak ?? '', asset: ROAD_FLOW_MATERIAL })
  return trafficMounted
}

let lineMounted: Promise<boolean> | null = null
/** 通用流光线材质是否可用（先查后挂；旧配置 lineFlowPak） */
export function mountLineFlowPak(): Promise<boolean> {
  lineMounted ??= ensure(LINE_FLOW_MATERIAL, { id: 'sc_line_loader', path: gVar?.smartCity?.lineFlowPak ?? '', asset: LINE_FLOW_MATERIAL })
  return lineMounted
}

let heatMounted: Promise<boolean> | null = null
/** 热力场材质是否可用（先查后挂；旧配置 heatFieldPak） */
export function mountHeatFieldPak(): Promise<boolean> {
  heatMounted ??= ensure(HEAT_FIELD_MATERIAL, { id: 'sc_heat_loader', path: gVar?.smartCity?.heatFieldPak ?? '', asset: HEAT_FIELD_MATERIAL })
  return heatMounted
}

let beaconMounted: Promise<boolean> | null = null
/** 分级点位材质是否可用（先查后挂；旧配置 pointBeaconPak） */
export function mountPointBeaconPak(): Promise<boolean> {
  beaconMounted ??= ensure(BEACON_MATERIAL, { id: 'sc_beacon_loader', path: gVar?.smartCity?.pointBeaconPak ?? '', asset: BEACON_MATERIAL })
  return beaconMounted
}

let mounted: Promise<boolean> | null = null
/**
 * 效果总包（流动线材质、点阵流光、电子围栏、摄像头视域）是否可用：先查后挂，旧配置 effectsPak。
 * 返回 false 时调用方退回内置样式。
 */
export function mountEffectsPak(): Promise<boolean> {
  mounted ??= ensure(EFFECTS_PROBE, { id: LOADER_ID, path: gVar?.smartCity?.effectsPak ?? '', asset: RESOURCE_LOADER_ASSET })
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
