import { type EffectPanel, api, loadLib } from '../effectRuntime'

/**
 * 可见表面贴地线 — fdapi.polyline + 效果总包里的贴地材质（_V1_3 / _V2_1）
 * 和「流动线（四种样式）」同样的四种图案，但打开贴地后图案画在线下方能看到的表面上：地形、道路、3DT 模型的屋顶和斜坡，
 * 线本身的 z 只用于远处。关掉贴地时，线就悬在给定的 z 上，效果与旧版一致。
 * 依赖：Cloud 已挂载效果总包 v17（或单独的 LineOnTerrain-V1.1-WindowsNoEditor.pak，二选一）；
 * 接口 public/static/dts-effects/libs/dynamic-lines.js（DTSDynamicLines）、flow-fx.js（DTSFlowFX）、line-on-terrain.js（DTSLineOnTerrain），按这个顺序加载。
 * 页面右侧「实时调节」面板改了立即生效；文件开头的「参数」是创建时用的，改了要重新运行。
 *
 * ── 接口（只算折线参数，折线用 fdapi.polyline.add / update 自己加）──
 *   const line = DTSDynamicLines.preparePolyline({ id, coordinates, style: 'dash' | 'arrow', … })   // 或 DTSFlowFX：'particles' | 'pulse'
 *   fdapi.polyline.add(DTSLineOnTerrain.prepare(line, { onTerrain, marginMeters, minPixelWidth }))
 *     onTerrain     true 贴地 / false 悬在 z 上（贴地时 depthTest 强制为 false）
 *     marginMeters  线带每侧余量（米），高楼低角度时图案被切掉就调大
 *     minPixelWidth 最小屏幕宽度（像素，按 1080 高画面），0 = 不限
 */

// ── 参数 ──
const onTerrain = true;      // 贴地
const z = 0;                 // 线的高度 z(m)，min=-10 max=20 step=1，贴地时只影响远处
const distance = 90;         // 观察距离，min=50 max=3000 step=10，lookAt 的距离，实际相机距离约是它的 2 倍

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  const PREFIX = 'demo_lot'; // 折线 id 前缀：demo_lot_dash、demo_lot_arrow …
  // 路线：demo.acp 北边公园一带（工程投影坐标，米），四条线各向北错开 28 米；换工程时改这里
  const ROUTE: [number, number][] = [[492280, 2492110], [492450, 2492190], [492620, 2492240]];
  const LINES = [
    { key: 'dash', dy: 0, maker: 'DTSDynamicLines', options: { style: 'dash', width: 8 } },
    { key: 'arrow', dy: 28, maker: 'DTSDynamicLines', options: { style: 'arrow', width: 8, color: '#ffb020' } },
    { key: 'particles', dy: 56, maker: 'DTSFlowFX', options: { style: 'particles', width: 10 } },
    { key: 'pulse', dy: 84, maker: 'DTSFlowFX', options: { style: 'pulse', width: 10 } },
  ];

  // 加载封装好的接口（public/libs 下，按依赖顺序）；加载过就跳过
  await loadLib('dynamic-lines.js', 'DTSDynamicLines')
  await loadLib('flow-fx.js', 'DTSFlowFX')
  await loadLib('line-on-terrain.js', 'DTSLineOnTerrain')

  const look = { onTerrain, z, marginMeters: 30, minPixelWidth: 3 }; // 面板改的就是它
  /** 四条线的 polyline 参数 @returns {object[]} polyline.add / update 的参数 */
  const build = () => LINES.map(({ key, dy, maker, options }) => DTSLineOnTerrain.prepare(
    (window as any)[maker].preparePolyline({ id: `${PREFIX}_${key}`, coordinates: ROUTE.map(([x, y]) => [x, y + dy, look.z]), ...options }),
    { onTerrain: look.onTerrain, marginMeters: look.marginMeters, minPixelWidth: look.minPixelWidth },
  ));

  await fdapi.polyline.delete(LINES.map(l => `${PREFIX}_${l.key}`));
  await fdapi.polyline.add(build());
  await fdapi.camera.lookAt(492450, 2492230, 0, distance, -40, -90, 1);

  // ── 实时调节面板 ──
  const gui = panel({ title: '贴地线 · 实时调节' }); // 页面右侧的面板
  /** 重新算参数并更新四条线 @returns {void} */
  const apply = () => fdapi.polyline.update(build());
  gui.add(look, 'onTerrain').name('贴地').onChange(apply);
  gui.add(look, 'z', -10, 20, 1).name('线的高度 z(m)').onFinishChange(apply);
  gui.add(look, 'marginMeters', 0, 200, 5).name('线带余量(m/每侧)').onFinishChange(apply);
  gui.add(look, 'minPixelWidth', 0, 10, 1).name('最小宽度(px)').onFinishChange(apply);
  const views = { 斜看: [-40, 90], 低视角: [-14, 70], 俯视: [-85, 140], '拉远 6 km': [-60, 3000] }; // [俯仰, 距离]
  for (const [name, [pitch, dist]] of Object.entries(views)) {
    gui.add({ [name]: () => fdapi.camera.lookAt(492450, 2492230, 0, dist, pitch, -90, 1) }, name);
  }
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  await fdapi.polyline.delete(['demo_lot_dash', 'demo_lot_arrow', 'demo_lot_particles', 'demo_lot_pulse']);
}
