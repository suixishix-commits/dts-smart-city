# DTS 效果接口速查（SDK 7.1 / REVISION 22639）

> 面向：阿布扎比智慧城市大屏（Vue 3 + TS），场景只有**卫星影像 + 地形**，无建筑模型，投影坐标（米）。
> 全局对象：`__xapi`（项目封装，等同文档里的 `fdapi` / `__g`）。下文一律写 `__xapi`。
>
> **资料来源与可信度**
> - 【文档】`http://127.0.0.1:8090/locale/zh/doc/*.html`（JSDoc 静态页）
> - 【源码】`http://127.0.0.1:8090/libac`（ac.min.js，逐类核对了字段转换、参数顺序、枚举数值）
> - 【示例】`http://127.0.0.1:8090/locale/zh/scripts/api_examples.js`（官方 int.html 的 1111 个 `test_xxx` 示例，可直接搜函数名抄用法）
> - 本文**没有连实例做运行时实测**。凡是只能在运行时确认的行为（事件字段全集、重复 id 的实际返回、某效果在纯地形上的观感）都标了 **未验证**。

---

## 1. 通用约定

### 1.1 调用方式与返回值【源码】

```js
const res = await __xapi.polyline.add({...})   // 不传回调 → 返回 Promise
__xapi.polyline.add({...}, res => {})          // 传回调 → 返回 undefined，不能再 await
__xapi.polyline.add({...}, null)               // 传 null → 发 __noResponse，不等响应（高频更新用）
```

- 响应对象形如 `{ command, timestamp, callbackIndex, result, resultMessage, ...业务字段 }`。
  `result === 0`（`APIErrorCode.OK`）才算成功，`resultMessage` 为文字说明。
- **Promise 永远 resolve，不会因为 `result !== 0` 而 reject**。只有"未连接"和"command 未定义"两种情况会 reject。业务代码必须自己判断 `res.result`。
- `get(ids)` 的数据在 `res.data`（数组）；`camera.get()` 的字段直接平铺在 res 上（`x y z pitch yaw roll camera[]`）；`infoTree.get()` 在 `res.infotree`；`coord.screen2World` 在 `res.worldLocation`；`coord.world2Screen` 在 `res.screenPosition`。
- SDK 内部有串行队列（`apiQueue`），一条命令收到响应后才发下一条。不 await 连发也能按序到达，但拿不到中间结果（文档 API_AsyncCall 专门演示了不 await 导致 `camera.get()` 结果为空）。
- 回调、then、await 三种写法在同一函数内不要混用【文档】。

`APIErrorCode`【源码数值】：

| 值 | 名称 | 含义 |
|---|---|---|
| 0 | OK | 正常 |
| 1 | InvalidParameters | 参数错误 |
| 2 | InternalError | 内部错误（环境未就绪、空指针） |
| 3 | ResourceNotFound | 数据不存在 |
| 4 | AcpProjWKTNotSet | 工程未设置坐标系（经纬度相关接口会失败） |
| 5 | CoordinateConversionFailed | 坐标转换失败 |
| 6 | IDExists | **指定 ID 的对象已经存在** |
| 7/8 | InvalidRequestType / InvalidRequestString | 无效请求 |
| 9 | NoCommand | 服务端没有对应命令 |
| 10 | DataTypeNotSupport | 数据类型不支持 |
| 11 | InvalidOperation | 无效操作 |
| 12 | ProjectNotOpened | 工程尚未打开 |

**重复 id**：枚举里有 `IDExists=6`，官方示例在 `add` 前一律先 `delete`/`clear`（示例注释："添加前清空…防止id重复"）。即重复 add 会失败而不是覆盖。具体是整批失败还是只跳过重复项 **未验证**。稳妥写法：`await x.delete(ids); await x.add(data)`，或已存在时用 `update`。

### 1.2 颜色格式【源码 `y()` 函数】

四种写法，SDK 在发送前统一转成 **RGBA 0–1 数组**：

| 写法 | 例 | 说明 |
|---|---|---|
| 数组 | `[1, 0.5, 0, 0.8]` | RGBA，0–1。3 元素自动补 alpha=1。**唯一能带透明度的写法** |
| 常量 | `Color.Red` | 实际值是字符串 `"RGB(255,0,0)"`，不带透明度 |
| RGB 串 | `'RGB(255,255,255)'` / `'rgb(...)'` | 0–255，除以 255 |
| 十六进制 | `'#FFFEEE'` / `'#FFF'` | 只支持 3 位或 6 位，**不支持 8 位带 alpha** |

坑：
- `'rgba(255,0,0,0.5)'` 会被当 RGB 串解析，alpha 也被除以 255 → 几乎全透明。要透明度只能用数组。
- **转换只作用于每个类登记过的颜色字段**（见各节"自动转换的颜色字段"）。没登记的字段只能传数组，例如 `marker.popupBackgroundColor`、热力图 `colors.colorStops[].color` / `invalidColor`、`weather.setFogParam` 的 fogColor、`setRainParam`/`setSnowParam` 的颜色、材质 `vectorParameters[].value`。**拿不准就一律用数组。**
- `Color` 常量共 136 个 CSS 色名（`Color.Red`、`Color.Cyan`、`Color.DeepSkyBlue`、`Color.Gold`、`Color.White`、`Color.Black`…），有几处拼写与 CSS 不同：`DoderBlue`、`LightBLue`、`Auqamarin`、`DarkVoilet`、`plum`（小写）、`Cornislk`、`GoldEnrod`、`PaleGodenrod`、`BrulyWood`、`PowDerBlue`。

### 1.3 坐标【文档】

- 场景坐标：X 东、Y 北、Z 上，单位米。
- 多数对象支持 `coordinateType`：`0` 投影（默认）/ `1` WGS84 / `2` GCJ02 / `3` BD09。用 1–3 要求工程已设置坐标系（否则错误码 4）。
- 点：`[x, y, z]`（z 可省，省略=0）。线：`[[x,y,z], ...]`。
- 面（polygon / polygon3d / highlightArea / dynamicWater）：单环二维数组；带洞三维数组（第 1 个是外环，其余内环）；多 Part 四维数组。SDK 会自动补齐维度和 z。
- 旋转一律欧拉角 `[Pitch, Yaw, Roll]`，度。Pitch −90~90（负值俯视），Yaw −180~180。
- bbox：`[minX, minY, minZ, maxX, maxY, maxZ]`。

### 1.4 资源路径【文档 + 源码】

- 图片/视频/pak 等字符串字段写 `'@path:/images/a.png'`，SDK 会替换成 Cloud"文件资源"根目录（`resourcesPath`）。
- 也支持渲染服务器本机绝对路径、`http(s)://` 网络地址。marker 的 `imagePath` 还可以传 **base64 dataURL**（示例 `test_marker_add_canvas` 用 `canvas.toDataURL()`）。
- **路径是渲染服务器视角**，不是浏览器视角。`/src/assets/x.png` 这种前端相对路径无效，要写渲染机能访问到的完整 URL。
- 弹窗网页（`popupURL`）由内置简化浏览器渲染，文档建议用原生 JS，避免 ES6 和新 CSS3 特性。

### 1.5 通用方法（BaseObject 派生类）【源码】

除特别说明，下列对象类都有：

```js
x.add(data | data[], fn)          x.update(data | data[], fn)   // update 只需 id + 要改的字段
x.delete(id | id[], fn)           x.clear(fn)
x.show(id | id[], fn)             x.hide(id | id[], fn)
x.get(id | id[], fn)              // → res.data[]
x.focus(id | id[], distance, flyTime, rotation, fn)
//   distance: 观察距离(米)，0/不传自动；flyTime: 秒，默认 2；rotation: [pitch,yaw,roll] 可选
x.updateBegin(); x.setXxx(id, v); ...; await x.updateEnd()   // 批量 setter，一次提交
```

- `id` 非字符串会被 `toString()`。所有 data 都可带 `groupId`、`userData`（字符串）。
- `showAll / hideAll / focusAll` 只有部分类有，各节单独列出。
- 所有 `setXxx(id, newVal)` 本质是 `update({id, xxx: newVal})`，单个调用就是一次网络往返；批量改请用 `update(数组)` 或 `updateBegin/updateEnd`。
- 按分组操作（任意类型通用）：`__xapi.infoTree.showByGroupId(gid)` / `hideByGroupId` / `highlightByGroupId` / `deleteByGroupId`。

### 1.6 事件【文档 API_Event + 示例 + 项目现有代码】

注册（二选一，后者会覆盖前者）：

```js
new DigitalTwinPlayer(host, { domId, apiOptions: { onReady, onEvent: e => {} } })
__xapi.setEventCallback(e => {})
```

`e.eventtype` 取值与开关：

| eventtype | 触发 | 开关 |
|---|---|---|
| `LeftMouseButtonClick` | 左键点到对象 | `settings.setMousePickMask` 含 `MouseClick(1)` |
| `MouseMoved` | 鼠标移动 | 掩码含 `MouseMove(2)`；间隔 `settings.setMouseMoveTime(秒)`，默认 1s |
| `MouseHovered` | 鼠标悬停 | 掩码含 `MouseHover(4)`；间隔 `settings.setMouseHoverTime(秒)`，默认 1s |
| `CameraStartMove` / `CameraMoving` / `CameraStopMove` | 相机运动 | `settings.setEnableCameraMovingEvent(true, period)`，period 为间隔帧数，默认 20，默认关闭 |
| `CameraChanged` | `focus()`、`camera.set/lookAt/lookAtBBox` 后 | 常开。字段 `Position[3]`、`Pitch`、`Yaw` |
| `CameraTourFinished` | `camera.playAnimation` / `cameraTour.play` 播完 | 常开 |
| `Measurement` | 测量完成，带结果 | 进入测量模式后 |
| `PlaneClipEdit` / `VolumeClipEdit` | 编辑剖切 | 剖切模式 |
| `MarkerCallBack` | 弹窗页调用 `FdExternal.postEvent(str)` | 数据在 `e.Data` |
| `PlotDrawFinished` | 标绘完成 | plot |
| `OnCustomObjectEnterTrigger` / `OnCustomObjectExitTrigger` / `OnCameraEnterTrigger` / `OnCameraExitTrigger` | 盒子触发器 | boxTrigger |
| `LoadProjectFinished` | 工程加载完成 | — |

