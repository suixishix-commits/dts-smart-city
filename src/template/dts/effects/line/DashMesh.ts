import { type EffectPanel, api, loadLib } from '../effectRuntime'

/**
 * 海量流动虚线 — fdapi.customMesh + 材质 MI_FlowDash_V2_0 / MI_ChaseArrow_V2_0
 * 效果总包里的虚线 V2.0：同一样式的所有线合并成几个 customMesh 网格（每个网格一次绘制），上百条、上千条线也不卡；
 * 外观和 V1.2 的折线虚线一样，可选流动虚线或追逐箭头。线是水平的扁带，宽度、间距按米算。
 * 依赖：Cloud 已挂载效果总包（PAK 见 docs/dts-effects）；封装好的接口 public/static/dts-effects/libs/dash-lines.js（全局 DTSDashLines）。
 * 页面右侧「实时调节」面板改了立即生效；文件开头的「参数」是创建时用的，改了要重新运行。
 *
 * ── DTSDashLines 接口 ──
 *   create(fdapi, { id, lines: [路线, …], style: 'dash' | 'arrow', color, width, spacingMeters, speed, brightness, opacity, reverse, liftM, groupId })
 *       路线是工程投影坐标（米）[[x, y, z], …]；也可以写 { coordinates, reverse } 单独反向
 *       返回 { meshes, meshIds, vertices, triangles, lengthM, lines, seconds }
 *   setStyle(fdapi, id, { 要改的字段 })   颜色、速度、亮度、不透明度、方向只改材质参数（立即生效）；样式、线宽、间距要重建网格
 *   remove(fdapi, id)；显隐用 fdapi.customMesh.show/hide(meshIds)
 */

// ── 参数 ──
const count = 300;           // 线条数，min=1 max=3000 step=10
const pointsPerLine = 60;    // 每条点数，min=2 max=1000 step=10，相邻两点相距 15 米
const style = 'dash';        // 样式，流动虚线=dash, 追逐箭头=arrow
const heightM = 60;          // 离地高度(m)，min=0 max=500 step=5
const distance = 1300;       // 观察距离，min=100 max=5000 step=50，lookAt 的距离，实际相机距离约是它的 1.7 倍

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  const ID = 'demo_dash_mesh'; // 图层 id（网格 id 是 demo_dash_mesh_0、_1 …）
  const center: [number, number] = [491000, 2491300]; // 路线分布的中心：demo.acp 城区（工程投影坐标，米）；换工程时改这里

  // 加载封装好的接口（public/static/dts-effects/libs/dash-lines.js，全局 DTSDashLines）；加载过就跳过
  await loadLib('dash-lines.js', 'DTSDashLines')

  // 演示路线：在中心周围 3 km 见方里随机起步、每 15 米随机偏转一点方向的折线；固定种子，每次运行一样
  let seed = 12345; // 伪随机数状态
  /** 下一个伪随机数 @returns {number} [0, 1) 之间 */
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const lines = Array.from({ length: count }, () => {
    let x = center[0] + (rnd() - 0.5) * 3000, y = center[1] + (rnd() - 0.5) * 3000, heading = rnd() * Math.PI * 2; // 起点和方向
    return Array.from({ length: pointsPerLine }, () => {
      const point = [x, y, heightM]; // 这一点
      heading += (rnd() - 0.5) * 0.5;
      x += 15 * Math.cos(heading);
      y += 15 * Math.sin(heading);
      return point;
    });
  });

  const look = { ...DTSDashLines.DEFAULTS, style }; // 当前样式（其余是 V1.2 的默认外观），面板改的就是它
  // 先删上次的网格（线多时网格多，按 id 范围删；customMesh 不记 groupId，删不存在的 id 也返回成功）
  await fdapi.customMesh.delete(Array.from({ length: 128 }, (_, i) => `${ID}_${i}`));
  const info = await DTSDashLines.create(fdapi, { id: ID, lines, ...look });
  await fdapi.camera.lookAt(...center, 0, distance, -45, -90, 1);

  // ── 实时调节面板 ──
  const gui = panel({ title: `海量流动虚线（${info.lines} 条线，${info.meshes} 个网格） · 实时调节` }); // 页面右侧的面板
  /** 把面板里的一项发给图层 @param {string} key 字段 @returns {(value: *) => void} 回调 */
  const send = key => value => DTSDashLines.setStyle(fdapi, ID, { [key]: value });
  gui.add(look, 'style', { 流动虚线: 'dash', 追逐箭头: 'arrow' }).name('样式').onChange(send('style'));
  gui.addColor(look, 'color').name('颜色').onChange(send('color'));
  gui.add(look, 'speed', 0, 2, 0.01).name('速度').onChange(send('speed'));
  gui.add(look, 'brightness', 0, 10, 0.1).name('亮度').onChange(send('brightness'));
  gui.add(look, 'opacity', 0, 1, 0.01).name('不透明度').onChange(send('opacity'));
  gui.add(look, 'reverse').name('反向').onChange(send('reverse'));
  // 线宽、间距要重建网格：松手再发
  gui.add(look, 'width', 0.5, 40, 0.5).name('线宽(m)').onFinishChange(send('width'));
  gui.add(look, 'spacingMeters', 1, 100, 1).name('间距(m)').onFinishChange(send('spacingMeters'));
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  // 网格 id 是 demo_dash_mesh_0、_1 …：按 id 范围删除（customMesh 不记 groupId；删不存在的 id 也返回成功）
  await fdapi.customMesh.delete(Array.from({ length: 128 }, (_, i) => `demo_dash_mesh_${i}`));
}
