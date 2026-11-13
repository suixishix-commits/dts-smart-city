import { type EffectPanel, api } from '../effectRuntime'

/**
 * 牵引线 — fdapi.guideLine.add（DTS 原生，不需要 PAK）
 * 沿采集的折线画一条带材质的引导线，起点、终点可挂端点材质。样式照 livex「一家人的一周」的出行路线：
 * 线材质 /JC_CustomAssets/PolylineLibrary/Exhibition/混合线_9，每条路线一个颜色
 * （livex 2026-09-25 定下的样子：不透明度 0.5、亮度1 100、亮度2 1，颜色2 深蓝）。
 * 场景：demo.acp（默认）是北边公园那条路，从中间的「家」往东、往西各一条；
 *       livex 是「一家人的一周」原样的五条路线（家到学校 / 清真寺 / 商店 / 医院 / 公园），Cloud 要加载 livex 工程。
 * 换工程时改 SCENES 里的坐标（工程投影坐标，米）。
 * 页面右侧「实时调节」面板改了立即生效；文件开头的「参数」是创建时用的，改了要重新运行。
 *
 * ── guideLine 字段 ──
 *   coordinates: [[x, y, z], ...]   折线顶点；coordinateType 0 = 工程投影坐标（米）
 *   width          线宽（米）                    setWidth(id, 值)
 *   guideSize      引导图案大小                  setGuideSize(id, 值)
 *   speed          引导图案流动速度              setSpeed(id, 值)
 *   interval       引导图案间隔，-1 为连续        setInterval(id, 值)
 *   shape          0 直线连接 / 1 曲线平滑        setShape(id, 值)
 *   depthTest      是否被模型遮挡                setDepthTest(id, 是否)
 *   style: { startPoint: { material }, endPoint: { material },
 *            polyline: { material, scalarParameters: [{ name, value }], vectorParameters: [{ name, value: [r, g, b, a] }] } }
 *   改材质参数（颜色等）用 fdapi.guideLine.update({ id, style })；整组删除用 fdapi.guideLine.clear()
 */

