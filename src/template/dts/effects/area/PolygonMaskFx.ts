import { type EffectPanel, api, loadLib, sleep } from '../effectRuntime'

/**
 * 多边形遮罩 — fdapi.customObject + 蓝图 BP_PolygonMask_V1
 * 效果总包里的多边形遮罩：半透明黑色遮罩从外边界向中心收拢，停在区域轮廓上，留出区域；
 * 填满后区域轮廓亮起，并沿轮廓立起一圈向上变淡的蓝色光墙（墙高按区域面积自动算）。
 * 依赖：Cloud 已挂载效果总包（PAK 见 docs/dts-effects）；封装好的接口 public/static/dts-effects/libs/polygon-mask.js（全局 PolygonMask）。
 * 页面右侧「实时调节」面板改了立即生效；文件开头的「参数」是创建时用的，改了要重新运行。
 *
 * ── PolygonMask 接口 ──
 *   create(fdapi, { id, holes: [环, …], outer?, groundZ?, autoPlay?, …样式 })
 *       holes 留出来的区域，可以多个环（奇偶规则：洞里的岛会重新遮住）；outer 外边界，不传 = 区域外接矩形每边外扩
 *       地面高度靠射线采样，区域要在画面里（或传 groundZ）
 *   update(fdapi, id, { holes })   换区域，不重播；墙高 1 秒内缓到新高度
 *   play(fdapi, id)                从外边界重新收拢
 *   setStyle(fdapi, id, { 要改的字段 })   progress 填充进度 0–1、fillDurationSeconds、revealDurationSeconds、maskOpacity、
 *       color（线性 RGBA）、glowIntensity、wallGradientPower、heightScale / minHeightM / maxHeightM（墙高 = clamp(k × √面积, 下限, 上限)）
 *   remove(fdapi, id)
 */

// ── 参数 ──
const fillSeconds = 2.5;     // 收拢时长(s)，min=0.1 max=20 step=0.1，遮罩从外边界收拢到区域轮廓用的秒数
const maskOpacity = 0.7;     // 遮罩不透明度，min=0 max=1 step=0.05，0 = 没有遮罩，1 = 纯黑
const color = '#2795ff';     // 轮廓颜色：轮廓线、光晕、光墙的颜色
const distance = 620;        // 观察距离，min=100 max=3000 step=10，lookAt 的距离，实际相机距离约是它的 1.7 倍

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  const ID = 'demo_polygon_mask'; // 遮罩对象 id
  // 留出来的区域：demo.acp 城区中心的一片街区（工程投影坐标，米），沿边界依次排列；换工程时改这里
  const hole = [[490300, 2490960], [490580, 2490900], [490790, 2491060], [490760, 2491330], [490480, 2491400], [490270, 2491230]];

  // 加载封装好的接口（public/static/dts-effects/libs/polygon-mask.js，全局 PolygonMask）；加载过就跳过
  await loadLib('polygon-mask.js', 'PolygonMask')

  /** 取色器的 sRGB 转成蓝图要的线性颜色 @param {string} hex '#rrggbb' @returns {number[]} [r, g, b, 1] */
  const linear = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).concat(1);

  // 先飞过去：地面高度靠射线采样，区域要在画面里（lookAt 不等飞完就返回，所以再等一下）
  await fdapi.camera.lookAt(490530, 2491150, 0, distance, -45, -75, 1);
  await sleep(1600);

  const info = await PolygonMask.create(fdapi, { id: ID, holes: [hole], fillDurationSeconds: fillSeconds, maskOpacity, color: linear(color) });

  // ── 实时调节面板 ──
  const gui = panel({ title: '多边形遮罩 · 实时调节' }); // 页面右侧的面板
  // 面板里的值（光晕、墙的默认值来自蓝图）
  const live = { progress: 1, maskOpacity, color, glowIntensity: 3, wallGradientPower: 1.8, heightScale: 0.05, minHeightM: 10, maxHeightM: 150, fillDurationSeconds: fillSeconds, revealDurationSeconds: 0.8 };
  /** 把面板里的一项发给蓝图（颜色先转成线性） @param {string} key 字段 @returns {(value: *) => void} onChange 回调 */
  const send = key => value => PolygonMask.setStyle(fdapi, ID, { [key]: key === 'color' ? linear(value) : value });
  gui.add({ play: () => PolygonMask.play(fdapi, ID) }, 'play').name('▶ 重新收拢');
  gui.add(live, 'progress', 0, 1, 0.01).name('填充进度').onChange(send('progress'));
  gui.add(live, 'maskOpacity', 0, 1, 0.01).name('遮罩不透明度').onChange(send('maskOpacity'));
  gui.addColor(live, 'color').name('轮廓颜色').onChange(send('color'));
  gui.add(live, 'glowIntensity', 0, 20, 0.1).name('发光强度').onChange(send('glowIntensity'));
  const wall = gui.addFolder(`光墙（当前墙高 ${info.heightM.toFixed(0)} m）`).close(); // 光墙分组（默认收起）
  wall.add(live, 'wallGradientPower', 0.2, 8, 0.1).name('向上变淡').onChange(send('wallGradientPower'));
  wall.add(live, 'heightScale', 0, 0.3, 0.005).name('高度系数').onChange(send('heightScale'));
  wall.add(live, 'minHeightM', 0, 200, 1).name('最低(m)').onChange(send('minHeightM'));
  wall.add(live, 'maxHeightM', 0, 500, 1).name('最高(m)').onChange(send('maxHeightM'));
  const timing = gui.addFolder('动画时长').close(); // 时长分组（默认收起）：下次收拢时生效
  timing.add(live, 'fillDurationSeconds', 0.1, 20, 0.1).name('收拢时长(s)').onChange(send('fillDurationSeconds'));
  timing.add(live, 'revealDurationSeconds', 0, 10, 0.1).name('轮廓出现(s)').onChange(send('revealDurationSeconds'));
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  await fdapi.customObject.delete(['demo_polygon_mask']);
}
