# 片区热力图（DTS heatmap3d 贴花）实现说明

把「按片区（行政区）给出数值」的数据，在 DTS 三维场景里画成一张**连续、平滑的热力图**：
数值越高越红，片区之间平滑过渡，外缘渐隐，数值为 0 的地方不着色；底图保持干净（卫星影像原色，无路网、无标签）。

参考实现：`dts-smart-city/src/views/heatdemo/`（`HeatDemoScene.ts`、`HeatDemoMain.vue`）、`src/api/regionHeat.ts`。
画法和配色来自 POPInspection 的 `Inspection-POC/src/dts/heatmap.ts`（full 模式）。

---

## 1. 整体流程

```
接口数据（片区 + GeoJSON 边界 + 数值）
  → 适配：数值转数字、取外环、简化边界
  → 投影：经纬度 → 场景坐标（米）
  → 栅格化：300 m 一格，每格取所在片区的数值强度（0.3–1）
  → 高斯模糊（σ ≈ 1.2 km）：片区之间平滑过渡、外缘渐隐，< 0.15 清零
  → 整张一个 heatmap3d 体积（不分块，分块会有接缝网格）
  → heatmap3d.addByVoxels（用回调拿回应）：贴花模式画在地面和屋顶上
```

## 2. 数据格式（接口原样）

```jsonc
{
  "code": 200,
  "msg": "Operation successful",
  "data": {
    "regions": [
      { "regionCode": "500", "regionName": "ABU AL ABYAD ISLAND", "level": "district",
        "value": "1.25E+9",                       // 字符串，可能为负
        "center": { "x": 53.80446, "y": 24.22459 } }
    ],
    "geometry": {                                 // GeoJSON FeatureCollection，WGS84
      "type": "FeatureCollection",
      "features": [
        { "properties": { "regionCode": "500", ... },
          "geometry": { "type": "Polygon" | "MultiPolygon", "coordinates": [...] } }
      ]
    },
    "minValue": "-1.375E+10",
    "maxValue": "1.25E+9"
  }
}
```

注意：
- `value` 是字符串，要 `Number()`；**负值表示同一个量的另一种记法**，着色和显示都按**绝对值**（参考界面显示为正的金额）。
- 数值 0 的片区不着色。
- 只用多边形的**外环**；边界点很密（6 万多点），用 Douglas–Peucker 按约 0.0003°（≈30 m）简化，点数降到约 1/20，判断格点归属足够用。

## 3. 投影

DTS 的场景坐标是投影坐标（米）。一次请求把所有经纬度投影过去：

```ts
const res = await __xapi.coord.gcs2pcs(lonlatList, 1)   // [[lon, lat], ...]；第二个参数照本项目 DtsSceneApi 传 1
if (res.result !== 0) throw new Error(res.resultMessage)
const xy = res.coordinates                               // [[x, y], ...]
```

每个片区记下投影后的外环和外包框（bbox），后面判断「格点落在哪个片区」时先比外包框再做点在多边形内判断，速度够用（40 万格点、100 个片区在 1 秒内）。

## 4. 栅格化 + 高斯模糊

```ts
const CELL = 300          // 格距，米
const BLUR_SIGMA = 1200   // 高斯核标准差，米

// 1) 外扩 3σ，模糊后的外缘有地方渐隐
const pad = BLUR_SIGMA * 3
const x0 = floor((minX - pad) / CELL) * CELL, y0 = floor((minY - pad) / CELL) * CELL
const nx = ceil((maxX + pad - x0) / CELL),     ny = ceil((maxY + pad - y0) / CELL)

// 2) 每格取所在片区的强度。|value| 在 [最小非零绝对值, 最大绝对值] 里的位置 t（0–1），
//    映射到 0.3–1（最低的片区落在色带的浅绿档，最高的落在红档）；不在片区里、或值为 0 → 0
raw[j * nx + i] = region ? 0.3 + 0.7 * t : 0

// 3) 可分离高斯模糊（先横后竖，边界外按 0），再把 < 0.15 的弱值清零（色带 0.15 以下本来就透明）
const grid = gaussianBlur(raw, nx, ny, BLUR_SIGMA / CELL)
for (k) if (grid[k] < 0.15) grid[k] = 0
```

