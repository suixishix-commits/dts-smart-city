import emits from '../../../utils/emitter.ts';
import type DispatchCenter from "../DispatchCenter";
import LocationParser from "../LocationParser";
import MoveObject from '../MoveObject';

/**
 * WebSocket位置解析器
 */
export default class WebSocketParser extends LocationParser {
  // websocket客户端
  client: any;
  // 派发中心
  dispatchCenter: DispatchCenter | undefined;
  // 移动对象队列
  objectMap: any
  // 重连定时器
  reconnectTimer
  // 重连次数
  reconnectCount: any = 0
  // 最大重连次数（0 表示无限重连）
  maxReconnectCount = 10
  // 初始重连间隔（ms）
  baseReconnectDelay = 1000
  // 是否手动关闭（用于区分正常/异常断开）
  isManualClose = false


  // 是否默认显示选项
  visibleOption: any
  // 防抖定时器：处理高频初始化co.add
  debounceTimer: any = null;
  // 是否开启Marker跟随
  enableFollowMarker: boolean = false;
  constructor(option: any) {
    super(option)
    if (option?.dispatchCenter) {
      this.dispatchCenter = option.dispatchCenter
      this.objectMap = this.dispatchCenter!.objectMap
      this.visibleOption = this.dispatchCenter?.visibleOption
      this.reconnectTimer = null;
      this.reconnectCount = 0; // 已重连次数
      this.maxReconnectCount = option?.maxReconnectCount ? option.maxReconnectCount : 10; // 最大重连次数（0 表示无限重连）
      this.baseReconnectDelay = 1000;
      this.isManualClose = false;
    }
  }

  public async play() {
    if (!this.client) {
      this.connect()
    }
  }

  //停止
  public async stop() {
    this.client?.close()
    this.isManualClose = true
    console.log("断开连接", this.client);
  }

  /**
   * 清空所有数据
   */
  public clear() {
    // 清空对象映射
    if (this.dispatchCenter) {
      this.dispatchCenter.objectMap = {}
    }
    // 清空重连状态
    this.reconnectCount = 0
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

  }

  /**
   * 暂停
   */
  public async pause() {
    this.client?.close()
    this.isManualClose = true
  }

  //恢复
  public async resume() {
    this.play()
  }

  /**
   * 连接
   */
  protected connect() {
    // 清理旧定时器
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    const connectUrl = import.meta.env.VITE_RS_WS_URL
    this.client = new WebSocket(connectUrl)
    // console.log("开始连接WS啦");
    this.client.onopen = () => {
      console.log('WebSocket 连接成功');
      this.reconnectCount = 0; // 重置重连次数
      this.isManualClose = false;
      const userInfo = SessionStorage.getItem('userInfo')
      const strToken = userInfo?.access_token || 'test_token'
      if (strToken) {
        let content = {
          "type": 3,
          "content": JSON.stringify({
            "key": "client_bind",
            "timestamp": new Date().getTime(),
            "data": {
              "channel": "web",
              "application": "hub",
              "token": strToken,
              "language": "zh-CN",
              "osVersion": "3.3.0",
            }
          }),
        }
        this.client.send(JSON.stringify(content));
      } else {
        console.log('没有token，无法连接客户端')
      }
    }

    this.client.onmessage = (message: any) => {
      // console.log('接收到消息:', message);
      let data = JSON.parse(message.data)
      switch (data.type) {
        // 心跳处理
        case 1: {
          this.startHeartbeat()
          break
        }
        case 'uav_position': {
          this.handlerUav(data, data?.info || [])
          break
        }
        default:
          break;
      }
    }

    this.client.onerror = (error: any) => {
      console.log('connection error:', error)
    }

    // 连接关闭
    this.client.onclose = (event) => {
      console.log('连接关闭：', event);
      // 停止心跳
      this.stopHeartbeat();
      // 仅在「非手动关闭」且「未达最大重连次数」时重连
      if (!this.isManualClose && (this.maxReconnectCount === 0 || this.reconnectCount < this.maxReconnectCount)) {
        this.reconnect();
      } else {
        console.log('停止重连（手动关闭/达到最大重连次数）');
      }
    };
  }