```js
__xapi.settings.setMousePickMask(MousePickMask.MouseClick | MousePickMask.MouseHover) // 7=全开 0=全关
__xapi.settings.enableRightClickMousePick(true)   // 右键拾取，默认关
```

`LeftMouseButtonClick` 常用字段（文档只列了这几个，完整字段 **未验证**，建议首次接入时 `console.log(e)`）：

| 字段 | 含义 |
|---|---|
| `e.Type` | 对象类型。示例和项目代码里出现过：`'marker'`、`'marker3d'`、`'CustomObj'`、`'Polyline'`、`'TileLayer'`（其余类型的写法未验证） |
| `e.Id`（或 `e.ID`） | 对象 id；两种大小写都要兼容：`e.Id || e.ID` |
| `e.ObjectID` | TileLayer 内 Actor 的 id |
| `e.MouseClickPoint` | 点击处世界坐标 `[x,y,z]` |
| `e.UserData` | add 时传的 userData（项目 ClickSelectedHandler 在用） |
| `e.GroupID` | 分组 id（未验证） |

marker `displayMode: 5`（聚合模式）下点击聚合图标会返回被聚合的 marker id 数组【文档】，字段名未验证。

---

## 2. 枚举常量（全部挂在 `window` 上，可直接用）【源码数值】

```js
PolylineStyle   = { Arrow:0, Arrow1:1, Flow:2, Beam:3, Normal:4, OnTerrain:5,
                    DottedNormal:6, DottedCircle:7, OriginColor:8, OnePixelWidth:9 }
PolygonStyle    = { SingleColor:0, CirclePoint:1, Volume:2 /*Volumn:2*/, Gradual:3, DynamicGradual:4,
                    WaveTransparent:5, WideWave:6, RotateArrow:7, RotateLine:8, RotateGradual:9,
                    OnTerrain:10, OriginColor:11, AlphaGradualBorder:12 }
Polygon3DStyle  = { Wave:0, LoopLine:1, Gradual:2, DynamicGradual:3, WaveTransparent:4, WideWave:5,
                    RotateArrow:6, RotateLine:7, RotateGradual:8, SingleColor:9, SingleColorWithLight:10,
                    OriginColor:11, OceanWater:12, LakeWater:13, Opacity:14, Mask:15, Transparent:16,
                    Volume:17 /*Volumn:17*/ }
HeatMapStyle    = { Normal:-1, CustomColor:0, CustomWave:1 }
MeasurementMode = { Coordinate:1, Linear:2, Horizontal:3, Vertical:4, MultiPoint:5, TerrainArea:6, Angle:7 }
MousePickMask   = { MouseClick:1, MouseMove:2, MouseHover:4 }
MapMode         = { Campass:0, SmallMap:1, BigMap:2 }
ResetType       = { ClearObjects:1, ResetSettings:2, ResetCamera:4 }      // 可按位或
AnimationMask   = { Camera:1, Environment:2, ProjectTree:4, Settings:8 }
ActionMode      = { None:0, Follow:1, FollowBehindAndAbove:2, FollowBehind:3, FollowAbove:4,
                    FollowBellow:5, FollowLeft:6, FollowRight:7, FollowWorldRotation:8 }
Viewport        = { V1:1, V2:2, V3:4, V4:8, All:255 }
DroneTrailStyle = { None:0, Cylinder:1, Strip:2, Dot_Dash_Line:3, Square_Dash_Line:4,
                    Pixel_Line1:5, Pixel_Line2:6, Pixel_Line3:7, Pixel_Line4:8 }
SplineMeshStyle = { Fence_1:0, Fence_2:1, Wall_1:2, Wall_2:3, Road_0:4 ... Road_9:13, Fence_Tree:14,
                    Pipe:15, Railway_1:16, Railway_2:17, Railway_4:18, Railway_5:19, RectangularPipe:20 }
WaterMode       = { Animation:0, Simulation:1, Arrow:2, DebrisFlow:4 }
```

样式含义：
- **PolylineStyle**：Arrow 箭头样式 1 / Arrow1 箭头样式 2 / Flow 流动线 / Beam 光流 / Normal 固定实线 / OnTerrain 贴地 / DottedNormal 普通虚线 / DottedCircle 圆点虚线 / OriginColor 原色 / OnePixelWidth 1 像素线。
- **PolygonStyle**：SingleColor 单色 / CirclePoint 圆点 / Volume 体积 / Gradual 渐变 / DynamicGradual 动态渐变 / WaveTransparent 波纹 / WideWave 宽波纹 / RotateArrow 旋转箭头 / RotateLine 旋转线 / RotateGradual 旋转渐变 / OnTerrain 贴地 / OriginColor 原色 / AlphaGradualBorder 透明渐变边界。
- **Polygon3DStyle**：Wave、LoopLine（文档无中文说明）/ Gradual 渐变 / DynamicGradual 动态渐变 / WaveTransparent 波纹 / WideWave 宽波纹 / RotateArrow 旋转箭头 / RotateLine 旋转线 / RotateGradual 旋转渐变 / SingleColor 单色无光照 / SingleColorWithLight 单色有光照 / OriginColor 原色 / OceanWater 海水(绿) / LakeWater 湖水(蓝) / Opacity 不透明 / Mask 遮罩 / Transparent 透明 / Volume 体积。

SDK 的样式改写【源码】：polyline `style:8` 实际发 `style:4 + brightness:1`；polygon `style:11` 实际发 `style:0 + brightness:1`；polygon3d `style:11` 发 `9 + intensity:1`，`style:17` 发 `11`。所以"OriginColor"就是不叠加发光的纯色。

**贴地样式的前提**（polyline OnTerrain / polygon OnTerrain）【文档】：工程需开启对象贴合（设置面板→显示/后期→对象贴合），代码里可用 `__xapi.settings.setReceiveDecalMode(1)`（0 无 / 1 所有对象 / 2 仅地形）。大地图 + WMTS 模式下坐标须在 WMTS 范围内。贴地模式下 `setViewHeightRange` 失效。

---

## 3. 线

### 3.1 polyline 折线（道路、管线、流向、边界）

自动转换的颜色字段：`color`。

```js
await __xapi.polyline.add({
  id: 'road-1',
  coordinates: [[x1,y1,z1],[x2,y2,z2],[x3,y3,z3]],
  coordinateType: 0,               // 0 投影 1 WGS84 2 GCJ02 3 BD09
  color: [0, 0.8, 1, 1],
  style: PolylineStyle.Flow,       // 见 §2
  thickness: 20,                   // 线宽，米，默认 20
  intensity: 1,                    // 亮度 0~1000，默认 0.5；>1 触发泛光发光感
  flowRate: 0.5,                   // 流速 0~1，默认 0.5（Arrow/Flow/Beam 等动态样式生效）
  tiling: 0,                       // 贴图平铺；<=0 按线长自动，>0 用给定值（仅部分样式支持）
  shape: 0,                        // 0 直线 1 曲线（点多时曲线很慢）
  depthTest: false,                // true 会被地形遮挡，false 永远可见
  range: [1, 100000],              // 可视距离 [近, 远]
  viewHeightRange: [0, 100000],    // 相机高度在此范围内才可见
  arcType: 0,                      // 球面工程用，0 劣弧 1 优弧
  // 自定义材质（设置后 style 失效，需要资源库 pak）：
  // material: '/JC_CustomAssets/PolylineLibrary/Exhibition/混合线_4',
  // scalarParameters: [{ name: '亮度', value: 0.5 }],
  // vectorParameters: [{ name: '颜色', value: [0,1,0,1] }],   // 只能数组
})
```

- **`intensity` 与 `brightness` 是同一个东西**【源码】：add/update 时 SDK 把 `intensity` 复制到 `brightness` 一并发送；`get()` 返回的是 `brightness`；setter 叫 `setBrightness`。add 时写哪个都行，建议写 `intensity`（与文档一致）。
- 文档写 style 取值 0~7，但枚举和源码支持到 9。
- 其它方法：`showAll / hideAll`、`setCoordinates / setStyle / setThickness / setColor / setFlowRate / setBrightness / setShape / setDepthTest (id, v)`、`setViewHeightRange(id, min, max)`、`attachObject([{polylineId, startObjectId, endObjectId}])`（端点跟随，仅支持 Satellite 对象）、`setViewportVisible(id, Viewport掩码)`。
- 材质参数名查询：`(await __xapi.misc.getMaterial(path)).data[0].params` → `[{name, type, defaultValue}]`。

### 3.2 odline 迁徙线（两点抛物线飞线，带流动点和端点光圈）

自动转换的颜色字段：`color`。

```js
await __xapi.odline.add({
  id: 'od-1',
  coordinates: [[x1,y1,z1],[x2,y2,z2]],   // 只能 2 个点：起点、终点
  coordinateType: 0,
  color: [0, 1, 0, 1],
  intensity: 10,            // 亮度 0.1~1000，默认 0.5（同样会映射成 brightness）
  flowRate: 0.5,            // 流速 0~1
  bendDegree: 0.5,          // 弯曲度 0~1
  tiling: 1,                // 贴图平铺，<=0 自动；lineStyle=2 时建议手动设，如 1
  lineThickness: 60,        // 线宽，米，默认 20
  flowPointSizeScale: 80,   // 运动点大小，米，默认 20
  labelSizeScale: 1000,     // 两端光圈大小，米，默认 100
  lineShape: 1,             // 0 平面 1 柱体（默认 1）
  lineStyle: 2,             // 0 纯色 1 箭头 2 流动点 3 虚线
  flowShape: 1,             // 发光运动点：0 无 1 球体
  startPointShape: 1, endPointShape: 1,   // 端点：0 无 1 球体（官方示例里出现过 2，含义未验证）
  startLabelShape: 1, endLabelShape: 1,   // 端点贴地圆环：0 无 1 圆
})
```

- 其它方法：`showAll / hideAll`、`setColor / setCoordinates / setFlowRate / setBrightness / setTiling / setBendDegree / setLineThickness / setflowPointSizeScale（注意小写 f）/ setLabelSizeScale / setLineShape / setLineStyle / setFlowShape / setStartPointShape / setEndPointShape / setStartLabelShape / setEndLabelShape`。
- 官方示例为了突出飞线，先 `weather.setDarkMode(true)`，再用 `tileLayer.setStyle(地形id, 0, Color.White, 0.1, 0.1, 1, 0.18)` 把底图压暗。本场景同样适用。

