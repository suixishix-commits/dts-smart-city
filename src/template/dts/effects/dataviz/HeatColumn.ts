import { type EffectPanel, api } from '../effectRuntime'

/**
 * 热力柱 — fdapi.marker3d.add + callBPFunction
 * 效果总包里的 3D 标注蓝图 BP_Marker3D_HeatColumn：方柱按数值升起，色带从底到顶 蓝 → 绿 → 黄 → 红，柱脚有扩散光圈。
 * 依赖：Cloud 已挂载效果总包（PAK 见 docs/dts-effects）。直接调蓝图函数，不用额外的 js。
 * 页面右侧「实时调节」面板改了立即生效；文件开头的「参数」是创建时用的，改了要重新运行。
 *
 * ── BP_Marker3D_HeatColumn 接口（marker3d.callBPFunction，参数类型 3 浮点、0 布尔、6 线性颜色 RGBA）──
 *   SetHeightM(高度米)          从当前高度平滑过渡；刚加载时从 0 升起
 *   SetWorldWidthM(边长米)      真实宽度，近大远小；0 = 改用屏幕宽度 SetWidthPx(像素，按画面高 1080 计)
 *   SetGradientColors(低, 中, 高, 顶)  四个色标，默认蓝 #1E7BFF、绿 #19E07A、黄 #FFE02A、红 #FF3B2A
 *   SetScaleMaxM(米)            0 = 每根柱子完整色带；大于 0 = 所有柱子共用一把高度刻度
 *   SetBrightness / SetOpacity  亮度倍数 / 侧面不透明度
 *   SetFlow(强度, 周期秒)       内部缓慢上行的流光，强度 0 = 关
 *   SetRiseDuration(秒)         升起时长，0 = 立即到位
 *   SetRingVisible(布尔) / SetRingPulse(秒)  柱脚光圈开关 / 波纹周期（0 = 静止）
 */

