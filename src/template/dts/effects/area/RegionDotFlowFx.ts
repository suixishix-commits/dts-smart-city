import { type EffectPanel, api, loadLib, sleep } from '../effectRuntime'

/**
 * 点阵流光（整层） — fdapi.customObject + 蓝图 BP_RegionDotFlow_V2
 * 效果总包里的点阵流光 V2.2：整个图层只用一个对象，所有区域烘进一张距离场贴图，每帧开销和区域数、点数无关（100 万点 1–3 秒加载完）。
 * 每个区域按图例色画：淡底色、内部图案、发光描边、内侧光晕、外侧溢光、沿边界跑的流光和轻微呼吸；相邻区域共用的边各画一半。
 * 内部图案 6 种（点阵、微光点阵、精密斜纹、蜂巢微网、轮廓流线、数字微栅格），可以贴地，也可以在固定高度画成平面。
 * 依赖：Cloud 已挂载效果总包（PAK 见 docs/dts-effects）；封装好的接口 public/static/dts-effects/libs/region-dot-flow.js（全局 RegionDotFlow），
 * 演示区域由 public/static/dts-effects/libs/demo-regions.js（全局 DemoRegions）生成。
 * 页面右侧「实时调节」面板改了立即生效；文件开头的「参数」是创建时用的，改了要重新运行。
 *
 * ── RegionDotFlow 接口 ──
 *   create(fdapi, { id, regions: [{ id, color: '#rrggbb', rings: [环, …] }], style, groundZ? })
 *       环是工程投影坐标（米）[[x, y], …]，奇偶规则（外环、洞、洞里的岛都放进来）；相邻区域的公共边要用同一组顶点
 *       地面高度靠射线采样，区域要在画面里（或传 groundZ）；也可以 regionsFromGeoJSON(要素集合, { idField, color }) 转换
 *   setStyle(fdapi, id, { 要改的字段 })   字段见 RegionDotFlow.DEFAULT_STYLE；PRESETS 是 6 种图案的预设
 *       返回 false：轮廓流线的内圈超出了已烘焙的范围，用新样式重新 create
 *   setColors(fdapi, id, { 区域id: 颜色 })   返回 false 要重新 create
 *   remove(fdapi, id)；整层显隐用 fdapi.customObject.show/hideByGroupId(id)
 */

