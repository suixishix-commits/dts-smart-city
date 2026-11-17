import emitter from '@/utils/emitter'

/**
 * 线宽随相机高度缩放。
 *
 * polyline 的 thickness 单位是米：按城市级俯视（相机约 9600 米）给的 60–90 米线宽，定位到 3000 米近看时
 * 会粗得像一条带子。这里登记每条线的基准线宽，相机停下后按高度换一档，所有模块的管线、飞线、路网一起变细。
 * 档位是离散的，相机小幅移动不会反复发指令。
 */

/** 基准线宽对应的相机高度（各模块默认机位），米 */
export const LINE_REF_HEIGHT = 9600
/** 线宽档位：相机高度 / 基准高度落在哪一档就乘哪个系数 */
const STEPS = [0.3, 0.45, 0.65, 1] as const
/** 缩放后最细的线宽，米 */
const MIN_THICKNESS = 4
/** 一次 update 的条数上限 */
const CHUNK = 200

/** 相机高度对应的线宽系数 */
export function lineScaleFor(height: number): number {
  const r = height / LINE_REF_HEIGHT
  return STEPS.find(s => r <= s * 1.15) ?? 1
}

/** 基准线宽乘系数后的实际线宽 */
export function scaledThickness(base: number, scale: number): number {
  return scale === 1 ? base : Math.max(MIN_THICKNESS, Math.round(base * scale))
}

class LineScaler {
  /** 线 id → 基准线宽 */
  private readonly base = new Map<string, number>()
  /** 当前系数 */
  scale = 1
  private started = false
  private timer: ReturnType<typeof setTimeout> | undefined

  /** 登记一批即将添加的线，返回按当前系数缩放过线宽的副本（原对象不改） */
  track<T extends { id: string }>(objects: T[]): T[] {
    return objects.map(o => {
      const t = (o as { thickness?: unknown }).thickness
      if (typeof t !== 'number') return o
      this.base.set(o.id, t)
      return this.scale === 1 ? o : { ...o, thickness: scaledThickness(t, this.scale) }
    })
  }

  untrack(ids: string[]): void {
    ids.forEach(id => this.base.delete(id))
  }

  /** 开始监听相机（场景就绪后调用一次） */
  start(): void {
    if (this.started) return
    this.started = true
    // CameraStopMove 默认不发，要打开相机运动事件；period 为间隔帧数
    __xapi.settings?.setEnableCameraMovingEvent?.(true, 20)
    emitter.on('CameraStopMove', () => this.refresh(200))
    // camera.set 飞行时也会发 CameraChanged，等飞完（定位一律 1.5 秒）再读高度
    emitter.on('CameraChanged', () => this.refresh(1800))
  }

  private refresh(delay: number): void {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.apply(), delay)
  }

  private async apply(): Promise<void> {
    const res = await __xapi.camera.get()
    const height = res?.camera?.[2]
    if (typeof height !== 'number') return
    const scale = lineScaleFor(height)
    if (scale === this.scale) return
    this.scale = scale
    const updates = [...this.base].map(([id, t]) => ({ id, thickness: scaledThickness(t, scale) }))
    for (let i = 0; i < updates.length; i += CHUNK) await __xapi.polyline.update(updates.slice(i, i + CHUNK))
  }
}

export const lineScaler = new LineScaler()
