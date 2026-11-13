import { type EffectPanel, api, pakPath } from '../effectRuntime'

/**
 * 指定地面图层贴花线 — fdapi.customObject + 蓝图 BP_Ground{Dash,Arrow,Particles,Pulse}_V1（预览版）
 * 线用 UE 原生贴花画出来，只有指定的地面 3DT 图层接收：路面上有图案，建筑、树不会被染上，还能正常挡住线。
 * 每段路线一个贴花对象，段与段之间按累计里程接上，图案连续。
 * 依赖：GroundLayerLines-V1-20261028-WindowsNoEditor.pak（不在效果总包里，还没验收），在「PAK 路径」填它在渲染机上的路径；
 * 旧的 LineOnTerrain PAK 不能代替。直接调 SDK，不用接口文件。
 *
 * ⚠ fdapi.tileLayer.enableDecal 是图层级的全局开关：会把场景里所有 EPT_Scene 图层设成「只有指定地面接收贴花」，
 *   对其他原生贴花、贴花模式的折线 / 面、热力图也生效。SDK 读不到原来的状态，「清除」会把所有图层恢复为接收贴花（场景默认状态）。
 *
 * ── 蓝图 Configure（全是浮点，按顺序）──
 *   SegmentLengthM, LineWidthM, ProjectionDepthM, YawDeg（局部 X 朝北、Y 朝东）, StationM（累计里程）, SpacingM,
 *   Speed, Direction（1 / -1）, Brightness, Opacity, MinPixelWidth, ColorR, ColorG, ColorB（线性）
 */

