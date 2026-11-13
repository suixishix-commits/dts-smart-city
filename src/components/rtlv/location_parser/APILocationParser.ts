import LocationParser from '../LocationParser'
import DispatchCenter from '../DispatchCenter'
import StaticObject from '../StaticObject';
import { getFiveGADeviceList, getAdsbList, getDeviceTdoaList } from '@/api/dispalyScreen.js'


export default class APILocationParser extends LocationParser {
  dispatchCenter: DispatchCenter | undefined;
  // 移动对象队列
  objectMap: any
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
  }

  //播放
  public async play() {
    getFiveGADeviceList().then((res: any) => {
      //console.log('FiveGADevice获取到数据', res);
      if (res?.data?.length > 0) {
        this.handlerFiveGADevice("FiveGADevice", res.data)
      }
    })
    getAdsbList().then((res: any) => {
      //console.log('AdsbDevice获取到数据', res);
      if (res?.data?.length > 0) {
        this.handlerAdsbDevice("AdsbDevice", res.data)
      }
    })
    getDeviceTdoaList().then((res: any) => {
      //console.log('TdoaDevice获取到数据', res);
      if (res?.data?.length > 0) {
        this.handlerTdoaDevice("TdoaDevice", res.data)
      }
    })
  }

  //停止
  public async stop() {

  }

  /**
   * 暂停
   */
  public async pause() {
  }

  //恢复
  public async resume() {
  }

  /**
   * 
   * @param msg 5G-A消息处理
   */
  private handlerFiveGADevice(dataSource: any, list: any) {
    list.forEach((item: any, index: any) => {
      if (item?.longitude) {
        let result, type, id, coord, txt, time, txtTime, receiveTime, usingType
        type = dataSource
        id = dataSource + '_' + item.id
        coord = [Number(item.longitude), Number(item.latitude)]
        txt = item.name
        txtTime = ''
        time = ''
        receiveTime = new Date().getTime()
        usingType = ''
        item.customDataSource = 'FiveGADevice'
        item.customDataId = id
        if (!Object.hasOwn(this.objectMap, id)) {//如果不包含ID
          this.objectMap[id] = new StaticObject({ objectId: id, dataSource: item.customDataSource, visible: this.getObjectVisible(item.customDataSource) })
        }
        result = { type, id, txtTime, receiveTime, time, txt, coord, usingType, rawData: item }
        this.objectMap[id].latestData = item
        this.objectMap[id].pushMessage(result)
      } else {
        console.log('5G-A数据坐标异常', item)
      }
    })
  }

  /**
   * 
   * @param msg AdsbDevice消息处理
   */
  private handlerAdsbDevice(dataSource: any, list: any) {
    list.forEach((item: any, index: any) => {
      if (item?.longitude) {
        let result, type, id, coord, txt, time, txtTime, receiveTime, usingType
        type = dataSource
        id = dataSource + '_' + item.id
        coord = [Number(item.longitude), Number(item.latitude)]
        txt = item.name
        txtTime = ''
        time = ''
        receiveTime = new Date().getTime()
        usingType = ''
        item.customDataSource = 'AdsbDevice'
        item.customDataId = id
        if (!Object.hasOwn(this.objectMap, id)) {//如果不包含ID
          this.objectMap[id] = new StaticObject({ objectId: id, dataSource: item.customDataSource, visible: this.getObjectVisible(item.customDataSource) })
        }
        result = { type, id, txtTime, receiveTime, time, txt, coord, usingType, rawData: item }
        this.objectMap[id].latestData = item
        this.objectMap[id].pushMessage(result)
      } else {
        console.log('5G-A数据坐标异常', item)
      }
    })
  }

  /**
   * 
   * @param msg TdoaDevice消息处理
   */
  private handlerTdoaDevice(dataSource: any, list: any) {
    list.forEach((item: any, index: any) => {
      if (item?.longitude) {
        let result, type, id, coord, txt, time, txtTime, receiveTime, usingType
        type = dataSource
        id = dataSource + '_' + item.id
        coord = [Number(item.longitude), Number(item.latitude)]
        txt = item.name
        txtTime = ''
        time = ''
        receiveTime = new Date().getTime()
        usingType = ''
        item.customDataSource = 'TdoaDevice'
        item.customDataId = id
        if (!Object.hasOwn(this.objectMap, id)) {//如果不包含ID
          this.objectMap[id] = new StaticObject({ objectId: id, dataSource: item.customDataSource, visible: this.getObjectVisible(item.customDataSource) })
        }

        result = { type, id, txtTime, receiveTime, time, txt, coord, usingType, rawData: item }
        this.objectMap[id].latestData = item
        this.objectMap[id].pushMessage(result)
      } else {
        console.log('5G-A数据坐标异常', item)
      }
    })
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
      return this.objectMap[moId].showPopupWindow()
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