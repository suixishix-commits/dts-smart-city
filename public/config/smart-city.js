// 场景相关配置。换场景时只改这里和 public/data/smart-city 下的数据文件。
Object.assign(gVar, {
  smartCity: {
    // UE 效果包统一放在渲染端资源目录 E:/Dts-Optimize/工程/demo_files/Resource 下，场景就绪后按绝对路径挂载，不需要改 Cloud 安装目录。
    // 效果总包：流动线材质、点阵流光、电子围栏、摄像头视域。留空则不挂载，依赖它的效果退回内置样式或不显示。
    effectsPak: 'E:/Dts-Optimize/工程/demo_files/Resource/DTS-Effects-Bundle.pak',
    // 智慧城市效果材质（dts-effect-kit/projects/SmartCityFx_20261117）：热力场、交通流光、分级点位合在一个包里。
    // 分开打的包都带同一个插件的资源索引，后挂的会让先挂的包里没在用的材质按路径找不到，所以只挂这一个。
    // 三项可以分别留空；挂载失败时各自退回 DTS 自带热力图 / 效果总包流动线 / DTS 扩散波纹
    heatFieldPak: 'E:/Dts-Optimize/工程/demo_files/Resource/SmartCityFx-V1-20261117-WindowsNoEditor.pak',
    trafficFlowPak: 'E:/Dts-Optimize/工程/demo_files/Resource/SmartCityFx-V1-20261117-WindowsNoEditor.pak',
    pointBeaconPak: 'E:/Dts-Optimize/工程/demo_files/Resource/SmartCityFx-V1-20261117-WindowsNoEditor.pak',
    // 底图风格：把影像压成偏冷的黄昏色调，让图层从底图里浮出来。
    // tint 乘到影像原色上；saturation 0~2；brightness 0.1~10；contrast 0.2~5；bloom 泛光 0~10
    ambience: { tint: [0.78, 0.88, 1, 1], saturation: 0.85, brightness: 0.3, contrast: 1.08, bloom: 0.6 },
    // 夜景（工具栏「昼夜切换」）：场景时间拨到入夜后影像几乎全黑，这里把影像提亮、压低饱和度，保留城市肌理，泛光加强
    nightAmbience: { tint: [0.7, 0.85, 1, 1], saturation: 0.6, brightness: 4, contrast: 1.2, bloom: 1.2 },
    // 开场动画：页面连上场景时相机从高空俯冲到默认机位、路网逐级点亮。false 关闭
    intro: true,
    // 各模块默认相机位 [x, y, z, pitch, yaw]（投影坐标，米）。
    // 取值方法：在场景里调好视角后，浏览器控制台执行 (await __xapi.camera.get()).camera，取前 5 个数。
    cameras: {
      overview: [225780, 2698610, 9600, -38, -38],
      traffic: [225780, 2698610, 9600, -38, -38],
      security: [225780, 2698610, 9600, -38, -38],
      environment: [225780, 2698610, 9600, -38, -38],
      lifeline: [225780, 2698610, 9600, -38, -38]
    },
    // 摄像头视频地址：{ 'CAM-0218': '/video/cam-0218.mp4' }，浏览器能直接播放的 mp4 / webm。
    // 没配置的摄像头显示按编号生成的模拟画面（右上角标 SIM）
    cameraStreams: {},
    // 热力图垂直范围（米），需覆盖场景地面高度
    heatmapZ: [-50, 300]
  }
})
