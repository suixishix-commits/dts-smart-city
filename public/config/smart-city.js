// 场景相关配置。换场景时只改这里和 public/data/smart-city 下的数据文件。
Object.assign(gVar, {
  smartCity: {
    // 各模块默认相机位 [x, y, z, pitch, yaw]。
    // 为 null 时，进入模块后自动定位到该模块的片区边界。
    // 取值方法：在场景里调好视角后，浏览器控制台执行 (await __xapi.camera.get()).camera，取前 5 个数。
    cameras: {
      overview: [231673, 2700198, 8674, -45, -82.5]
    },
    // 热力图垂直范围（米），需覆盖场景地面高度
    heatmapZ: [-50, 300]
  }
})