// ── 参数 ──
const pattern = 'contour';   // 内部图案，点阵流光=dots, 微光点阵=glimmer, 精密斜纹=hatch, 蜂巢微网=honeycomb, 轮廓流线=contour, 数字微栅格=grid
const patternScale = 0.4;    // 图案缩放，min=0.05 max=4 step=0.05，预设按「1 像素约 4 米」调；相机更近时调小，点和间距一起缩放
const surface = 'drape';     // 贴地方式，贴地=drape, 平面=flat，平面：在地面以上「平面高度」米处画一个水平面
const flatHeightM = 30;      // 平面高度(m)，min=-50 max=500 step=1，贴地方式为平面时生效
const distance = 950;        // 观察距离，min=200 max=3000 step=50，lookAt 的距离，实际相机距离约是它的 1.7 倍

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  const ID = 'demo_dot_flow_layer'; // 图层 id（蓝图对象是 demo_dot_flow_layer:field）
  const center: [number, number] = [491300, 2491500]; // 演示区域的中心：demo.acp 城区（工程投影坐标，米）；换工程时改这里

  // 加载封装好的接口和演示数据（public/libs 下，全局 RegionDotFlow、DemoRegions）；加载过就跳过
  await loadLib('region-dot-flow.js', 'RegionDotFlow')
  await loadLib('demo-regions.js', 'DemoRegions')

  // 演示区域：约 1.6 × 1.2 km 的一组相邻街区，边界弯曲、相邻两块共用顶点；L / T 形、带洞、两块地的区域都有，按面积分 5 档图例色
  const regions = DemoRegions.colorByArea(DemoRegions.lattice({
    center, cols: [250, 250, 250, 64, 250, 250, 250], rows: [224, 224, 224, 64, 224, 224],
    labels: ['AABNRRR', 'ACBNRXR', 'CCBNRRR', 'DDDSEEF', 'GDHHEFF', 'GGHMEMF'],
  }));

  /** 图案预设按缩放调整点和间距 @param {string} name 图案名 @returns {object} 样式字段 */
  const preset = name => ({ ...RegionDotFlow.PRESETS[name], dotSpacingM: RegionDotFlow.PRESETS[name].dotSpacingM * patternScale, dotSizeM: RegionDotFlow.PRESETS[name].dotSizeM * patternScale });
  const style = { ...RegionDotFlow.DEFAULT_STYLE, ...preset(pattern), surface, flatHeightM }; // 当前样式，面板改的就是它

  // 先飞过去：地面高度靠射线采样，区域要在画面里（lookAt 不等飞完就返回，所以再等一下）
  await fdapi.camera.lookAt(...center, 0, distance, -60, -90, 1);
  await sleep(1800);

  await RegionDotFlow.create(fdapi, { id: ID, regions, style });

  // ── 实时调节面板 ──
  const gui = panel({ title: '点阵流光（整层） · 实时调节' }); // 页面右侧的面板
  /** 把面板里的一项发给图层 @param {string} key 字段 @returns {(value: *) => void} onChange 回调 */
  const send = key => value => RegionDotFlow.setStyle(fdapi, ID, { [key]: value });
  gui.add(style, 'pattern', { 点阵流光: 'dots', 微光点阵: 'glimmer', 精密斜纹: 'hatch', 蜂巢微网: 'honeycomb', 轮廓流线: 'contour', 数字微栅格: 'grid' })
    .name('内部图案').onChange(async name => {
      Object.assign(style, preset(name));
      gui.controllersRecursive().forEach(c => c.updateDisplay());
      // 轮廓流线需要更远处也精确的距离场：返回 false 时用新样式重新创建（约 1 秒）
      if (!(await RegionDotFlow.setStyle(fdapi, ID, preset(name)))) await RegionDotFlow.create(fdapi, { id: ID, regions, style: { ...style } });
    });
  gui.add(style, 'surface', { 贴地: 'drape', 平面: 'flat' }).name('贴地方式').onChange(send('surface'));
  gui.add(style, 'flatHeightM', -50, 500, 1).name('平面高度(m)').onChange(send('flatHeightM'));
  gui.add(style, 'flatDepthTest').name('平面被楼遮挡').onChange(send('flatDepthTest'));
  gui.add(style, 'paused').name('暂停动画').onChange(send('paused'));

  // [分组, 字段, 名称, 最小, 最大, 步长]
  const STYLE_CONTROLS: any[][] = [
    ['图案', 'dotSpacingM', '间距(m)', 1, 200, 0.5], ['图案', 'dotSizeM', '点大小(m)', 0, 50, 0.1], ['图案', 'dotIntensity', '亮度', 0, 5, 0.05],
    ['图案', 'dotOpacity', '不透明度', 0, 1, 0.01], ['图案', 'patternLinePx', '线宽(px)', 0, 5, 0.1], ['图案', 'patternAnim', '动态强度', 0, 3, 0.05],
    ['图案', 'baseOpacity', '底色', 0, 0.5, 0.01], ['图案', 'breathAmount', '呼吸幅度', 0, 0.5, 0.01],
    ['描边与光晕', 'lineWidthPx', '描边宽度(px)', 0, 10, 0.1], ['描边与光晕', 'lineIntensity', '描边亮度', 0, 10, 0.1], ['描边与光晕', 'lineOpacity', '描边不透明度', 0, 1, 0.01],
    ['描边与光晕', 'glowWidthPx', '内晕宽度(px)', 0, 60, 1], ['描边与光晕', 'glowIntensity', '内晕亮度', 0, 10, 0.1], ['描边与光晕', 'glowOpacity', '内晕不透明度', 0, 1, 0.01],
    ['描边与光晕', 'spillWidthPx', '外侧溢光(px)', 0, 20, 0.5],
    ['流光', 'flowPeriodSeconds', '跑一圈(s)', 1, 60, 0.5], ['流光', 'flowLength', '长度', 0, 0.5, 0.01], ['流光', 'flowCount', '段数', 0, 4, 1], ['流光', 'flowIntensity', '亮度', 0, 10, 0.1],
  ];
  const folders: Record<string, any> = {}; // 分组名 -> 面板分组（默认收起）
  for (const [group, key, name, ...range] of STYLE_CONTROLS) {
    folders[group] ??= gui.addFolder(group).close();
    folders[group].add(style, key, ...range).name(name).onChange(send(key));
  }
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  // 直接按蓝图对象 id 删除：刷新页面后封装库里没有记录，RegionDotFlow.remove 删不到
  await fdapi.customObject.delete(['demo_dot_flow_layer:field']);
}
