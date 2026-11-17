import { drawLabel, type LabelSpec } from './labelImage'

/**
 * 场景标注的选中高亮：面板或场景里选中某个业务对象时，把它的标注换成「选中」样式的图片
 * （类别色描边 + 外发光），取消选中时换回来。marker.update 原地换 imagePath，不闪。
 *
 * kit.pin 画图片标注时在这里登记（标注 id → 业务 id、画图参数）；各模块把当前选中的业务 id 交给 highlightPins。
 */
interface Entry {
  userId: string
  spec: LabelSpec
  url: string
}

const registry = new Map<string, Entry>()
/** 当前换成选中样式的标注 id */
let selected = new Set<string>()

export function registerPin(pinId: string, userId: string, spec: LabelSpec, url: string): void {
  registry.set(pinId, { userId, spec, url })
  // 同 id 重新画（拖动时间轴、换数据）后，图片回到了普通样式
  selected.delete(pinId)
}

/** 要换成的样式：选中的业务 id 对应的标注用选中图，之前选中、现在不选的换回普通图 */
export function selectionUpdates(userIds: (string | null | undefined)[]): { id: string; imagePath: string }[] {
  const want = new Set(userIds.filter((id): id is string => !!id))
  const next = new Set([...registry].filter(([, e]) => want.has(e.userId)).map(([id]) => id))
  const updates: { id: string; imagePath: string }[] = []
  for (const id of selected) {
    const e = registry.get(id)
    if (!next.has(id) && e) updates.push({ id, imagePath: e.url })
  }
  for (const id of next) {
    if (selected.has(id)) continue
    const e = registry.get(id) as Entry
    const img = drawLabel({ ...e.spec, variant: 'selected' })
    if (img) updates.push({ id, imagePath: img.url })
  }
  selected = next
  return updates
}

/** 高亮这些业务对象的标注（null 表示没有选中） */
export async function highlightPins(userIds: (string | null | undefined)[]): Promise<void> {
  const updates = selectionUpdates(userIds)
  if (updates.length && typeof __xapi !== 'undefined') await __xapi.marker.update(updates)
}

/** 离开模块时清空：标注已经删掉了 */
export function resetPinSelection(): void {
  registry.clear()
  hoverQueue.clear()
  selected = new Set()
}

// ---- 悬停图：延后到空闲时画 ----
// 标注先用普通图上屏（悬停也显示普通图），空闲时补画悬停图再原地换上。
// 随时间轴变化的图层每个时刻都要重画标注，这样同步开销减半，拖动、播放时间轴不掉帧。

const hoverQueue = new Map<string, LabelSpec>()
let hoverScheduled = false
/** 每片空闲时间最多画多久，毫秒 */
const HOVER_SLICE = 8

function scheduleFlush() {
  if (hoverScheduled) return
  hoverScheduled = true
  const run = () => {
    hoverScheduled = false
    void flushHover()
  }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 500 })
  else setTimeout(run, 60)
}

async function flushHover(): Promise<void> {
  const start = performance.now()
  const updates: { id: string; hoverImagePath: string }[] = []
  for (const [id, spec] of hoverQueue) {
    hoverQueue.delete(id)
    // 期间标注被重画成别的内容（或删掉了）：这一张不用补
    if (registry.get(id)?.spec !== spec) continue
    const img = drawLabel({ ...spec, variant: 'hover' })
    if (img) updates.push({ id, hoverImagePath: img.url })
    if (performance.now() - start > HOVER_SLICE) break
  }
  if (hoverQueue.size) scheduleFlush()
  if (updates.length && typeof __xapi !== 'undefined') await __xapi.marker.update(updates)
}

/** 登记一张要在空闲时补画的悬停图 */
export function scheduleHover(pinId: string, spec: LabelSpec): void {
  hoverQueue.set(pinId, spec)
  scheduleFlush()
}
