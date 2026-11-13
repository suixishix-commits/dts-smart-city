import { type EffectPanel, api, loadLib, pakPath } from '../effectRuntime'

/**
 * 多边形漫开 — fdapi.customObject + 蓝图 BP_PolygonSpread_V1（预览版）
 * 半透明的青色"水面"从起点沿多边形内部向外漫开：前沿发光、带毛边，遇到区域外的缺口（水道）会绕行，不会直接穿过；
 * 铺满后留下一圈发光描边。以贴花方式投射，贴合地形、影像和建筑。
 * 依赖：PolygonSpread-V1-WindowsNoEditor.pak（dts-resource/projects/PolygonSpread_20261030/Delivery，未验收、不在总包里），
 * 放进 CloudMaster 文件资源目录后用 '@path:文件名' 引用；接口 public/static/dts-effects/libs/polygon-spread.js（全局 PolygonSpread）。
 * 页面右侧「实时调节」面板改了立即生效；文件开头的「参数」是创建时用的，改了要重新运行。
 *
 * ── PolygonSpread 接口 ──
 *   const spread = new PolygonSpread(fdapi, { pakFilePath })
 *   await spread.add(id, geojson, { coordinateType: 0, origins: [[x, y]], duration, autoPlay, color, opacity, glow, style })
 *       geojson：Polygon / MultiPolygon / Feature / FeatureCollection；coordinateType 0 = 工程投影坐标（米），1 = 经纬度
 *       origins：漫开起点，不传时取区域内离边界最远的点
 *   spread.play(id, 秒) / pause / resume / reset / showFinal / setProgress(id, 0..1)
 *   spread.setColor(id, [r, g, b, a] 线性) / setOpacity / setGlow
 *   spread.setStyle(id, { frontWidth, noiseAmount, noiseScale, edgeWidth })   前沿宽度、毛边强度、噪波尺寸、描边宽度
 *   spread.remove(id)
 */

// ── 参数 ──
const pakFilePath = pakPath('PolygonSpread-V1-WindowsNoEditor.pak', '@path:PolygonSpread-V1-WindowsNoEditor.pak'); // PAK 路径：CloudMaster 文件资源目录里的文件用 @path: 开头；已挂载时留空
const shape = 'square';      // 区域，正方形=square, 带水道的街区=channel
const squareSide = 400;      // 正方形边长(m)，min=50 max=3000 step=10，只对正方形有效，起点在中心
const duration = 4;          // 漫开时长(s)，min=0.5 max=20 step=0.5
const color = '#0dbfd9';     // 颜色
const opacity = 0.45;        // 填充不透明度，min=0 max=1 step=0.05
const distance = 700;        // 观察距离，min=100 max=3000 step=10，lookAt 的距离，实际相机距离约是它的 1.7 倍

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  const ID = 'demo_polygon_spread'; // 蓝图对象 id
  const CENTER: [number, number] = [490535, 2491150]; // demo.acp 城区中心（工程投影坐标，米）；换工程时改这里
  const half = squareSide / 2; // 正方形半边长
  // 区域（沿边界依次排列）：正方形以 CENTER 为中心；街区西边切进一条约 50 米宽的"水道"
  const ring = shape === 'square'
    ? [[CENTER[0] - half, CENTER[1] - half], [CENTER[0] + half, CENTER[1] - half], [CENTER[0] + half, CENTER[1] + half], [CENTER[0] - half, CENTER[1] + half]]
    : [[490250, 2490950], [490600, 2490880], [490820, 2491050], [490800, 2491350], [490500, 2491420], [490260, 2491260],
      [490320, 2491160], [490620, 2491160], [490620, 2491110], [490300, 2491110]];
  const area = { type: 'Polygon', coordinates: [ring] };
  // 起点：正方形在中心；街区在东南角，前沿要绕过水道尽头才能到西北
  const origin = shape === 'square' ? CENTER : [490700, 2491000];

  // 加载封装好的接口（public/static/dts-effects/libs/polygon-spread.js，全局 PolygonSpread）；加载过就跳过
  await loadLib('polygon-spread.js', 'PolygonSpread')

  /** 取色器的 sRGB 转成蓝图要的线性颜色 @param {string} hex '#rrggbb' @returns {number[]} [r, g, b, 1] */
  const linear = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).concat(1);

  await fdapi.customObject.delete([ID]); // 删掉上次的（刷新页面后接口没有记录）
  const spread = new PolygonSpread(fdapi, { pakFilePath }); // 接口实例
  await fdapi.camera.lookAt(CENTER[0], CENTER[1], 0, distance, -45, -90, 1);
  const info = await spread.add(ID, area, { coordinateType: 0, origins: [origin], duration, color: linear(color), opacity });
  console.info(`多边形漫开：投射范围 ${info.size.toFixed(0)} 米，最远漫开 ${info.maxDistance} 米，${info.stats.triangles} 个三角形`);

  // ── 实时调节面板 ──
  const gui = panel({ title: '多边形漫开 · 实时调节' }); // 页面右侧的面板
  const live = { duration, progress: 1, color, opacity, glow: 1, ...PolygonSpread.STYLE }; // 面板里的值
  gui.add(live, 'duration', 0.5, 20, 0.5).name('漫开时长(s)');
  gui.add({ play: () => spread.play(ID, live.duration) }, 'play').name('▶ 重新漫开');
  gui.add({ pause: () => spread.pause(ID) }, 'pause').name('暂停');
  gui.add({ resume: () => spread.resume(ID) }, 'resume').name('继续');
  gui.add({ final: () => spread.showFinal(ID) }, 'final').name('直接显示终态');
  gui.add(live, 'progress', 0, 1, 0.01).name('定格进度').onChange(value => spread.setProgress(ID, value));
  const look = gui.addFolder('样式'); // 样式分组：拖动时立即生效
  look.addColor(live, 'color').name('颜色').onChange(value => spread.setColor(ID, linear(value)));
  look.add(live, 'opacity', 0, 1, 0.01).name('填充不透明度').onChange(value => spread.setOpacity(ID, value));
  look.add(live, 'glow', 0, 5, 0.05).name('发光强度').onChange(value => spread.setGlow(ID, value));
  // [字段, 名称, 最小, 最大, 步长]：SetStyle 的四个值
  const STYLE_CONTROLS: any[][] = [['frontWidth', '前沿宽度', 0.005, 0.3, 0.005], ['noiseAmount', '毛边强度', 0, 0.2, 0.005],
    ['noiseScale', '噪波尺寸', 0.5, 10, 0.1], ['edgeWidth', '描边宽度', 0, 6, 0.1]];
  for (const [key, name, ...range] of STYLE_CONTROLS) {
    look.add(live, key, ...range).name(name).onChange(value => spread.setStyle(ID, { [key]: value }));
  }
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  await fdapi.customObject.delete(['demo_polygon_spread']);
}
