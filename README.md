# 智慧城市数字孪生平台（练手项目）

基于 dts-web-template 1.2.0。数据范围为阿布扎比主岛，全部为 mock 模拟数据。

## 环境

- Node 22.13 + npm 10
- DTS Cloud：`127.0.0.1:8090`（地址在 `.env.*` 和 `public/config/dev.js` 中配置）
- 效果总包（可选）：`public/config/smart-city.js` 的 `effectsPak` 填渲染主机上 pak 文件的绝对路径；留空或路径不对时自动退回内置样式

## 命令

- `npm install`
- `npm run dev` 开发（http://localhost:8666；首次打开要等依赖预构建，可能一两分钟）
- `npm run test:unit` 单元测试（全量约 2–4 分钟；只跑一部分：`npx vitest run src/scene src/views/overview`）
- `npm run type-check` 类型检查
- `npm run build` 构建
- `npm run geo` 重新生成地理底数据 `public/data/smart-city/geo.json`（改了 `scripts/build-geo.mjs` 之后）

`npm run lint` 目前不可用：脚本沿用模板的 ESLint 8 参数，而安装的是 ESLint 9，且没有 flat config。

## 文档

- `docs/模块开发约定.md`：写新模块前必读
- `docs/场景图层与配置清单.md`：配置项、效果总包、地理数据管线、底座、场景 kit、工具栏、各模块图层
- `docs/DTS效果接口速查.md`
- `docs/2026-11-13-智慧城市数字孪生系统-设计文档.md`
- `docs/2026-11-13-实施计划-01-框架与城市总览.md`
- `目录规范说明.md`
- 页面设计稿：https://claude.ai/artifact/KsiifD2a9gwZxWf4qapcqC

## 结构概览

五个业务模块共用一套场景底座，详见 `docs/场景图层与配置清单.md`。

| 部分 | 位置 | 说明 |
|------|------|------|
| 地理底数据 | `scripts/build-geo.mjs` → `public/data/smart-city/geo.json` | 主岛海岸线、16 个片区、17 条道路、36 个路口、21 个地标。所有 mock 数据都从它派生，保证图层落在陆地和路网上 |
| 投影后的地理数据 | `src/scene/geo.ts`（`CityGeo`） | geo.json 的全部坐标一次投影成场景坐标；附带折线、点在面内、陆地网格等工具 |
| 城市底座 | `src/scene/CityBase.ts` | 场景就绪后启动一次：清理残留对象、应用底图风格、挂载效果总包、投影地理数据、画路网和海岸线。切换模块不重建 |
| 效果总包 | `src/scene/effects.ts`、`public/libs/` | 通过一个不可见的加载器 `customObject` 按路径挂载 UE pak；前端适配库按需加载；挂载不上时各处用内置样式兜底 |
| 底图风格 | `smart-city.js` 的 `ambience` | 把影像压成偏冷的黄昏色调、关云、开泛光；可在工具栏的图层管理里关掉 |
| 场景 kit | `src/scene/kit.ts` | 统一配色和场景对象构造函数（线、波纹、标注、飞线、立体柱、范围面、热力图、点阵流光、电子围栏、视域） |
| 模块场景基类 | `src/scene/ModuleScene.ts` | 图层的创建、替换、显隐和离开时的清理 |
| 通用工具栏 | `src/components/panel/SceneTools.vue`、`BaseLayerPanel.vue`、`src/composables/useSceneTools.ts` | 八个工具全部可用：图层管理、城市巡航、测量、昼夜切换、天气模拟、截图、视角复位、全屏 |
| 分辨率适配 | `index.html`、`src/utils/viewportScale.ts` | 根字号按视口宽度等比，并受高度约束（窗口比 16:9 更扁时按高度缩小）；图表 option 按设计稿 px 书写，由 `scaleOptionSizes` 换算 |

## 模块进度

- [x] 城市总览：片区密度、人口热力、热点事件、摄像头四个图层，时间轴，通用工具栏
- [ ] 智慧交通（开发中）
- [ ] 公共安全（开发中）
- [ ] 生态环境（开发中）
- [ ] 城市生命线（开发中）

五个模块的路由和顶部导航都已开放。

## 已知限制

- 摄像头画面是占位，未接视频流。
- 场景标注是纯文字标注，没有图标资源。
- 城市巡航播完即停，不循环（SDK 没有循环播放）。
- 没有效果总包时，城市总览的片区用半透明面兜底，颜色取进入时刻的人口密度，不随时间轴变化。
- 昼夜、天气是整个场景的状态，而工具栏按钮的按下状态属于各模块：开着夜间模式或下雨时切换模块，场景保持原样，但新模块的按钮显示为未按下。
- 总览的热点事件、摄像头坐标写在 `overview.json` 里（WGS84），不是从 geo.json 派生的；`geoData.spec.ts` 会检查它们落在主岛范围内。
