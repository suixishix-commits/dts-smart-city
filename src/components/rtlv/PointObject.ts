import PointObjectPlayer from "./PointObjectPlayer"
import qs from 'qs'
import ProjectSceneFacade from '@/components/ProjectSceneFacade'

export default class PointObject {
  option: any
  // 移动对象
  moveObjectId: any
  // 位置队列
  locationQueue: Array<any> = []
  // 已播放列表
  alreadyPlayedList: Array<any> = []
  // 定时器ID
  timeId: any
  // 弹窗地址,不包含传参
  popupUrl: any
  // 最新数据
  latestData: any
  // 数据来源
  dataSource: any

  constructor(option: any) {
    this.option = option
  }

  //播放
  public async play() {
    //从位置队列中播放第一个位置
    //当前策略是来一个插一个，用定时器控制一下延迟
    let len = this.locationQueue.length
    if (len > 0) {
      this.timeId = setInterval(() => {
        len = this.locationQueue.length
        if (len > 0) {
          let item = this.locationQueue.shift()
          let markerText = item.txt ? item.txt + '\n' : ''
          markerText = markerText + item.txtTime
          let mo: any = {
            id: `co_${item.id}`,
            location: item.coord,
            rotation: [],
            smoothTime: 0,
            markerId: `mk_${item.id}`,
            markerText: markerText,
            historyPosition: item.historyPosition,
            historyLineId: `hl_${item.id}`
          }
          if (this.popupUrl) {
            mo.popupUrl = this.popupUrl + '?' + qs.stringify(this.processPopupData(item.type, item.rawData))
          }
          PointObjectPlayer.pushList([mo])
          this.alreadyPlayedList.push(item)
        }
      }, 200)
    } else {
      if (this.timeId) {
        clearInterval(this.timeId)
        this.timeId = null
      }
    }
  }

  //暂停
  public async pause() {
  }

  //恢复
  public async resume() {
  }

  //停止
  public async stop() {
  }

  /**
   * 添加新位置
   * @param location 
   */
  public async pushMessage(location: any) {
    //是否自动播放
    let playflag = this.locationQueue?.length == 0 ? true : false
    this.locationQueue.push(location)
    //去重
    this.locationQueue = this.locationQueue.filter((item, index, self) => {
      return index === self.findIndex(obj => obj.time === item.time)
    })
    //排序
    this.locationQueue.sort((a, b) => { return a.time - b.time });
    if (this.locationQueue.length > 0 && !this.moveObjectId && __xapi?.isReady) {//初始化co对象
      this.initMoveObject(this.locationQueue[0])
    }
    // 自动播放
    if (playflag) {
      this.play()
    }
  }

