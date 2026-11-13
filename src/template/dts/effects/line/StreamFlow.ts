import { type EffectPanel, api, loadLib } from '../effectRuntime'

/**
 * 空间光流 — fdapi.customMesh + 材质 MI_StreamFlow_V4_0 / MI_SpatialFlow_V2_1
 * 效果总包里的两种立体光流，沿路线流动，都是真实三维网格（不是贴地的线），会被楼正常遮挡：
 *   体积光流（V4.1）：一束有半径的光流，里面是交叉的柔边光片、光丝和光点；半径从 2 米放大到上百米时，光晕、光丝、间距、速度自动适配
 *   粒子光流（V2.1）：路面上方一串飞行的光点，每个带两段拖尾
 * 路线坐标是光流的底面，体积光流的中心轴自动抬高一个半径。单个对象最长 1200 米（体积）/ 3600 米（粒子），更长的要分段。
 * 依赖：Cloud 已挂载效果总包（PAK 见 docs/dts-effects）；封装好的接口 public/static/dts-effects/libs/stream-flow.js（全局 DTSStreamFlow）、
 * public/static/dts-effects/libs/spatial-flow.js（全局 DTSSpatialFlow），都要先加载 public/static/dts-effects/libs/dynamic-lines.js。
 * 页面右侧「实时调节」面板改了立即生效；文件开头的「参数」是创建时用的，改了要重新运行。
 *
 * ── 接口（只算网格，网格用 fdapi.customMesh.add 自己加；SDK 会改写字段，要传副本）──
 *   DTSStreamFlow.prepareMeshes({ id, coordinates, radius, autoFit, color, speed, spacingMeters, brightness, trail, sparkScale,
 *                                 filamentWidth, haloRadius, reverse, groupId })   返回网格数组，按路线分段，id 是「id_段号」
 *   DTSStreamFlow.retune(meshes, { 要改的字段 })   颜色、速度、方向、亮度、拖尾、光点、光丝、光晕只改材质参数，返回新网格，
 *                                                   用 customMesh.update 发 { id, scalarParameters, vectorParameters, userData }
 *   DTSSpatialFlow.prepareMesh({ id, coordinates, color, width, density, sparkScale, trail, speed, spacingMeters, brightness, reverse, groupId })
 */

// ── 参数 ──
const kind = 'stream';       // 光流，体积光流=stream, 粒子光流=spatial
const radius = 6;            // 半径(m)，min=1 max=200 step=0.5，体积光流的横截面半径，整体高度约两倍半径
const distance = 95;         // 观察距离，min=50 max=3000 step=10，lookAt 的距离，实际相机距离约是它的 1.7 倍

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  const ID = 'demo_stream_flow'; // 网格 id：体积光流按 24 米一段，是 demo_stream_flow_0、_1 …；粒子光流就是它
  // 路线：demo.acp 北边公园南侧的一条路（工程投影坐标，米；z 是实测路面高度），沿流动方向排列；换工程时改这里
  const route = [
    [492341.3, 2492220.1, -0.69], [492389.6, 2492214.2, -0.69], [492444.2, 2492208.5, -0.69], [492490.0, 2492202.3, -0.69],
    [492503.8, 2492198.7, -0.69], [492513.9, 2492192.3, -0.88], [492530.7, 2492177.1, -0.78], [492545.4, 2492169.1, -0.69],
    [492564.1, 2492160.0, -0.69], [492580.7, 2492142.1, -0.88], [492609.5, 2492130.6, -0.88], [492622.1, 2492129.4, -0.88],
    [492636.0, 2492144.0, -0.88], [492657.9, 2492162.5, -0.88], [492679.8, 2492167.4, -0.88], [492701.1, 2492164.3, -0.69],
    [492722.3, 2492156.8, -0.69],
  ];

  // 加载封装好的接口（public/libs 下；stream-flow.js、spatial-flow.js 用到 dynamic-lines.js，要后加载）；加载过就跳过
  await loadLib('dynamic-lines.js', 'DTSDynamicLines')
  await loadLib('stream-flow.js', 'DTSStreamFlow')
  await loadLib('spatial-flow.js', 'DTSSpatialFlow')

  // 当前样式，面板改的就是它（体积光流的默认外观；粒子光流只用其中的颜色、速度、亮度、拖尾、光点大小、方向）
  const look = { color: '#16acff', speed: 0.3, brightness: 3.2, trail: 0.7, sparkScale: 1, filamentWidth: 0.018, haloRadius: 0.48, reverse: false };
  /** 粒子光流的网格 @returns {object} customMesh 参数 */
  const spatialMesh = () => DTSSpatialFlow.prepareMesh({ id: ID, coordinates: route, ...look, brightness: Math.min(look.brightness, 4), trail: Math.min(look.trail, 1), sparkScale: Math.min(Math.max(look.sparkScale, 0.5), 3) });

  // 先删上次的网格（customMesh 不记 groupId，按 id 删；删不存在的 id 也返回成功）
  await fdapi.customMesh.delete([ID, ...Array.from({ length: 100 }, (_, i) => `${ID}_${i}`)]);
  let meshes = kind === 'stream' // 当前网格（体积光流按路线分成几段）
    ? DTSStreamFlow.prepareMeshes({ id: ID, coordinates: route, radius, autoFit: true, spacingMeters: 8, ...look })
    : [spatialMesh()];
  await fdapi.customMesh.add(structuredClone(meshes));
  await fdapi.camera.lookAt(492540, 2492172, radius, distance, -26, -60, 1);

  // ── 实时调节面板 ──
  const gui = panel({ title: `${kind === 'stream' ? '体积光流' : '粒子光流'} · 实时调节` }); // 页面右侧的面板
  /** 把面板里的一项发给网格：只改材质参数，不重建网格 @param {string} key 字段 @returns {(value: *) => void} 回调 */
  const send = key => value => {
    meshes = kind === 'stream' ? DTSStreamFlow.retune(meshes, { [key]: value }) : [spatialMesh()];
    fdapi.customMesh.update(meshes.map(({ id, scalarParameters, vectorParameters, userData }) => ({ id, scalarParameters, vectorParameters, userData })));
  };
  gui.addColor(look, 'color').name('颜色').onChange(send('color'));
  gui.add(look, 'speed', 0, 2, 0.01).name('速度').onChange(send('speed'));
  gui.add(look, 'brightness', 0, 8, 0.1).name('亮度').onChange(send('brightness'));
  gui.add(look, 'trail', 0.02, 1, 0.01).name('拖尾').onChange(send('trail'));
  gui.add(look, 'sparkScale', 0.25, 4, 0.05).name('光点大小').onChange(send('sparkScale'));
  gui.add(look, 'reverse').name('反向').onChange(send('reverse'));
  if (kind === 'stream') {
    gui.add(look, 'filamentWidth', 0.002, 0.2, 0.001).name('光丝粗细').onChange(send('filamentWidth'));
    gui.add(look, 'haloRadius', 0.08, 3, 0.01).name('光晕半径').onChange(send('haloRadius'));
  }
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  // 体积光流按 24 米一段（demo_stream_flow_0、_1 …），粒子光流是 demo_stream_flow：按 id 删除（customMesh 不记 groupId）
  await fdapi.customMesh.delete(['demo_stream_flow', ...Array.from({ length: 100 }, (_, i) => `demo_stream_flow_${i}`)]);
}
