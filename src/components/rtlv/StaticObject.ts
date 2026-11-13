import qs from 'qs'
import ProjectSceneFacade from '@/components/ProjectSceneFacade'
import DtsFacade from '../dts/DtsFacade';

export default class StaticObject {
  option: any
  // 场景对象
  objectId: any
  // 位置队列
  msgQueue: Array<any> = []
  // 弹窗地址,不包含传参
  popupUrl: any
  // 最新数据
  latestData: any
  // 数据来源
  dataSource: any
  //可见性
  visible: any = true
  // 是否已经场景化
  hasAddedToScene: any = false;

  constructor(option: any) {
    this.option = option
    this.visible = option?.visible ? true : false
    this.objectId = option?.objectId
    this.dataSource = option?.dataSource
  }

  //播放
  public async play() {
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
   * @param msgItem 
   */
  public async pushMessage(msgItem: any) {
    //是否自动播放
    let playflag = this.msgQueue?.length == 0 ? true : false
    this.msgQueue.push(msgItem)
    if (this.msgQueue.length > 0 && __xapi?.isReady) {//初始化co对象
      if (this.visible && !this.hasAddedToScene) {
        this.initObject(this.msgQueue[0])
      }
    }
    // 自动播放
    if (playflag) {
      this.play()
    }
  }

  // 初始化移动对象
  private async initObject(msgItem: any) {
    // 个性化资源
    let markerImagePath = '@path:szdk/img/shelter_cooperate.png'
    let markerImageSelectedPath = '@path:szdk/img/shelter_cooperate_selected.png'
    // 绑定在点上的用户数据
    let userData: any = {
      id: msgItem.id,
      type: msgItem.type,
      txt: msgItem.txt
    }
    // 弹窗信息
    let popupUrl: any = gVar.dtsCloud.popupRootUrl
    let popupSize: any = [304, 322]
    let popupOffset: any = [0, 0]
    switch (this.dataSource) {
      case 'RoadShelter':
        popupSize = [304, 322]
        popupOffset = [-160, -170]
        markerImagePath = '@path:szdk/img/shelter_cooperate.png'
        markerImageSelectedPath = '@path:szdk/img/shelter_cooperate_selected.png'
        popupUrl = popupUrl + '/szdk/popup/fangcang.html?' + qs.stringify(this.processPopupData(this.dataSource, this.latestData))
        break;
      case 'FiveGADevice':
        popupSize = [302, 252]
        popupOffset = [-160, -146]
        markerImagePath = '@path:szdk/img/fiveGADevice.png'
        markerImageSelectedPath = '@path:szdk/img/fiveGADevice_selected.png'
        popupUrl = popupUrl + '/szdk/popup/zhenceishebei.html?' + qs.stringify(this.processPopupData(this.dataSource, this.latestData)) + '&detectionType=5G-A'
        break;
      case 'AdsbDevice':
        popupSize = [302, 252]
        popupOffset = [-160, -146]
        markerImagePath = '@path:szdk/img/adsbDevice.png'
        markerImageSelectedPath = '@path:szdk/img/adsbDevice_selected.png'
        popupUrl = popupUrl + '/szdk/popup/zhenceishebei.html?' + qs.stringify(this.processPopupData(this.dataSource, this.latestData)) + '&detectionType=Adsb'
        break;
      case 'TdoaDevice':
        popupSize = [302, 252]
        popupOffset = [-160, -146]
        markerImagePath = '@path:szdk/img/tdoaDevice.png'
        markerImageSelectedPath = '@path:szdk/img/tdoaDevice_selected.png'
        popupUrl = popupUrl + '/szdk/popup/zhenceishebei.html?' + qs.stringify(this.processPopupData(this.dataSource, this.latestData)) + '&detectionType=Tdoa'
        break;
      default:
        break;
    }

    let markerText = msgItem.txt
    markerText = markerText + msgItem.txtTime ? '\n' + msgItem.txtTime : ''

    // marker选项
    let markerOption: any = {
      id: `mk_${msgItem.id}`,
      groupId: 'lac_static_marker',
      userData: JSON.stringify(userData), //自定义数据
      coordinate: ProjectSceneFacade.pro4jTransform(msgItem.coord), //坐标位置
      coordinateType: 0, //默认0是投影坐标系，也可以设置为经纬度空间坐标系值为1      
      anchors: [-48 / 2, 48],
      imageSize: [48, 48], //图片的尺寸
      range: [1, 400000], //可视范围
      imagePath: markerImagePath, //显示图片路径
      hoverImagePath: markerImageSelectedPath,
      //popupURL: markerPopupURL, //弹窗HTML链接
      popupBackgroundColor: [1, 1, 1, 0.9], //弹窗背景颜色
      popupSize: [420, 440], //弹窗大小
      popupOffset: popupOffset, //弹窗偏移
      fixedSize: true, //图片固定尺寸，取值范围：false 自适应，近大远小，true 固定尺寸，默认值：false
      text: markerText, //显示的文字
      useTextAnimation: true, //打开文字展开动画效果
      textRange: [1, 10000], //文本可视范围[近裁距离, 远裁距离]
      textOffset: [0, 10], // 文本偏移
      textBackgroundColor: [0, 0, 0, 0], //文本背景颜色
      fontSize: 16, //字体大小
      fontOutlineSize: 1, //字体轮廓线大小
      fontColor: [1, 1, 1, 1], //字体颜色
      fontOutlineColor: '#0288d1', //字体轮廓线颜色
      autoHidePopupWindow: false, //失去焦点后是否自动关闭弹出窗口
      autoHeight: true, // 自动判断下方是否有物体
      displayMode: 1, //智能显示模式  开发过程中请根据业务需求判断使用四种显示模式
      clusterByImage: true, // 聚合时是否根据图片路径分类，即当多个marker的imagePath路径参数相同时按路径对marker分类聚合
      priority: 0, //避让优先级
      occlusionCull: true //是否参与遮挡剔除
    }
    // 如果有地址就加
    if (popupUrl) {
      markerOption.popupSize = popupSize
      markerOption.popupURL = popupUrl
      this.popupUrl = popupUrl
    }

    // 创建点对象 
    __xapi.marker.add(markerOption, null)
    this.hasAddedToScene = true
    //console.log(`初始化静态对象${this.objectId}成功`, msgItem, markerOption, popupUrl)
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
    //console.log("方舱弹窗信息处理：",type,rawData)    
    let result: any = {}
    result = Object.assign(result, rawData)
    result['inPlayUrl'] = ''
    result['outPlayUrl'] = ''
    result['topicDataSource'] = type
    return result
  }

  /**
   * 显示移动对象的弹窗信息
   * @param moId 
   * @returns 
   */
  public showPopupWindow() {
    let markerId = `mk_${this.objectId}`
    DtsFacade.showPopupWindow(markerId)
    console.log(`显示mk_${this.objectId}弹窗啦！`, this.popupUrl)
  }

  /**
   * 设置对象可见性
   * 
   * 在对象可见且未添加到场景中时，实例化场景对象
   * 
   * @param visible 可见性
   */
  public setVisible(visible: any) {
    this.visible = visible
    if (this.visible && !this.hasAddedToScene) {
      this.initObject(this.msgQueue[0])
    }
  }
}