import type { SceneApi, SceneObjectType } from './SceneApi'

/** SceneApi 的 DTS 实现，直接调用 __xapi。只在场景就绪后使用。 */
export class DtsSceneApi implements SceneApi {
  async add(type: SceneObjectType, objects: { id: string }[]): Promise<void> {
    if (type === 'heatmap') {
      for (const o of objects) await __xapi.heatmap.addByHeatPoints(o)
      return
    }
    await __xapi[type].add(objects)
  }

  async remove(type: SceneObjectType, ids: string[]): Promise<void> {
    await __xapi[type].delete(ids)
  }

  async setVisible(type: SceneObjectType, ids: string[], visible: boolean): Promise<void> {
    if (visible) await __xapi[type].show(ids)
    else await __xapi[type].hide(ids)
  }

  async setCamera(view: number[], flyTime = 2): Promise<void> {
    await __xapi.camera.set(view[0], view[1], view[2], view[3], view[4], flyTime)
  }

  async focus(type: SceneObjectType, id: string, distance = 600): Promise<void> {
    await __xapi[type].focus(id, distance, 2)
  }

  async project(lonLat: number[][]): Promise<number[][]> {
    if (lonLat.length === 0) return []
    const res = await __xapi.coord.gcs2pcs(lonLat, 1)
    if (res.result !== 0) throw new Error('坐标转换失败：' + res.resultMessage)
    return res.coordinates
  }
}