  // 初始化移动对象
  private async initMoveObject(location: any) {
    this.dataSource = location.type
    // 个性化资源
    // let markerImagePath = '@path:szdk/img/uav_dj.png'
    let markerImagePath = '@path:szdk/img/uav_dj_y.png'
    let coPakFilePath = '@path:DTS_Library.pak'
    let coAssetPath = '/JC_CustomAssets/ObjectLibrary/Exhibition/交通工具/其他/无人机_1'
    // 绑定在点、线、co上的用户数据
    let userData: any = {
      id: location.id,
      type: location.type,
      txt: location.txt
    }

    // 弹窗信息
    let popupUrl: any = gVar.dtsCloud.popupRootUrl
    let popupSize: any = [1920, 1080]

    switch (location.type) {
      case 'AdsBUav':
        markerImagePath = '@path:szdk/img/uav_xunhe.png'
        popupUrl = popupUrl + '/szdk/popup/tonghangfeiji.html'
        break;
      case 'RoadUav':
        userData.usingType = location.usingType
        if (JSON.parse(location.netWork)) {
          popupSize = [317, 559]
          popupUrl = popupUrl + '/szdk/popup/hezuowurenji.html'
        } else {
          popupSize = [304, 257]
          popupUrl = popupUrl + '/szdk/popup/feihezuowurenji.html'
        }
        if (location.usingType == '0') {//普通
          // markerImagePath = '@path:szdk/img/uav_dj.png'
          markerImagePath = '@path:szdk/img/uav_dj_y.png'
        } else if (location.usingType == '1') {//顺丰
          markerImagePath = '@path:szdk/img/uav_hezu.png'
        } else if (location.usingType == '2') {//美团
          markerImagePath = '@path:szdk/img/uav_meituan.png'
        } else if (location.usingType == '3') {//医疗
          markerImagePath = '@path:szdk/img/uva_jinwu.png'
        }
        break;
      default:
        popupSize = null
        popupUrl = null
        break;
    }

    // co对象
    let coOption = {
      id: `co_${location.id}`, //自定义对象唯一id
      pakFilePath: coPakFilePath, //资源库pak文件路径,推荐使用cloud内置的文件资源管理器加载pak并使用@path方式传入参数      
      assetPath: coAssetPath,
      groupId: 'lac_co',
      location: ProjectSceneFacade.pro4jTransform(location.coord), //位置坐标
      coordinateType: 0, // 坐标系类型
      rotation: [0, 0, 0], // 世界坐标系旋转
      localRotation: [0, 0, 0], //模型自身旋转
      scale: [500, 500, 500], //模型缩放
      isEffectRotation: true, //是否开启旋转效果
      smoothMotion: 1, //1: 平滑移动，0: 跳跃移动
      supportAttach: false, //不支持贴画贴合
      visible: true, //模型加载后默认是否显示
      userData: JSON.stringify(userData), //自定义数据
    }
    let markerText = location.txt ? location.txt + '\n' : ''
    markerText = markerText + location.txtTime

    // 跟随marker
    let markerOption: any = {
      id: `mk_${location.id}`,
      groupId: 'lac_co_marker',
      userData: JSON.stringify(userData), //自定义数据
      coordinate: ProjectSceneFacade.pro4jTransform(location.coord), //坐标位置
      coordinateType: 0, //默认0是投影坐标系，也可以设置为经纬度空间坐标系值为1      
      anchors: [-48 / 2, 48],
      imageSize: [48, 48], //图片的尺寸
      range: [1, 10000000], //可视范围
      imagePath: markerImagePath, //显示图片路径
      //popupURL: markerPopupURL, //弹窗HTML链接
      popupBackgroundColor: [1, 1, 1, 0.9], //弹窗背景颜色
      popupSize: [420, 440], //弹窗大小
      popupOffset: [-250, -200], //弹窗偏移
      fixedSize: true, //图片固定尺寸，取值范围：false 自适应，近大远小，true 固定尺寸，默认值：false
      text: markerText, //显示的文字
      useTextAnimation: true, //打开文字展开动画效果
      textRange: [1, 10000], //文本可视范围[近裁距离, 远裁距离]
      textOffset: [0, -10], // 文本偏移
      textBackgroundColor: [0, 0, 0, 0], //文本背景颜色
      fontSize: 20, //字体大小
      fontOutlineSize: 1, //字体轮廓线大小
      fontColor: [1, 1, 1, 1], //字体颜色
      fontOutlineColor: '#0288d1', //字体轮廓线颜色
      autoHidePopupWindow: false, //失去焦点后是否自动关闭弹出窗口
      autoHeight: false, // 自动判断下方是否有物体
      displayMode: 2, //智能显示模式  开发过程中请根据业务需求判断使用四种显示模式
      clusterByImage: true, // 聚合时是否根据图片路径分类，即当多个marker的imagePath路径参数相同时按路径对marker分类聚合
      priority: 0, //避让优先级
      occlusionCull: false //是否参与遮挡剔除})
    }
    // 如果有地址就加
    if (popupUrl) {
      markerOption.popupSize = popupSize
      markerOption.popupURL = popupUrl
      this.popupUrl = popupUrl
    }
    //尾巴线
    let lineObj

    // 创建无人机
    __xapi.customObject.add(coOption, null)
    __xapi.marker.add(markerOption, null)
    // 设置自动跟随
    __xapi.marker.setAttachCustomObject({ markerId: `mk_${location.id}`, objectId: `co_${location.id}`, offset: [0, 0, 0] }, null)
    this.moveObjectId = `${location.id}`
    // 画尾巴线
    if (location?.historyPosition?.length >= 0) {
      let lineCoords = location.historyPosition.map((point: any, index: any) => {
        return [Number(point.lng), Number(point.lat), Number(point.height)]
      })
      //确保两个点
      if (lineCoords?.length == 0) {
        lineCoords.push([...location.coord])
        lineCoords.push([...location.coord])
      } else if (lineCoords?.length == 0) {
        lineCoords.push(...lineCoords[0])
      }

      lineObj = {
        id: `hl_${location.id}`,//折线唯一标识id
        coordinates: ProjectSceneFacade.pro4jTransform(lineCoords),//构成折线的坐标点数组
        coordinateType: 0,//坐标系类型，取值范围：0为Projection类型，1为WGS84类型，2为火星坐标系(GCJ02)，3为百度坐标系(BD09)，默认值：0 
        groupId: 'lac_history_line',
        range: [1, 100000],//可视范围：[近裁距离, 远裁距离]，取值范围: [任意负值, 任意正值]
        color: '#0288d1',//折线颜色
        thickness: 100,//折线宽度
        userData: JSON.stringify(userData), //自定义数据
        intensity: 1,//亮度
        flowRate: 0.5,//流速
        shape: 0, //折线类型 0：直线， 1：曲线
        depthTest: false,//是否做深度检测 开启后会被地形高度遮挡
        style: PolylineStyle.OriginColor,//折线样式 参考样式枚举：PolylineStyle
        tiling: 0//材质贴图平铺比例
      }
      __xapi.polyline.add(lineObj)
    }
    //console.log(`初始化CO${this.moveObjectId}成功`,location)
    //console.log(`初始化CO${this.moveObjectId}成功`,coOption,markerOption,lineObj);    
  }

  /**
   * 获取移动对象的最新数据 
   * 
   * @param hasCoord 是否包含坐标相关的数据，默认为true
   * @returns 
   */
  public getLastData(hasCoord = true) {
    if (hasCoord) {
      return this.latestData
    } else {
      return this.processPopupData(this.dataSource, this.latestData)
    }
  }

  /**
   * 加工弹窗信息，去掉坐标信息
   * @param type 
   * @param rawData 
   * @returns 
   */
  private processPopupData(type: any, rawData: any) {
    let result: any = {}
    //去掉坐标信息
    switch (type) {
      case 'AdsBUav':
        result = Object.assign(result, rawData)
        break;
      case 'RoadUav':
        result = Object.assign(result, rawData)
        result['flightPlan'] = ''
        result['historyPosition'] = ''
        break;
      default:
        result = Object.assign(result, rawData)
        break;
    }
    return result

  }

  /**
   * 显示移动对象的弹窗信息
   * @param moId 
   * @returns 
   */
  public showPopupWindow() {
    let fullPopupUrl = this.popupUrl + '?' + qs.stringify(this.getLastData(false))
    let markerId = `mk_${this.moveObjectId}`
    __xapi.marker.setPopupURL(markerId, fullPopupUrl)
    __xapi.marker.showPopupWindow(markerId)
    console.log(`显示mk_${this.moveObjectId}弹窗啦！`, fullPopupUrl)
  }
}