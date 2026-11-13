import { type EffectPanel, api, loadLib, sleep } from '../effectRuntime'

/**
 * 摄像头视域 — fdapi.customObject + 蓝图 BP_ViewFrustum_V2
 * 效果总包里的摄像头视域：一个摄像头一个对象。视锥从镜头长出来（约 1.2 秒），碰到地面、墙、物体就停，
 * 碰到的表面被照亮并描出轮廓；只有什么都没碰到的视线才画出远端轮廓。侧面半透明，四条棱发光，没有远端盖子。
 * 依赖：Cloud 已挂载效果总包（PAK 见 docs/dts-effects）；封装好的接口 public/static/dts-effects/libs/view-frustum.js（全局 ViewFrustum）。
 * 页面右侧「实时调节」面板改了立即生效；文件开头的「参数」是创建时用的，改了要重新运行。
 *
 * ── ViewFrustum 接口 ──
 *   create(fdapi, { id, position: 镜头 [x, y, z], target: 瞄准点 [x, y, z]（或 yawDeg + pitchDeg）, hfovDeg, vfovDeg,
 *                   rangeM, collision, play, duration, style })   rangeM 不传：开碰撞时取瞄准距离的 2 倍
 *   play(fdapi, id, 秒) / showFull(fdapi, id)   重新长出来 / 直接显示完整视锥
 *   aim(fdapi, id, { target } 或 { yawDeg, pitchDeg })   转动镜头（DTS 相机的偏航、俯仰）
 *   setShape(fdapi, id, { hfovDeg, vfovDeg, rangeM })     视场角、最远距离
 *   setCollision(fdapi, id, 开关) / recapture(fdapi, id)  碰撞开关 / 场景变了（车开走、图层加载）后重新采集深度
 *   setStyle(fdapi, id, { 要改的字段 })                    字段和默认值见 ViewFrustum.DEFAULT_STYLE（下面面板里全有）
 *   remove(fdapi, id)
 */