`gaussianBlur` 就是标准的一维高斯核（半径 3σ，归一化）分别沿 x、y 卷积一次，代码见 `HeatDemoScene.ts`。

调参：
- `BLUR_SIGMA` 越大越「热力」、越模糊；越小越接近按片区分块。1.2 km 适合全酋长国视角。
- `CELL` 越小越细腻，但数据量按平方涨；300 m 时全酋长国约 430 × 470 格，一个体积装得下。

## 5. heatmap3d 体积（整张一个）

**不要分块**：按 64×64 分成多个体积时，引擎在块与块交界处过渡不连续，会画出一圈圈细线（网格）。整张热力放进一个体积：

```ts
const LAYERS = 4, FLOOR = -50, HEIGHT = 500

const values = new Array(nx * ny * LAYERS).fill(0)
for (j < ny) for (i < nx) {
  const v = Math.round(grid[j * nx + i] * 1000) / 1000
  // ⚠ 纹理的行和投影坐标的北向相反：第 j 行写到 ny-1-j
  for (l < LAYERS) values[(l * ny + (ny - 1 - j)) * nx + i] = v
}
const [wm, hm] = [nx * CELL, ny * CELL]
const volume = {
  id: 'heat-volume',
  groupId: 'heat-volume',
  heatValues: { size: [nx, ny, LAYERS], values },
  bbox: [0, 0, 0, wm, hm, HEIGHT],
  volumeBoxLocation: [x0 + wm / 2, y0 + hm / 2, FLOOR],
  volumeBoxSize: [wm, hm, HEIGHT],
  volumeBoxRotation: [0, 0, 0],
  displayMode: 3,      // 贴花：贴在地面和屋顶上（体积雾、体素都不好看）
  blendMode: 1,        // 半透明混合
  brightness: 8,       // 亮度高了颜色只会发灰
  heatValueMode: 0,
  heatValueRange: [0, 1],
  updateTime: 0,
  colors                // 见下一节
}
```

**⚠ 用回调拿回应**：这一版 SDK 的 `heatmap3d.addByVoxels` 返回的 Promise **永远不会结束**，`await` 它会把后面的步骤全卡住
（页面看起来卡死、镜头不动）。照 POPInspection 的写法，传回调并加超时：

```ts
const answer = send => new Promise(resolve => {
  const timer = setTimeout(() => resolve(undefined), 45000)   // 体积建得慢，最多等 45 秒
  send(r => { clearTimeout(timer); resolve(r) })
})

let r = await answer(done => __xapi.heatmap3d.addByVoxels([volume], done))
if (r?.result === 6) {   // IDExists：页面刷新后上一次的体积还在渲染实例里
  await answer(done => __xapi.heatmap3d.delete([volume.id], done))
  r = await answer(done => __xapi.heatmap3d.addByVoxels([volume], done))
}
```

删除：`answer(done => __xapi.heatmap3d.delete(ids, done))`。重画（换色板、换数据）时先删再加。

## 6. 配色

三组色板（低 → 高，四色），来自 POPInspection `customerHeat.ts` 的 `heatRamps`：

| 色板 | 颜色 |
|---|---|
| warm 绿到红（默认） | `#a8e633` → `#ffdb1f` → `#ff850f` → `#ed1f0f` |
| ocean 深蓝到青 | `#0a1f5c` → `#0d4a8f` → `#1688b8` → `#3fc9bf` |
| risk 紫到深红 | `#5a35a5` → `#b5368a` → `#f04a3e` → `#c8102e` |

色带照搬 POPInspection 默认热力（`heatmap.ts` 的 `RAMP`）：**0.15 以下全透明**，然后从一层很薄的绿逐渐加厚到黄、橙，0.78 起是红。
warm 用下面的原色；ocean / risk 在同样的档位换成各自色板的四色（档位 → 第几色：`[0,0,0,0,1,2,3,3]`）。
颜色**转线性（^2.2）再乘强度**：warm、risk 乘 0.22，ocean 同亮度下发光更强，乘 0.14。

