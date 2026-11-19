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
  → 栅格化：200 m 一格，每格取所在片区的数值强度（0–1）
  → 高斯模糊（σ ≈ 1.2 km）：片区之间平滑过渡、外缘渐隐
  → 分块：64 × 64 格一块，只留有值的块
  → heatmap3d.addByVoxels：贴花模式画在地面和屋顶上
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
const CELL = 200          // 格距，米
const BLUR_SIGMA = 1200   // 高斯核标准差，米

// 1) 外扩 3σ，模糊后的外缘有地方渐隐
const pad = BLUR_SIGMA * 3
const x0 = floor((minX - pad) / CELL) * CELL, y0 = floor((minY - pad) / CELL) * CELL
const nx = ceil((maxX + pad - x0) / CELL),     ny = ceil((maxY + pad - y0) / CELL)

// 2) 每格取所在片区的强度。|value| 在 [最小非零绝对值, 最大绝对值] 里的位置 t（0–1），
//    映射到 0.15–1（最低的片区也看得见）；不在片区里、或值为 0 → 0
raw[j * nx + i] = region ? 0.15 + 0.85 * t : 0

// 3) 可分离高斯模糊（先横后竖，边界外按 0），再把 < 0.03 的弱值清零（不着色）
const grid = gaussianBlur(raw, nx, ny, BLUR_SIGMA / CELL)
for (k) if (grid[k] < 0.03) grid[k] = 0
```

`gaussianBlur` 就是标准的一维高斯核（半径 3σ，归一化）分别沿 x、y 卷积一次，代码见 `HeatDemoScene.ts`。

调参：
- `BLUR_SIGMA` 越大越「热力」、越模糊；越小越接近按片区分块。1.2 km 适合全酋长国视角。
- `CELL` 越小越细腻，但数据量按平方涨；200 m 时全酋长国约 60 万格，一次发完没问题。

## 5. 分块 + heatmap3d 体积

按 64 × 64 格分块，跳过全 0 的块，每块一个 heatmap3d 体积，**全部放进一个数组一次 `addByVoxels`**：

```ts
const LAYERS = 4, FLOOR = -50, HEIGHT = 500, TILE = 64

for (每个有值的块 ti, tj, 宽 w 格, 高 h 格) {
  const values = new Array(w * h * LAYERS).fill(0)
  for (j < h) for (i < w) {
    const v = round(grid[(tj + j) * nx + ti + i] * 1000) / 1000
    // ⚠ 纹理的行和投影坐标的北向相反：第 j 行写到 h-1-j
    for (l < LAYERS) values[(l * h + (h - 1 - j)) * w + i] = v
  }
  const [wm, hm] = [w * CELL, h * CELL]
  volumes.push({
    id: `heat-volume-${ti}-${tj}`,
    groupId: 'heat-volume',
    heatValues: { size: [w, h, LAYERS], values },
    bbox: [0, 0, 0, wm, hm, HEIGHT],
    volumeBoxLocation: [x0 + ti * CELL + wm / 2, y0 + tj * CELL + hm / 2, FLOOR],
    volumeBoxSize: [wm, hm, HEIGHT],
    volumeBoxRotation: [0, 0, 0],
    displayMode: 3,      // 贴花：贴在地面和屋顶上（体积雾、体素都不好看）
    blendMode: 1,        // 半透明混合
    brightness: 8,       // 亮度高了颜色只会发灰
    heatValueMode: 0,
    heatValueRange: [0, 1],
    updateTime: 0,
    colors                // 见下一节
  })
}
await __xapi.heatmap3d.addByVoxels(volumes)
```

删除：`__xapi.heatmap3d.delete(ids)`。重画（换色板、换数据）时先删旧 id 再加。
如果返回 `result === 6`（IDExists：页面刷新后上一次的体积还在渲染实例里），先 `delete` 再 `addByVoxels` 一次。

## 6. 配色

三组色板（低 → 高，四色），来自 POPInspection `customerHeat.ts` 的 `heatRamps`：

| 色板 | 颜色 |
|---|---|
| warm 绿到红（默认） | `#a8e633` → `#ffdb1f` → `#ff850f` → `#ed1f0f` |
| ocean 深蓝到青 | `#0a1f5c` → `#0d4a8f` → `#1688b8` → `#3fc9bf` |
| risk 紫到深红 | `#5a35a5` → `#b5368a` → `#f04a3e` → `#c8102e` |

传给 `colors` 的色带：0 全透明，其后四档；颜色**转线性（^2.2）再乘一个强度**，透明度逐档升高：

```ts
const INTENSITY = 0.16
const ALPHAS = [0.28, 0.36, 0.44, 0.52]
const linear = (hex) => [0, 2, 4].map(i => INTENSITY * (parseInt(hex.slice(1 + i, 3 + i), 16) / 255) ** 2.2)
const colors = {
  gradient: true,
  invalidColor: [0, 0, 0, 0],
  colorStops: [
    { value: 0, color: [0, 0, 0, 0] },                                         // 0：不着色
    ...[0.01, 0.4, 0.7, 1].map((value, i) => ({ value, color: [...linear(ramp[i]), ALPHAS[i]] }))
  ]
}
```

为什么要压暗：引擎的自动曝光会把亮色洗成荧光、粉彩色。POPInspection 画零散热点时用 `INTENSITY = 0.35`、透明度 0.35–0.95；
这里热力成片铺满全岛，按那个值会把卫星底图整片盖死，所以降到 0.16 和 0.28–0.52，底图的地块、道路能透出来。
想更浓就把 `INTENSITY` 和 `ALPHAS` 往上调。

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
| 颜色荧光、盖死底图 | 线性化 + 压暗（INTENSITY）+ 半透明（ALPHAS），见第 6 节 |
| 南北颠倒 | 纹理行序和北向相反，写值时行号翻转 `h-1-j` |
| 片区一块一块、边界生硬 | 不是热力图；栅格后做高斯模糊（第 4 节） |
| 有等值线 | 自定义热力场材质（HeatField）自带 1 像素等值线；这里用 heatmap3d 贴花，没有 |
| 渲染实例上别的客户端的热力盖住自己的 | 渲染实例是共享的，所有客户端的对象都在同一个场景里；测试时只开一个客户端 |
| 刚重启的渲染端偶尔不回应，页面卡住 | SDK 只打 `API response timeout` 警告、Promise 不结束；关键调用加超时重试 |
