/**
 * 分级点位效果（UE 材质 PointBeacon V3，dts-effect-kit/projects/PointBeacon_20261117）。
 *
 * 一个图层的所有点合成一个 customMesh（一次绘制）：
 * - 每个点一块贴地方片：中心光点、旋转刻度环、外环和两道扩散波纹；
 * - 光柱（3 片交叉的竖直面片）材质仍支持，但默认各级都不用：朝天的光柱不指向任何内容，含义由标签和引线表达。
 * customMesh 没有 UV，顶点颜色带数据：R、G 为面片四角的 0/1（插值后就是片内坐标），B 区分地面 / 光柱，
 * A 是等级 / 4（A 是线性 8 位值，RGB 会做 sRGB 转换只能放 0/1）。坐标是投影坐标的绝对米数。
 */

export const BEACON_MATERIAL = '/JC_CustomAssets/PointBeacon/MI_PointBeacon_V3_FX'

export interface BeaconPoint {
  /** 投影坐标 [x, y] 或 [x, y, z]（米） */
  at: number[]
  /** 告警等级 1–4：一级最醒目 */
  level: 1 | 2 | 3 | 4
}

/** 各等级的地面光环半径和光柱高度、宽度（米）：全城视角下一级仍可辨认，拉近到街区时不会盖住整个路口。beam 为 0 即不画光柱 */
export const BEACON_TIERS: Record<1 | 2 | 3 | 4, { radius: number; beam: number; beamWidth: number }> = {
  1: { radius: 340, beam: 0, beamWidth: 0 },
  2: { radius: 270, beam: 0, beamWidth: 0 },
  3: { radius: 240, beam: 0, beamWidth: 0 },
  4: { radius: 200, beam: 0, beamWidth: 0 }
}

/** 光柱由几片交叉的竖直面片组成 */
const BEAM_PLANES = 3
/** 地面方片离地高度，米（材质关了深度测试，抬高只是让透视下的位置更贴近路面） */
const GROUND_Z = 15

/** 保留到厘米，减小请求体积（加载速度受 JSON 字节数影响） */
const cm = (v: number) => Math.round(v * 100) / 100

/**
 * 生成一个图层的 customMesh 参数。points 为空时返回 null。
 * 材质参数（亮度、速度、颜色）用材质实例的默认值，需要时在 scalarParameters / vectorParameters 里覆盖。
 */
export function beaconMesh(id: string, points: BeaconPoint[], options: { brightness?: number; tiers?: typeof BEACON_TIERS } = {}): Record<string, unknown> | null {
  if (!points.length) return null
  const coordinates: number[][] = []
  const colors: number[][] = []
  const indices: number[] = []
  const quad = (corners: number[][], kind: 0 | 1, level: number) => {
    const base = coordinates.length
    // 角顺序：(0,0) (1,0) (1,1) (0,1)
    const uv = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1]
    ]
    corners.forEach((c, k) => {
      coordinates.push(c.map(cm))
      colors.push([uv[k][0], uv[k][1], kind, level / 4])
    })
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  for (const p of points) {
    const [x, y] = p.at
    const z = (p.at[2] ?? 0) + GROUND_Z
    const tier = (options.tiers ?? BEACON_TIERS)[p.level]
    const r = tier.radius
    quad(
      [
        [x - r, y - r, z],
        [x + r, y - r, z],
        [x + r, y + r, z],
        [x - r, y + r, z]
      ],
      0,
      p.level
    )
    if (tier.beam > 0) {
      const w = tier.beamWidth / 2
      for (let k = 0; k < BEAM_PLANES; k++) {
        const a = (Math.PI / BEAM_PLANES) * k
        const dx = Math.cos(a) * w
        const dy = Math.sin(a) * w
        quad(
          [
            [x - dx, y - dy, z],
            [x + dx, y + dy, z],
            [x + dx, y + dy, z + tier.beam],
            [x - dx, y - dy, z + tier.beam]
          ],
          1,
          p.level
        )
      }
    }
  }
  return {
    id,
    coordinateType: 0,
    coordinates,
    colors,
    indices,
    color: [1, 1, 1, 1],
    createCollision: false,
    material: BEACON_MATERIAL,
    scalarParameters: options.brightness !== undefined ? [{ name: 'Brightness', value: options.brightness }] : []
  }
}