```ts
const RAMP = [            // [档位, [r, g, b, 透明度]]
  [0,    [0.45, 0.8,  0.25, 0]],
  [0.15, [0.45, 0.8,  0.25, 0]],     // 0.15 以下透明
  [0.26, [0.45, 0.8,  0.25, 0.3]],   // 薄薄一层绿
  [0.38, [0.8,  0.85, 0.15, 0.45]],
  [0.5,  [1,    0.75, 0.1,  0.6]],
  [0.64, [1,    0.42, 0.03, 0.75]],
  [0.78, [0.92, 0.14, 0,    0.85]],  // 红
  [1,    [0.78, 0.05, 0,    0.92]]
]
const PALETTE_STOP = [0, 0, 0, 0, 1, 2, 3, 3]
const INTENSITY = { warm: 0.22, ocean: 0.14, risk: 0.22 }
const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16) / 255)
const colors = {
  gradient: true,
  invalidColor: [0, 0, 0, 0],
  colorStops: RAMP.map(([value, c], k) => ({
    value,
    color: (palette === 'warm' ? c : [...hex(ramp[PALETTE_STOP[k]]), c[3]])
      .map((v, ch) => (ch < 3 ? INTENSITY[palette] * v ** 2.2 : v))
  }))
}
```

为什么要压暗：引擎的自动曝光会把亮色洗成荧光、粉彩色。低端透明、薄绿，高端才是实红，所以底图大部分区域透得出来，重点只落在高值处。

## 7. 干净的底图

热力页不加载城市底座（黄昏色调、路网、标签、开场动画），进入时：

```ts
// 清掉渲染实例里残留的对象（实例不随页面刷新复位）
await Promise.all(['marker', 'polygon', 'polyline', 'customMesh', 'radiationPoint', 'heatmap'].map(t => __xapi[t].clear()))

// 影像原色、白天、无云、泛光关小
const scenes = (await __xapi.infoTree.get()).infotree.filter(n => n.type === 'EPT_Scene').map(n => n.iD)
await __xapi.tileLayer.setStyle(scenes, 0, [1, 1, 1, 1], 1, 1, 1, 0.18)
await __xapi.weather.setDateTime(年, 月, 日, 12, 0, 0, false)
await __xapi.weather.setCloudDensity(0)
await __xapi.weather.setDarkMode(false)
await __xapi.settings.setBloomIntensity(0.2)
```

离开页面时删掉自己的体积（`heatmap3d.delete`）；页面关闭（`pagehide`）时也要发删除，否则体积留在共享的渲染实例里，下一个打开的页面会看到。

## 8. 接真实接口

前端只依赖第 2 节的返回格式。本项目里地址取配置 `smart-city.js` 的 `regionHeatApi`，留空时读本地示例
`public/data/heatmap-demo/region-heat.json`（和接口同格式）。换接口只改地址。

## 9. 踩过的坑

| 现象 | 原因 / 处理 |
|---|---|
| 颜色反了：负值大的片区成了「低」 | 负值是同一量的另一种记法，按绝对值着色 |
| 0 的片区也有颜色 | 色带第一档 value 0 必须是 `[0,0,0,0]`，数据里 0 要真的写 0 |
| 颜色荧光、盖死底图 | 线性化 + 压暗 + 低端透明，见第 6 节 |
| 热力上有一圈圈细线（网格） | 分块的接缝；整张一个体积，见第 5 节 |
| 页面卡住、后面的步骤不执行 | `addByVoxels` 的 Promise 不结束；用回调拿回应，见第 5 节 |
| 南北颠倒 | 纹理行序和北向相反，写值时行号翻转 `h-1-j` |
| 片区一块一块、边界生硬 | 不是热力图；栅格后做高斯模糊（第 4 节） |
| 有等值线 | 自定义热力场材质（HeatField）自带 1 像素等值线；这里用 heatmap3d 贴花，没有 |
| 渲染实例上别的客户端的热力盖住自己的 | 渲染实例是共享的，所有客户端的对象都在同一个场景里；测试时只开一个客户端 |
| 刚重启的渲染端偶尔不回应，页面卡住 | SDK 只打 `API response timeout` 警告、Promise 不结束；关键调用加超时重试 |

## 10. 镜头

热力页**不设置镜头**，保持用户当前的视角。需要「框住全部片区」时可以按投影后的外包框算机位（参考实现里的 `fitCamera`）。