### 3.3 beam 光流（沿折线发射的发光粒子）

自动转换的颜色字段：`color`。**没有 coordinateType，只能投影坐标**【文档】。

```js
await __xapi.beam.add({
  id: 'beam-1',
  coordinates: [[x,y,z], ...],
  color: [0, 1, 0, 0.8],
  thickness: 3,     // 0.01~10，是比例不是米（粒子+自发光，无精确单位；要精确宽度用 polyline）
  duration: 3,      // 粒子生命周期 0.1~3 秒
  interval: 2,      // 发射间隔 1~10 秒
  velocity: 5,      // 粒子速度 0.1~5
})
```
其它：`showAll / hideAll`、`setColor / setCoordinates / setDuration / setInterval / setThickness / setVelocity`。

### 3.4 guideLine 引导线、splineMesh 路径模型（简述）

- `guideLine.add({id, coordinates, coordinateType, range, depthTest, shape(0直/1曲), width(米,默认30), guideSize(默认30), speed(米/秒,默认10), interval(秒,-1不循环), color, style:{startPoint,endPoint,...各自可设 material}})`：沿线跑动的引导动画。
- `splineMesh.add({id, coordinates, style: SplineMeshStyle.Road_3, meshPath?, scale, curveType, segment, range})`：沿路径铺围挡/墙/道路/管道/铁路实体模型。内置样式是否可用取决于资源库（未验证）。

---

## 4. 面与体

### 4.1 polygon 平面多边形（片区、围栏、覆盖范围）

自动转换的颜色字段：`color`、`frameColor`。

```js
await __xapi.polygon.add({
  id: 'district-1',
  coordinates: [[x,y,z], ...],          // 单环 / 带洞 / 多 Part，见 §1.3
  coordinateType: 0,
  color: [0, 0.4, 1, 0.35],             // 填充
  frameColor: [0, 0.8, 1, 1],           // 边框颜色
  frameThickness: 5,                    // 边框厚度，米；0 = 不画边框
  style: PolygonStyle.SingleColor,
  intensity: 1,                         // 亮度 0~1000（SDK 发送时改名为 brightness）
  depthTest: false,
  priority: 1,                          // 叠放顺序 -1000~1000，大的在上
  range: [1, 100000],
  viewHeightRange: [0, 100000],
  // 仅 style = AlphaGradualBorder(12) 生效：
  gradualWidth: 10,                     // 渐变带宽度，米，默认 10
  outerAlpha: 0.3, innerAlpha: 1,       // 渐变起止透明度，默认 0.3 / 1
  // material / scalarParameters / vectorParameters 同 polyline
})
```

- 贴地（`OnTerrain`）且有洞时，内环方向必须与外环相反，否则洞不显示【文档】。
- 其它方法：`glow(ids, duration)`（闪烁；-1 一直闪，0 不闪，>0 秒数）、`highlight(ids)`、`unHighlight(ids)`、`setColor / setCoordinates / setDepthTest`、`setViewHeightRange(id,min,max)`。
- **没有 `showAll / hideAll / setStyle`**，改样式用 `update({id, style})`。
- `unHighlight` 在源码里没有 return，**await 不到结果**；需要等待就用 `polygon.stopHighlight(ids)`（同一功能，有返回）。

### 4.2 polygon3d 立体多边形（光墙、围栏、体块、水体）

自动转换的颜色字段：`color`。

```js
await __xapi.polygon3d.add({
  id: 'wall-1',
  coordinates: [[x,y,z], ...],
  coordinateType: 0,
  color: [0, 0.8, 1, 1],
  height: 200,                               // 拉伸高度，米
  intensity: 2,                              // 亮度 0~1000
  style: Polygon3DStyle.WaveTransparent,
  tillingX: 0, tillingY: 0,                  // 贴图横/纵平铺（注意拼写是 tilling，两个 l）
  generateTop: false,                        // 是否生成顶面，默认 true
  generateSide: true,                        // 侧面，默认 true
  generateBottom: false,                     // 底面，默认 true
  depthTest: true,                           // 非半透明材质不支持关闭深度检测
  bClip: false,                              // 是否参与剖切
  viewHeightRange: [0, 100000],
  // material / scalarParameters / vectorParameters 可选
})
```

- 光墙/电子围栏：`generateTop:false, generateBottom:false` + `Gradual / DynamicGradual / WaveTransparent / RotateArrow / RotateLine`。
- 其它方法：`showAll / hideAll`、`highlight(ids)`（仅部分样式支持）、`unHighlight(ids)`（同样无返回值，要等待用 `stopHighlight`）、`stopGlow(ids)`、`setStyle / setColor / setCoordinates / setHeight / setIntensity / setTillingX / setTillingY / setDepthTest`、`setViewHeightRange`、`enableClip(ids) / disableClip(ids)`。
- **`glow` 必须传数组**：`__xapi.polygon3d.glow([{ id, color:[1,1,1,1], duration: 5, interval: 1 }])`。源码里非数组分支引用了未定义变量 `o`，传单个对象会直接抛 ReferenceError。`interval` 要小于 `duration`。

### 4.3 highlightArea 高亮区域（给区域内的地表/模型染色）

自动转换的颜色字段：`color`。

```js
await __xapi.highlightArea.add({
  id: 'ha-1',
  coordinates: [[x,y,z], ...],
  coordinateType: 0,            // 文档未列，官方示例在用
  color: [0, 1, 0, 0.8],
  heightRange: [0, 200],        // 只有 Z 落在此区间的表面才被染色，要覆盖地形高程
  intensity: 1,                 // 0~1000
  depthTest: true,
})
```
其它：`setColor / setCoordinates / setHeightRange / setIntensity / setDepthTest`。无 showAll/hideAll。在纯地形上的染色效果未验证（文档说的是"模型"）。

### 4.4 radiationPoint 辐射圈（贴地扩散波纹，事件点、预警范围）

自动转换的颜色字段：`color`。

```js
await __xapi.radiationPoint.add({
  id: 'rp-1',
  coordinate: [x, y, z],
  coordinateType: 0,     // 文档未列，官方示例在用
  radius: 300,           // 0~500000 米
  rippleNumber: 3,       // 波纹圈数 0~5
  color: [1, 0, 0, 0.8],
  intensity: 0.8,        // 0~1（映射为 brightness）
  autoHeight: true,      // 自动贴到下方表面
})
```
其它：`showAll / hideAll / focusAll(distance, flyTime, rotation)`、`setCoordinate / setRadius / setRippleNumber / setColor / setBrightness / setAutoHeight`。

### 4.5 decal 贴花（把图片贴到地表）

无颜色字段。**没有 show/hide**，只有 add/update/delete/clear/focus/focusAll/get。

```js
await __xapi.decal.add({
  id: 'd1',
  texturePath: '@path:/images/zone.png',
  decalBlendMode: 0,            // 0 背景混合 1 仅贴花（剔除 png 半透明）
  order: 1,                     // 层级，大的在上
  // 方式一：位置 + 旋转 + 缩放
  location: [x, y, z], rotation: [-90, 0, 0], scale: [100, 100, 100],
  // 方式二：bbox（设置后 location/scale 失效）
  // bbox: [minX, minY, minZ, maxX, maxY, maxZ], rotation: [-90, 0, 0],
})
```
要让地形接收贴花：`settings.setReceiveDecalMode(1 或 2)`。

---

## 5. 热力

### 5.1 heatmap 平面热力图

无自动颜色转换：`colors` 里的颜色**只能写数组**。无 coordinateType：bbox 与点坐标都是**投影坐标**（经纬度先 `coord.gcs2pcs`）。

```js
await __xapi.heatmap.addByHeatPoints({
  id: 'population-heat',
  bbox: [minX, minY, minZ, maxX, maxY, maxZ],   // 必须 6 个且 min<=max，否则直接返回 false（不是 Promise）
  range: [0, 100],                              // 热力值范围，点的 heatValue 须在其内
  data: [{ id: '0', coordinate: [x, y, 0], radius: 200, heatValue: 60 }, ...],
  style: HeatMapStyle.CustomColor,   // -1 Normal 普通（标准配色，下面带 * 的参数不生效）/ 0 贴地 / 1 波形
  textureSize: 1024,                 // * 128~4096，越大越清晰也越慢
  opacityMode: 1,                    // * 0 用色卡 alpha  1 用热力点不透明度
  opacityRange: [0, 1],              // * 仅 opacityMode=1
  blur: 0.85,                        // * 0~1，越大越平滑
  blendMode: 1,                      // 0 / 1
  light: false,                      // 是否受光照
  colors: {                          // * 自定义色带；不传用标准热力配色
    gradient: true,
    invalidColor: [0, 0, 0, 1],
    colorStops: [
      { value: 0,   color: [0, 0.97, 0, 1] },
      { value: 0.5, color: [1, 0.71, 0, 1] },
      { value: 1,   color: [1, 0, 0, 1] },
    ],
  },
  updateTime: 1,                     // update 时的插值动画时长，秒
  viewHeightRange: [0, 100000],
})
```

- `style` 不传时 SDK 强制发 `-1`，并**丢弃** textureSize/colors 等参数。要自定义色带必须显式写 `style: 0` 或 `1`。
- 动态刷新：`heatmap.updateByHeatPoints({ id, data: [{id, heatValue}], updateTime: 1 })`（带插值过渡）；增删点 `addPoints(id, points)` / `removePoints(id, pointIds)`；`setRange(id, [min,max])`、`setBBox(id, bbox)`。
- 旧式位置参数接口仍在：`heatmap.add(id, bbox, range, data, style, textureSize, opacityMode, opacityRange, blur, colors, blendMode, light, binaryFile, updateTime, viewHeightRange, fn)` 及同顺序的 `update(...)`。新代码用 `addByHeatPoints`。
- tif 栅格：`addByTif({id, style, range, colors, tifFile:{file, minHeight, maxHeight}, ...})`；tif 序列动画 `load({..., tifAnimation:{files[], totalSeconds, time, minHeight, maxHeight}})` + `play(id) / pause(id) / setTime(id, 秒)`；`highlightPixels(id, [[px,py],...]) / unHighlightAllPixels(id)`。
- 通用：`delete / clear / focus / show / hide / get`。无 showAll/hideAll。

### 5.2 heatmap3d 三维热力（体积雾 / 体素）

