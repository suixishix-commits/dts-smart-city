import TimeUtil from '@/utils/TimeUtil';
import TurfUtil from '@/utils/TurfUtil';
import WebSocketParser from './location_parser/WebSocketParser';
import Timeline from './Timeline';

/**
 *
 */
export default class DispatchCenter {
  // 参数选项
  option: any
  // 移动对象队列
  objectMap: any
  // 时间线
  timeline: Timeline
  // 位置解析器
  locationParser: WebSocketParser
  // 数据类是否默认显示
  visibleOption: any
  constructor(option: any) {
    this.option = option
    this.objectMap = {}
    this.visibleOption = option.visibleOption
    this.timeline = new Timeline(option)
    this.locationParser = new WebSocketParser({ dispatchCenter: this })
  }

  //播放
  public async play () {
    this.locationParser.play()
  }

  //暂停
  public async pause() {
    this.locationParser.pause()
  }

  //恢复
  public async resume() {
    this.locationParser.resume()
  }

  //停止
  public async stop() {
    this.locationParser.stop()
    // 清空所有对象信息
    this.clearAllObjects()
  }

  /**
   * 清空所有对象信息
   */
  private clearAllObjects() {
    // 清空对象映射
    this.objectMap = {}
    // 清空时间线
    this.timeline.clear()
    // 清空位置解析器
    this.locationParser.clear()
  }

  /**
   * 获取移动对象的最新数据
   * @param moId 移动对象ID
   */
  public getLastData(moId: any) {
    let result = this.locationParser.getLastData(moId)
    return result
  }

  /**
   * 显示移动对象的弹窗信息
   *
   * 类型(ID)：RoadUav(batchNumAndSerial字段)
   * AdsBUav(ICAOAddress)
   * RoadShelter(shelterId)
   *
   * @param moId 类型+ID
   * @returns
   */
  public showPopupWindow(type: any, moId: any) {
    console.log("显示弹窗", type, moId);
    if (type == 'RoadUav' || type == 'AdsBUav' || type == 'FiveGAUavHistory') {//如果类型为all或者数据源类型与传入类型一致
      this.locationParser.showPopupWindow(type, moId)
    }
  }

  /**
   * 获取数据列表
   *
   * 返回MoveObject或StaticObject
   *
   * 类型：[{不传：查全部，all:全部}]
   * AdsBUav: 通航飞机 adsb_uav主题
   * RoadUav: 无人机 road_uav主题
   * FiveGAUavHistory:侦测器
   * RoadShelter:方舱
   * FiveGADevice:5G-A侦测设备
   * AdsbDevice：Adsb侦测设备
   * TdoaDevice：Tdoa侦测设备
   *
   * @param type 类型
   */
  public getList(type: any[] = ['all']) {
    let result: any = []
    for (const key in this.objectMap) {
      if (Object.prototype.hasOwnProperty.call(this.objectMap, key)) {
        const element = this.objectMap[key];
        if (type[0] == 'all' || type.includes(element.dataSource)) {
          result.push(element)
        }
      }
    }
    return result
  }

  /**
   * 漫游跟随
   *
   * @param moId
   */
  public roamingMoveObject(moId: any) {
    this.locationParser.roamingMoveObject(moId)
  }

  /**
   * 显示目标对象多线
   *
   * @param moId 移动对象ID
   */
  public showMultiLine(moId: any) {
    this.locationParser.showMultiLine(moId)
  }

  /**
   * 隐藏全部
   */
  public showAll() {
    if (__xapi.isReady) {
      //MQTT解析器用到，co移动对象
      __xapi.infoTree.showByGroupId('lac_co')
      //MQTT解析器用到，co跟随对象
      __xapi.infoTree.showByGroupId('lac_co_marker')
      //MQTT解析器用到，历史尾巴线
      __xapi.infoTree.showByGroupId('lac_history_line')
      //静态点对象用到
      __xapi.infoTree.showByGroupId('lac_static_marker')
    }
  }

