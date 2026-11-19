// 场景相关配置。换场景时只改这里和 public/data/smart-city 下的数据文件。
Object.assign(gVar, {
  smartCity: {
    // UE 效果资源「先查后挂」（scene/effects.ts）：资源已经在渲染端（别的项目挂过）就直接用，不挂任何包；
    // 查不到先挂资源总包 resourcePak，还查不到才挂下面各效果的单独包。同一插件的包挂两个会互相顶掉，所以单独包只作兜底。
    // 资源总包：收齐了本项目用到的全部效果材质和蓝图（热力场、交通流光、流光线、分级点位、流动线、点阵流光、电子围栏、视域）
    resourcePak: 'E:/Dts-Optimize/工程/demo_files/Resource/dts-resource-v1.0.6.pak',
    // 兜底的单独包（旧配置）：总包可用时不会被挂；文件移走后留空即可
    effectsPak: 'E:/Dts-Optimize/工程/demo_files/Resource/DTS-Effects-Bundle.pak',
    heatFieldPak: 'E:/Dts-Optimize/工程/demo_files/Resource/SmartCityFx-V2-20261118-WindowsNoEditor.pak',
    trafficFlowPak: 'E:/Dts-Optimize/工程/demo_files/Resource/SmartCityFx-V2-20261118-WindowsNoEditor.pak',
    lineFlowPak: 'E:/Dts-Optimize/工程/demo_files/Resource/SmartCityFx-V2-20261118-WindowsNoEditor.pak',
    pointBeaconPak: 'E:/Dts-Optimize/工程/demo_files/Resource/SmartCityFx-V2-20261118-WindowsNoEditor.pak',
    // 底图风格：把影像压成偏冷的黄昏色调，让图层从底图里浮出来。
    // tint 乘到影像原色上；saturation 0~2；brightness 0.1~10；contrast 0.2~5；bloom 泛光 0~10
    ambience: { tint: [0.78, 0.88, 1, 1], saturation: 0.85, brightness: 0.3, contrast: 1.08, bloom: 0.6 },
    // 夜景（工具栏「昼夜切换」）：场景时间拨到入夜后影像几乎全黑，这里把影像提亮、压低饱和度，保留城市肌理，泛光加强
    nightAmbience: { tint: [0.7, 0.85, 1, 1], saturation: 0.6, brightness: 4, contrast: 1.2, bloom: 1.2 },
    // 片区热力演示页（#/heatmap）的数据接口：返回格式见 src/api/regionHeat.ts。留空用本地示例 data/heatmap-demo/region-heat.json
    regionHeatApi: '',
    // 演示时刻 'HH:mm'：页面打开时全站时钟从这个时刻开始走（演示数据的告警、事件、工单都在下午这个时段）。
    // 接真实数据时删掉这一项，全站用真实时间
    demoTime: '14:45',
    // 开场动画：页面连上场景时相机从高空俯冲到默认机位、路网逐级点亮。false 关闭
    intro: true,
    // 各模块默认相机位 [x, y, z, pitch, yaw]（投影坐标，米）。
    // 取值方法：在场景里调好视角后，浏览器控制台执行 (await __xapi.camera.get()).camera，取前 5 个数。
    cameras: {
      // 统一机位：朝东南斜看全岛，市中心在前景，岛的两端都落在两侧面板之间
      overview: [228203, 2717338, 10960, -45, 60],
      traffic: [228203, 2717338, 10960, -45, 60],
      security: [228203, 2717338, 10960, -45, 60],
      environment: [228203, 2717338, 10960, -45, 60],
      lifeline: [228203, 2717338, 10960, -45, 60]
    },

    // 摄像头视频地址：{ 'CAM-0218': '/video/cam-0218.mp4' }，浏览器能直接播放的 mp4 / webm。
    // 没配置的摄像头显示按编号生成的模拟画面（右上角标 SIM）
    cameraStreams: {},
    // 热力图垂直范围（米），需覆盖场景地面高度
    heatmapZ: [-50, 300]
  }
})
