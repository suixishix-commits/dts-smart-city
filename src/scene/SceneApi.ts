export type SceneObjectType = 'marker' | 'polygon' | 'heatmap'

/** 场景操作的最小接口。真实实现见 DtsSceneApi，测试用替身实现。 */
export interface SceneApi {
  /** 添加对象，每个对象必须带字符串 id */
  add(type: SceneObjectType, objects: { id: string }[]): Promise<void>
  remove(type: SceneObjectType, ids: string[]): Promise<void>
  setVisible(type: SceneObjectType, ids: string[], visible: boolean): Promise<void>
  /** view = [x, y, z, pitch, yaw] */
  setCamera(view: number[], flyTime?: number): Promise<void>
  focus(type: SceneObjectType, id: string, distance?: number): Promise<void>
  /** WGS84 经纬度 [lon, lat] 数组 → 场景投影坐标 [x, y, z] 数组 */
  project(lonLat: number[][]): Promise<number[][]>
}
