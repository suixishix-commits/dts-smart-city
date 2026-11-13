import qs from 'qs';
import DtsFacade from '../dts/DtsFacade';
import MoveObjectPlayer from "./MoveObjectPlayer";
import MovementQueue from './MovementQueue.ts';
export default class MoveObject {
  //无人机详细信息
  data: any = {}
  option: any
  // 移动对象
  objectId: any
  // 位置队列
  locationQueue: Array<any> = []
  // 最新位置
  latestLocation: any
  // 已播放列表
  alreadyPlayedList: Array<any> = []
  // 历史轨迹
  historyPosition: Array<any> = []
  // 定时器ID
  timeId: any
  // 弹窗地址,不包含传参
  popupUrl: any
  // 最新数据
  latestData: any
  // 数据来源
  dataSource: any
  // 上一条报警状态
  previousAlarmState: any = false
  //可见性。当为false时，接收到MQTT消息也不参与每帧渲染
  visible: any = true
  // 是否已经场景化
  hasAddedToScene: any = false;
  // 撒点图片映射
  imgMapper: any = {
    'usingTypeDefault': '@path:szdk/img/uav_dj_y',
    'usingType0': '@path:szdk/img/uav_dj_y',//普通
    'usingType1': '@path:szdk/img/shun_feng',//顺丰
    'usingType2': '@path:szdk/img/uav_meituan',//美团
    'usingType3': '@path:szdk/img/yi_liao',//医疗
    'usingType4': '@path:szdk/img/jing_wu',//警务
  }

  constructor(option: any) {
    this.option = option
    this.objectId = option?.objectId
    this.visible = option?.visible ? true : false
    this.dataSource = option?.dataSource
    this.latestData = option?.latestData
    this.data = option?.data
  }

