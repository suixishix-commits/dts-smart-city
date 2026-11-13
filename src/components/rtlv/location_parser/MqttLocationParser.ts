import LocationParser from '../LocationParser'
import DispatchCenter from '../DispatchCenter'
// import mqtt from 'mqtt'
import mqtt from '@/utils/mqtt';
import type { QoS } from 'mqtt-packet';
import TimeUtil from '@/utils/TimeUtil';
import MoveObject from '../MoveObject';
import NonCoordObject from '../NonCoordObject';
import { mq_url, mq_config } from '@/utils/mqttConfig'

export default class MqttLocationParser extends LocationParser {
  client: any;
  dispatchCenter: DispatchCenter | undefined;
  // 移动对象队列
  objectMap: any
  // mqtt重连次数
  reconnectionTimes: any = 0
  maxReconnectionTimes: any = 5
  // 订阅主题
  topics: [] | undefined
  //---消息统计---//
  // 消息总数
  messageCount: number = 0
  // 处理开始时间
  beginTime: any = new Date()

  // 是否默认显示选项
  visibleOption: any

  constructor(option: any) {
    super(option)
    if (option?.dispatchCenter) {
      this.dispatchCenter = option.dispatchCenter
      this.objectMap = this.dispatchCenter!.objectMap
      this.visibleOption = this.dispatchCenter?.visibleOption
    }
    // 订阅主题
    if (mq_config.topic?.length > 0) {
      this.topics = mq_config.topic.split(',')
    }
    //console.log('mqtt消息解析器构造方法：:', this.topics, mq_config)
  }

  //播放
  public async play() {
    if (this.client) {
      this.subscribe()
    } else {
      this.connect()
      this.subscribe()
    }
  }

  //停止
  public async stop() {
    this.unSubscribe()
    this.client?.end()
    console.log("断开连接", this.client?.options.clientId);
  }

  /**
   * 暂停
   */
  public async pause() {
    this.unSubscribe()
  }

  //恢复
  public async resume() {
    this.play()
  }

  /**
   * 连接
   */
  protected connect() {
    const connectUrl = mq_url
    const mqOption = {
      clientId: 'mq_client_freedo' + RandomUtil.getUUID(12),
      username: mq_config.a,
      password: mq_config.b,
      clean: true,
      connectTimeout: 30 * 1000, // ms
      reconnectPeriod: 4000 // ms
    }

    this.client = mqtt.connect(connectUrl, mqOption)
    if (this.client?.on) {
      this.client.on('connect', () => {
        this.reconnectionTimes = 0
        console.log('connection successful------------')
      })

      this.client.on('reconnect', () => {
        console.log('reconnect ------------', this.reconnectionTimes)
        this.reconnectionTimes++
        if (this.reconnectionTimes > this.maxReconnectionTimes) {
          this.client?.end()
          console.log("重连次数超限，断开连接！");

        }
      })

      this.client.on('error', (error: any) => {
        console.log('connection error:', error)
      })

      this.client.on('message', (topic: string, message: any) => {
        console.log(`received message from topic: ${topic}`, JSON.parse(message.toString()))
        this.messageCount++
        switch (import.meta.env.VITE_APP_SUBSCRIBE_TOPIC) {
          case 'thing/product/+/osd':
            this.messageHandler(topic, JSON.parse(message.toString()))
            break
          case 'atm/mst/17764369/flyinfo/FUSION/#':
            this.messageHandlerTwo(topic, JSON.parse(message.toString()))
            break
        }
        if (this.messageCount % 5 == 0) {
          console.log("消息统计：", TimeUtil.getDurationByDate(this.beginTime, new Date()), "秒内，收到的消息总数：", this.messageCount, "合计CO对象个数：", Object.keys(this.objectMap).length, this.objectMap);
        }
      })
    }
  }

  /**
   * 订阅
   */
  protected subscribe() {
    if (this.client && this.topics && this.topics?.length > 0) {
      let qos = 0 as QoS
      this.topics.forEach((item: any, index: any) => {
        this.client!.subscribe(item, { qos: qos }, (error: any, granted: any) => {
          if (error) {
            console.log('subscribe error:', error)
            return
          }
          console.log('subscribe successfully:', granted)
        })
      })

    }
  }

  /**
   * 取消订阅
   */
  protected unSubscribe() {
    if (this.client && this.topics && this.topics?.length > 0) {
      this.topics.forEach((topic: any, index: any) => {
        let qos: any = 0 as QoS
        this.client!.unsubscribe(topic, (error: any) => {
          if (error) {
            console.log('unsubscribe error:', error)
            return
          }
          console.log(`unsubscribed topic: ${topic}`)
        })
      })
    }
  }

