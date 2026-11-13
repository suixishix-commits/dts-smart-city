import { type EffectPanel, api, loadLib } from '../effectRuntime'

/**
 * 流动线（四种样式） — fdapi.polyline + 效果总包里的折线材质
 * 一条折线换四种材质：流动虚线 MI_FlowDash_V1_2、追逐箭头 MI_ChaseArrow_V1_2、粒子流光 MI_ParticleFlow_V2_0、
 * 脉冲流光 MI_PulseComposite_V2_0（粒子流里隔一段跑过一个亮脉冲）。线宽、间距按米算，方向沿着点的顺序。
 * 依赖：Cloud 已挂载效果总包（PAK 见 docs/dts-effects）；封装好的接口 public/static/dts-effects/libs/dynamic-lines.js（全局 DTSDynamicLines，虚线和箭头）、
 * public/static/dts-effects/libs/flow-fx.js（全局 DTSFlowFX，粒子和脉冲），它们只负责算材质参数，折线用 fdapi.polyline.add / update 自己加。
 * 页面右侧「实时调节」面板改了立即生效；文件开头的「参数」是创建时用的，改了要重新运行。
 *
 * ── 接口 ──
 *   DTSDynamicLines.preparePolyline({ id, coordinates, style: 'dash' | 'arrow', color, width, spacingMeters, speed, brightness, reverse })
 *   DTSFlowFX.preparePolyline({ 同上, style: 'particles' | 'pulse', density 0.25–3, trail 0.02–1, spread 0.1–0.8, sparkScale 0.5–3,
 *                               pulseSpacingMeters（脉冲间距，≥ spacingMeters）, headStrength 0–4（脉冲头亮度） })
 *   返回 polyline.add / update 的参数（material + scalarParameters + vectorParameters）；coordinates 是 [[x, y, z], …]（工程投影坐标，米）
 */

// ── 参数 ──
const style = 'dash';        // 样式，流动虚线=dash, 追逐箭头=arrow, 粒子流光=particles, 脉冲流光=pulse
const width = 26;            // 线宽(m)，min=0.5 max=50 step=0.5
const distance = 95;         // 观察距离，min=50 max=3000 step=10，lookAt 的距离，实际相机距离约是它的 1.7 倍

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  const ID = 'demo_flow_line'; // 折线 id
  // 路线：demo.acp 北边公园南侧的一条路（工程投影坐标，米；z 是实测路面高度），沿行驶方向排列；换工程时改这里
  const road: [number, number, number][] = [
    [492341.3, 2492220.1, -0.69], [492389.6, 2492214.2, -0.69], [492444.2, 2492208.5, -0.69], [492490.0, 2492202.3, -0.69],
    [492503.8, 2492198.7, -0.69], [492513.9, 2492192.3, -0.88], [492530.7, 2492177.1, -0.78], [492545.4, 2492169.1, -0.69],
    [492564.1, 2492160.0, -0.69], [492580.7, 2492142.1, -0.88], [492609.5, 2492130.6, -0.88], [492622.1, 2492129.4, -0.88],
    [492636.0, 2492144.0, -0.88], [492657.9, 2492162.5, -0.88], [492679.8, 2492167.4, -0.88], [492701.1, 2492164.3, -0.69],
    [492722.3, 2492156.8, -0.69],
  ];
  const route = road.map(([x, y, z]) => [x, y, z + 0.4]); // 抬高 0.4 米，免得和路面互相遮挡闪烁

  // 加载封装好的接口（public/libs 下；flow-fx.js 用到 dynamic-lines.js，要后加载）；加载过就跳过
  await loadLib('dynamic-lines.js', 'DTSDynamicLines')
  await loadLib('flow-fx.js', 'DTSFlowFX')

  // 当前样式，面板改的就是它（粒子、脉冲的几项只对这两种样式有用）
  const look = { style, color: '#24c9ff', width, spacingMeters: 60, speed: 0.97, brightness: 5.3, reverse: false, density: 2, trail: 0.4, spread: 0.74, sparkScale: 2.6, pulseSpacingMeters: 72, headStrength: 1.6 };
  /** 按当前样式算出折线参数 @returns {object} polyline.add / update 的参数 */
  const build = () => (look.style === 'dash' || look.style === 'arrow' ? DTSDynamicLines : DTSFlowFX).preparePolyline({ id: ID, coordinates: route, ...look });

  await fdapi.polyline.delete(ID);
  await fdapi.polyline.add(build());
  await fdapi.camera.lookAt(492540, 2492172, 0, distance, -32, -60, 1);

  // ── 实时调节面板 ──
  const gui = panel({ title: '流动线 · 实时调节' }); // 页面右侧的面板
  /** 按当前样式重新算参数并更新折线 @returns {void} */
  const apply = () => fdapi.polyline.update(build());
  gui.add(look, 'style', { 流动虚线: 'dash', 追逐箭头: 'arrow', 粒子流光: 'particles', 脉冲流光: 'pulse' }).name('样式').onChange(apply);
  gui.addColor(look, 'color').name('颜色').onChange(apply);
  gui.add(look, 'width', 0.5, 50, 0.5).name('线宽(m)').onChange(apply);
  gui.add(look, 'spacingMeters', 1, 60, 1).name('间距(m)').onChange(apply);
  gui.add(look, 'speed', 0, 2, 0.01).name('速度').onChange(apply);
  gui.add(look, 'brightness', 0, 10, 0.1).name('亮度').onChange(apply);
  gui.add(look, 'reverse').name('反向').onChange(apply);
  const fx = gui.addFolder('粒子 / 脉冲').close(); // 只对粒子流光、脉冲流光有用（默认收起）
  fx.add(look, 'density', 0.25, 3, 0.05).name('粒子密度').onChange(apply);
  fx.add(look, 'trail', 0.02, 1, 0.01).name('拖尾').onChange(apply);
  fx.add(look, 'spread', 0.1, 0.8, 0.01).name('散布').onChange(apply);
  fx.add(look, 'sparkScale', 0.5, 3, 0.05).name('光点大小').onChange(apply);
  fx.add(look, 'pulseSpacingMeters', 12, 300, 1).name('脉冲间距(m)').onChange(apply);
  fx.add(look, 'headStrength', 0, 4, 0.05).name('脉冲头亮度').onChange(apply);
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  await fdapi.polyline.delete('demo_flow_line');
}