  /**
   * 隐藏全部
   */
  public hiddenAll() {
    if (__xapi.isReady) {
      for (const key in this.objectMap) {
        if (Object.prototype.hasOwnProperty.call(this.objectMap, key)) {
          const element = this.objectMap[key];
          //设置对象可见性
          if (element?.setVisible) {
            element.setVisible(true)
          }
        }
      }
      //MQTT解析器用到，co移动对象
      __xapi.infoTree.hideByGroupId('lac_co')
      //MQTT解析器用到，co跟随对象
      __xapi.infoTree.hideByGroupId('lac_co_marker')
      //MQTT解析器用到，历史尾巴线
      __xapi.infoTree.hideByGroupId('lac_history_line')
      //静态点对象用到
      __xapi.infoTree.hideByGroupId('lac_static_marker')
    }
  }

  /**
   * 按类型显示对象
   * 仅显示该类，不会隐藏其它类
   *
   * AdsBUav: 通航飞机 adsb_uav主题
   * RoadUav: 无人机 road_uav主题
   * FiveGAUavHistory:侦测器
   * RoadShelter:方舱
   * FiveGADevice:5G-A侦测设备
   * AdsbDevice：Adsb侦测设备
   * TdoaDevice：Tdoa侦测设备
   *
   * @param types 类型
   */
  public showByType(types: any[]) {
    console.log("分组显示：", types);
    if (types?.length > 0 && __xapi.isReady) {
      // 待显示列表
      let coTodoList: any = []
      let markerTodoList: any = []
      let lineTodoList: any = []
      for (const key in this.objectMap) {
        if (Object.prototype.hasOwnProperty.call(this.objectMap, key)) {
          const element = this.objectMap[key];
          if (types.includes(element.dataSource)) {
            let objectId: any = key
            if (element.dataSource == 'RoadUav' || element.dataSource == 'AdsBUav' || element.dataSource == 'FiveGAUavHistory') {
              coTodoList.push(`co_${objectId}`)
              markerTodoList.push(`mk_${objectId}`)
              lineTodoList.push(`hl_${objectId}`)
            } else {
              markerTodoList.push(`mk_${objectId}`)
            }
            //设置对象可见性
            if (element?.setVisible) {
              element.setVisible(true)
            }
          }
        }
      }
      //显示CO对象
      if (coTodoList.length > 0) {
        __xapi.customObject.show(coTodoList)
      }
      if (markerTodoList.length > 0) {
        __xapi.marker.show(markerTodoList)
      }
      if (lineTodoList.length > 0) {
        __xapi.polyline.show(lineTodoList)
      }
    }
  }

  /**
   * 按类型显示对象
   * 仅显示该类，不会隐藏其它类
   *
   * AdsBUav: 通航飞机 adsb_uav主题
   * RoadUav: 无人机 road_uav主题
   * FiveGAUavHistory:侦测器
   * RoadShelter:方舱
   * FiveGADevice:5G-A侦测设备
   * AdsbDevice：Adsb侦测设备
   * TdoaDevice：Tdoa侦测设备
   *
   * @param types 类型
   */
  public hideByType(types: any[]) {
    //console.log("分组隐藏：", types);
    if (types?.length > 0 && __xapi.isReady) {
      // 待显示列表
      let coTodoList: any = []
      let markerTodoList: any = []
      let lineTodoList: any = []
      for (const key in this.objectMap) {
        if (Object.prototype.hasOwnProperty.call(this.objectMap, key)) {
          const element = this.objectMap[key];
          if (types.includes(element.dataSource)) {
            let objectId = key
            if (element.dataSource == 'RoadUav' || element.dataSource == 'AdsBUav' || element.dataSource == 'FiveGAUavHistory') {
              coTodoList.push(`co_${objectId}`)
              markerTodoList.push(`mk_${objectId}`)
              lineTodoList.push(`hl_${objectId}`)
            } else {
              markerTodoList.push(`mk_${objectId}`)
            }
            //设置对象可见性
            if (element?.setVisible) {
              element.setVisible(false)
              //console.log("按类隐藏,设置对象可见性啦", element)
            }
          }
        }
      }
      //显示CO对象
      if (coTodoList.length > 0) {
        __xapi.customObject.hide(coTodoList)
      }
      if (markerTodoList.length > 0) {
        __xapi.marker.hide(markerTodoList)
      }
      if (lineTodoList.length > 0) {
        __xapi.polyline.hide(lineTodoList)
      }
      //console.log("分组隐藏：", types, coTodoList, markerTodoList, lineTodoList);
    }
  }

