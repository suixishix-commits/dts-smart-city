import { type EffectPanel, api, loadLib, sleep } from '../effectRuntime'

/**
 * 电子围栏 — fdapi.customObject + 蓝图 BP_ElectronicFence_V1
 * 效果总包里的电子围栏：贴地轮廓先提亮，再整圈从零高度升起蓝色半透明能量幕墙（约 2 秒，慢起、中间快、软停），
 * 顶部一条细亮的青色边；立起后幕墙里有缓慢上升的粒子、淡淡的流线、低处的扫描带和轻微呼吸，越往上越透明。
 * 依赖：Cloud 已挂载效果总包（PAK 见 docs/dts-effects）；封装好的接口 public/static/dts-effects/libs/electronic-fence.js（全局 ElectronicFence）。
 * 页面右侧「实时调节」面板改了立即生效；文件开头的「参数」是创建时用的，改了要重新运行。
 *
 * ── ElectronicFence 接口 ──
 *   create(fdapi, { id, coordinates, heightM, mode, timing: { riseSeconds, preRollSeconds }, style })
 *       coordinates 闭合轮廓（工程投影坐标，米，首尾不用重复）；mode：'rise' 提亮后升起 / 'full' 直接立起 / 'outline' 只留地面轮廓
 *       地面高度靠射线采样，围栏要在画面里（或传 groundZ）
 *   play(fdapi, id, timing?)              重新升起
 *   showFull / showOutline(fdapi, id)     直接立起 / 落回地面轮廓
 *   setHeight(fdapi, id, 米)              立着时 0.8 秒缓到新高度
 *   setStyle(fdapi, id, { 要改的字段 })   字段和默认值见 ElectronicFence.DEFAULT_STYLE（下面面板里全有）
 *   remove(fdapi, id)
 */

// ── 参数 ──
const heightM = 15;          // 幕墙高度(m)，min=2 max=100 step=1
const riseSeconds = 2;       // 升起时长(s)，min=0.5 max=8 step=0.1
const mode = 'rise';         // 出场方式，轮廓提亮后升起=rise, 直接立起=full, 只留地面轮廓=outline
const distance = 140;        // 观察距离，min=50 max=2000 step=10，lookAt 的距离，实际相机距离约是它的 1.7 倍

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  const ID = 'demo_e_fence'; // 围栏 id（蓝图对象是 demo_e_fence:fence）
  // 围栏轮廓：demo.acp 城区里的一块地（工程投影坐标，米）；换工程时改这里
  const ring = [[490140, 2490885], [490262, 2490872], [490296, 2490958], [490214, 2491016], [490128, 2490982]];

  // 加载封装好的接口（public/static/dts-effects/libs/electronic-fence.js，全局 ElectronicFence）；加载过就跳过
  await loadLib('electronic-fence.js', 'ElectronicFence')

  // 先飞过去：地面高度靠射线采样，围栏要在画面里（lookAt 不等飞完就返回，所以再等一下）
  await fdapi.camera.lookAt(490212, 2490945, 0, distance, -26, -45, 1);
  await sleep(1600);

  await ElectronicFence.create(fdapi, { id: ID, coordinates: ring, heightM, mode, timing: { riseSeconds } });

  // ── 实时调节面板 ──
  const gui = panel({ title: '电子围栏 · 实时调节' }); // 页面右侧的面板
  const live = { heightM, riseSeconds }; // 面板里的高度与升起时长
  const style = { ...ElectronicFence.DEFAULT_STYLE }; // 面板里的样式，初始是默认样式
  gui.add(live, 'heightM', 2, 100, 1).name('幕墙高度(m)').onFinishChange(value => ElectronicFence.setHeight(fdapi, ID, value));
  gui.add(live, 'riseSeconds', 0.5, 8, 0.1).name('升起时长(s)');
  gui.add({ play: () => ElectronicFence.play(fdapi, ID, { riseSeconds: live.riseSeconds }) }, 'play').name('▶ 重新升起');
  gui.add({ full: () => ElectronicFence.showFull(fdapi, ID) }, 'full').name('直接立起');
  gui.add({ outline: () => ElectronicFence.showOutline(fdapi, ID) }, 'outline').name('落回地面轮廓');

  const look = gui.addFolder('样式').close(); // 样式分组（默认收起）：拖动时立即生效
  // [字段, 名称, 最小, 最大, 步长]；颜色字段不写范围
  const STYLE_CONTROLS: any[][] = [
    ['color', '幕墙颜色'], ['edgeColor', '顶边颜色'],
    ['brightness', '亮度', 0, 4, 0.05], ['wallOpacity', '幕墙不透明度', 0, 1, 0.01], ['gradientPower', '向上变淡', 0.2, 6, 0.1],
    ['particleDensity', '粒子密度', 0, 1, 0.05], ['flowIntensity', '流线强度', 0, 1, 0.05], ['scanIntensity', '扫描带', 0, 1, 0.05],
    ['breathAmount', '呼吸幅度', 0, 0.5, 0.01], ['frontBoost', '升起前沿亮度', 0, 4, 0.1],
    ['groundGlowM', '地面光晕(m)', 0, 10, 0.1], ['groundLineM', '地面线宽(m)', 0, 3, 0.05],
  ];
  for (const [key, name, ...range] of STYLE_CONTROLS) {
    (range.length ? look.add(style, key, ...range) : look.addColor(style, key)).name(name)
      .onChange(value => ElectronicFence.setStyle(fdapi, ID, { [key]: value }));
  }
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  // 直接按蓝图对象 id 删除：刷新页面后封装库里没有记录，ElectronicFence.remove 删不到
  await fdapi.customObject.delete(['demo_e_fence:fence']);
}