构建方式：`addByHeatPoints`（离散点）、`addByImages`（16 张 1024² 切片）、`addByVoxels`、`addBySparseVoxels`、`addByTif`（后三个在源码里都是 `add` 的别名）。

```js
await __xapi.heatmap3d.addByHeatPoints({
  id: 'h3d',
  displayMode: 0,              // 0 体积雾 1 体素 2 盒子 3 贴花
  brightness: 10,              // 0~100，0 全透明
  bbox: [minX, minY, minZ, maxX, maxY, maxZ],
  voxels: [{ coordinate: [x,y,z], radius: 50, heatValue: 0.5, alpha: 1 }, ...],
  voxelShape: 1,               // 0 球（构建很慢）1 盒子（默认）2 四面体（需 indices）
  voxelAlphaMode: 0,           // 0 用色带 alpha 1 按热力值在 heatValueRange 内线性插值
  voxelSize: 50,               // 只传 voxels + voxelSize 时自动算 bounds / textureSize
  textureSize: 128,            // 128~512
  denoise: 0,                  // 0~5
  heatValueMode: 0,            // 0 插值 1 最近 2 叠加 3 最小 4 最大 5 覆盖 6 独占
  heatValueRange: [0, 1],
  blendMode: 1,                // 0 X 光 1 半透明
  boundsColor: [1, 1, 1, 1],   // 包围盒 1px 线框，默认不显示
  colors: { gradient: true, invalidColor: [0,0,0,0], colorStops: [{ value: 0, color: [0,0,1,1] }] },
  updateTime: 1,
})
```
另有 `volumeBoxLocation / volumeBoxRotation / volumeBoxSize`。此类方法很多（文档 HeatMap3D.html，示例 `test_heatmap3d_*` 28 个），这里只列了核心字段，其余未逐一核对。

---

## 6. 标注

### 6.1 marker 屏幕标注（图标 + 文字 + 牵引线 + 弹窗 + 聚合）

自动转换的颜色字段：`fontColor`、`fontOutlineColor`、`textBackgroundColor`、`lineColor`。**`popupBackgroundColor` 不在其中，只能数组。**
限制：单次 add 不超过 5000 个，工程内总数不超过 20 万【文档】。

```js
await __xapi.marker.add({
  id: 'cam-001', groupId: 'sc_camera', userData: JSON.stringify({ ... }),
  coordinate: [x, y, z], coordinateType: 0,
  // 图片
  imagePath: 'http://host/icons/camera.png',        // 支持 gif、网络地址、@path:、dataURL
  imageSize: [32, 32],                              // 默认 [32,32]
  hoverImagePath: 'http://host/icons/camera_hover.png',
  hoverImageSize: [32, 32],                         // [0,0]=用图片原尺寸；比 imageSize 小则按 imageSize
  anchors: [-16, 32],                               // 图片偏移，默认 [0,0] 时图片左上角对准坐标点；
                                                    // 底部居中对准：[-width/2, height]
  fixedSize: true,                                  // true 固定像素大小，false 近大远小（默认）
  // 文字
  text: '摄像头 001',
  fontSize: 14, fontColor: Color.White,             // 默认 12 / 黑
  fontOutlineSize: 1, fontOutlineColor: Color.Black,
  textBackgroundColor: [0, 0, 0, 0.5],              // 默认 [1,1,1,0.85]
  textOffset: [0, 0],
  textRange: [1, 6000],                             // 文字可视距离，默认 [100, 6000]
  useTextAnimation: false,                          // 文字展开动画，默认 true，量大时关掉
  // 牵引线
  showLine: true,
  lineSize: [2, 100],                               // [宽, 高] 像素；showLine=true 未设时 SDK 补 [2,100]
  lineColor: Color.White, lineOffset: [0, 0],
  // 弹窗（渲染端内置浏览器画在视频流里）
  popupURL: 'http://host/popup.html?id=001',        // 网页 / 视频文件 / 实时流地址
  popupSize: [600, 400], popupOffset: [0, 0],
  popupBackgroundColor: [1, 1, 1, 0.1],
  autoHidePopupWindow: true,                        // 点别处自动关
  autoHideText: true,                               // 弹窗打开时隐藏文字
  // 可见性
  range: [1, 100000],                               // 默认 [10, 10000]，大场景务必调大
  viewHeightRange: [0, 100000],
  rangeRatio: 0.01,                                 // 配合 viewHeightRange，相机降低时 range 线性衰减到 ratio*range
  autoHeight: false,                                // z=0/不设时自动贴合下方表面；z 有值时相当于偏移
  // 避让 / 聚合
  displayMode: 2,
  priority: 0,                                      // 避让优先级，大的靠上
  occlusionCull: false,                             // 遮挡剔除，仅 displayMode 0/1 生效
  clusterByImage: true,                             // 按 imagePath 分类聚合
})
```

`displayMode`：`0` 相机移动时不显示、参与避让聚合 / `1` 移动时显示、参与避让聚合 / `2` 移动时显示、不参与避让聚合（始终全显示）/ `3` 移动时不显示、不参与 / `4` 智能（SDK 的 add 默认值；按 range 的 1% 和 10% 分段自动切 2→1→0，比例用 `autoDisplayModeSwitchFirstRatio`、`autoDisplayModeSwitchSecondRatio` 调）/ `5` 聚合模式。

其它方法：
- `showAll / hideAll / focusAll(distance, flyTime, rotation)`；`showByGroupId(gid|gid[]) / hideByGroupId / deleteByGroupId`。
- 弹窗：`showPopupWindow(ids) / hidePopupWindow(ids) / showAllPopupWindow() / hideAllPopupWindow()`。
- 聚合样式（全局）：`setClusterStyle({ imagePath, imageSize:[30,30], fontSize: 14, fontColor:[1,1,1,1], enableAnimation: false })`，fontColor alpha=0 可隐藏数字。
- 跟随移动对象：`attachObject([{ markerId, objectId, offset:[x,y,z] }])`，支持 CustomObject / Vehicle / Vehicle2 / Train / Drone。源码里没有 return，await 不到结果；要等待用 `setAttachCustomObject`。
- setter：`setCoordinate / setImagePath / setImageSize / setHoverImagePath / setAnchors / setText / setTextOffset / setFontSize / setFontColor / setFontOutlineSize / setFontOutlineColor / setTextBackgroundColor / setRange / setTextRange / setPopupURL / setPopupSize / setPopupOffset / setAutoHidePopupWindow / setLineSize / setLineColor / setLineOffset / setPriority / setOcclusionCull / setGroupId / setUserData`、`setViewportVisible(id, 掩码)`。
- 别名【源码】：`textColor`→`fontColor`，`url`→`popupURL`。
- 弹窗页与大屏通信：弹窗页引入 ac.min.js 后 `FdExternal.postEvent('字符串')` → 大屏收到 `MarkerCallBack`，数据在 `e.Data`；`FdExternal.close()` 关闭弹窗。弹窗页内也可以 `new DigitalTwinAPI()` 直接调接口（示例 popup_interact.html）。
- 想用 Vue 组件做弹窗：监听点击事件，用 `coord.world2Screen(x,y,z)` 取 `screenPosition` 自己定位 DOM（官方示例 `div_marker` 就是这么做的）。注意该屏幕坐标是相对**视频流画面**的，不是 video 元素尺寸，需按缩放比换算。

### 6.2 markerLayer 标注图层（海量点，三级 LOD）

自动转换的颜色字段：`color`、`fontColor`、`fontOutlineColor`、`textBackgroundColor`、`lineColor`。
远处显示圆点 → 中距显示图片 → 近处显示完整 marker。图层级参数与 marker 基本相同，另有：

```js
await __xapi.markerLayer.add({
  id: 'poi-layer',
  range: [1, 5000, 100000],     // [minDis, lodDis, maxDis]：minDis~lodDis 显示 Marker，lodDis~maxDis 显示图片/点
  minPixel: 4,                  // 到 maxDis 时的像素大小
  coordinateType: 0, autoHeight: false, viewHeightRange: [0, 100000],
  fontSize: 12, fontColor: Color.White, textBackgroundColor: [0,0,0,0.5], textRange: [100, 6000],
  popupSize: [600, 400], displayMode: 4, clusterByImage: true, priority: 0, occlusionCull: false,
  markers: [{ id: 'p1', coordinate: [x,y,z], anchors: [-16,32], text: 'xx', popupURL: '',
              imagePath: '...', imageSize: [32,32], hoverImagePath: '...', hoverImageSize: [32,32] }],
})
```
其它：`showAll / hideAll`、`focusByMarkerId(id, markerId, distance, flyTime, rotation)`、`setViewHeightRange(id,min,max)`。displayMode 只有 0~4（无聚合模式 5）。

### 6.3 marker3d 动态标记（场景内的三维特效点 + 3D 文字）

自动转换的颜色字段：`textColor`、`textOutlineColor`。

```js
await __xapi.marker3d.add({
  id: 'm1', groupId: 'g',
  coordinate: [x, y, z], coordinateType: 0,
  pointName: 'Point_B_1',       // 特效名，取自 Explorer 资源面板→动态标记的显示名；示例里还有 '3D_UI_C_3'
  pointVisible: true, pointScale: 5,              // 整体缩放 >= 0.01
  text: '变电站', textSize: 32,                    // 文字 0~100 字符；默认字号 70
  textColor: '#6BF4F7', textOutlineSize: 1, textOutlineColor: Color.Black,
  textFixed: true,              // 文字是否固定朝向
  textVisible: true,
  textLocation: [0,0,0], textRotation: [0,0,0], textScale: [1,1,1],
  fixedSize: false,             // false 近大远小
  range: [1, 100000], viewHeightRange: [0, 100000],
  autoHeight: false, collision: true, depthTest: true,
})
```
- 可用的 `pointName` 取决于渲染端资源库，本工程有哪些 **未验证**（名字不对时的表现也未验证）。
- 其它：`showAll / hideAll`、`showByGroupId / hideByGroupId / deleteByGroupId`、`setViewHeightRange(id,min,max)`、`attachObject([{marker3dId, objectId, offset}])`（跟随 CustomObject；无返回值）、`getBPFunction(ids)`、`callBPFunction([{id, functionName, parameters:[{paramType, paramValue}]}])`（无返回值，要等待用 `callBatchBPFunction`）。
- `update` 不会处理 `viewHeightRange`（只有 add 处理），更新可见高度用 `setViewHeightRange`。

