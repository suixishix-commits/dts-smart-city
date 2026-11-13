Object.assign(gVar, {
  loginUrl: '',
  dtsCloud: {
    player: '127.0.0.1:8090', // DTS Cloud 地址
    pid: '', // 工程 Id；留空沿用实例当前加载的工程
    iid: '', // 实例 Id；留空由 cloud 分配
    username: '',
    password: '',
    campass: { visible: false, left: 1820, top: 106 },
    showMainUI: false,
    showFullscreenButton: false,
    dtsResetNum: 0
  }
})