// ── 参数 ──
const lensHeight = 14;       // 镜头离地(m)，min=2 max=80 step=1
const hfovDeg = 60;          // 水平视场角(°)，min=10 max=120 step=1
const vfovDeg = 34;          // 垂直视场角(°)，min=5 max=90 step=1
const rangeM = 80;           // 最远距离(m)，min=10 max=500 step=5，视线最远到这里；开碰撞时碰到表面会更早停下
const collision = true;      // 碰撞：开：视线碰到地面、墙、物体就停，并照亮碰到的表面；关：完整的四棱锥
const duration = 1.2;        // 生长时长(s)，min=0.4 max=3 step=0.1
const distance = 90;         // 观察距离(m)，min=20 max=600 step=5，相机到视锥中部的距离，从侧面斜看

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  const ID = 'demo_view_frustum'; // 视域 id（蓝图对象是 demo_view_frustum:frustum）
  const POLE = 'demo_view_frustum_pole'; // 摄像头立杆（折线）
  // 镜头和瞄准点的平面位置：demo.acp 北边公园，镜头在路南侧，朝东北看向路和对面的草地（工程投影坐标，米）；换工程时改这里
  const lensXY = [492480, 2492160];
  const targetXY = [492515, 2492205];

  // 加载封装好的接口（public/static/dts-effects/libs/view-frustum.js，全局 ViewFrustum）；加载过就跳过
  await loadLib('view-frustum.js', 'ViewFrustum')

  // 先飞过去：地面高度用竖直射线测，射线只对画面里的地方有效（lookAt 不等飞完就返回，所以再等一下）
  await fdapi.camera.lookAt(...targetXY, 0, 150, -35, -45, 1);
  await sleep(1600);
  const probe = await fdapi.tools.linesIntersect([lensXY, targetXY].map(([x, y]) => ({ start: [x, y, 3000], end: [x, y, -500] })), false, false); // 两条竖直射线
  const [lensGround, targetGround] = [0, 1].map(i => probe?.intersects?.[i]?.LineIntersectPoint?.[2] ?? 0); // 镜头、瞄准点下方的地面高度
  const position = [...lensXY, lensGround + lensHeight]; // 镜头位置
  const target = [...targetXY, targetGround]; // 瞄准点

  // 立杆：从地面到镜头的一根细灰线
  await fdapi.polyline.delete(POLE);
  await fdapi.polyline.add({ id: POLE, coordinates: [[...lensXY, lensGround], [...lensXY, position[2] - 0.3]], coordinateType: 0, color: [0.62, 0.66, 0.7, 1], thickness: 0.35, style: 4, intensity: 0.2, depthTest: true });

  const info = await ViewFrustum.create(fdapi, { id: ID, position, target, hfovDeg, vfovDeg, rangeM, collision, duration });

  // 相机：从视锥右后方斜看它的中部（DTS 相机偏航 0 朝东、顺时针为正，俯仰向下为负）
  const dx = target[0] - position[0], dy = target[1] - position[1], dz = target[2] - position[2]; // 镜头指向瞄准点的方向
  const across = Math.hypot(dx, dy); // 水平距离
  const mid = [position[0] + dx * 0.9, position[1] + dy * 0.9, position[2] + dz * 0.9]; // 视锥中部（碰撞时视锥约到瞄准点的 2 倍远）
  const eye = [mid[0] + (dy / across) * distance * 0.9 - (dx / across) * distance * 0.3, mid[1] - (dx / across) * distance * 0.9 - (dy / across) * distance * 0.3, mid[2] + distance * 0.6]; // 相机位置：视线右侧、稍靠后、抬高
  await fdapi.camera.set(...eye, Math.atan2(mid[2] - eye[2], Math.hypot(mid[0] - eye[0], mid[1] - eye[1])) * 180 / Math.PI, -Math.atan2(mid[1] - eye[1], mid[0] - eye[0]) * 180 / Math.PI, 1);

  // ── 实时调节面板 ──
  const gui = panel({ title: '摄像头视域 · 实时调节' }); // 页面右侧的面板
  // 面板里的镜头朝向（DTS 相机约定：偏航 0 朝东、顺时针为正，俯仰向下为负）、视场角、距离和生长时长
  const live = { yawDeg: -Math.atan2(dy, dx) * 180 / Math.PI, pitchDeg: Math.atan2(dz, Math.hypot(dx, dy)) * 180 / Math.PI, hfovDeg, vfovDeg, rangeM: info.rangeM, collision, duration };
  gui.add(live, 'yawDeg', -180, 180, 1).name('水平转动(°)').onChange(() => ViewFrustum.aim(fdapi, ID, { yawDeg: live.yawDeg, pitchDeg: live.pitchDeg }));
  gui.add(live, 'pitchDeg', -89, 30, 1).name('俯仰(°)').onChange(() => ViewFrustum.aim(fdapi, ID, { yawDeg: live.yawDeg, pitchDeg: live.pitchDeg }));
  gui.add(live, 'hfovDeg', 10, 120, 1).name('水平视场角(°)').onChange(value => ViewFrustum.setShape(fdapi, ID, { hfovDeg: value }));
  gui.add(live, 'vfovDeg', 5, 90, 1).name('垂直视场角(°)').onChange(value => ViewFrustum.setShape(fdapi, ID, { vfovDeg: value }));
  gui.add(live, 'rangeM', 10, 500, 1).name('最远距离(m)').onChange(value => ViewFrustum.setShape(fdapi, ID, { rangeM: value }));
  gui.add(live, 'collision').name('碰撞').onChange(value => ViewFrustum.setCollision(fdapi, ID, value));
  gui.add(live, 'duration', 0.4, 3, 0.1).name('生长时长(s)');
  gui.add({ play: () => ViewFrustum.play(fdapi, ID, live.duration) }, 'play').name('▶ 重新生长');
  gui.add({ full: () => ViewFrustum.showFull(fdapi, ID) }, 'full').name('直接显示完整');

  const look = gui.addFolder('样式').close(); // 样式分组（默认收起）：拖动时立即生效
  const style = { ...ViewFrustum.DEFAULT_STYLE }; // 面板里的样式，初始是默认样式
  // [字段, 名称, 最小, 最大, 步长]；颜色字段不写范围
  const STYLE_CONTROLS: any[][] = [
    ['color', '颜色'], ['faceOpacity', '侧面不透明度', 0, 0.3, 0.01], ['edgeBand', '棱线渐变宽度', 0.02, 0.6, 0.01],
    ['lineWidthPx', '发光线宽(px)', 0.5, 6, 0.1], ['glowPx', '柔光宽度(px)', 0, 12, 0.5], ['brightness', '亮度', 0.2, 4, 0.05],
    ['frontBoost', '生长前沿增亮', 0, 3, 0.05], ['footprintOpacity', '投影不透明度', 0, 0.6, 0.01],
  ];
  for (const [key, name, ...range] of STYLE_CONTROLS) {
    (range.length ? look.add(style, key, ...range) : look.addColor(style, key)).name(name)
      .onChange(value => ViewFrustum.setStyle(fdapi, ID, { [key]: value }));
  }
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  // 直接按对象 id 删除：刷新页面后封装库里没有记录，ViewFrustum.remove 删不到
  await fdapi.customObject.delete(['demo_view_frustum:frustum']);
  await fdapi.polyline.delete('demo_view_frustum_pole');
}
