import type { SceneApi, SceneObjectType } from './SceneApi'

/**
 * SDK 调用失败时通常不会 reject，而是 resolve 一个 result 非 0 的对象。这里只记录，不抛错。
 */
function check(res: unknown, operation: string, ids: string[]): void {
  const r = res as { result?: unknown; resultMessage?: unknown } | null | undefined
  if (r && typeof r === 'object' && typeof r.result === 'number' && r.result !== 0) {
    console.warn(`[DtsSceneApi] ${operation} 失败`, ids, r.resultMessage)
  }
}

/** SceneApi 的 DTS 实现，直接调用 __xapi。只在场景就绪后使用。 */
export class DtsSceneApi implements SceneApi {
  async add(type: SceneObjectType, objects: { id: string }[]): Promise<void> {
    if (objects.length === 0) return
    // 场景对象存在云渲染实例里，页面刷新后不会消失；同 id 再 add 会失败，所以先删。
    // 对象不存在时删除会返回非 0，属正常情况，不检查结果。
    await __xapi[type].delete(objects.map(o => o.id))
    if (type === 'heatmap') {
      for (const o of objects) check(await __xapi.heatmap.addByHeatPoints(o), 'heatmap.addByHeatPoints', [o.id])
      return
    }
    check(
      await __xapi[type].add(objects),
      `${type}.add`,
      objects.map(o => o.id)
    )
  }

  async remove(type: SceneObjectType, ids: string[]): Promise<void> {
    check(await __xapi[type].delete(ids), `${type}.delete`, ids)
  }

  async setVisible(type: SceneObjectType, ids: string[], visible: boolean): Promise<void> {
    if (visible) check(await __xapi[type].show(ids), `${type}.show`, ids)
    else check(await __xapi[type].hide(ids), `${type}.hide`, ids)
  }

  async setCamera(view: number[], flyTime = 2): Promise<void> {
    check(await __xapi.camera.set(view[0], view[1], view[2], view[3], view[4], flyTime), 'camera.set', [])
  }

  async focus(type: SceneObjectType, id: string, distance = 600): Promise<void> {
    check(await __xapi[type].focus(id, distance, 2), `${type}.focus`, [id])
  }

  async project(lonLat: number[][]): Promise<number[][]> {
    if (lonLat.length === 0) return []
    const res = await __xapi.coord.gcs2pcs(lonLat, 1)
    if (res.result !== 0) throw new Error('坐标转换失败：' + res.resultMessage)
    return res.coordinates
  }
}
