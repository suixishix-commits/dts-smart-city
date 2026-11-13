# 智慧城市数字孪生平台（练手项目）

基于 dts-web-template 1.2.0。数据范围为阿布扎比主岛，全部为 mock 模拟数据。

## 环境

- Node 22.13 + npm 10
- DTS Cloud：`127.0.0.1:8090`（地址在 `.env.*` 和 `public/config/dev.js` 中配置）

## 命令

- `npm install`
- `npm run dev` 开发（http://localhost:8666；首次打开要等依赖预构建，可能一两分钟）
- `npm run test:unit` 单元测试
- `npm run type-check` 类型检查
- `npm run build` 构建

`npm run lint` 目前不可用：脚本沿用模板的 ESLint 8 参数，而安装的是 ESLint 9，且没有 flat config。

## 文档

- `docs/2026-11-13-智慧城市数字孪生系统-设计文档.md`
- `docs/2026-11-13-实施计划-01-框架与城市总览.md`
- `docs/场景图层与配置清单.md`
- `目录规范说明.md`
- 页面设计稿：https://claude.ai/artifact/KsiifD2a9gwZxWf4qapcqC

## 模块进度

- [x] 城市总览（面板与交互已在浏览器走查；连接 DTS 场景的联调尚未做）
- [ ] 智慧交通
- [ ] 公共安全
- [ ] 生态环境
- [ ] 城市生命线

## 已知限制

- 摄像头画面是占位，未接视频流。
- 通用工具栏只实现了昼夜切换、天气模拟、视角复位、全屏；图层管理、城市巡航、测量、截图为禁用状态。
- 场景标注是纯文字标注，没有图标资源。
- mock 坐标是主岛范围内的示意经纬度，进入场景时通过 DTS 转成投影坐标。