### 6.4 customTag（已停止更新）

文档标注 Deprecated，推荐用 marker。特点是把一个网页当标签贴在场景里：`customTag.add({id, coordinate, contentURL, contentSize:[w,h], pivot:[0.5,0.5], range:[1,5000], popupURL, popupSize, popupPos, autoHidePopupWindow})`。本地地址不能有空格。有 `showAll / hideAll / focusAll`。另有 `tag` 类（`api.tag`，TagData）同为旧接口。

---

## 7. 光、视频、全景、波束

### 7.1 light 光源

自动转换的颜色字段：`color`。

```js
await __xapi.light.add({
  id: 'light_1',
  type: 1,                               // 1 点光源 2 聚光灯 3 矩形光
  coordinates: [[x, y, z]],              // 二维数组；点/聚光 1 个点，矩形光 2 个点（起止）
  coordinateType: 0,
  color: [0, 0, 1, 1],
  rotation: [0, 0, 0],                   // [pitch, yaw, roll]
  intensity: 200,                        // 烛光，默认 8
  distance: 1000,                        // 可视距离，米，默认 5000
  attenuationRadius: 100,                // 衰减半径，米
  castShadows: false,                    // 多光源开阴影非常耗性能
  outerConAngle: 45,                     // 仅 type=2：锥角 0~180，默认 45
  thickness: 3,                          // 仅 type=3：宽度 0.1~20000 米，默认 3
  automate: true,                        // 默认 true：按场景时间自动开关（晚上亮、白天灭）
})
```
**白天看不到灯光**：要么 `automate: false`，要么先 `weather.setDateTime(...)` 调到夜间（官方示例的做法）。有 `showAll / hideAll`；无单项 setter，用 `update`。

### 7.2 videoProjection 视频投影

自动转换的颜色字段：`frustumColor`。

```js
await __xapi.videoProjection.add({
  id: 'vp1', coordinateType: 0,
  videoURL: 'rtsp://...',          // 本地文件 / 网络文件 / rtsp / http 流
  location: [x, y, z], rotation: [-50, 0, 0],
  fov: 90,                         // 垂直视角 0~160
  aspectRatio: 1.77,               // 宽高比 0.1~10
  distance: 100, minDistance: 0,   // 投影距离 / 近裁，米
  exposure: 0.6,                   // 0~3
  depthCulling: true,              // 背面剔除
  screen: false, screenDistance: 100,     // 是否显示幕布及其距离
  frustumVisible: true, frustumColor: [0, 0, 1, 1],
  texturePath: '',                 // 蒙版图片
  order: 1,
})
```
setter：`setVideoURL / setLocation / setRotation / setFovy / setAspectRatio / setDistance / setDepthCulling / setFrustumColor`。

### 7.3 panorama 全景图

`panorama.add({id, imagePath, coordinate, yaw(-360~360), onTerrain(默认 true，贴地后 offset 的 Z 失效), offset:[x,y,z]})`；`enter(id)` 进入、`exit()` 退出、`switchMode()` 在全景与三维间切换。无 show/hide。

### 7.4 signalWave 信号波束

`signalWave.add({id, alpha(0~1), range:[min,max]（距发射点的透明度衰减区间）, valA..valG: [x,y,z]})`，用 7 个点定义波束形状（各点几何含义文档没写，未验证）。注意源码里登记的颜色字段名写成了 `"olor"`，即**该类没有任何颜色自动转换**。

---

## 8. 水体与淹没

| 对象 | 用途 | 关键点 |
|---|---|---|
| `tools.startFloodFill(options)` / `stopFloodFill()` | 一次性水淹分析 | 全局只有一份 |
| `floodFill` | 同上，但可多份、可按 id 管理 | 颜色字段 `color` |
| `dynamicWater` | 多边形动态水面 | 3 种预设样式，无 show/hide |
| `waterMesh` | 自定义三角网水面 | 可设流速流向 |
| `fluid` | 实时流体仿真（出水点喷涌漫流） | 28 种样式 |
| `polygon3d` 的 `OceanWater(12)` / `LakeWater(13)` | 最简单的水体块 | — |
| `hydrodynamic1d/2d`、`hydrodynamicModel`、`river`(过时)、`waterFlowField`、`smoothedParticleHydrodynamics`、`oceanHeatMap` | 专业水动力模型结果可视化 | 需要外部模型数据文件，本文未展开 |

```js
// 水淹（基于地形向外漫延）
await __xapi.floodFill.add({
  id: 'fd1',
  min: [minX, minY], max: [maxX, maxY],   // 分析范围
  seed: [x, y],                           // 出水点，必须在范围内且不能被遮挡，否则无效
  elevation: 3.5,                         // 水位高度，米
  color: Color.LightSeaGreen,
  precision: 0.5,                         // 0~1，越高越慢
})
// setColor / setElevation / setPrecision / setSeed (id, v)、setRange(id, minArr, maxArr)、showAll / hideAll
// 涨水动画：定时 setElevation(id, h)

await __xapi.dynamicWater.add({ id: 'dy1', coordinates: [[x,y,z],...], coordinateType: 0, style: 0 })
// style：0 深蓝 1 蓝 2 湖水；setCoordinates / setStyle；focusAll

await __xapi.waterMesh.add({
  id: 'wm1', coordinateType: 0,
  coordinates: [[x,y,z], ...],            // 顶点
  indices: [2, 0, 3, 0, 2, 1],            // 三角形索引，绕向须一致
  waterColor: [0, 0.4, 0.8, 0.8],
  waterSpeed: 3,                          // 0.01~30 米/秒
  waterDirection: 0,                      // 0~1，对应 0~360 度
  waveScale: 0.3,                         // 波纹强度 0.01~1
  waterUVRepeat: 100,                     // 贴图重复间距 1~10000 米
})

await __xapi.fluid.add({
  id: 'ff',
  bbox: [minX, minY, minZ, maxX, maxY, maxZ],      // 仿真范围
  style: 8,                                        // 0~27
  color: [0, 0.5, 1, 1],                           // 可选，默认用样式自带颜色
  sources: [{ id: 'ff_1', rotation: [0,0,0],
              bbox: [minX, minY, minZ, maxX, maxY, maxZ],   // 出水口，须在仿真 bbox 内且高于地形（地形高度 + 1 米）
              velocity: [0, 0],                             // 流速流向 [-2, 2]
              shape: 0,                                     // 0 矩形 1 圆形
              duration: -1 }],                              // -1 一直出水
})
__xapi.fluid.continueSource([{ id: 'ff', sources: [{ id: 'ff_1', active: true }] }])  // 示例里 add 后调它开始出水
// pause(ids) / continue(ids) / reset(ids) / addSource / removeSource / stopSource
```
取地形高度：`tools.lineIntersect([x, y, 高处z], [x, y, 低处z])` → `LineIntersectPoint`（要求在相机视野内，且起点 Z 大于终点 Z）。

海面参数（工程里有海洋时）：`weather.setOceanWave({scale, length, amplitude, speed, formDensity, directionNorm})`、`settings.setOceanColor(color)`。

---

## 9. 运动对象

以下对象都依赖资源库里的模型资产（`assetPath` / `pakFilePath`）。本工程渲染端挂了哪些 pak **未验证**；可用 `misc.reloadPak()` 重新挂载、`settings.getCharacterAssetPath()` / `getDroneAssetPath()` 查询部分资产。

### 9.1 customObject 自定义模型

```js
await __xapi.customObject.add({
  id: 'o1', groupId: 'g',
  pakFilePath: '@path:DTS_Library.pak',
  assetPath: '/Game/Common/Asset_Bank/Mesh/Car/BP_Car_JiuHuChe',   // 必须是蓝图 Actor
  location: [x, y, z], coordinateType: 0,
  rotation: [0, 0, 0], localRotation: [0, 0, 0], scale: [1, 1, 1],
  range: [0, 10000],
  smoothMotion: 1,          // 1 平滑移动 0 跳跃
  isEffectRotation: true,   // startMove/moveTo 时是否自动转向
  autoHeight: false, collision: true, enableDecal: true, visible: true,
})
// 实时位置驱动（GPS）
__xapi.customObject.moveTo([{ id: 'o1', location: [x,y,z], rotation: [0,90,0], smoothTime: 1 }])
// 轨迹回放：time 为到达时刻（秒），第一个点必须是 0；rotation 可省，自动计算
__xapi.customObject.startMove('o1', 0, [
  { time: 0, coordinate: [x1,y1,z1] }, { time: 5, coordinate: [x2,y2,z2] }, { time: 9, coordinate: [x3,y3,z3] },
])
__xapi.customObject.pause(ids); __xapi.customObject.resume(ids); __xapi.customObject.stop(ids)
```
- 相机跟随：`focus(ids, distance, flyTime, rotation, actionMode, offset)`，`actionMode` 用 `ActionMode`；取消 `camera.cancelFollow()`。
- 效果：`highlight(ids) / unHighlight(ids)`、`glow([{id, color, duration, interval}]) / stopGlow(ids)`、`setTintColor(ids, color)`、`overrideMaterial(data) / restoreMaterial(ids)`、`showGrowth(data)`。
- 其它：`setLocation(id, loc, smoothTime) / setRotation / setLocalRotation / setScale / setSmoothMotion / setSmoothTime / setMoveRate`、`showByGroupId / hideByGroupId`、`addByTileLayer`、`callBPFunction`。

### 9.2 vehicle 载具（带车轮转向，自动贴地）

```js
await __xapi.vehicle.add({
  id: 'vc1',
  assetPath: '/JC_CustomAssets/VehicleLibrary/Exhibition/SUV_01',
  coordinate: [x, y, z], coordinateType: 0,     // 仅 0 / 1
  rotation: [0, 0, 0],
  autoHeight: true,          // 默认 true，自动算行驶高度
  colorType: 0,              // 0 随机内置涂装，>0 固定涂装
  color: [1, 0, 0, 1],       // 自定义涂装，覆盖 colorType
  delay: 0.5,                // moveTo 的延迟，秒
})
__xapi.vehicle.moveTo([{ id: 'vc1', coordinate: [x,y,z], gear: 3, heading: 0, time: 1 }])  // gear：0 驻车 1 倒 2 空 3 前进
__xapi.vehicle.setWayPoint([{ id: 'vc1', wayPoints: [{ timeStamp: 0, coordinate: [x,y,z], gear: 3 }, ...] }])
__xapi.vehicle.start([{ id: 'vc1', timeStamp: 0 }])     // 从轨迹的某时刻开始跑
__xapi.vehicle.pause(ids); __xapi.vehicle.resume(ids); __xapi.vehicle.stop(ids)
// focus(ids, followEnable, distance, flyTime, rotation, distanceRotation, offset)  ← 参数顺序与其它类不同
```
`vehicle2`、`train` 是类似的另外两套接口。