  //播放
  public async play() {
    //从位置队列中播放第一个位置
    //当前策略是来一个插一个，用定时器控制一下延迟
    let len = this.locationQueue.length
    if (len > 0) {
      // 先清除可能存在的旧定时器，避免多个定时器同时运行
      if (this.timeId) {
        clearInterval(this.timeId)
        this.timeId = null
      }
      this.timeId = setInterval(() => {
        len = this.locationQueue.length
        if (len > 0) {
          let item = this.locationQueue.shift()
          if (this.visible && this.hasAddedToScene) {
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
              historyLineId: `hl_${item.id}`,
              dataSource: this.dataSource,
              hasAddedToScene: this.hasAddedToScene,
              info: item.rawData?.info || []
            }
            // 报警状态判断
            mo.alarm = false
            mo.previousAlarmState = this.previousAlarmState
            if (item?.rawData?.alarm?.alarm) {
              mo.alarm = true
              mo.alarmData = item?.alarm
            }
            if (this.popupUrl) {
              mo.popupUrl = this.popupUrl + '?' + qs.stringify(this.processPopupData(item.type, item.rawData))
            }
            // console.log(`${TimeUtil.parseDateTime()},play`, mo)
            MoveObjectPlayer.pushList([mo], item.rawData)
            // console.log("MoveObjectPlayer.pushList:", mo);

            //记录本次报警状态，仅当前后两个任务的报警状态发生变化时才调用CO蓝图函数
            this.previousAlarmState = mo.alarm
            //this.alreadyPlayedList.push(item.rawData)
          }
        } else {
          // 队列为空时，清除定时器
          if (this.timeId) {
            clearInterval(this.timeId)
            this.timeId = null
          }
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
   * 添加新消息
   * @param location
   */
  public async pushMessage(location: any) {
    // console.log(`${TimeUtil.parseDateTime()},pushMessage`)
    // 如果显示，才参与每帧渲染
    if (this.visible) {
      //是否自动播放
      let playflag = this.locationQueue?.length == 0 ? true : false
      this.locationQueue.push(location)
      //去重
      this.locationQueue = this.locationQueue.filter((item, index, self) => {
        return index === self.findIndex(obj => obj.time === item.time)
      })
      //排序
      this.locationQueue.sort((a, b) => {
        return a.time - b.time
      });
      this.latestLocation = location
      // 对象初始化至场景移至Parser中进行批量处理
      if (this.locationQueue.length > 0 && __xapi?.isReady && this.visible && !this.hasAddedToScene) {//初始化co对象
        // this.initMoveObject(this.locationQueue[0])
      }
      // 自动播放
      if (playflag) {
        this.play()
      }
    } else {
      //console.log("不显示，不参与每帧渲染",location)
    }
  }
  //测试无人机数据
  async textMove(location: any) {
    await this.initMoveObject(location)
    __xapi.customObject.focus("co_undefined", 50)
    // 使用示例
    const currentPosition = [13273457.04875432, 3032186.167999611, 1530.5352104];    // 当前坐标
    const targetPosition = [[13273465.333945313, 3032495.3815625003, 1530.5352104],
    [13273458.818007812, 3032038.0771875, 1530.5352104],
    [13274022.9034375, 3032081.1990625, 1530.5352104],
    [13274099.62515625, 3032744.9703125, 1530.5352104]];    // 目标坐标
    const movementQueue = new MovementQueue();
    // // 设置初始位置
    movementQueue.setCurrentPosition(currentPosition);
    for (let i = 0; i < targetPosition.length; i++) {
      const position = targetPosition[i];
      movementQueue.addMovement(
        position,    // 目标坐标
        10,           // 每次移动0.5米
        0.1,             // 每1秒移动一次
        (pos) => {     // 更新回调
          console.log(`第${i + 1}个任务当前位置:`, pos);
          __xapi.customObject.setLocation("co_undefined", pos)
        },
        (pos) => {     // 完成回调
          console.log(`第${i + 1}个任务完成，到达:`, pos);
        });
    }
  }
  // 初始化移动对象。功能已移至Parser中进行批量处理
  private async initMoveObject(location: any) {

    // 个性化资源
    let markerImagePath = '@path:szdk/img/pu_tong.png'
    let markerImageSelectedPath = '@path:szdk/img/pu_tong_selected.png'
    let coPakFilePath = '@path:DTS_Library.pak'
    let coAssetPath = '/JC_CustomAssets/ObjectLibrary/Exhibition/大疆无人机/BP_无人机_空'
    // 绑定在点、线、co上的用户数据
    let userData: any = {
      id: this.objectId,
      type: this.dataSource,
      txt: location.txt
    }

    // 弹窗信息
    let popupUrl: any = gVar.dtsCloud.popupRootUrl
    let popupSize: any = [1920, 1080]
    let popupOffset: any = [0, 0]

    switch (this.dataSource) {
      case 'Uav':
        userData.usingType = location.usingType
        markerImagePath = this.imgMapper[`usingType${location.usingType}`] ? this.imgMapper[`usingType${location.usingType}`] + '.png' : this.imgMapper[`usingTypeDefault`] + '.png'
        markerImageSelectedPath = this.imgMapper[`usingType${location.usingType}`] ? this.imgMapper[`usingType${location.usingType}`] + '_selected.png' : this.imgMapper[`usingTypeDefault`] + '_selected.png'
        break;
      default:
        popupSize = null
        popupUrl = null
        break;
    }

    // co对象
    let coOption = {
      id: `co_${this.objectId}`, //自定义对象唯一id
      pakFilePath: coPakFilePath, //资源库pak文件路径,推荐使用cloud内置的文件资源管理器加载pak并使用@path方式传入参数
      assetPath: coAssetPath,
      groupId: 'lac_co',
      //location: DtsFacade.gcs2pcsLocally(location.coord), //位置坐标
      location: location.coord, //位置坐标
      coordinateType: 0, // 坐标系类型
      rotation: [0, 0, 0], // 世界坐标系旋转
      localRotation: [0, 0, 0], //模型自身旋转
      scale: [6, 6, 6], //模型缩放
      isEffectRotation: true, //是否开启旋转效果
      smoothMotion: 1, //1: 平滑移动，0: 跳跃移动
      enableDecal: false, //不支持贴画贴合
      visible: true, //模型加载后默认是否显示
      userData: JSON.stringify(userData), //自定义数据
    }
    let markerText = location.txt ? location.txt + '\n' : ''
    markerText = markerText + location.txtTime
    //为了解决弹窗闪烁，采用不更新marker，但text时间又比较显眼，故先置空
    markerText = ''
    // 跟随marker
    let markerOption: any = {
      id: `mk_${this.objectId}`,
      groupId: 'lac_co_marker',
      userData: JSON.stringify(userData), //自定义数据
      //coordinate: DtsFacade.gcs2pcsLocally(location.coord), //坐标位置
      coordinate: location.coord, //坐标位置
      coordinateType: 0, //默认0是投影坐标系，也可以设置为经纬度空间坐标系值为1
      anchors: [-48 / 2, 48],
      imageSize: [48, 48], //图片的尺寸
      range: [2000, 400000], //可视范围
      imagePath: markerImagePath, //显示图片路径
      hoverImagePath: markerImageSelectedPath,
      //popupURL: markerPopupURL, //弹窗HTML链接
      popupBackgroundColor: [1, 1, 1, 0.9], //弹窗背景颜色
      popupSize: [420, 440], //弹窗大小
      // popupOffset: popupOffset, //弹窗偏移
      fixedSize: true, //图片固定尺寸，取值范围：false 自适应，近大远小，true 固定尺寸，默认值：false
      text: markerText, //显示的文字
      useTextAnimation: true, //打开文字展开动画效果
      textRange: [1, 10000], //文本可视范围[近裁距离, 远裁距离]
      textOffset: [0, 0], // 文本偏移
      textBackgroundColor: [0, 0, 0, 0], //文本背景颜色
      fontSize: 16, //字体大小
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
    //重置marker配置
    markerOption = { ...markerOption, ...this.setPopupData(this.data?.legality) }
    //重置co配置
    coOption = { ...coOption, ...this.setCoData(this.data?.legality) }
    // 如果有地址就加
    /*  if (popupUrl) {
        markerOption.popupSize = popupSize
        markerOption.popupUrl = popupUrl + '?' + qs.stringify(this.processPopupData(this.dataSource, location.rawData))
      }*/

    await __xapi.marker.add(markerOption).then(res => {
    })

    // 创建无人机
    __xapi.customObject.add(coOption, () => {
      // console.log('初始化无人机co成功:', coOption, '无人机跟随marker', markerOption)
      //旋翼旋转
      let arrObj: any = []
      let updateObj: any = {
        id: `co_${this.objectId}`,
        functionName: '旋转',
        parameters: [
          { "paramType": 0, "paramValue": true }, //是否旋转
          { "paramType": 3, "paramValue": 100000 },
          { "paramType": 0, "paramValue": false }, //是否隐藏物资
        ]
      }
      arrObj.push(updateObj)
      if (arrObj.length > 0) {
        __xapi.customObject.callBatchBPFunction(arrObj)
      }
      // 设置marker自动跟随
      __xapi.marker.setAttachCustomObject({ markerId: `mk_${this.objectId}`, objectId: `co_${this.objectId}`, offset: [0, 0, 0] }, null)

    })

    //尾巴线
    let lineObj: any = null

    this.hasAddedToScene = true
    // 仅为无人机时，画尾巴线
    if (location?.historyPosition?.length >= 0 && this.dataSource == 'Uav') {
      let lineCoords = location.historyPosition
      //确保两个点
      if (lineCoords?.length == 0) {
        lineCoords.push([...location.coord])
        lineCoords.push([...location.coord])
      } else if (lineCoords?.length == 1) {
        lineCoords.push([...lineCoords[0]])
      }
      // todo 美团无人机航线暂时不渲染
      if (location?.usingType === '2') {
      } else {
        lineObj = {
          id: `hl_${this.objectId}`,//折线唯一标识id
          //coordinates: DtsFacade.gcs2pcsLocally(lineCoords),//构成折线的坐标点数组
          coordinates: lineCoords,//构成折线的坐标点数组
          coordinateType: 0,//坐标系类型，取值范围：0为Projection类型，1为WGS84类型，2为火星坐标系(GCJ02)，3为百度坐标系(BD09)，默认值：0
          groupId: 'lac_history_line',
          range: [1, 100000],//可视范围：[近裁距离, 远裁距离]，取值范围: [任意负值, 任意正值]
          color: '#24FFFB',//折线颜色
          thickness: 3,//折线宽度
          userData: JSON.stringify(userData), //自定义数据
          intensity: 0.8,//亮度
          flowRate: 0.5,//流速
          shape: 1, //折线类型 0：直线， 1：曲线
          depthTest: false,//是否做深度检测 开启后会被地形高度遮挡
          style: PolylineStyle.OriginColor,//折线样式 参考样式枚举：PolylineStyle
          tiling: 0//材质贴图平铺比例
        }
        // 添加尾巴线
        // __xapi.polyline.add(lineObj)
      }
    }
    // console.log(`初始化MoveObject<${this.objectId}>成功`, markerOption, coOption, lineObj);
  }
  /**
   * 重置co数据
   * */
  public setCoData(legality) {
    let assetPath: any = null
    let scale: any = null
    switch (Number(legality)) {
      case 1:
        //避让无人机放大
        assetPath = '/JC_CustomAssets/ObjectLibrary/Exhibition/大疆无人机/BP_无人机_医'
        scale = [1, 1, 1]
        break
      case 2:
        //合约无人机非合法飞行活动。
        break
      case 3:
        //黑飞无人机。
        assetPath = '/JC_CustomAssets/ObjectLibrary/Exhibition/无人机/旋翼无人机'
        scale = [6, 6, 6]
        break
      default:
        assetPath = '/JC_CustomAssets/ObjectLibrary/Exhibition/大疆无人机/BP_无人机_医'
        scale = [0.5, 0.5, 0.5]
        break
    }
    return {
      assetPath, scale
    }
  }
  /**
   *
   * 添加maker弹框数据
   * */
  public setPopupData(legality) {
    let popupUrl: any = null
    let popupSize: any = null
    let imagePath: any = null
    let popupOffset: any = null
    switch (Number(legality)) {
      /*      case 1:
              //合约无人机合法飞行活动。
              popupUrl = `@path:szdk/popup/warning/wrjInfo.html?userId=${userId}&traceId=${traceId}&speed=${speed}&height=${height}`+'&.html'
              popupSize = [500,180]
              popupOffset = [0,0]
              imagePath='@path:szdk/img/uav_dj_y.png'
              break*/
      case 2:
        //合约无人机非合法飞行活动。
        popupUrl = 'http://192.168.1.24:8080/adsbUav.html'
        break
      case 3:
        //黑飞无人机。
        popupUrl = `@path:szdk/popup/versionInfo/wrjRed.html?title=黑飞` + '&.html'
        popupSize = [360, 210]
        popupOffset = [0, 0]
        imagePath = '@path:szdk/img/uav_dj_y_hf.png'
        break
      default:
        //合约无人机合法飞行活动。
        popupUrl = `@path:szdk/popup/versionInfo/taskRunGreenTwo.html`
        popupSize = [540, 220]
        popupOffset = [0, 0]
        imagePath = '@path:szdk/img/uav_dj_y.png'
        break
    }
    return { popupUrl, popupSize, imagePath, popupOffset }
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
        result['historyPosition'] = ''
        break;
      case 'RoadUav':
        result = Object.assign(result, rawData)
        result['flightPlan'] = ''
        result['historyPosition'] = ''
        result['detecPosition'] = ''
        //console.log("RoadUav弹窗传值", rawData, result, qs.stringify(result))
        break;
      case 'FiveGAUavHistory':
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
    //let fullPopupUrl = this.popupUrl + '?' + qs.stringify(this.getLastData(false))
    let markerId = `mk_${this.objectId}`
    //__xapi.marker.showPopupWindow(markerId)
    DtsFacade.showPopupWindow(markerId)
    console.log(`显示mk_${this.objectId}弹窗啦！`, this.latestData)
  }

  /**
   * 漫游跟随
   *
   * @param moId
   */
  public roamingMoveObject() {
    console.log("视角跟随", this.latestData, `co_${this.objectId}`)
    __xapi.customObject.focus(`co_${this.objectId}`, -1)
  }

  /**
   * 显示目标对象多线
   *
   * @param moId 移动对象ID
   */
  public showMultiLine() {
    console.log("三线标绘", this.latestData)
    // 删除旧三线
    __xapi.infoTree.deleteByGroupId('gp_flight_3line')
    // 先高亮
    //DtsFacade.highlightPolyline(`hl_${this.objectId}`)
    let strPlan = this.latestData?.flightPlan
    if (strPlan) {//飞行计划
      let plan = JSON.parse(strPlan)
      // ProjectSceneFacade.showFlightPlan(this.objectId, plan, { id: this.objectId, dataSource: this.dataSource })
    }
    let detecPosition = this.latestData?.detecPosition

    if (detecPosition?.length > 0) {
      let polyline = detecPosition.map((item: any, index: any) => {
        return [Number(item.lng), Number(item.lat), Number(item.height)]
      })
      // ProjectSceneFacade.showDetecPosition(this.objectId, polyline, { id: this.objectId, dataSource: this.dataSource })
    }
  }

  /**
   * 设置对象可见性
   *
   * 在对象可见且未添加到场景中时，实例化场景对象
   *
   * 不通过该值去控制对象显隐，避免过多请求dts api
   *
   * @param visible 可见性
   */
  public setVisible(visible: any) {
    this.visible = visible
    let item = this.latestData
    if (this.visible && !this.hasAddedToScene) {
      this.initMoveObject(item)
    }
  }
}
