import { type EffectPanel, api } from '../effectRuntime'

/**
 * 边界流光 — fdapi.customObject + 蓝图 BP_BoundaryFlow_V2R2C
 * 效果总包里的范围光流：光点从第一个顶点出发，沿闭合边界两头同时生长，在对面合围后留下发光边线；
 * 生长中两端各带一团粒子和空间尾丝。边线是真实的三维圆管，会被楼和地形正常遮挡。
 * 依赖：Cloud 已挂载效果总包（PAK 见 docs/dts-effects）。直接调蓝图函数，不用额外的 js。
 * 页面右侧「实时调节」面板改了立即生效；文件开头的「参数」是创建时用的，改了要重新运行。
 *
 * ── BP_BoundaryFlow_V2R2C 接口（customObject.callBPFunction；参数类型 3 浮点、5 字符串、6 线性颜色 RGBA）──
 *   SetBoundary(String)                    边界：'X=北向厘米 Y=东向厘米 Z=高度厘米|…'，相对对象位置（第一个顶点）；
 *                                          3–256 个点，不能自交，首尾不用重复。DTS 生成的对象带 -90° 偏航，所以 x、y 对调
 *   Configure(时长秒, 散布宽度厘米, 亮度, 颜色)   生长一圈的时长、生长端粒子散开的宽度、发光强度、颜色
 *   Play() / Pause() / Restart()           播放 / 暂停 / 从头播放
 *   SetProgress(0–1)                       定格在某个进度（先 Pause）
 *   ShowFinal()                            直接显示合围后的终态
 */

// ── 参数 ──
const duration = 6;          // 生长时长(s)，min=1 max=30 step=0.5，两端各走半圈、在对面合围用的秒数
const widthM = 3;            // 散布宽度(m)，min=0.5 max=20 step=0.5，生长端粒子散开的宽度
const brightness = 2;        // 亮度，min=0.2 max=10 step=0.1
const color = '#19b8ff';     // 颜色
const distance = 42;         // 观察距离，min=30 max=3000 step=10，lookAt 的距离，实际相机距离约是它的 1.7 倍

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  const ID = 'demo_boundary_flow'; // 蓝图对象 id
  const ASSET = '/JC_CustomAssets/ObjectLibrary/Exhibition/BoundaryFlowV2R2C/BP_BoundaryFlow_V2R2C'; // 蓝图资源路径
  // 边界顶点：demo.acp 北边公园里的一块草地（工程投影坐标，米；z 是实测地面高度），沿边界依次排列；换工程时改这里。
  // 顶点之间按三维直线连，不会自动贴合中间的地形：起伏大的地方要多给点
  const points: [number, number, number][] = [[492328.5, 2492291.7, -0.55], [492398.9, 2492290.2, -0.55], [492398.0, 2492234.1, -0.55], [492329.7, 2492242.5, -0.55]];
  const [x0, y0, z0] = points[0]!; // 对象位置 = 第一个顶点
  const boundary = points.map(([x, y, z]) => `X=${((y - y0) * 100).toFixed(1)} Y=${((x - x0) * 100).toFixed(1)} Z=${((z - z0) * 100).toFixed(1)}`).join('|'); // 蓝图要的边界字符串

  await fdapi.customObject.delete([ID]);
  await fdapi.customObject.add({ id: ID, assetPath: ASSET, location: [x0, y0, z0], rotation: [0, 0, 0], scale: [1, 1, 1], coordinateType: 0, collision: false, autoHeight: false, enableDecal: false });

  // add 返回 0 不代表资源存在：能列出蓝图函数才说明总包已挂载
  const fns = await new Promise<any>(resolve => fdapi.customObject.getBPFunction(ID, resolve)); // 蓝图函数列表
  if (!fns?.data?.[0]?.params?.length) throw new Error('Cloud 没有挂载效果总包：找不到 BP_BoundaryFlow_V2R2C');

  /** 取色器的 sRGB 转成蓝图要的线性颜色 @param {string} hex '#rrggbb' @returns {number[]} [r, g, b, 1] */
  const linear = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).concat(1);
  /** callBPFunction 的一个参数 @param {number} paramType 参数类型 @param {*} paramValue 值 @returns {object} 参数 */
  const p = (paramType, paramValue) => ({ paramType, paramValue });
  /** 调一个蓝图函数：不等结果，指令按发送顺序执行 @param {string} functionName 函数名 @param {object[]} [parameters] 参数 @returns {void} */
  const call = (functionName: string, parameters: object[] = []) => fdapi.customObject.callBPFunction([{ id: ID, functionName, parameters }]);

  call('Pause');
  call('SetBoundary', [p(5, boundary)]);
  call('Configure', [p(3, duration), p(3, widthM * 100), p(3, brightness), p(6, linear(color))]);
  call('Play');
  await fdapi.camera.lookAt(492364, 2492262, 0, distance, -40, -70, 1);

  // ── 实时调节面板 ──
  const gui = panel({ title: '边界流光 · 实时调节' }); // 页面右侧的面板
  const live = { duration, widthM, brightness, color, progress: 0.5 }; // 面板里的值
  /** 把面板里的时长、宽度、亮度、颜色发给蓝图 @returns {void} */
  const configure = () => call('Configure', [p(3, live.duration), p(3, live.widthM * 100), p(3, live.brightness), p(6, linear(live.color))]);
  gui.add({ restart: () => call('Restart') }, 'restart').name('▶ 从头播放');
  gui.add({ pause: () => call('Pause') }, 'pause').name('暂停');
  gui.add({ play: () => call('Play') }, 'play').name('继续');
  gui.add({ final: () => call('ShowFinal') }, 'final').name('显示终态');
  gui.add(live, 'progress', 0, 1, 0.01).name('定格进度').onChange(value => { call('Pause'); call('SetProgress', [p(3, value)]); });
  gui.add(live, 'duration', 1, 30, 0.5).name('生长时长(s)').onChange(configure);
  gui.add(live, 'widthM', 0.5, 20, 0.5).name('散布宽度(m)').onChange(configure);
  gui.add(live, 'brightness', 0.2, 10, 0.1).name('亮度').onChange(configure);
  gui.addColor(live, 'color').name('颜色').onChange(configure);
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  await fdapi.customObject.delete(['demo_boundary_flow']);
}