// ── 参数 ──
const groundLayerId = '4DECD1704AD8119E33CF658A64A70AD2';    // 地面图层 ID：唯一接收贴花的 3DT 图层；留空时运行会列出场景里的图层（demo.acp 的 demo 图层）
const pakFilePath = pakPath('GroundLayerLines-V1-20261028-WindowsNoEditor.pak', '');      // PAK 路径：GroundLayerLines-V1 在渲染机上的 .pak 路径
const effect = 'Arrow';      // 图案，流动虚线=Dash, 追逐箭头=Arrow, 粒子流光=Particles, 脉冲流光=Pulse
const lineWidthM = 12;       // 线宽(m)，min=1 max=100 step=1
const spacingM = 40;         // 图案间距(m)，min=2 max=500 step=1
const speed = 0.22;          // 流动速度，min=0 max=2 step=0.01
const reverse = false;       // 反向流动
const brightness = 1.5;      // 亮度，min=0 max=10 step=0.1
const opacity = 0.85;        // 不透明度，min=0 max=1 step=0.01
const lineColor = '#08a6ff'; // 颜色
const projectionDepthM = 200; // 投射深度(m)，min=10 max=1000 step=10，贴花投射盒的总高度
const minPixelWidth = 3;     // 最小宽度(px)，min=0 max=10 step=1

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  const PREFIX = 'demo_gll'; // 对象 id：demo_gll-1、demo_gll-2 …（每段一个），groupId 也是它
  // 路线：demo.acp 北边公园南侧的一条路（工程投影坐标，米；z 是实测路面高度）；换工程时改这里
  const route: [number, number, number][] = [
    [492341.3, 2492220.1, -0.69], [492389.6, 2492214.2, -0.69], [492444.2, 2492208.5, -0.69], [492490.0, 2492202.3, -0.69],
    [492503.8, 2492198.7, -0.69], [492513.9, 2492192.3, -0.88], [492530.7, 2492177.1, -0.78], [492545.4, 2492169.1, -0.69],
    [492564.1, 2492160.0, -0.69], [492580.7, 2492142.1, -0.88], [492609.5, 2492130.6, -0.88], [492622.1, 2492129.4, -0.88],
    [492636.0, 2492144.0, -0.88], [492657.9, 2492162.5, -0.88], [492679.8, 2492167.4, -0.88], [492701.1, 2492164.3, -0.69],
    [492722.3, 2492156.8, -0.69],
  ];

  /**
   * 调 SDK 并检查 result：callBPFunction、enableDecal 在 SDK 7.1 里只从回调返回结果
   * @param {object} owner SDK 模块 @param {string} method 方法名 @param {Array} args 参数 @returns {Promise<object>} 响应
   */
  const sdkCall = (owner, method: string, args: unknown[]) => new Promise<any>((resolve, reject) => {
    let settled = false; // 回调和 Promise 只认第一次
    const timer = setTimeout(() => finish(new Error(`${method} 超时`)), 30000);
    /** @param {unknown} reply 响应或错误 @returns {void} */
    function finish(reply) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (reply instanceof Error) throw reply;
        const parsed = typeof reply === 'string' ? JSON.parse(reply) : reply; // 兼容 JSON 字符串
        if (parsed && parsed.result != null && Number(parsed.result) !== 0) throw new Error(`${method}: ${parsed.resultMessage || parsed.result}`);
        resolve(parsed);
      } catch (error) { reject(error); }
    }
    try {
      const pending = owner[method](...args, finish);
      if (pending && typeof pending.then === 'function') pending.then(finish, finish);
    } catch (error) { finish(error); }
  });

  // 场景里的 3DT 图层（EPT_Scene）
  const { infotree } = await sdkCall(fdapi.infoTree, 'get', []);
  const layers = infotree.filter(row => row.type === 'EPT_Scene').map(row => ({ id: String(row.iD ?? row.id ?? row.ID).toUpperCase(), name: row.name }));
  if (!groundLayerId) throw new Error(`请在参数里填「地面图层 ID」。场景里的 3DT 图层：\n${layers.map(l => `${l.id}  ${l.name}`).join('\n')}`);
  if (!pakFilePath) throw new Error('请在参数里填 GroundLayerLines-V1 PAK 在渲染机上的路径');
  const ground = groundLayerId.toUpperCase(); // 接收贴花的图层
  if (!layers.some(l => l.id === ground)) throw new Error(`场景里没有图层 ${groundLayerId}`);

  // 只让指定的地面图层接收贴花
  await sdkCall(fdapi.tileLayer, 'enableDecal', [layers.map(l => ({ tileLayerId: l.id, enable: l.id === ground }))]);

  // 每段一个贴花对象，按累计里程接上
  const hex = (lineColor.match(/\w\w/g) ?? []).map(h => parseInt(h, 16) / 255); // sRGB 0–1
  const color = hex.map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); // 线性 RGB
  const objects: any[] = []; // customObject.add 的参数
  const calls: any[] = []; // Configure 调用
  let stationM = 0; // 累计里程
  for (let i = 1; i < route.length; i++) {
    const [a, b] = [route[i - 1]!, route[i]!]; // 段的起点、终点
    const lengthM = Math.hypot(b[0] - a[0], b[1] - a[1]); // 水平长度
    if (lengthM < 0.01) continue;
    const id = `${PREFIX}-${i}`;
    objects.push({
      id, groupId: PREFIX, assetPath: `/JC_CustomAssets/ObjectLibrary/Exhibition/GroundLayerLinesV1/BP_Ground${effect}_V1`, pakFilePath,
      location: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rotation: [0, 0, 0], scale: [1, 1, 1],
      coordinateType: 0, collision: false, autoHeight: false, enableDecal: false, range: [0, 1000000],
    });
    const yawDeg = Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI; // 局部 X 朝北、Y 朝东
    const values = [lengthM, lineWidthM, projectionDepthM, yawDeg, stationM, spacingM, speed, reverse ? 1 : -1, brightness, opacity, minPixelWidth, ...color];
    calls.push({ id, functionName: 'Configure', parameters: values.map(paramValue => ({ paramType: 3, paramValue })) });
    stationM += lengthM;
  }

  await fdapi.customObject.delete(Array.from({ length: route.length }, (_, i) => `${PREFIX}-${i}`)); // 删掉上次的（不存在的 id 也返回成功）
  await sdkCall(fdapi.customObject, 'add', [objects]);
  const functions = JSON.stringify(await sdkCall(fdapi.customObject, 'getBPFunction', [objects.map(o => o.id)])); // 确认蓝图已加载
  if (!functions.includes('Configure') || /"objectName"\s*:\s*"None"/.test(functions)) throw new Error('贴花蓝图没有加载，检查 PAK 路径');
  await sdkCall(fdapi.customObject, 'callBPFunction', [calls]);
  await fdapi.camera.lookAt(492540, 2492172, 0, 120, -50, -60, 1);
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  // 删本示例的贴花对象，并把所有 3D 图层的贴花接收开关恢复为打开（场景默认状态），
  // 否则其他贴花类效果（如多边形漫开）在非指定图层上看不到
  await fdapi.customObject.delete(Array.from({ length: 17 }, (_, i) => `demo_gll-${i}`));
  const { infotree = [] } = await fdapi.infoTree.get();
  const layers = infotree.filter(n => n.type === 'EPT_Scene').map(n => ({ tileLayerId: n.iD, enable: true }));
  // enableDecal 在 SDK 7.1 里只从回调返回结果；回调不来时 3 秒后放行
  await new Promise(resolve => { fdapi.tileLayer.enableDecal(layers, resolve); setTimeout(resolve, 3000); });
}
