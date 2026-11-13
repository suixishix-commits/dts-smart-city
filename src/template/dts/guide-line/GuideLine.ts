import { cumulative, densify, fillet, grownTo, movePath, type ScenePoint } from './routePath'

/**
 * 牵引线（参考 livex-front「一家人的一周」的出行路线画法）：一条路线在孪生上的三样东西，
 * 同一刻起步、同一速度：
 *  - 线：`polyline`，牵引线材质 `混合线_9`，生长时先画头两个点，之后每 `TICK_MS` 按走过的
 *    里程 `setCoordinates` 延长到线头——线是长出来的，不是一次画完；
 *  - 载体：`customObject`，车辆库的模型缩到千分之一，画面上看不见，`startMove` 沿同一条路走，
 *    整条轨迹连到达时间一次交给引擎，引擎按自己的帧率平滑移动；
 *  - 标记：`marker.attachObject` 贴在载体上跟着走，到终点留在原地。
 *
 * marker 和 polyline 都不插值，逐帧 setCoordinate 画面上是一格一格跳；引擎里唯一自己平滑
 * 移动的是 CustomObject，所以标记贴在载体上。路线几何在 `routePath.ts`：转角倒圆、等距加密，
 * 线用 shape 0 直连也是弧线。
 *
 * 两种画法：静态是整条线一次画完、标记站在线尾，没有载体；生长是上面三样一起动。
 */

export interface GuideRide {
  /** 路线的键，也是三个对象 id 的后缀。 */
  readonly key: string
  /** 折线顶点，第一个是起点，最后一个是终点（场景投影坐标）。 */
  readonly points: readonly ScenePoint[]
  /** 线的颜色，RGB 0..1。 */
  readonly ink: readonly [number, number, number]
  /** 标记图片（http 地址或 @path:），按 `MARKER_SIZE` 画，站在自己的圆心上。 */
  readonly image: string
  /** 米/秒，线头和载体共用：线越长走得越久。 */
  readonly speed: number
  /** 线的宽度，米。 */
  readonly width: number
}

/** 分组 id，三类对象共用。 */
export const GUIDE_GROUP = 'gp_guide_line'
/** 加密后相邻点的最大间距，米。 */
export const STEP_M = 2
/** 转角倒圆的半径（切点离拐点的距离），米。 */
export const CORNER_R_M = 8
/** 线延长的节奏；上一拍没回包就跳过。 */
export const TICK_MS = 50
/** 载体的缩放：车辆库的模型缩到千分之一，画面上看不见。 */
const CARRIER_SCALE = [0.001, 0.001, 0.001]
/** 载体模型：DTS 内置资源库的车辆，只当移动的锚点用。 */
const CARRIER_ASSET = '/JC_CustomAssets/ObjectLibrary/Exhibition/交通工具/工程车/工程抢险车_3'
/** 标记的屏幕尺寸，1920 设计像素（图标是 100 x 100 的圆徽）。 */
const MARKER_SIZE = 44
/** 标记压在其它标牌之上：SDK 的 priority 值越大显示越靠上。 */
const MARKER_PRIORITY = 100

/** 牵引线材质和参数；`颜色1` 是各条线自己的颜色。 */
const LINE_MATERIAL = '/JC_CustomAssets/PolylineLibrary/Exhibition/混合线_9'
const LINE_SCALARS = [
  { name: '不透明度', value: 0.5 },
  { name: '亮度1', value: 100 },
  { name: '亮度2', value: 1 }
]
const LINE_COLOUR_2_VALUE = [0, 0, 0.28125, 1]

export const guideLineId = (key: string): string => `${GUIDE_GROUP}-line-${key}`
export const guideMarkerId = (key: string): string => `${GUIDE_GROUP}-marker-${key}`
export const guideCarrierId = (key: string): string => `${GUIDE_GROUP}-co-${key}`

interface Running {
  readonly ride: GuideRide
  readonly path: readonly ScenePoint[]
  readonly cum: readonly number[]
  /** 线长出来、标记沿线走；静态的一次画完，没有载体。 */
  readonly animated: boolean
  /** 起跑的时刻；还在等回包时是 null，线不长。 */
  startedAt: number | null
  /** 线已经画完整，之后不再碰。 */
  done: boolean
}