  /**
   * 显示对象
   *
   * @param list 显示列表
   */
  private showList(list: any[]) {
    //console.log("显示列表：", list);
    if (list?.length > 0 && __xapi.isReady) {
      // 待显示列表
      let coTodoList: any[] = []
      let markerTodoList: any[] = []
      let lineTodoList: any[] = []
      list.forEach((element: any, index: any) => {
        let objectId = element.objectId
        if (element.dataSource == 'RoadUav' || element.dataSource == 'AdsBUav' || element.dataSource == 'FiveGAUavHistory') {
          coTodoList.push(`co_${objectId}`)
          markerTodoList.push(`mk_${objectId}`)
          lineTodoList.push(`hl_${objectId}`)
        } else {
          markerTodoList.push(`mk_${objectId}`)
        }
        //设置对象可见性
        if (element?.setVisible) {
          element.setVisible(true)
        }
      })

      //显示CO对象
      if (coTodoList.length > 0) {
        __xapi.customObject.show(coTodoList)
      }
      if (markerTodoList.length > 0) {
        __xapi.marker.show(markerTodoList)
      }
      if (lineTodoList.length > 0) {
        __xapi.polyline.show(lineTodoList)
      }
    }
  }

  /**
   * 显示侦测设备
   *
   * 类型：5G-A/ADSB
   *
   * @param filter 过滤条件
   *
   *
   */
  public filterDetector(filter: any) {
    console.log("侦测设备过滤条件：", filter)
    if (filter.detectorFilter.enabled) {
      // 先全隐
      this.hideByType(['FiveGADevice', 'AdsbDevice', 'TdoaDevice'])
      let list: any = this.findDetectorList(filter)
      this.showList(list)
    } else {//全隐
      this.hideByType(['FiveGADevice', 'AdsbDevice', 'TdoaDevice'])
    }
  }

  //侦测设备过滤
  private findDetectorList(filter: any) {
    // 所有数据
    let allList: any = undefined
    let allCount: any = undefined
    if (filter.detectorFilter.enabled) {
      allList = this.getList(['FiveGADevice', 'AdsbDevice', 'TdoaDevice'])
      allCount = allList?.length
      // 类型
      let arrType: any = filter.detectorFilter?.type
      if (arrType?.length > 0 && arrType[0] != 'all') {
        //数据来源customDataSource
        allList = allList.filter((item: any) => {
          return arrType.includes(item.dataSource)
        })
      }
    }

    //高度过滤
    if (allList && filter.heightFilter.enabled && (filter.heightFilter?.heightMax < 10000 || filter.heightFilter?.heightMin > 0)) {
      let minHeihgt = filter.heightFilter.heightMin
      let maxHeight = filter.heightFilter.heightMax
      allList = allList.filter((item: any) => {
        let flag = false
        let height = item.latestData?.height ? Number(item.latestData.height) : 0
        if (height >= minHeihgt && height <= maxHeight) {
          flag = true
        }
        //console.log("高度过滤", height, minHeihgt, maxHeight, flag)
        return flag
      })
    }
    // 区域过滤，区域=9时为全部
    if (allList && filter.regionFilter.enabled && filter.regionFilter?.where?.length < 9) {
      let arrRegion = filter.regionFilter?.where
      allList = allList.filter((item: any) => {
        let flag = false
        let point: any = undefined
        point = [Number(item.latestData.longitude), Number(item.latestData.latitude)]
        if (point && point?.length > 0) {
          flag = TurfUtil.booleanContainsForAreaFilter(arrRegion, point)
        }
        return flag
      })
    }
    console.log(`侦测设备过滤前后,时间不参与过滤：${allCount}-${allList?.length}`)
    return allList
  }

