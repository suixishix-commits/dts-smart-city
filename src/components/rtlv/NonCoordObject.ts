import qs from 'qs'
import ProjectSceneFacade from '@/components/ProjectSceneFacade'

export default class NonCoordObject {
  option: any
  // 场景对象
  objectId: any
  // 位置队列
  locationQueue: Array<any> = []
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
    // 如果坐标发生变化，更新坐标即可 
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
    if (this.locationQueue.length > 0 && !this.objectId && __xapi?.isReady) {//初始化co对象
      this.initObject(this.locationQueue[0])
    }
    // 自动播放
    if (playflag) {
      this.play()
    }
  }

  // 初始化移动对象
  private async initObject(location: any) {
    this.dataSource = location.type
    // 个性化资源
    let markerImagePath = '@path:szdk/img/shelter_cooperate.png'
    // 绑定在点、线、co上的用户数据
    let userData: any = {
      id: location.id,
      type: location.type,
      txt: location.txt
    }

    // 弹窗信息
    let popupUrl: any = gVar.dtsCloud.popupRootUrl
    let popupSize: any = [304, 322]
    popupUrl = popupUrl + '/szdk/popup/fangcang.html?' + qs.stringify(this.processPopupData(this.dataSource, this.latestData))

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
      autoHeight: true, // 自动判断下方是否有物体
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

    // 创建无人机   
    __xapi.marker.add(markerOption, null)
    this.objectId = `${location.id}`
    //console.log(`初始化方舱${this.objectId}成功`,location,markerOption,popupUrl)
    //console.log(`初始化CO${this.objectId}成功`,coOption,markerOption,lineObj);    
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
    return result
  }

  /**
   * 显示移动对象的弹窗信息
   * @param moId 
   * @returns 
   */
  public showPopupWindow() {
    let fullPopupUrl = this.popupUrl + '?' + qs.stringify(this.getLastData(false))
    let markerId = `mk_${this.objectId}`
    __xapi.marker.setPopupURL(markerId, fullPopupUrl)
    __xapi.marker.showPopupWindow(markerId)
    console.log(`显示mk_${this.objectId}弹窗啦！`, fullPopupUrl)
  }
}