/** 在地面上的路线，按键。 */
const running = new Map<string, Running>()
let ticker: ReturnType<typeof setInterval> | null = null
/** 上一拍还没回包就跳过这一拍，不往引擎里堆命令。 */
let busy = false

const ready = (): boolean => Boolean(__xapi?.isReady)

/** 引擎命令失败只记一行警告，不打断其它路线。 */
async function call(what: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch (error) {
    console.warn(`[GuideLine] ${what} 失败:`, error)
  }
}

/** 一条路线加密后的几何。 */
function ridePath(ride: GuideRide): ScenePoint[] {
  return densify(fillet(ride.points, CORNER_R_M, STEP_M), STEP_M)
}

function lineOf({ ride, path, cum, animated }: Running): object {
  const [r, g, b] = ride.ink
  return {
    id: guideLineId(ride.key),
    groupId: GUIDE_GROUP,
    // 生长的从头两个点长起；静态的整条。
    coordinates: grownTo(path, cum, animated ? 0 : Infinity),
    coordinateType: 0,
    color: [r, g, b, 1],
    style: 4,
    thickness: ride.width,
    intensity: 1,
    // 弧度已经在坐标里，引擎按直线段连。
    shape: 0,
    depthTest: true,
    range: [0, 100000],
    viewHeightRange: [0, 100000],
    tiling: 0,
    material: LINE_MATERIAL,
    scalarParameters: LINE_SCALARS.map((p) => ({ ...p })),
    vectorParameters: [
      { name: '颜色1', value: [r, g, b, 1] },
      { name: '颜色2', value: [...LINE_COLOUR_2_VALUE] }
    ]
  }
}

function carrierOf({ ride, path }: Running): object {
  return {
    id: guideCarrierId(ride.key),
    groupId: GUIDE_GROUP,
    assetPath: CARRIER_ASSET,
    location: [...path[0]],
    coordinateType: 0,
    rotation: [0, 0, 0],
    scale: [...CARRIER_SCALE],
    smoothMotion: 1,
    autoHeight: false,
    collision: false,
    enableDecal: false,
    visible: true,
    range: [0, 1_000_000_000]
  }
}

/**
 * 标记按 1920 设计像素画，引擎按视频流像素渲染：流比 1920 宽（4K 流）时按比例放大，
 * 和 usecase 的 remconfig.DTSize 同一个算法。
 */
function markerScale(): number {
  const width = document.querySelector('video')?.videoWidth || 1920
  return width / 1920
}

function markerOf({ ride, path, animated }: Running): object {
  // 生长的从起点出发，静态的站在线尾。
  const at = animated ? path[0] : path[path.length - 1]
  const size = Math.round(MARKER_SIZE * markerScale())
  return {
    id: guideMarkerId(ride.key),
    groupId: GUIDE_GROUP,
    coordinate: [...at],
    coordinateType: 0,
    imagePath: ride.image,
    imageSize: [size, size],
    anchors: [-size / 2, size / 2],
    fixedSize: true,
    autoHeight: false,
    range: [0, 1_000_000_000],
    text: '',
    textBackgroundColor: [0, 0, 0, 0],
    occlusionCull: false,
    displayMode: 2,
    clusterByImage: false,
    priority: MARKER_PRIORITY
  }
}

/** 删掉这些键在实例上的东西（先停载体）。`carriers` 是其中带载体的键，不传就当都带。 */
async function remove(keys: readonly string[], carriers: readonly string[] = keys): Promise<void> {
  if (carriers.length) {
    const ids = carriers.map(guideCarrierId)
    await call('停止载体', () => __xapi.customObject.stop(ids))
    await call('删除载体', () => __xapi.customObject.delete(ids))
  }
  await call('删除标记', () => __xapi.marker.delete(keys.map(guideMarkerId)))
  await call('删除牵引线', () => __xapi.polyline.delete(keys.map(guideLineId)))
}

/** 静态：线整条、标记在线尾，没有载体也没有拍。 */
async function place(runs: readonly Running[]): Promise<void> {
  await Promise.all([
    call('添加牵引线', () => __xapi.polyline.add(runs.map(lineOf))),
    call('添加标记', () => __xapi.marker.add(runs.map(markerOf)))
  ])
  runs.forEach((run) => (run.done = true))
}