// ── 参数 ──
const scene = 'demo';         // 场景，demo.acp=demo, livex 一家人的一周=livex，要和 Cloud 当前加载的工程一致
const width = 0.5;           // 线宽(m)，min=0.05 max=20 step=0.05，livex 原来用 0.1
const speed = 8;             // 流动速度，min=0 max=50 step=0.5
const opacity = 0.5;         // 不透明度，min=0 max=1 step=0.05
const brightness = 100;      // 亮度，min=1 max=300 step=1，材质参数「亮度1」
const lift = 0;              // 抬高(m)，min=0 max=50 step=0.5，在采集高度上整体抬高
const distance = 220;        // 观察距离，min=50 max=3000 step=10，lookAt 的距离，实际相机距离约是它的 1.7 倍

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  // ── demo.acp：北边公园那条路（路面高度上抬 0.4 米，免得和路面闪烁），「家」在中间 ──
  const ROAD = (<[number, number, number][]>[
    [492341.3, 2492220.1, -0.69], [492389.6, 2492214.2, -0.69], [492444.2, 2492208.5, -0.69], [492490.0, 2492202.3, -0.69],
    [492503.8, 2492198.7, -0.69], [492513.9, 2492192.3, -0.88], [492530.7, 2492177.1, -0.78], [492545.4, 2492169.1, -0.69],
    [492564.1, 2492160.0, -0.69], [492580.7, 2492142.1, -0.88], [492609.5, 2492130.6, -0.88], [492622.1, 2492129.4, -0.88],
    [492636.0, 2492144.0, -0.88], [492657.9, 2492162.5, -0.88], [492679.8, 2492167.4, -0.88], [492701.1, 2492164.3, -0.69],
    [492722.3, 2492156.8, -0.69],
  ]).map(([x, y, z]) => [x, y, z + 0.4]);
  const DEMO_HOME = 8; // 「家」是 ROAD 的第几个点

  // ── livex：「一家人的一周」采集的顶点（EPSG:32640），统一场景高度 10 米 ──
  const Z = 10;
  const HOME = [237947.40453125, 2709488.5657128906, Z]; // 家
  // 清真寺和商店共走的前段
  const COMMON_TO_MOSQUE = [HOME, [237928.8462890625, 2709484.923828125, Z], [237919.0505078125, 2709500.173515625, Z],
    [237911.530703125, 2709513.067421875, Z], [237825.593515625, 2709658.9409375, Z], [237801.495234375, 2709644.760234375, Z],
    [237794.10551757814, 2709655.615527344, Z], [237671.74282958984, 2709568.3484472656, Z], [237654.9574609375, 2709590.134199219, Z],
    [237638.8435546875, 2709578.4212792967, Z], [237629.13458496094, 2709589.8021875, Z], [237613.55341796877, 2709578.6886523436, Z],
    [237567.94193359374, 2709626.11921875, Z]];
  // 五条路线：颜色（sRGB 0–1，livex 的设计色）和顶点
  const LIVEX = {
    school: { color: [0.3137, 0.6157, 0.8667], points: [HOME, [237928.8462890625, 2709484.923828125, Z], [237919.0505078125, 2709500.173515625, Z],
      [237911.530703125, 2709513.067421875, Z], [237825.593515625, 2709658.9409375, Z], [237801.85640625, 2709644.613125, Z],
      [237794.10551757814, 2709655.615527344, Z], [237782.70615234374, 2709648.513359375, Z], [237765.6114453125, 2709671.09171875, Z],
      [237722.36376953125, 2709640.98109375, Z], [237713.391484375, 2709653.35, Z]] },
    mosque: { color: [0.149, 0.6157, 0.5686], points: [...COMMON_TO_MOSQUE, [237560.35952148438, 2709619.357421875, Z]] },
    shop: { color: [0.949, 0.6431, 0.2667], points: [...COMMON_TO_MOSQUE, [237505.77943359377, 2709684.247207031, Z], [237499.60419921877, 2709677.6189453127, Z]] },
    hospital: { color: [0.9098, 0.4706, 0.5412], points: [HOME, [237928.8462890625, 2709484.923828125, Z], [237919.0505078125, 2709500.173515625, Z],
      [237911.530703125, 2709513.067421875, Z], [237816.4905859375, 2709675.012578125, Z], [237830.1973730469, 2709685.563339844, Z],
      [237812.44393554688, 2709707.6801171876, Z], [237800.8103808594, 2709699.76015625, Z], [237686.76153320313, 2709855.1541015627, Z]] },
    park: { color: [0.5137, 0.7216, 0.3608], points: [HOME, [237970.15033203125, 2709510.625214844, Z], [237957.23634765626, 2709533.285185547, Z],
      [237983.6792578125, 2709553.268417969, Z]] },
  };
  // 各场景的路线（颜色 sRGB 0–1 + 顶点）和相机 [x, y, 俯仰, 航向]
  const SCENES = {
    demo: {
      routes: {
        west: { color: [0.3137, 0.6157, 0.8667], points: ROAD.slice(0, DEMO_HOME + 1).reverse() },
        east: { color: [0.949, 0.6431, 0.2667], points: ROAD.slice(DEMO_HOME) },
      },
      camera: [492530, 2492175, -50, -100],
    },
    livex: { routes: LIVEX, camera: [237800, 2709620, -60, -60] },
  };
  const ROUTES = SCENES[scene].routes;
  const keys = Object.keys(ROUTES); // 要画的路线
  const idOf = key => `demo_guide_${key}`;
  const EMPTY = '/JC_CustomAssets/PolylineLibrary/GuideExhibition/空'; // 不要端点图案

  /** 一条路线的样式：颜色1 是路线色，其余是 livex 的原样 @param {number[]} rgb 颜色 @param {object} v 不透明度和亮度 @returns {object} style */
  const styleOf = (rgb, v) => ({
    startPoint: { material: EMPTY },
    endPoint: { material: EMPTY },
    polyline: {
      material: '/JC_CustomAssets/PolylineLibrary/Exhibition/混合线_9',
      scalarParameters: [{ name: '不透明度', value: v.opacity }, { name: '亮度1', value: v.brightness }, { name: '亮度2', value: 1 }],
      vectorParameters: [{ name: '颜色1', value: [...rgb, 1] }, { name: '颜色2', value: [0, 0, 0.28125, 1] }],
    },
  });

  await fdapi.guideLine.delete([...Object.keys(SCENES.demo.routes), ...Object.keys(LIVEX)].map(idOf)); // 删掉上次的（两个场景的都删）
  await fdapi.guideLine.add(keys.map(key => ({
    id: idOf(key),
    coordinates: ROUTES[key].points.map(([x, y, z]) => [x, y, z + lift]),
    coordinateType: 0,
    range: [0, 100000],
    depthTest: true,
    shape: 0,
    width,
    guideSize: 1,
    speed,
    interval: -1,
    style: styleOf(ROUTES[key].color, { opacity, brightness }),
  })));
  const [cx, cy, pitch, yaw] = SCENES[scene].camera;
  await fdapi.camera.lookAt(cx, cy, 0, distance, pitch, yaw, 1);

  // ── 实时调节面板 ──
  const gui = panel({ title: '牵引线 · 实时调节' }); // 页面右侧的面板
  const live = { width, speed, shape: 0, depthTest: true, opacity, brightness }; // 面板里的值
  const ids = keys.map(idOf);
  /** 给全部路线调同一个 set 方法 @param {string} method 方法名 @returns {(value: *) => void} 回调 */
  const setAll = method => value => ids.forEach(id => fdapi.guideLine[method](id, value));
  /** 材质参数变了：按各自颜色重发 style @returns {void} */
  const restyle = () => fdapi.guideLine.update(keys.map(key => ({ id: idOf(key), style: styleOf(ROUTES[key].color, live) })));
  gui.add(live, 'width', 0.05, 20, 0.05).name('线宽(m)').onFinishChange(setAll('setWidth'));
  gui.add(live, 'speed', 0, 50, 0.5).name('流动速度').onFinishChange(setAll('setSpeed'));
  gui.add(live, 'shape', { 直线连接: 0, 曲线平滑: 1 }).name('连接方式').onChange(value => setAll('setShape')(Number(value)));
  gui.add(live, 'depthTest').name('被模型遮挡').onChange(setAll('setDepthTest'));
  gui.add(live, 'opacity', 0, 1, 0.05).name('不透明度').onFinishChange(restyle);
  gui.add(live, 'brightness', 1, 300, 1).name('亮度').onFinishChange(restyle);
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  // 按 id 删除本示例的牵引线，两个场景的都删（不用 clear()，免得删掉别处画的 guideLine）
  await fdapi.guideLine.delete(['west', 'east', 'school', 'mosque', 'shop', 'hospital', 'park'].map(key => `demo_guide_${key}`));
}