### 9.3 drone 无人机、trafficSimulation 交通仿真

- `drone.add({id, assetPath:'/AirCityPlugin/ArtResources/Drone/Drone', coordinate, rotation, scale, trailType: DroneTrailStyle.Strip, trailColor, trailThickness, trailDuration(默认 3 秒), lightColor:[r,g,b,亮度], label:{visible, offset, cullDistance, ...}})` + `drone.moveTo(data)`，自带拖尾轨迹。
- `trafficSimulation.add({id, coordinateType, models:[{type, package}], heatmap:{bbox, visible, blur, heatRadiusScale, colorStops...}, noiseThreshold, timer})`：十万级车流仿真，用 `.dat` 数据驱动 `update`；`showHeatMap / hideHeatMap / highlight / unHighlight / autoHighlight(id, distance) / showTextLabel / hideTextLabel`。数据格式本文未展开。

---

## 10. 相机

### 10.1 camera【源码核对了参数顺序】

```js
const c = await __xapi.camera.get()      // { x, y, z, pitch, yaw, roll, camera:[x,y,z,pitch,yaw,roll] }

__xapi.camera.set(x, y, z, pitch, yaw, flyTime)     // 相机放到该位置；flyTime 秒，默认 2，0=瞬切
__xapi.camera.set([x, y, z, pitch, yaw, roll], flyTime)     // 直接用 get().camera
__xapi.camera.set({ x, y, z, pitch, yaw }, flyTime)

__xapi.camera.lookAt(x, y, z, distance, pitch, yaw, flyTime)   // 看向目标点，distance=相机离目标的距离，0=自动
__xapi.camera.lookAtBBox(bbox, pitch, yaw, flyTime)
__xapi.camera.flyAround([x, y, z], [pitch, yaw, roll], distance, time)
//   绕点一周；rotation 默认 [0,90,0]，distance 默认 1000，time 一周秒数默认 10
__xapi.camera.stop()                               // 停止（实现上是 Camera_Move 的 stop 指令；能否打断 flyAround 未验证）
```

- 角度：**pitch 俯仰，负值朝下**（−90 垂直俯视）；**yaw 航向**，−180~180。官方示例用 `pitch -15, yaw -173`。
- 顺序是 **pitch 在前、yaw 在后**。2021-03-17 之前是 (heading, tilt)，老代码可 `camera.useOldDataFormat(true)` 全局交换。文档里 `lookAtBBox(bbox, yaw, pitch)` 那段示例是旧顺序，以签名为准。
- pitch / yaw 传 0 或不传 = 服务端自动取默认值（源码 `pitch||0`），不是"水平正东"。想要精确 0 度可传一个极小值（如 0.001），效果未验证。
- 计算朝向：`camera.getEulerAngle(startPoint, endPoint)` → `[pitch, yaw, 0]`，**同步函数**，本地计算。
- 限制范围：`lockByBBox(bbox)` / `unlock()`；`settings.setMinCameraHeight(m)`（≥ −100，默认 −100）、`settings.setMaxCameraHeight(m)`（≥ 100000，默认 100000）。
- 步进：`moveForward / moveBackward / moveLeft / moveRight / moveUp / moveDown / turnLeft / turnRight / turnUp / turnDown`。
- 工程里预录的导览：`getAnimationList()` → `[{id, name, type, uuid, ...}]`；`playAnimation(id | id[], AnimationMask?) / pauseAnimation() / resumeAnimation() / stopAnimation()`；`getAnimationImage(name)` → base64 png 缩略图（128×128）。
- 球面工程：`enterWorld() / exitWorld()`（地球 ↔ 场景飞入飞出）。投影工程下的行为未验证。
- `cancelFollow()` 取消对象跟随。

### 10.2 cameraTour 代码创建的导览

```js
const frames = [
  new CameraTourKeyFrame(0, 1.0, [x1, y1, z1], [pitch, yaw, 0]),   // (index, 到达时刻秒, location, rotation?)
  new CameraTourKeyFrame(1, 4.0, [x2, y2, z2]),                    // rotation 省略则按路径自动计算
  new CameraTourKeyFrame(2, 8.0, [x3, y3, z3], [-25, 108, 0]),
]
await __xapi.cameraTour.delete('tour1')
await __xapi.cameraTour.add(new CameraTourData('tour1', '总览巡航', frames))   // (id, name, keyFrames)
__xapi.cameraTour.play('tour1')
__xapi.cameraTour.pause(); __xapi.cameraTour.resume(); __xapi.cameraTour.stop()   // 这三个不带 id
__xapi.cameraTour.setTime('tour1', 3)                       // 从第 3 秒开始播
__xapi.cameraTour.setMouseClickToPause('tour1', false)      // 默认 true：播放中点鼠标会暂停
```
- 播完触发 `CameraTourFinished` 事件。没有内置循环，循环要在事件里再 `play`。
- 其它：`update(CameraTourData)`、`setKeyFrames / setDuration / setName / setUserData (id, v)`、`exportVideo(id, 服务器路径)`（mp4，1920×1080，30fps，存在渲染服务器磁盘）。
- 没有 `get / clear / show / hide`。`setTime` 与 `setMouseClickToPause` 在源码里都是发 `CameraTour_Play` 命令，调用即开始播放。

---

## 11. weather 天气与时间【源码核对】

```js
__xapi.weather.setDateTime(year, month, day, hour, minute, daynightLoop)   // daynightLoop=true 则 3 分钟循环一天
__xapi.weather.simulateTime(9, 15, 10)                 // 10 秒内从 9 点过渡到 15 点
__xapi.weather.simulateTime([9, 30], [15, 45], 15)     // 也可 [时, 分]
__xapi.weather.setDarkMode(true)                       // 黑暗模式（夜景底图感，飞线/发光效果最显眼）
await __xapi.weather.getDateTime()   // { year, month, day, hour, minute, latitude, longitude, timeZone, daynightLoop, dayLength }
await __xapi.weather.getParams()     // 当前全部天气参数
```

雨 / 雪 / 雾 / 云：

```js
__xapi.weather.setCloudThickness(2)      // 开雨雪前必须先设云层厚度（文档与示例一致）
__xapi.weather.setCloudDensity(0.5)      // 0~1
__xapi.weather.setRainParam(strength, speed, raindropSize, rainColor, alignCamera, overcastStrength)
//   各项 0~1；strength 必须 > 0；例：setRainParam(1, 1, 1, [0.5,0.5,0.5,0.1], 0.5, 0.5)
__xapi.weather.setSnowParam(strength, speed, snowflakeSize, snowColor, alignCamera, overcastStrength)
__xapi.weather.disableRainSnow()
__xapi.weather.setFogParam(fogDensity, fogColor, fogHeightFalloff, fogStartDistance, fogOpacity)
//   density 0~2，falloff 0~2，startDistance 0~10000，opacity 0~1；例：setFogParam(0.1, [1,1,1,1], 0.05, 10, 0.2)
__xapi.weather.setCloudParam(cloudsColor, cloudsAltitude /*km 0~8*/, cloudShadowStrength /*0~1*/)
__xapi.weather.setLowCloud(coverage, density, height /*0~0.5*/, windSpeed /*0~100*/, windDirection /*0~360*/)
__xapi.weather.setHighCloud(coverage, windSpeed, windDirection, cirrus, cirrostratus, cirrocumulus)   // 密度类 0~1
__xapi.weather.setCloudHeight(km)        // 文档没列，源码和示例里有
```

- **颜色坑**：`setFogParam` 的 fogColor、`setRainParam` / `setSnowParam` 的颜色在源码里**没有经过颜色转换**，只能传 `[r,g,b,a]` 数组（文档写"支持四种格式"与源码不符）。`setCloudParam`、`setSunColor`、`setAmbientLightColor` 会转换。
- `setRainParam` / `setSnowParam` 内部是 `x || null`：alignCamera、overcastStrength 传 0 会变成 null（取服务端默认）。
- `setCloudThickness(v)` 实际发的是 `lowCloudHeight`，文档范围写 0~0.5，官方示例却传 2；`setCloudDensity` 发 `lowCloudDensity`。取值以实际效果为准（未验证）。
- 没有单独的"关雾"接口，把 fogDensity / fogOpacity 设 0。

光照与大气：

| 方法 | 范围 / 说明 |
|---|---|
| `setSunIntensity(v)` | 0~40 |
| `setSunSize(v)` / `setMoonSize(v)` | 0~10 |
| `setSunColor(color)` | 四种格式 |
| `setMoonIntensity(v)` | 0~1 |
| `setAmbientLightIntensity(v)` / `setAmbientLightColor(color)` | 0~5 |
| `setTemperature(k)` | 色温 1700~12000 |
| `setShadowQuality(v)` | 1~5，越高越耗显卡 |
| `setShadowIntensity(v)` | 0~1 |
| `setShadowDistance(m)` | 10~30000 |
| `setRayleighScatter(v)` | 0~2，默认 0.04（天空散射，调蓝/调橙） |
| `setSkyVisibleMaxHeight(m)` | 相机高于此值天空变黑，默认 50000 |
| `setWindSpeed(v)` / `setWindDirection(deg)` | 0~100 / 0~360（正北 0，顺时针），影响雨雪飘向 |
| `getSunDirection(时间戳ms)` | 指向太阳的方向向量 |
| `setEarthCloudIntensity / setEarthNightLightIntensity / setEarthStarBackgroundIntensity (0~1)` | 仅球面工程 |

---

## 12. settings 后期、地形、交互

后期与画质（全部 `(value, fn)`，源码里都走 `Settings_SetPostProcess`）：