  // 重连逻辑（指数退避）
  protected reconnect() {
    this.reconnectCount++;
    // 指数退避：重连间隔 = 初始间隔 * 2^(重连次数-1)，上限 30 秒
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectCount - 1),
      30000
    );
    console.log(`第 ${this.reconnectCount} 次重连，${delay}ms 后尝试...`);
    this.reconnectTimer = setTimeout(() => {
      this.connect(); // 重新建立连接
    }, delay);
  }

  /**
   * 发送心跳
   */
  protected startHeartbeat() {
    this.stopHeartbeat();
    if (this.client && this.client.readyState === WebSocket.OPEN) {
      this.client.send(JSON.stringify({ type: 0, content: '' })); // 发送心跳包
    }
  }

  /**
   * 停止发送心跳
   */
  protected stopHeartbeat() {
  }

  /**
     *
     * @param data 无人机消息处理
     * @param info 无人机消息处理
     */
  private handlerUav(data: any, info: any) {
    let result
    if (data?.drones && data?.timestamp) {
      let uavs = data.drones
      // console.warn('uav消息', data)
      if (uavs.length > 0) {
        uavs.forEach((uav: any) => {
          let uavId = uav.drone_id
          let msg = uav
          if (msg && msg?.coordinates && Number(msg?.coordinates.x) > 0) {
            let type, id, coord, txt, time, txtTime, receiveTime, historyPosition, camera
            // 解析业务属性值，封装移动对象统一格式
            type = 'Uav'
            id = type + '_' + uavId
            // coord = [Number(msg.data.longitude), Number(msg.data.latitude), Number(msg.data.height) + 320]
            coord = [Number(msg?.coordinates.x), Number(msg?.coordinates.y), Number(msg?.coordinates.z)]
            txt = msg.name
            txtTime = data.timestamp
            time = txtTime
            receiveTime = data.timestamp
            historyPosition = null
            // 相机信息
            camera = [45, 45]
            if (!Object.hasOwn(this.objectMap, id)) {//如果不包含ID
              this.objectMap[id] = new MoveObject({ objectId: id, dataSource: type, visible: this.getObjectVisible(type), data: msg })
              // 历史轨迹
              this.objectMap[id].historyPosition = [coord]
              // 添加MO对象至场景中
              this.addMoveObjectToScene()
            } else {
              // 历史轨迹
              this.objectMap[id]?.historyPosition?.push(coord)
              // 只保留最近300条历史轨迹数据，约5分钟
              this.objectMap[id].historyPosition = this.objectMap[id]?.historyPosition?.slice(-300)
            }
            historyPosition = this.objectMap[id]?.historyPosition

            result = { type, id, txtTime, receiveTime, time, txt, coord, rawData: msg, historyPosition }
            //抛出速度信息
            emits.emit("droneSpeed", result)
            this.objectMap[id].latestData = msg
            this.objectMap[id].pushMessage(result)
          } else {
            console.log('Uav数据坐标异常', msg)
          }
        })
      }
    }
    return result
  }

  /**
     * 根据配置选项，获取对象默认可见性
     *
     * @param dataSource 数据来源
     */
  private getObjectVisible(dataSource: any) {
    //默认可见
    let defaultVisible = true;
    if (this.visibleOption && Object.hasOwn(this.visibleOption, dataSource) && !this.visibleOption[dataSource]) {
      defaultVisible = false
    }
    return defaultVisible
  }

  /**
   * 获取移动对象的最新数据
   * @param moId 移动对象ID
   */
  public getLastData(moId: any) {
    if (this.objectMap[moId]) {
      return this.objectMap[moId].getLastData()
    } else {
      return null
    }
  }

  /**
   * 显示移动对象的弹窗信息
   * @param moId
   * @returns
   */
  public showPopupWindow(type: any, moId: any) {
    if (this.objectMap[moId]) {
      if (type == 'RoadUav' || type == 'AdsBUav' || type == 'FiveGAUavHistory') {//如果类型为all或者数据源类型与传入类型一致
        return this.objectMap[moId].showPopupWindow()
      }
    }
  }

  /**
   * 漫游跟随
   *
   * @param moId
   */
  public roamingMoveObject(moId: any) {
    if (this.objectMap[moId] && this.objectMap[moId] instanceof MoveObject) {
      this.objectMap[moId].roamingMoveObject()
    }
  }

  /**
   * 显示目标对象多线
   *
   * @param moId 移动对象ID
   */
  public showMultiLine(moId: any) {
    if (this.objectMap[moId] && this.objectMap[moId] instanceof MoveObject) {
      this.objectMap[moId].showMultiLine()
    }
  }

  /**
   * 设置对象可见性
   * @param visibleOption
   */
  public setVisibleOption(visibleOption: any) {
    this.visibleOption = visibleOption
  }

  /**
   * 批量添加MO对象至场景中
   */
  public addMoveObjectToScene() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    // 防抖定时器：解决高频调用DTS接口引发的阻塞
    this.debounceTimer = setTimeout(async () => {
      let arrMov: MoveObject[] = [];
      for (let key in this.objectMap) {
        let moObj = this.objectMap[key];
        if (moObj && !moObj.hasAddedToScene) {
          arrMov.push(moObj);
        }
      }
      if (arrMov.length > 0 && __xapi?.isReady) {
        //console.warn('添加MO至场景中', arrMov)
        // CO列表
        let arrCo: any = [];
        // marker列表
        let arrMarker: any = [];
        arrMov.forEach((moObj: MoveObject) => {
          let location = moObj.latestLocation
          // 个性化资源
          let markerImagePath = '@path:szdk/img/pu_tong.png'
          let markerImageSelectedPath = '@path:szdk/img/pu_tong_selected.png'
          let coPakFilePath = '@path:DTS_Library.pak'
          let coAssetPath = '/JC_CustomAssets/ObjectLibrary/Exhibition/大疆无人机/BP_无人机_空'
          // 绑定在点、线、co上的用户数据
          let userData: any = {
            id: moObj.objectId,
            type: moObj.dataSource,
            txt: location.txt
          }

          // 弹窗信息
          let popupUrl: any = gVar.dtsCloud.popupRootUrl
          let popupSize: any = [1920, 1080]
          let popupOffset: any = [0, 0]

          switch (moObj.dataSource) {
            case 'Uav':
              userData.usingType = location.usingType
              markerImagePath = moObj.imgMapper[`usingType${location.usingType}`] ? moObj.imgMapper[`usingType${location.usingType}`] + '.png' : moObj.imgMapper[`usingTypeDefault`] + '.png'
              markerImageSelectedPath = moObj.imgMapper[`usingType${location.usingType}`] ? moObj.imgMapper[`usingType${location.usingType}`] + '_selected.png' : moObj.imgMapper[`usingTypeDefault`] + '_selected.png'
              break;
            default:
              popupSize = null
              popupUrl = null
              break;
          }

          // co对象
          let coOption = {
            id: `co_${moObj.objectId}`, //自定义对象唯一id
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
            id: `mk_${moObj.objectId}`,
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
          markerOption = { ...markerOption, ...moObj.setPopupData(moObj.data?.legality) }
          //重置co配置
          coOption = { ...coOption, ...moObj.setCoData(moObj.data?.legality) }
          // 如果有地址就加
          /*  if (popupUrl) {
              markerOption.popupSize = popupSize
              markerOption.popupUrl = popupUrl + '?' + qs.stringify(this.processPopupData(this.dataSource, location.rawData))
            }*/
          arrCo.push(coOption)
          arrMarker.push(markerOption)

          //尾巴线
          let lineObj: any = null

          // 仅为无人机时，画尾巴线
          if (location?.historyPosition?.length >= 0 && moObj.dataSource == 'Uav') {
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
                id: `hl_${moObj.objectId}`,//折线唯一标识id
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

        });

        console.log(`${TimeUtil.parseDateTime()}待初始化MoveObject对象`, arrCo, arrMarker)

        // 撒点
        if (this.enableFollowMarker) {
          await __xapi.marker.add(arrMarker).then(res => {
          })
        }

        // 分批撒co
        await batchExecuteSync.bind(this)(arrCo, 200, (batchData: any) => {
          // 创建无人机
          __xapi.customObject.add(batchData, async () => {
            // console.log('初始化无人机co成功:', coOption, '无人机跟随marker', markerOption)          
            // 蓝图列表
            let arrBlueprint: any = [];
            // co与marker绑定列表
            let arrAttach: any = [];

            batchData.forEach((co: any, index: any) => {
              // 旋翼旋转
              arrBlueprint.push({
                id: `${co.id}`,
                functionName: '旋转',
                parameters: [
                  { "paramType": 0, "paramValue": true }, //是否旋转
                  { "paramType": 3, "paramValue": 100000 },
                  { "paramType": 0, "paramValue": false }, //是否隐藏物资
                ]
              })
              // 显示胶囊
              arrBlueprint.push({
                id: `${co.id}`,
                functionName: '显示胶囊',
                parameters: [
                  { "paramType": 0, "paramValue": true },
                ]
              })
              let objectId = co.id.substring(3)
              arrAttach.push({ markerId: `mk_${objectId}`, objectId: `co_${objectId}`, offset: [0, 0, 0] })

              // 更改MO状态，启动移动
              this.objectMap[objectId].hasAddedToScene = true
            })
            // 设置marker自动跟随
            if (this.enableFollowMarker) {
              await __xapi.marker.setAttachCustomObject(arrAttach, null)
            }
            // 批量调用蓝图函数
            await __xapi.customObject.callBatchBPFunction(arrBlueprint)
            //console.log(`${TimeUtil.parseDateTime()}分批初始化MoveObject成功`, batchData, arrBlueprint, arrAttach)
          })
        }, 1000, true)
      }
    }, 200);
  }
}