  /**
   * 飞行器过滤展示
   *
   * @param filter 过滤条件
   *
   */
  public filterCraft(filter: any) {
    console.log("飞行器过滤条件：", filter)
    if (filter.airVehicleFilter.enabled) {
      // 先全隐
      this.hideByType(['RoadUav', 'AdsBUav'])
      let list = this.findCraftList(filter)
      this.showList(list)
    } else {//全隐
      this.hideByType(['RoadUav', 'AdsBUav'])
    }
  }

  // 飞行器数据
  private findCraftList(filter: any) {
    // 所有数据
    let allList: any = undefined
    let allCount: any = undefined
    if (filter.airVehicleFilter.enabled) {
      allList = this.getList(['RoadUav', 'AdsBUav'])
      allCount = allList?.length
      // 类型
      let arrType: any = filter.airVehicleFilter?.type
      if (arrType?.length > 0 && arrType[0] != 'all') {
        //数据来源customDataSource
        allList = allList.filter((item: any) => {
          return arrType.includes(item.dataSource)
        })
      }

      //是否合作
      let arrNetWork: any = filter.airVehicleFilter?.netWork
      if (arrNetWork?.length > 0 && arrNetWork[0] != 'all') {
        allList = allList.filter((item: any) => {
          let flag = false
          if (Object.hasOwn(item.latestData, 'netWork')) {
            let v = String(item.latestData?.netWork)
            flag = arrNetWork.includes(v)
            console.log("是否合作过滤", arrNetWork, v, arrNetWork.includes(v));
          }
          return flag
        })
      }

      // 企业、用途
      let arrUsingType: any = filter.airVehicleFilter?.usingType
      if (arrUsingType?.length > 0 && arrUsingType[0] != 'all') {
        //其它类型
        let excludeArr = ['0', '1', '2', '3']
        allList = allList.filter((item: any) => {
          let flag = false
          if (arrUsingType.includes(item.latestData?.usingType)) {//如果值在选中列表中
            flag = true
          } else if (arrUsingType.includes('999')) {//值不在选中列表，但选了其它
            if (!excludeArr.includes(item.latestData?.usingType)) {//值不在枚举中
              flag = true
            } else {//选了其它，但没选当前类型要排除
              flag = false
            }
          }
          return flag
        })
      }
    }

    //高度过滤
    if (allList && filter.heightFilter.enabled && (filter.heightFilter?.heightMax < 10000 || filter.heightFilter?.heightMin > 0)) {
      let minHeihgt = filter.heightFilter.heightMin
      let maxHeight = filter.heightFilter.heightMax
      allList = allList.filter((item: any) => {
        let flag = false
        let height = 0
        switch (item.dataSource) {
          case 'RoadUav':
            if (item.latestData?.height) {
              height = Number(item.latestData.height)
            }
            break;
          case 'AdsBUav':
            if (item.latestData?.altitude) {
              height = Number(item.latestData.altitude)
            }
            break;
        }
        if (height >= minHeihgt && height <= maxHeight) {
          flag = true
        }
        //console.log("高度过滤", height, minHeihgt, maxHeight, flag)
        return flag
      })
    }

    //时间过滤
    if (allList && filter.dateTimeFilter.enabled) {
      let startTime = filter.dateTimeFilter.startTime + '-01 00:00:00'
      let arrEndTime = filter.dateTimeFilter.endTime.split('-')
      let endTime = new Date(arrEndTime[0], arrEndTime[1] - 1, 1);
      endTime.setMonth(endTime.getMonth() + 1);
      let minTime = TimeUtil.parse(startTime).getTime()
      let maxTime = endTime.getTime()
      //console.log("时间过滤", startTime, TimeUtil.parseDateTime(endTime), minTime, maxTime);
      allList = allList.filter((item: any) => {
        let flag = false
        let time = 0
        switch (item.dataSource) {
          case 'RoadUav':
            time = Number(item.latestData.time)
            break;
          case 'AdsBUav':
            time = Number(item.latestData.createTime)
            break;
        }
        if (time >= minTime && time <= maxTime) {
          flag = true
        }
        //console.log("时间过滤", time, minTime, maxTime, flag)
        return flag
      })
    }

    // 区域过滤，区域=9时为全部
    if (allList && filter.regionFilter.enabled && filter.regionFilter?.where?.length < 9) {
      let arrRegion = filter.regionFilter?.where
      allList = allList.filter((item: any) => {
        let flag = false
        let point: any = undefined
        switch (item.dataSource) {
          case 'RoadUav':
            point = [Number(item.latestData.lng), Number(item.latestData.lat)]
            break;
          case 'AdsBUav':
            point = [Number(item.latestData.longitude), Number(item.latestData.latitude)]
            break;
        }
        if (point && point?.length > 0) {
          flag = TurfUtil.booleanContainsForAreaFilter(arrRegion, point)
        }
        //console.log("区域过滤", time, minTime, maxTime, flag)
        return flag
      })

    }

    console.log(`飞行器过滤前后：${allCount}-${allList?.length}`)
    return allList
  }

