import { type EffectPanel, api, loadLib } from '../effectRuntime'

/**
 * 实例化空间粒子光流 V5 — fdapi.customObject + 蓝图 BP_StreamFlow_V5
 * 和「空间光流」一样是沿路线流动的立体光流，但 V5 把所有路线放进一个蓝图对象里实例化绘制：
 * 浏览器只发路线段和样式数值，网格在引擎里生成，路线多时加载快得多（1000 条约 1.8 秒）。
 * 依赖：Cloud 已挂载效果总包 v17（含 BP_StreamFlow_V5）；不用总包时在「PAK 路径」里填 StreamFlow-V5-WindowsNoEditor.pak 在渲染机上的路径。
 * 接口 public/static/dts-effects/libs/stream-flow-instanced.js（全局 DTSStreamFlowInstanced）。
 * 页面右侧「实时调节」面板松手后生效；文件开头的「参数」是创建时用的，改了要重新运行。
 *
 * ── DTSStreamFlowInstanced 接口 ──
 *   prepareLayer({ id, routes, pakFilePath, ...样式 })  只算数据，返回 plan；routes 是 [[[x, y, z], …], …]，点是光流的底面
 *   load(fdapi, plan)                   建对象并发送路线；不会删旧对象，同 id 要先 remove
 *   setStyle(fdapi, id, 完整样式)        没写的字段会回到默认值，所以总是传完整的一份
 *   remove(fdapi, id)
 *   样式字段和范围见 DTSStreamFlowInstanced.defaults / ranges（下面面板里都有）
 */

// ── 参数 ──
const count = 100;           // 路线数，min=1 max=5000 step=1，在城区 3 km 见方的网格里生成
const pakFilePath = '';      // PAK 路径：已挂载总包时留空；否则填渲染机上的 .pak 路径
const distance = 1300;       // 观察距离，min=50 max=20000 step=50，lookAt 的距离

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  const ID = 'demo_stream_v5'; // 蓝图对象 id
  const CENTER: [number, number] = [492500, 2492250]; // demo.acp 城区中心（工程投影坐标，米）；换工程时改这里

  // 加载封装好的接口；加载过就跳过
  await loadLib('stream-flow-instanced.js', 'DTSStreamFlowInstanced')
  const fx = DTSStreamFlowInstanced;

  /** 交付示例里的测试路线：网格起点、每步 3 米、走到一半拐 90° @param {number} n 路线数 @returns {number[][][]} 路线 */
  const testRoutes = (n: number): number[][][] => {
    const side = Math.ceil(Math.sqrt(n)), cell = 3000 / side; // 网格
    return Array.from({ length: n }, (_, i) => {
      let px = CENTER[0] - 1500 + i % side * cell, py = CENTER[1] - 1500 + Math.floor(i / side) * cell, heading = i * 2.399963 % (2 * Math.PI);
      const points = [[px, py, 0]], turn = (i % 2 ? 1 : -1) * Math.PI / 2; // 路线与拐弯方向
      for (let j = 0; j < 134; j++) { if (j >= 80 && j < 86) heading += turn / 6; px += Math.cos(heading) * 3; py += Math.sin(heading) * 3; points.push([px, py, 0]); }
      return points;
    });
  };

  const style = { ...fx.defaults }; // 当前样式，面板改的就是它
  const routes = testRoutes(count); // 路线
  let plan; // 当前已加载的数据
  /** 删掉旧对象，按当前样式重新算并加载 @returns {Promise<void>} 加载完成 */
  const reload = async () => {
    await fx.remove(fdapi, ID).catch(() => {});
    plan = fx.prepareLayer({ id: ID, routes, pakFilePath, ...style });
    await fx.load(fdapi, plan);
  };
  await reload();
  await fdapi.camera.lookAt(CENTER[0], CENTER[1], 0, distance, -50, -90, 1);

  // ── 实时调节面板 ──
  const gui = panel({ title: '实例化光流 · 实时调节' }); // 页面右侧的面板
  /** 发送完整样式；半径、密度改变了光丝或光点轨道数时必须重新加载 @returns {Promise<void>} 完成 */
  const apply = async () => {
    const next = fx.resolveSettings({ ...style }); // 新样式对应的轨道数
    const now = plan.settings; // 已加载的轨道数
    if (next.filaments !== now.filaments || next.sparkTracks !== now.sparkTracks || next.groups !== now.groups) await reload();
    else await fx.setStyle(fdapi, ID, { ...style });
  };
  gui.addColor(style, 'color').name('光流颜色').onFinishChange(apply);
  // [字段, 名称, 步长]；范围取自 fx.ranges
  const CONTROLS: any[][] = [['radius', '空间半径(m)', 0.1], ['density', '粒子密度', 0.05], ['speedMps', '速度(m/s)', 0.1], ['brightness', '发光强度', 0.1], ['minPixelWidth', '最小屏幕宽度', 0.1]];
  const limit = (key, max) => Math.min(fx.ranges[key][1], max); // 滑块上限收窄到常用范围
  for (const [key, name, step] of CONTROLS) gui.add(style, key, fx.ranges[key][0], limit(key, key === 'radius' ? 50 : 20), step).name(name).onFinishChange(apply);
  gui.add(style, 'reverse').name('反向流动').onChange(apply);
  const detail = gui.addFolder('光丝、光核与拖尾').close(); // 默认收起
  detail.add(style, 'filamentWidth', 0.001, 0.2, 0.001).name('光丝直径(m)').onFinishChange(apply);
  detail.add(style, 'haloRadius', 0.01, 3, 0.01).name('光晕半径(m)').onFinishChange(apply);
  detail.add(style, 'sparkScale', 0.1, 4, 0.1).name('光核倍率').onFinishChange(apply);
  detail.add(style, 'trailMeters', 0, 10, 0.01).name('拖尾长度(m)').onFinishChange(apply);
  detail.add(style, 'spacingMeters', 0.5, 40, 0.1).name('粒子间距(m)').onFinishChange(apply);
  gui.add({ near: () => fdapi.camera.lookAt(...routes[0]![82]!,Math.max(35, style.radius * 5), -22, -50, 1) }, 'near').name('近看第一条');
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  await fdapi.customObject.delete(['demo_stream_v5']);
}
