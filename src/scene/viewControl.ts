/**
 * 视角控件的镜头计算（纯函数）：机位 [x, y, z, pitch, yaw]，朝向约定同 kit.focusView ——
 * 水平视线方向是 (cos yaw, -sin yaw)，俯仰角为负表示朝下看。所有操作都绕「视线落地点」进行，看的东西不跑出画面。
 */

/** 俯视（2D）时的俯仰角；DTS 不接受正好 -90 */
export const TOP_DOWN_PITCH = -89
/** 回到斜视（3D）时的俯仰角，和各模块主页机位一致 */
export const TILT_PITCH = -38
/** 俯仰角低于它就算俯视 */
const TOP_DOWN_BELOW = -80
/** 镜头高度范围，米：太低会钻进楼里，太高底图出边 */
export const HEIGHT_RANGE: [number, number] = [150, 30000]

const rad = (deg: number) => (deg * Math.PI) / 180

/** 视线和地面（z = 0）的交点，以及镜头到它的斜距 */
export function viewTarget(camera: number[]): { target: [number, number]; distance: number } {
  const [x, y, z, pitch, yaw] = camera
  // 视线接近水平时没有落地点：按 5 公里外处理
  const down = Math.max(rad(-pitch), rad(5))
  const ground = z / Math.tan(down)
  const yawR = rad(yaw)
  return { target: [x + Math.cos(yawR) * ground, y - Math.sin(yawR) * ground], distance: z / Math.sin(down) }
}

/** 从落地点、斜距、俯仰、方位反推机位 */
export function cameraAt(target: number[], distance: number, pitch: number, yaw: number): number[] {
  const down = rad(-pitch)
  const z = distance * Math.sin(down)
  const ground = distance * Math.cos(down)
  const yawR = rad(yaw)
  return [target[0] - Math.cos(yawR) * ground, target[1] + Math.sin(yawR) * ground, z, pitch, yaw]
}

/** 拉近 / 拉远：k < 1 拉近，k > 1 拉远；高度限制在 HEIGHT_RANGE 里 */
export function zoomed(camera: number[], k: number): number[] {
  const { target, distance } = viewTarget(camera)
  const pitch = camera[3]
  const sin = Math.sin(rad(-pitch))
  const next = Math.min(HEIGHT_RANGE[1] / sin, Math.max(HEIGHT_RANGE[0] / sin, distance * k))
  return cameraAt(target, next, pitch, camera[4])
}

/** 绕落地点水平旋转 deg 度（正数向右转） */
export function rotated(camera: number[], deg: number): number[] {
  const { target, distance } = viewTarget(camera)
  const yaw = ((((camera[4] + deg + 180) % 360) + 360) % 360) - 180
  return cameraAt(target, distance, camera[3], yaw)
}

/** 当前是不是俯视 */
export function isTopDown(camera: number[]): boolean {
  return camera[3] < TOP_DOWN_BELOW
}

/** 俯视（2D）和斜视（3D）互切，落地点不变。斜视切俯视时斜距缩短一些，画面范围大致不变 */
export function toggledTopDown(camera: number[]): number[] {
  const { target, distance } = viewTarget(camera)
  return isTopDown(camera) ? cameraAt(target, distance * 1.25, TILT_PITCH, camera[4]) : cameraAt(target, distance * 0.8, TOP_DOWN_PITCH, camera[4])
}