// ── 参数 ──
const count = 25;              // 柱子数，min=1 max=400 step=1
const spacing = 70;            // 间距(m)，min=10 step=5
const maxHeight = 260;         // 最高(m)，min=10 step=10，数值最大的那根柱子的高度
const width = 26;              // 柱宽(m)，min=0 step=2，真实边长；0 = 改用屏幕固定宽度
const rise = 1.2;              // 升起时长(s)，min=0 max=10 step=0.1
const distance = 520;          // 观察距离，min=100 step=50，lookAt 的距离，实际相机距离约是它的 1.7 倍

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  const GROUP = 'demo_heat_column'; // 标注分组，id 是 demo_heat_column_0、_1 …
  const [cx, cy] = [490212, 2490945]; // 柱阵中心：demo.acp 城区（工程投影坐标，米）；换工程时改这里

  await fdapi.marker3d.deleteByGroupId(GROUP);

  /** 第 i 根柱子的数值（0.15–1）：固定的伪随机数，每次运行一样 @param {number} i 序号 @param {number} [seed] 换一组数时改它 @returns {number} 数值 */
  const valueOf = (i, seed = 4.1) => 0.15 + 0.85 * Math.abs((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1);
  const side = Math.ceil(Math.sqrt(count)); // 网格每行几根
  // 柱子：按网格排开
  const columns = Array.from({ length: count }, (_, i) => ({
    id: `${GROUP}_${i}`,
    x: cx + (i % side - (side - 1) / 2) * spacing,
    y: cy + (Math.floor(i / side) - (side - 1) / 2) * spacing,
    value: valueOf(i),
  }));

  await fdapi.marker3d.add(columns.map(c => ({
    id: c.id,
    groupId: GROUP,
    pointName: 'BP_Marker3D_HeatColumn',   // 3D 标注的资源名就是蓝图名
    coordinate: [c.x, c.y, 0],
    coordinateType: 0,
    autoHeight: true,                      // z 传 0 + autoHeight：柱底自动贴到地面
    pointScale: 1,
    fixedSize: false,
    range: [1, 1e7],
  })));

  // marker3d.add 返回 0 不代表资源存在：能列出蓝图函数才说明总包已挂载
  const probe = await new Promise<any>(resolve => fdapi.marker3d.getBPFunction(columns[0]!.id, resolve)); // 蓝图函数列表
  if (!probe?.data?.[0]?.params?.length) throw new Error('Cloud 没有挂载效果总包：找不到 BP_Marker3D_HeatColumn');

  /** callBPFunction 的一个参数 @param {number} paramType 参数类型 @param {*} paramValue 值 @returns {object} 参数 */
  const p = (paramType, paramValue) => ({ paramType, paramValue });
  /** 取色器的 sRGB 转成蓝图要的线性颜色 @param {string} hex '#rrggbb' @returns {number[]} [r, g, b, 1] */
  const linear = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).concat(1);
  /** 给每根柱子调同一个蓝图函数 @param {string} functionName 函数名 @param {object[]} parameters 参数 @returns {void} */
  const callAll = (functionName, parameters) => fdapi.marker3d.callBPFunction(columns.map(c => ({ id: c.id, functionName, parameters })));
  /** 每根柱子设到自己的高度（按升起时长平滑过渡） @returns {void} */
  const setHeights = () => fdapi.marker3d.callBPFunction(columns.map(c => ({ id: c.id, functionName: 'SetHeightM', parameters: [p(3, c.value * live.maxHeight)] })));

  // 面板里的值（亮度、不透明度、流光、色标是蓝图默认值）
  const live = { width, opacity: 0.82, brightness: 1, flow: 0.35, ring: true, globalScale: false, rise, maxHeight, low: '#1e7bff', mid: '#19e07a', high: '#ffe02a', top: '#ff3b2a' };

  // callBPFunction 一次发一批、按顺序执行：先设样式和升起时长，最后设高度，柱子从 0 升起
  fdapi.marker3d.callBPFunction(columns.flatMap(c => [
    { id: c.id, functionName: 'SetWorldWidthM', parameters: [p(3, width)] },
    { id: c.id, functionName: 'SetRiseDuration', parameters: [p(3, rise)] },
  ]));
  setHeights();

  await fdapi.camera.lookAt(cx, cy, 0, distance, -30, -60, 1);

  // ── 实时调节面板 ──
  const gui = panel({ title: '热力柱 · 实时调节' }); // 页面右侧的面板
  let seed = 4.1; // 当前这组数值的种子
  gui.add({ again: () => { callAll('SetRiseDuration', [p(3, 0)]); callAll('SetHeightM', [p(3, 0)]); callAll('SetRiseDuration', [p(3, live.rise)]); setHeights(); } }, 'again').name('▶ 重新升起');
  gui.add({ shuffle: () => { seed += 1; columns.forEach((c, i) => (c.value = valueOf(i, seed))); setHeights(); } }, 'shuffle').name('换一组数值');
  gui.add(live, 'maxHeight', 10, 600, 10).name('最高(m)').onChange(setHeights);
  gui.add(live, 'rise', 0, 10, 0.1).name('升起时长(s)').onChange(value => callAll('SetRiseDuration', [p(3, value)]));
  gui.add(live, 'width', 0, 80, 1).name('柱宽(m)').onChange(value => callAll('SetWorldWidthM', [p(3, value)]));
  gui.add(live, 'opacity', 0, 1, 0.01).name('不透明度').onChange(value => callAll('SetOpacity', [p(3, value)]));
  gui.add(live, 'brightness', 0, 4, 0.05).name('亮度').onChange(value => callAll('SetBrightness', [p(3, value)]));
  gui.add(live, 'flow', 0, 1, 0.05).name('内部流光').onChange(value => callAll('SetFlow', [p(3, value), p(3, 4.5)]));
  gui.add(live, 'ring').name('柱脚光圈').onChange(value => callAll('SetRingVisible', [p(0, value)]));
  gui.add(live, 'globalScale').name('统一刻度').onChange(value => callAll('SetScaleMaxM', [p(3, value ? live.maxHeight : 0)]));
  const colors = gui.addFolder('色带').close(); // 四个色标（默认收起）
  /** 把四个色标发给每根柱子 @returns {void} */
  const sendColors = () => callAll('SetGradientColors', ['low', 'mid', 'high', 'top'].map(k => p(6, linear(live[k]))));
  for (const [key, name] of [['low', '低'], ['mid', '中'], ['high', '高'], ['top', '顶']] as const) colors.addColor(live, key).name(name).onChange(sendColors);
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  await fdapi.marker3d.deleteByGroupId('demo_heat_column');
}