  /**
   * 方舱过滤
   *
   * @param filter 过滤条件
   *
   */
  public filterShelter(filter: any) {
    console.log("方舱过滤条件：", filter)
    if (filter.shelterFilter.enabled) {
      // 先全隐
      this.hideByType(['RoadShelter'])
      let list = this.findShelterList(filter)
      this.showList(list)
    } else {//全隐
      this.hideByType(['RoadShelter'])
    }
  }

  // 方舱数据过滤
  private findShelterList(filter: any) {
    // 所有数据
    let allList: any = undefined
    let allCount: any = undefined
    if (filter.shelterFilter.enabled) {
      allList = this.getList(['RoadShelter'])
      allCount = allList?.length
    }
    // 区域过滤，区域=9时为全部
    if (allList && filter.regionFilter.enabled && filter.regionFilter?.where?.length < 9) {
      let arrRegion = filter.regionFilter?.where
      allList = allList.filter((item: any) => {
        let flag = false
        let point: any = undefined
        if (item.latestData.coordinate) {
          let arr = item.latestData.coordinate.split(',')
          point = [Number(arr[0]), Number(arr[1])]
          if (point && point?.length > 0) {
            flag = TurfUtil.booleanContainsForAreaFilter(arrRegion, point)
          }
        }
        return flag
      })
    }
    console.log(`方舱过滤前后,时间、高度不参与过滤：${allCount}-${allList?.length}`)
    return allList
  }

  //高度、区域、时间公共过滤
  public filterCommonWhere(filter: any) {
    console.log("过滤条件：", filter)
    //隐藏全部
    this.hiddenAll()
    //this.hideByType(['RoadUav', 'AdsBUav', 'FiveGADevice', 'AdsbDevice', 'TdoaDevice', 'RoadShelter'])
    //飞行器过滤
    let list = this.findCraftList(filter)
    this.showList(list)
    // 侦测设备过滤
    let list1 = this.findDetectorList(filter)
    this.showList(list1)
    // 方舱过滤
    let list2 = this.findShelterList(filter)
    this.showList(list2)
  }

  //高度、区域、时间公共数据过滤
  private findCommonWhereList(list: any[], filter: any) {
    if (list?.length > 0) {
      console.log('');
    }
    return list
  }

  /**
   * 设置对象可见性
   * @param visibleOption
   */
  public setVisibleOption(visibleOption: any) {
    this.visibleOption = visibleOption
    this.locationParser.setVisibleOption(visibleOption)
  }
}