| 方法 | 取值 |
|---|---|
| `setBloomIntensity(v)` | 泛光 0~10，默认 0。**线/面的 intensity > 1 要配合它才有辉光** |
| `setExposureEnabled(bool)` / `setExposureCompensation(v)` | 自动曝光开关（默认 false）/ 曝光补偿（默认 0） |
| `setContrast(v)` / `setSaturation(v)` | 0~100，默认 10 |
| `setTonemapper(bool)` | 色彩优化，默认 true |
| `setLutMode(n)` / `setLutIntensity(v)` | LUT 调色预设 0~30（0 关）/ 强度 0~1 |
| `setLensFlareIntensity(v)` | 镜头光晕 0~1 |
| `setDarkCorner(v)` | 暗角 0~1 |
| `setChromaticAberration(v)` | 色差 0~5 |
| `setPostProcessEffects(n)` | 滤镜：0 无 / 1 景深 / 2 线框 / 3 圆珠笔 / 4 白框 / 5 蓝图 / 6 原色黑边 |
| `setDepthFiethSwitch(bool)`（原拼写）/ `setFocalLength(mm)` / `setAperture(f)` / `setDeepBlur(v)` / `setDofMode(0~3)` | 景深；dofMode：0 近 0.5km / 1 2km / 2 5km / 3 10km |
| `setAmbientIntensity(0~100)` / `setAmbientRadius(v)` / `setAmbientFadeDistance(m)` | 环境光遮蔽，默认 60 / 100 / 12000 |
| `setGlobalIllumination(bool)` | 屏幕空间全局光照，默认 false（文档没列，源码和示例有） |
| `setAntiAliasing(bool)` | 默认 true |
| `setScreenPercentage(v)` | 渲染分辨率百分比 50~200，默认 125 |
| `setFovX(deg)` | 水平视场角 10~135 |
| `setNearClipPlane(m)` | 0.1~100，默认 1 |

地形与贴合：

| 方法 | 说明 |
|---|---|
| `setTerrainGlobalAlpha(v)` | 地形不透明度 0~1（1 不透明）。`setTerrainAlpha` 已过时 |
| `setTerrainGlobalLitStatus(bool)` | 地形是否受光照，默认 true。**设 false 后影像不随昼夜变暗** |
| `setTerrainGlobalPixelDepthOffsetRatio(v)` | 仅 dom+dem 发布的地形 3dt，缓解贴地对象闪烁 |
| `setReceiveDecalMode(n)` | 对象贴合：0 无 / 1 所有对象 / 2 仅地形。贴地线/面/贴花的前提 |
| `setGroundHeight(h)` | 工程地面海拔 |
| `setCameraTerrainCollision(bool)` | 相机是否被地形挡住不穿地 |
| `setOsgbGlobalAlpha / setOsgbGlobalLitStatus` | 倾斜摄影用，本场景无关 |

交互与界面：

| 方法 | 说明 |
|---|---|
| `setMousePickMask(mask)` / `setMouseHoverTime(s)` / `setMouseMoveTime(s)` / `enableRightClickMousePick(bool)` | 见 §1.6 |
| `setEnableCameraMovingEvent(bool, period)` | 见 §1.6 |
| `setEnableInteract(bool)` | 整体禁用/启用键鼠触摸交互 |
| `setInteractiveMode(n)` / `getInteractiveMode()` | 0 漫游 / 1 人物 / 2 无人机 / 3 中心漫游 / 4 地图 |
| `setMoveSpeed(0~1)` / `setYawSpeed(0~1)` | 默认 0.2 / 1.0 |
| `setCameraAutoRotateOnRightDoubleClick(bool)` | 右键双击自动旋转，默认 true，大屏建议关 |
| `setHighlightColor(color)` | 全局高亮颜色（影响各类 highlight） |
| `showMainUI() / hideMainUI()`、`setCampassVisible(bool)`、`setCampassPosition(left, top)`、`setToolbarVisible(bool)` | 隐藏渲染端自带 UI |
| `setMapMode(mode, options)` / `getMapMode()` | 0 指南针 / 1 鹰眼图 / 2 大地图（叠加 MVT / WMTS / WMS / Mapbox / 天地图底图）。options：`serviceType(0 MVT,1 WMTS,2 WMS,3 MapServer,4 Mapbox)`、`serviceProvider`、`coordType(0 经纬度,1 本地)`、`mapPoint`、`longitude/latitude`、`style`、`cache`、`groundHeight`、`renderMode(0 正常,1 透明,2 标注,3 贴地)`、`decalMode`、`serverURL:[[id,url]]`、`coordOrder`、`maxLevel(0~22)`。大地图与 vtpk 标注互斥 |
| `setWMTSLayerVisible([[id, bool]])` / `setWMTSLayerOpacity([[id, 0~1]])` | 大地图模式下的图层 |
| `getProjectWKT()` | 工程坐标系 wkt |

---

## 13. tools 测量、剖切、分析

```js
// 测量：先设模式再开始；结果通过 'Measurement' 事件返回
__xapi.tools.setMeasurement(MeasurementMode.Linear, {
  unitType: 0,                    // 0 米 1 千米 2 英尺
  coordinates: [],                // 传了就直接量这些点，不传走鼠标拾取
  pointSize: 8, textSize: 10,
  textColor: Color.Yellow, pointColor: [0,0,1,0.3], lineColor: Color.Red, areaColor: [0,1,0,0.3],  // 四个颜色都会转换
  showCoordinateText: false,
})
__xapi.tools.startMeasurement()
__xapi.tools.stopMeasurement()
```
MeasurementMode：1 坐标 / 2 直线 / 3 水平 / 4 垂直 / 5 多点（多边形投影面积）/ 6 地表面积 / 7 角度。

| 方法 | 说明 |
|---|---|
| `startPolygonClip(coordinates, isReverseCut)` / `stopPolygonClip()` | 多边形剖切（挖掉区域内或区域外）。图层需先 `tileLayer.enableClip(图层id)` |
| `startPlaneClip(location, rotation, isShowPlane, isEditable)` / `stopPlaneClip()` | 面剖切 |
| `startVolumeClip(bbox, direction, isShowBBox, isEditable, rotation)` / `updateVolumeClip(同参)` / `stopVolumeClip()` | 体剖切，direction：0 正向 1 反向 |
| `startFloodFill({min, max, seed, elevation, color, precision})` / `stopFloodFill()` | 水淹，见 §8 |
| `startContourLineAnalysis(options)` / `stop…` | 等高线（适用地形）：`coordinates, isShowContourPlane, contourPlaneOpacity, isShowContourLine, contourLineColor, contourLineSpacing(默认 20 米), contourLineRangeMin/Max, label:{sapcing(原拼写), fontSize, fontColor, backgroundColor}, colorStops` |
| `startTerrainSlopeAnalysis({coordinates, showArrow, colorMode, arrowColor})` / `stop…` | 坡度坡向（适用地形 3dt）；colorMode：1 坡度 2 坡向 |
| `startViewshedAnalysis({startPoint, endPoint, fov_h, fov_v, height, visibleColor, invisibleColor, frustumVisible, ...})` / `stop…` | 可视域（另有可多实例的 `viewshed` 对象类） |
| `startVisiblityAnalysis` / `startViewDomeAnalysis` / `startSkylineAnalysis` / `startSunshineAnalysis` / `startCutFillAnalysis` + 对应 `stop…` | 通视 / 开敞度 / 天际线 / 日照 / 填挖方 |
| `lineIntersect(start, end)` / `linesIntersect([{start,end}], highPrecision, returnDetails)` | 射线求交，返回 `Id / Type / ObjectID / PropertyName / LineIntersectPoint`；取地形高度用。须在相机视野内 |
| `startGeometryEdit(id, type)` / `stopGeometryEdit()` | 交互式顶点编辑（polygon / polygon3d / polyline / radiationPoint / waterMesh / customObject） |
| `replaceTextureByImage / ByVideo / ByUrl (texturePath, 资源)`、`restoreTexture(paths)` | 替换模型材质纹理为图片 / 视频 / 网页 |
| `showUIPanel(UIPanelType, [x,y])` / `hideUIPanel(type)` / `showMeasurePanel` / `showClipPanel` | 调出渲染端自带面板 |

不传 `coordinates` 的分析都会进入鼠标交互拾取模式。

---

## 14. coord 坐标转换

```js
// 经纬度 → 投影。入参 [lng,lat] / [lng,lat,z] / 它们的数组；第二个参数：1 WGS84（默认）2 GCJ02 3 BD09
const r = await __xapi.coord.gcs2pcs([[54.37, 24.45], [54.40, 24.47]], 1)
const g = await __xapi.coord.pcs2gcs([x, y, z], 1)
const s = await __xapi.coord.screen2World(600, 400)        // s.worldLocation
const p = await __xapi.coord.world2Screen(x, y, z)         // p.screenPosition = [sx, sy]
```
- gcs2pcs / pcs2gcs 结果在响应的哪个字段，文档没给示例（**未验证**，猜测是 `coordinates`，首次使用请打印）。
- 工程没设坐标系时失败（文档写"错误代码 -4"，枚举里是 `AcpProjWKTNotSet = 4`）。
- 屏幕坐标是相对**视频流画面**左上角的像素，不是 video 元素的 CSS 像素。`player.getVideoStreamSize()` / `getVideoElementSize()` 可用于换算（方法存在于源码，返回结构未验证）。
- 大多数对象直接支持 `coordinateType: 1`，不必自己转；必须转的：heatmap（bbox 和点）、beam、decal、camera、fluid / floodFill 的范围、tools 的剖切与分析坐标。

---

## 15. misc 杂项

| 方法 | 说明 |
|---|---|
| `getMaterial(path | path[])` | 查材质参数 → `res.data[].params[{name, type, defaultValue}]` |
| `callBPFunction({actorTag / objectName, functionName, paramType, paramValue / parameters})` | 调场景蓝图函数 |
| `playVideo(id, x, y, w, h, url)` / `stopPlayVideo(id)` | 在视频流画面上开视频窗口 |
| `playMovie(url, loop)` / `stopMovie()` | 全屏播片（期间暂停三维渲染） |
| `addImageButtons([{id, x, y, width, height, normalImage, hoverImage, tooltip}])` / `addAnimatedImageButtons` / `deleteImageButtons(ids)` | 画在流里的按钮 |
| `enterMultiViewportMode(1~7, lineColor, lineSize)` / `exitMultiViewportMode()` / `setActiveViewport(0~3)` / `setMultiviewportInteractSync(bool)` | 多视口分屏对比 |
| `enterReportMode() / exitReportMode()` | 汇报演示模式 |
| `setWindowResolution(w, h)` | 设渲染窗口分辨率（文档没列，源码和示例有） |
| `reloadPak()` | 重新挂载新加的 pak |
| `showAllFoliages() / hideAllFoliages()` | 植被显隐 |
| `projectAssetCountAll()` / `projectAssetCount(AssetType)` | 工程资产统计 |

