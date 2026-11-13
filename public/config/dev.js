Object.assign(gVar, {
  // 登录地址
  loginUrl: 'http://www.login.cn',
  // DTS Cloud配置
  dtsCloud: {
    player: '127.0.0.1:8090', //必填,cloud管理端地址及端口
    pid: '', //工程Id；连指定实例时留空，沿用实例当前加载的工程（传了会把实例切到该工程）
    instanceId: '', //实例Id，建议别传，让cloud根据pid寻找可用实例
    iid: '', //实例Id；留空由 cloud 分配空闲实例
    username: '',
    password: '',
    showLog: false,
    campass: {
      visible: true, //显示指南钍
      left: 1820, //距左位置
      top: 106 //距上位置
    },
    showMainUI: false, //显示内嵌UI
    showFullscreenButton: false, //显示全屏按钮
    // 场景OnReady时重置参数，>0时重置
    dtsResetNum: 7,
    // Marker弹窗根地址
    popupRootUrl: 'http://192.168.8.16:9090'
  },
  // 天气组件参数配置
  weather: {
    key: 'f5c5757ddb7a431abf3bffc67f858b0e', //zhouxq的和风项目
    url: 'https://devapi.qweather.com/v7/grid-weather/now',
    location: '112.96,28.22', // 长沙市，从天地图上获取
    interval: 2 //2个小时取更新一次天气
  },
  // 颜色面板配置
  colorPanel: {
    polygon: [
      [488545.9375, 2491134.5, 1.0],
      [488235.9375, 2490811.5, 1.0],
      [487774.5625, 2491299.25, 1.0],
      [488081.59375, 2491625.5, 1.0]
    ],
    polyline: [
      [493061.53125, 2490053.5, 0.0001],
      [492508.28125, 2490032.25, 8.719531],
      [492532, 2490584.75, 5.599374771],
      [492131.28125, 2490606.25, 9.4026]
    ],
    rgb: '#1f1f1f',
    hex: '31, 31, 31',
    alpha: '[0.12,0.12,0.12,0.8]',
    tileLayerId: '979A4C034E29728F8A2635AD747B72A3' // 房子图层id
  }
})

//支持cloud访问该前端服务。如果不是http开头，则加上http：//
if (gVar.dtsCloud.popupRootUrl.indexOf('http://') == -1) {
  let protocol = window.location.protocol
  let host = window.location.host
  let baseUrlPrefix = `${protocol}//${host}`
  gVar.dtsCloud.popupRootUrl = baseUrlPrefix + gVar.dtsCloud.popupRootUrl
}
