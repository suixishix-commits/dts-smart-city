// 场景相关配置。换场景时只改这里和 public/data/smart-city 下的数据文件。
Object.assign(gVar, {
  smartCity: {
    // 效果总包（UE pak）在渲染主机上的绝对路径。场景就绪后按路径挂载，不需要改 Cloud 安装目录。
    // 留空则不挂载：依赖总包的效果（流动线材质、点阵流光、电子围栏、摄像头视域）退回内置样式或不显示。
    effectsPak: 'H:/Dts-Optimize/dts-effect-kit/effects/bundle/DTS-Effects-Bundle.pak',
    // 底图风格：把影像压成偏冷的黄昏色调，让图层从底图里浮出来。
    // tint 乘到影像原色上；saturation 0~2；brightness 0.1~10；contrast 0.2~5；bloom 泛光 0~10
    ambience: { tint: [0.78, 0.88, 1, 1], saturation: 0.85, brightness: 0.3, contrast: 1.08, bloom: 0.6 },
    // 各模块默认相机位 [x, y, z, pitch, yaw]（投影坐标，米）。
    // 取值方法：在场景里调好视角后，浏览器控制台执行 (await __xapi.camera.get()).camera，取前 5 个数。
    cameras: {
      overview: [225780, 2698610, 9600, -38, -38],
      traffic: [225780, 2698610, 9600, -38, -38],
      security: [225780, 2698610, 9600, -38, -38],
      environment: [225780, 2698610, 9600, -38, -38],
      lifeline: [225780, 2698610, 9600, -38, -38]
    },
    // 热力图垂直范围（米），需覆盖场景地面高度
    heatmapZ: [-50, 300]
  }
})