/** 线、载体、标记、贴合、起跑——贴合要等载体和标记都建好，起跑的同一刻线开始长。 */
async function launch(runs: readonly Running[]): Promise<void> {
  const lines = call('添加牵引线', () => __xapi.polyline.add(runs.map(lineOf)))
  await Promise.all([
    call('添加载体', () => __xapi.customObject.add(runs.map(carrierOf))),
    call('添加标记', () => __xapi.marker.add(runs.map(markerOf)))
  ])
  const attachments = runs.map(({ ride }) => ({
    markerId: guideMarkerId(ride.key),
    objectId: guideCarrierId(ride.key),
    offset: [0, 0, 0]
  }))
  // 新版 SDK 叫 attachObject，7.0 叫 setAttachCustomObject，同一条引擎命令（SetupPOIAttachment）。
  const { marker } = __xapi
  const attach = marker.attachObject ? marker.attachObject.bind(marker) : marker.setAttachCustomObject.bind(marker)
  await call('标记贴到载体', () => attach(attachments))
  await lines
  const now = Date.now()
  // 中途被撤或被重开的不再起跑。
  for (const run of runs.filter((run) => running.get(run.ride.key) === run)) {
    run.startedAt = now
    const track = movePath(run.path, run.cum, run.ride.speed)
    void call('载体起跑', () => __xapi.customObject.startMove(guideCarrierId(run.ride.key), 0, track))
  }
  ticker ??= setInterval(() => void grow(), TICK_MS)
}

/** 一拍：把每条还在长的线延长到线头。到了的那一拍画完整条，之后不再碰。 */
async function grow(): Promise<void> {
  if (busy) return
  if (!ready()) {
    // 孪生下线：实例上的对象已不可知，只忘掉，不发删除。
    running.clear()
    stopTicker()
    return
  }
  const now = Date.now()
  const growing = [...running.values()].filter((run) => run.startedAt !== null && !run.done)
  if (!growing.length) {
    if ([...running.values()].every((run) => run.done)) stopTicker()
    return
  }
  busy = true
  try {
    const heads = growing.map((run) => {
      const walked = ((now - run.startedAt!) / 1000) * run.ride.speed
      run.done = walked >= run.cum[run.cum.length - 1]
      return [guideLineId(run.ride.key), grownTo(run.path, run.cum, walked)] as const
    })
    // 一拍一条命令：updateBegin / updateEnd 把几条线的 setCoordinates 攒成一次提交。
    const { polyline } = __xapi
    if (polyline.updateBegin && polyline.updateEnd) {
      polyline.updateBegin()
      for (const [id, coordinates] of heads) polyline.setCoordinates(id, coordinates)
      await call('延长牵引线', () => polyline.updateEnd())
    } else {
      await Promise.all(heads.map(([id, coordinates]) => call('延长牵引线', () => polyline.setCoordinates(id, coordinates))))
    }
  } finally {
    busy = false
  }
}

function stopTicker(): void {
  if (ticker) clearInterval(ticker)
  ticker = null
  busy = false
}

export default class GuideLine {
  /**
   * 把这些路线画到地面上：`animate` 时线长出来、标记从起点沿路走，否则整条线加线尾的标记
   * 一次画完。同一条路线再来一次就从头开始。
   *
   * @param rides 要画的路线
   * @param animate 是否生长（默认静态）
   */
  static async start(rides: readonly GuideRide[], animate = false): Promise<void> {
    if (!ready() || !rides.length) return
    // 同 id 的旧对象先删：add 遇到已有 id 会留下旧的。
    await remove(rides.map((r) => r.key))
    const runs = rides.map((ride): Running => {
      const path = ridePath(ride)
      return { ride, path, cum: cumulative(path), animated: animate, startedAt: null, done: false }
    })
    runs.forEach((run) => running.set(run.ride.key, run))
    if (animate) await launch(runs)
    else await place(runs)
  }

  /**
   * 撤掉这些路线：线、载体、标记一起删（不传就全撤）。
   *
   * @param keys 路线的键；不传是全部
   */
  static async stop(keys?: readonly string[]): Promise<void> {
    const stopping = (keys ?? [...running.keys()]).filter((key) => running.has(key))
    if (!stopping.length) return
    const carriers = stopping.filter((key) => running.get(key)!.animated)
    stopping.forEach((key) => running.delete(key))
    if (!running.size) stopTicker()
    if (ready()) await remove(stopping, carriers)
  }
}

export { GuideLine }