  /**
   * 断开连接
   */
  protected end() {
    this.client?.end()
    console.log("断开连接", this.client?.options.clientId);
  }


  /**
   * 消息处理函数
   * @param topic 
   * @param msg 
   */
  protected messageHandler(topic: string, msg: any) {
    let result
    if (msg?.data && msg.data?.longitude && Number(msg.data?.longitude) > 0) {
      msg.customDataSource = 'Uav'
      msg.customDataId = 'Uav_' + msg.device_sn
      result = this.handlerUav(msg)
    } else {
      switch (topic) {
        case '/largeScreen/alarm_his123'://告警信息
          msg.customDataSource = 'AlarmHis'
          msg.customDataId = 'AlarmHis_' + msg.id
          result = this.handlerAlarmHis(msg)
          break
        default:
          console.log(`received message from topic: ${topic}`, msg)
          break;
      }
    }
    // console.log(`${topic}消息处理完毕,结果：`, result);
  }
  /**
   * 消息处理函数2
   * @param topic
   * @param msg
   */
  protected messageHandlerTwo(topic: string, msg: any) {
    let result
    if (msg?.data && msg.data?.longitude && Number(msg.data?.longitude) > 0) {
      msg['device_sn'] = msg.data.device_sn
      msg['timestamp'] = msg.data.timeMs || msg.data.timems
      msg.customDataSource = 'Uav'
      msg.customDataId = 'Uav_' + msg.device_sn
      result = this.handlerUav(msg)
    } else {
      switch (topic) {
        case '/largeScreen/alarm_his123'://告警信息
          msg.customDataSource = 'AlarmHis'
          msg.customDataId = 'AlarmHis_' + msg.id
          result = this.handlerAlarmHis(msg)
          break
        default:
          console.log(`received message from topic: ${topic}`, msg)
          break;
      }
    }
  }
  /**
   * 
   * @param msg 无人机消息处理
   */
  private handlerUav(msg: any) {
    let result
    if (msg?.data && msg.data?.longitude && Number(msg.data?.longitude) > 0) {
      let type, id, coord, txt, time, txtTime, receiveTime, historyPosition
      // 解析业务属性值，封装移动对象统一格式
      type = 'Uav'
      id = type + '_' + msg.device_sn
      // coord = [Number(msg.data.longitude), Number(msg.data.latitude), Number(msg.data.height) + 320]
      coord = [Number(msg.data.longitude), Number(msg.data.latitude), Number(msg.data.height) + 1500]
      txt = msg.device_sn
      txtTime = TimeUtil.parseTime(msg.timestamp)
      time = msg.timestamp
      receiveTime = new Date().getTime()
      historyPosition = null
      if (!Object.hasOwn(this.objectMap, id)) {//如果不包含ID
        this.objectMap[id] = new MoveObject({ objectId: id, dataSource: type, visible: this.getObjectVisible(type) , data:msg?.data })
        // 历史轨迹
        this.objectMap[id].historyPosition = [coord]
      } else {
        // 历史轨迹
        this.objectMap[id]?.historyPosition?.push(coord)
      }
      historyPosition = this.objectMap[id]?.historyPosition

      result = { type, id, txtTime, receiveTime, time, txt, coord, rawData: msg, historyPosition }
      this.objectMap[id].latestData = msg
      this.objectMap[id].pushMessage(result)
      // console.log("objectMap.pushMessage:", result)
    } else {
      console.log('Uav数据坐标异常', msg)
    }
    return result
  }

  /**
   * 
   * @param msg 方舱消息处理
   */
  private handlerAlarmHis(msg: any) {
    //console.log('方舱消息处理',msg)    
    let result
    if (msg?.coordinate && msg.coordinate.indexOf(',') > 0) {
      let type, id, coord, txt, time, txtTime, receiveTime, usingType
      type = 'AlarmHis'
      id = type + '_' + msg.id
      let arrCoord = msg.coordinate.split(',')
      coord = [Number(arrCoord[0]), Number(arrCoord[1])]
      txt = msg.shelterName
      txtTime = ''
      time = ''
      receiveTime = new Date().getTime()
      usingType = msg.shelterType
      if (!Object.hasOwn(this.objectMap, id)) {//如果不包含ID
        this.objectMap[id] = new NonCoordObject({})
      }
      result = { type, id, txtTime, receiveTime, time, txt, coord, usingType, rawData: msg }
      this.objectMap[id].latestData = msg
      this.objectMap[id].pushMessage(result)
    } else {
      console.log('报警MQTT数据异常', msg)
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

}