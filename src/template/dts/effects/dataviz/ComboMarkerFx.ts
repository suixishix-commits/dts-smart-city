import CoordRandomUtil from '@/utils/CoordRandomUtil'
import { type EffectPanel, api, loadLib } from '../effectRuntime'

/**
 * 区域数值标注 — fdapi.marker.add / update（DTS 原生，不需要 PAK）
 * Figma「房地产-深色-08045-460」的点位：深色胶囊里左边是名称，右边是数值徽标，下方三角指针对准坐标；红 / 橙 / 黄 / 绿四种配色。
 * 名称和数值都是传进去的文字，长度不固定：胶囊按文字宽度精确算宽，数值在徽标里居中；很短时不窄于最小宽度。
 * 前端把整张标注（底图 + 文字）画成 PNG 交给 marker，文字和底图一起缩放，间距不会变。
 * 改某个值时用 update：只把变了的点原地换图（marker.update 换 imagePath），不删不加、不闪。
 * 数据：模板的点位（CoordRandomUtil.singleLine 前 4 个点），名称和数值是演示数据，四个点各一种配色。
 * 依赖：接口 public/static/dts-effects/libs/combo-marker.js（全局 ComboMarker）。
 *
 * ── ComboMarker 接口 ──
 *   const markers = ComboMarker.create(fdapi, { prefix, far: 显示距离(m), maxNameWidth, minWidth: 标注最小宽(px), minBadgeWidth: 徽标最小宽(px),
 *                                               scale: 显示倍数, thin: { baseRange, fullHeight } })
 *   await markers.set([{ id, coordinate: [x, y, z], name, value, theme: 'red' | 'orange' | 'yellow' | 'green', level? }])   全部重建
 *   await markers.update([{ id, value, theme }])   只改变了的点，可以只传变了的字段
 *   await markers.remove(ids) / markers.clear()
 *   ComboMarker.fitScale()   显示倍数，照 livex 的 marker 适配原则：min(推流宽 / 1920, 推流高 / 1080)，4K 是 2
 *   markers.observe()        推流分辨率变了自动按新倍数换图
 */

/** 示例在 window 上存的状态（刷新页面后清除时要用） */
const win = window as any

// ── 参数 ──
const heightM = 20;          // 离地高度(m)，标注点比模板点位再抬高多少
const minWidth = 200;        // 标注最小宽(px)，名称、数值很短时整条不窄于它
const minBadgeWidth = 80;    // 徽标最小宽(px)，数值很短时徽标不窄于它，数值始终居中

const GROUP = 'demo_combo'; // marker 的 groupId，id 是 demo_combo_<序号>
const THEMES = ['green', 'yellow', 'orange', 'red'] as const; // 配色：小到大
/** 演示数据：名称、数值（每个点一种配色） */
const POINTS = [
  { name: '1 号监测站', value: 12 },
  { name: '2 号监测站', value: 46 },
  { name: '3 号监测站', value: 78 },
  { name: '4 号监测站', value: 95 }
];

/** 数值 → 配色：0–100 等距分四档 */
const themeOf = (v: number) => THEMES[Math.min(3, Math.max(0, Math.floor(v / 25)))]

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()

  // 加载接口（public/static/dts-effects/libs/combo-marker.js，全局 ComboMarker）；加载过就跳过
  await loadLib('combo-marker.js', 'ComboMarker')

  // 模板点位的前 4 个
  const coords = CoordRandomUtil.singleLine.slice(0, POINTS.length)
  const points = POINTS.map((p, i) => ({
    id: `${GROUP}_${i + 1}`,
    coordinate: [coords[i][0], coords[i][1], coords[i][2] + heightM],
    name: p.name,
    value: String(p.value),
    theme: themeOf(p.value)
  }))

  const scale = ComboMarker.fitScale(); // 显示倍数（livex 适配原则，按推流分辨率算）
  const markers = ComboMarker.create(fdapi, { prefix: GROUP, far: 500000, minWidth, minBadgeWidth, scale });
  win.__dtsComboUnobserve?.();
  await markers.set(points);
  win.__dtsComboUnobserve = markers.observe(); // 推流分辨率变了自动换图

  // 相机看向 4 个点的中间
  const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  await fdapi.camera.lookAt(cx, cy, 0, 1500, -35, -90, 1);

  // ── 实时调节面板 ──
  const gui = panel({ title: '区域数值标注 · 实时调节' }); // 页面右侧的面板
  const live = { point: points[0]!.id, value: POINTS[0]!.value }; // 面板里的值
  gui.add(live, 'point', Object.fromEntries(points.map((p) => [p.name, p.id]))).name('点位');
  gui.add(live, 'value', 0, 100, 1).name('数值');
  gui.add({ apply: () => markers.update([{ id: live.point, value: String(live.value), theme: themeOf(live.value) }]) }, 'apply').name('▶ 更新这个值');
  gui.add({ hide: () => fdapi.marker.hideByGroupId(GROUP) }, 'hide').name('隐藏');
  gui.add({ show: () => fdapi.marker.showByGroupId(GROUP) }, 'show').name('显示');
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  // 停掉视频窗口监听，删掉本示例的全部 marker（按 groupId）
  win.__dtsComboUnobserve?.();
  win.__dtsComboUnobserve = null;
  await fdapi.marker.deleteByGroupId(GROUP);
}
