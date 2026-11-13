import CoordRandomUtil from '@/utils/CoordRandomUtil'
import { type EffectPanel, api, loadLib, pakPath } from '../effectRuntime'

/**
 * 区域状态标注 — fdapi.marker3d.add + callBPFunction（UE 打包的 3D 标注）
 * 蓝图 BP_Marker3D_ZoneStatus：悬空的 V 形玻璃晶体，一串光点连到地面菱形；本示例不显示文字。
 * 一个主题色给晶体、光点和菱形上色，随时可改。
 * 出场默认 3 秒：地面冲击波、菱形描边 → 光团沿光柱冲上 → 尖端爆光、晶体展开、扫光；之后光点上流、晶体周期扫光、地面脉冲。
 * 数据：模板的点位（CoordRandomUtil.singleLine 前 4 个点），四个点各一种状态：建设中蓝、已交付绿、招标中橙、计划建设白。
 * 依赖：接口 public/static/dts-effects/libs/zone-marker.js（全局 ZoneMarker）；PAK 是 dts-resource\projects\ZoneMarker3D_20261030\Delivery\ZoneMarker3D-V1-WindowsNoEditor.pak。
 *   渲染端 Content\Paks 里放了这个 PAK 并新开过实例，就按 Marker3D 加载；还没有时自动改用 customObject + pakFilePath 从下面的路径临时加载。
 *
 * ── ZoneMarker 接口 ──
 *   const zones = ZoneMarker.create(fdapi, { groupId, pakFilePath? })   pakFilePath = 不部署、按 customObject 临时加载
 *   await zones.add([{ id, coordinate: [x, y, 0], color?, layout?, animation? }])   文字默认不显示
 *   await zones.update([{ id, color?, layout?, glow?, brightness?, replay? }])
 *   await zones.replay() / zones.showFinal() / zones.remove(ids) / zones.clear()
 *   layout（参考像素，ReferenceDistance 1500 m 处 1 参考像素 = 1 屏幕像素）：crystalPx 晶体高、beamPx 光柱、basePx 菱形
 *   animation：entrySeconds 出场时长、delaySeconds 延迟、idleSpeed 待机动画速度
 */

/** 示例在 window 上存的状态（刷新页面后清除时要用） */
const win = window as any

// ── 参数 ──
const pakFilePath = pakPath('ZoneMarker3D-V1-WindowsNoEditor.pak', 'E:\\Dts-Optimize\\dts-resource\\projects\\ZoneMarker3D_20261030\\Delivery\\ZoneMarker3D-V1-WindowsNoEditor.pak'); // 临时加载用的 PAK（渲染端路径）：渲染端没挂载时才用
const crystalPx = 80;   // 晶体高(px)，min=20 max=300 step=2
const beamPx = 30;      // 光柱长(px)，min=0 max=500 step=5
const entrySeconds = 3; // 出场时长(s)，min=0.5 max=8 step=0.1
const stagger = 0.3;    // 依次出场间隔(s)，第 i 个延迟 i × 间隔

const GROUP = 'demo_zone_marker'; // 分组，id 是 demo_zone_marker_<序号>
const COLORS: Record<string, string> = { building: '#2f7bff', built: '#4fd987', tendering: '#ff9a2e', planned: '#d8e6ff' }; // 状态 → 主题色
const STATUS = { 建设中: 'building', 已交付: 'built', 招标中: 'tendering', 计划建设: 'planned' }; // 显示名 → 状态
/** 演示数据：每个点的名称和状态 */
const POINTS = [
  { name: '1 号项目', status: 'building' },
  { name: '2 号项目', status: 'built' },
  { name: '3 号项目', status: 'tendering' },
  { name: '4 号项目', status: 'planned' }
];

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  // 加载接口（public/static/dts-effects/libs/zone-marker.js，全局 ZoneMarker）；页面里已有的不是这一版就重新加载（旧版默认显示文字）
  await loadLib('zone-marker.js', 'ZoneMarker', '1.4.1')
  await win.__dtsZoneMarkers?.clear().catch(() => {});

  // 模板点位的前 4 个（z 是模板点位的高度）
  const coords = CoordRandomUtil.singleLine.slice(0, POINTS.length)
  const projects = POINTS.map((p, i) => ({ id: `${GROUP}_${i + 1}`, name: p.name, status: p.status, coordinate: [coords[i][0], coords[i][1], coords[i][2]] }));
  /** 全部标注的 add 数据（不传文字，只有晶体、光柱和菱形） */
  const markersOf = () => projects.map((p, i) => ({ id: p.id, coordinate: p.coordinate, color: COLORS[p.status], layout: { crystalPx, beamPx }, animation: { entrySeconds, delaySeconds: i * stagger } }));

  // 先按 Marker3D 加；渲染端没挂载这个 PAK 时 isResolved 为 false，改用 customObject 临时加载
  let zones = ZoneMarker.create(fdapi, { groupId: GROUP }); // 标注管理器
  await zones.add(markersOf());
  let mode = 'Marker3D（渲染端已挂载）'; // 实际的加载方式
  if (!(await zones.isResolved(projects[0]!.id).catch(() => false))) {
    await zones.clear();
    zones = ZoneMarker.create(fdapi, { groupId: GROUP, pakFilePath });
    await zones.add(markersOf());
    mode = 'customObject 临时加载 PAK';
  }
  win.__dtsZoneMarkers = zones;
  console.info(`区域状态标注：${projects.length} 个项目，加载方式 ${mode}`);
  // 相机看向 4 个点的中间
  const cx = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
  const cy = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
  await fdapi.camera.lookAt(cx, cy, 0, 1500, -35, -90, 1);

  // ── 实时调节面板 ──
  const gui = panel({ title: '区域状态标注 · 实时调节' }); // 页面右侧的面板
  const live = { project: projects[0]!.id, status: projects[0]!.status, color: COLORS[projects[0]!.status] }; // 面板里的值
  const pick = () => projects.find(p => p.id === live.project) ?? projects[0]!; // 选中的项目
  const edit = gui.addFolder('改一个项目'); // 状态 / 颜色
  /** 面板显示刷新 @returns {void} */
  const refresh = () => edit.controllersRecursive().forEach(c => c.updateDisplay());
  edit.add(live, 'project', Object.fromEntries(projects.map(p => [p.name, p.id]))).name('项目').onChange(() => {
    const p = pick();
    Object.assign(live, { status: p.status, color: COLORS[p.status] });
    refresh();
  });
  edit.add(live, 'status', STATUS).name('状态').onChange(s => { live.color = COLORS[s]; refresh(); });
  edit.addColor(live, 'color').name('主题色');
  edit.add({ apply: async () => {
    const p = pick();
    p.status = live.status;
    await zones.update([{ id: p.id, color: live.color }]);
  } }, 'apply').name('▶ 更新');
  gui.add({ replay: () => zones.replay() }, 'replay').name('重播出场');
  gui.add({ final: () => zones.showFinal() }, 'final').name('直接显示最终状态');
  const look = { brightness: 1 }; // 亮度
  gui.add(look, 'brightness', 0.2, 2, 0.05).name('亮度').onFinishChange(v => zones.update(projects.map(p => ({ id: p.id, brightness: v }))));
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  // 删掉本示例的全部标注（Marker3D 按分组删；临时加载时按 id 删）
  await win.__dtsZoneMarkers?.clear().catch(() => {});
  win.__dtsZoneMarkers = null;
  await fdapi.marker3d.deleteByGroupId(GROUP);
}