顶层：`__xapi.reset(ResetType.ClearObjects | ResetType.ResetCamera)`（不传参默认清除所有接口创建的对象）；`__xapi.getVersion()`；`__xapi.setEventCallback(fn)`；`__xapi.destroy()`；`registerTick(url)`（在渲染进程内每帧执行 JS，用于高频更新，见文档 API_FrameTick）。

### 截图：SDK 没有截图接口

- 源码里有命令常量 `Camera_ExportImage`，但**没有任何方法调用它**；`misc` 里也没有 screenshot / download。
- 能用的替代：
  1. `camera.exportOrthoImage(path, [w,h], orthoWidth, location, rotation, backgroundColor)`：正交出图，存到**渲染服务器磁盘**。
  2. `cameraTour.exportVideo(id, path)`：导览出 mp4，同样存服务器。
  3. 前端自己截 video：`const v = player.getVideoElement(); ctx.drawImage(v, 0, 0)` 后 `canvas.toDataURL()`。这是通用浏览器手段，**未验证**（WebRTC 视频一般不涉及跨域污染）。
  4. `tools.showUIPanel(UIPanelType.Screenshot)` 调出渲染端自带截屏面板（枚举值 31，行为未验证）。

---

## 16. infoTree 图层树、tileLayer 图层样式

```js
const { infotree } = await __xapi.infoTree.get()
// [{ iD, index, parentIndex, name, visiblity, type }]   ← 字段拼写就是 iD / visiblity
// type：EPT_Folder / EPT_Scene（3dt 图层，地形也是它）/ EPT_ModelActor / EPT_Light / EPT_Decal / EPT_Polyline ...

__xapi.infoTree.show(id | id[])        // 文档没列，源码和示例有；传文件夹 id 可整组显示
__xapi.infoTree.hide(id | id[])
__xapi.infoTree.setVisibility([{ id, visible: true }])
__xapi.infoTree.focus(id | id[])
__xapi.infoTree.enableXRay(id | id[], color) / disableXRay(ids)
__xapi.infoTree.showByGroupId(gid) / hideByGroupId(gid) / highlightByGroupId(gid) / deleteByGroupId(gid)
```

tileLayer（3dt 图层，本场景里就是地形 / 影像层，id 从 `infoTree.get()` 里 type=EPT_Scene 的项取）：

```js
__xapi.tileLayer.setStyle(ids, style, color, saturation, brightness, contrast, contrastBase)
//   style：0 默认 / 1 X 光 / 2 纯色 / 3 水晶体 / 4 暗黑 / 5 科幻 / 6 扩散 / 7 素体块
//   后四个参数仅 style=0 生效：saturation 0~2（默认 1）、brightness 0.1~10（默认 1）、
//   contrast 0.2~5（默认 1）、contrastBase 0.036~0.9（默认 0.18）
__xapi.tileLayer.setStyle(terrainId, 0, Color.White, 0.1, 0.1, 1, 0.18)   // 官方示例：压暗去饱和底图以突出飞线
await __xapi.tileLayer.getStyle(ids)
__xapi.tileLayer.setAltitudeHeatMap(ids, [{ value: 0, color: [0,0,1,1] }, { value: 500, color: [1,0,0,1] }])
//   按海拔分层设色（适合地形）。源码里无返回值，不能 await。颜色只能数组
__xapi.tileLayer.enableXRay(ids, color) / disableXRay(ids)
__xapi.tileLayer.enableClip(ids) / disableClip(ids)          // 参与剖切
__xapi.tileLayer.show(ids) / hide(ids) / focus(ids, distance, flyTime, rotation)
__xapi.tileLayer.setViewHeightRange(id, min, max)
__xapi.tileLayer.addModifier(id, tileLayerId, coordinates, 缓冲) / clearModifier(ids)   // 压平
__xapi.tileLayer.addHole(data) / clearHole(ids)                                         // 挖洞
```
- 各 style 在**影像地形**上的效果未验证（X 光、水晶体、科幻等多是给建筑白模设计的）。可靠的是 style 0 的饱和度 / 亮度 / 对比度，以及按海拔设色。
- `highlightActor / showActor / hideActor / getObjectIDs` 等 Actor 级接口针对含构件的模型图层，本场景用不上。
- 另有 `imageryLayer`、`globeTerrain`、`cesium3DTileset`、`geoJSONLayer`、`shapeFileLayer` 可在运行时追加影像 / 矢量图层（本文未展开）。geoJSONLayer 支持按属性渲染（Simple / UniqueValue / ClassBreaks），适合直接加载行政区、路网 GeoJSON。

---

## 17. 坑点汇总

1. **Promise 不 reject**：失败也 resolve，必须查 `res.result === 0`。
2. **传了回调就没有 Promise**；`heatmap.addByHeatPoints / setBBox` 在 bbox 非法时同步返回 `false`。
3. **部分方法没有 return，await 立即得到 undefined**：`polygon.unHighlight`、`polygon3d.unHighlight`、`marker.attachObject`、`marker3d.attachObject`、`marker3d.callBPFunction`、`tileLayer.setAltitudeHeatMap`。
4. **`polygon3d.glow` 只能传数组**，传对象抛 ReferenceError。
5. **颜色**：`rgba()` 字符串、8 位 hex 不支持；未登记字段只能数组（popupBackgroundColor、热力色带、雾 / 雨 / 雪颜色、材质 vectorParameters、signalWave 全部）。
6. **亮度字段名不统一**：polyline / odline / polygon / radiationPoint add 时写 `intensity`，SDK 映射为 `brightness`，`get` 返回 `brightness`，setter 叫 `setBrightness`；polygon3d / highlightArea / light 一直叫 `intensity`。
7. **拼写原样使用**：`tillingX / tillingY`、`setflowPointSizeScale`、`setDepthFiethSwitch`、`Campass`、`startVisiblityAnalysis`、`sapcing`、infoTree 的 `iD / visiblity`、事件的 `eventtype`（全小写）与 `Id / ID`（两种都出现）。
8. **默认可视距离很小**：marker 默认 `range [10, 10000]`、`textRange [100, 6000]`；城市级俯视要显式调大，否则拉高就消失。
9. **marker 默认 displayMode = 4**（智能避让），点多时远处会被避让隐藏；要全显示用 2。
10. **资源路径是渲染服务器视角**，前端相对路径无效；`@path:` 指向 Cloud 文件资源根目录。
11. **贴地样式 / 贴花**依赖对象贴合开关（`settings.setReceiveDecalMode`）。
12. **灯光默认 `automate: true`**，白天不亮。
13. **发光感 = intensity > 1 + `settings.setBloomIntensity(>0)`**；默认 bloom 为 0。夜景或 `setDarkMode(true)` 下最明显。
14. **`depthTest: false`** 才能保证线 / 面不被起伏地形遮住；地形场景里 z 给小了会埋进地下，可用 `autoHeight`（marker / marker3d / radiationPoint 支持）或 `lineIntersect` 取高程。
15. **重复 id 会报 IDExists(6)**（依据枚举与示例习惯，实际返回未验证）；模块进入时先 delete 再 add，或用 groupId + `infoTree.deleteByGroupId`。
16. **文档与源码不一致处**：heatmap 文档只写 `addByHeatPoints`，源码还有位置参数的 `add / update`；polyline style 文档写 0~7，实际到 9；`lookAtBBox` 示例参数顺序是旧的；weather 颜色"四种格式"对雾 / 雨 / 雪不成立；settings 的 `setGlobalIllumination`、misc 的 `setWindowResolution`、weather 的 `setCloudHeight`、infoTree 的 `show / hide / focus` 文档没列但可用。
17. **版本校验**：ac.min.js（7.1）与服务器接口版本不一致时 SDK 会 `alert`，用 `__xapi.misc.isApiVersionMatched()` 可主动查。

---

## 18. 本场景（仅影像 + 地形）可直接出效果的组合

| 目标 | 做法 |
|---|---|
| 夜景科技感底图 | `weather.setDarkMode(true)` 或 `setDateTime` 调到夜间；`tileLayer.setStyle(地形id, 0, Color.White, 0.3, 0.3, 1, 0.18)` 压暗；`settings.setBloomIntensity(1~2)` |
| 片区 / 行政区 | polygon `AlphaGradualBorder`（渐变描边）或 `SingleColor + frameColor`；重点片区加 polygon3d 光墙（`Gradual / DynamicGradual`，无顶无底） |
| 道路 / 管线 / 流向 | polyline `Flow / Arrow / Beam`，`depthTest:false`，`intensity` 2~10 |
| 区域间联系 / 调度 | odline（`lineStyle:2` 流动点 + 端点光圈） |
| 事件点 / 预警 | radiationPoint 波纹 + marker（图标、弹窗）或 marker3d 特效点 |
| 人口 / 指标分布 | heatmap `CustomColor` 自定义色带，`updateByHeatPoints` 做时序动画；立体可试 heatmap3d 体积雾 |
| 海量 POI | markerLayer（三级 LOD）或 marker `displayMode:5` 聚合 + `setClusterStyle` |
| 海岸 / 洪涝 | floodFill 定时 `setElevation`；polygon3d `OceanWater / LakeWater`；fluid 喷涌仿真 |
| 地形表达 | `tileLayer.setAltitudeHeatMap` 海拔分层设色；等高线、坡度分析 |
| 镜头语言 | `camera.flyAround` 环绕；cameraTour 关键帧巡航；`weather.simulateTime` 日夜流转 |
| 天气演示 | `setCloudThickness` → `setRainParam / setSnowParam`；`setFogParam` |

**本 SDK 版本没有 / 做不到的**：截图接口；finiteElement / hydrodynamic 系列需要外部专业数据文件才有意义；customObject / vehicle / drone / marker3d 特效 / 自定义材质依赖渲染端资源库 pak（本工程是否具备未验证）；建筑相关效果（tileLayer 的 X 光 / 水晶体 / 科幻 / Actor 高亮、highlightArea 染建筑）在无建筑模型的场景里没有作用对象。
