/**
* 楼宇拆解类
* 
* @author 周小群 20240516
*
* 1、支持Actor楼层和TileLayer楼层的拆解
* 2、可垂直方向弹开、收拢
* 3、可水平方向设定角度移动，勿需垂直弹开后再水平移动，支持弹开后水平移动，也支持水平移动后再垂直移动
* 4、对于TileLayer,改变位置后，要在页面销毁前调用reset方法重置，否则要调用api.reset()方法进行场景重置
*
* 实现原理：
* 1、对于Actor楼层，将Actor复制为CustomObject对象，使用定时器调用CustomObject对象的setLocation()方法修改楼层位置---相对场景位置
* 2、对于TileLayer楼层，使用定时器调用TileLayer对象的setLocation()方法修改楼层位置---相对场景位置
*
* 使用准备：
* 1、需准备建筑物各个楼层的3dt文件并导入acp工程
* 2、DismantleBuilding类实例化选项配置,{floorInfoArr:[楼层基本信息,见3，必填],
  buildVerticalMoveDistance:可选，楼栋整体垂直移动距离,默认10米,
  verticalMoveOnceDistance:可选，单个楼层垂直移动距离,默认0.3米,
  verticalMoveOnceCostTime:可选，单个楼层垂直移动一次耗时，默认30毫秒,  
  verticalMoveDistance:可选，单个楼层垂直移动总距离,默认10米,
  horizontalMoveOnceDistance:可选，单个楼层水平移动一次距离,默认0.5米,
  horizontalMoveOnceCostTime:可选，单个楼层水平移动一次耗时，默认20毫秒,
  horizontalMoveDirection:可选，单个楼层水平移动方向(-180~-180）,默认0度，正东。逆时针方向为正，90为正北，-90为正南  
  horizontalMoveDistance:可选，单个楼层水平移动总距离,默认40米
}
*
* 3、楼层基本信息配置如下
        // {            
        //     layerId: "4DECD1704AD8119E33CF658A64A70AD2",//必选，图层树上的图层Id
        //     floorId:"floor-1",//必选，楼层ID，
        //     floorName:"-1层",//可选，楼层名称
        //     moveType:'tileLayer',//必选，移动类型 TileLayer/Actor
        //     objectId: "zhihuizhongxin_lang_11",//moveType=Actor时必选，楼层模型对象ActorId,不能重复
        //     floorIndex:1, //必选，层号，所在楼栋第N层，最底下那层楼（可能是地下室）为1，用于计算本层向上移动后的高度
        // }
*
* 方法调用：
* 1、升起楼层：dismantleBuildingObj.moveUp()
* 2、下降楼层：dismantleBuildingObj.moveDown()
* 3、抽出楼层：dismantleBuildingObj.pull([{ floorId: 1,verticalMoveDistance: 10(向上垂直移动10米) }])
* 4、推入楼层：dismantleBuildingObj.push([floorId1,floorId2])
*
**/
export default class DismantleBuilding {
  //构造器参数的默认值
  constructor(options = {}) {
    /**
     * 必选。待拆解的楼层模型信息数组：包含{layerId,objectId,floorId}
     */
    this.floorInfoArr = options.floorInfoArr
    /**
     * 可选。楼宇拆解对象实例id,用于CO分组
     */
    this.id = options?.id || 'dismantleBuildingInstance_'
    /**
     * 可选，默认10米。楼栋整体垂直移动距离
     */
    this.buildVerticalMoveDistance = options?.buildVerticalMoveDistance || 10
    /**
     * 可选，默认10米。单个楼层垂直移动总距离
     */
    this.verticalMoveDistance = options?.verticalMoveDistance || 10
    /**
     * 可选，默认30毫秒。单个楼层每次垂直移动耗时
     */
    this.verticalMoveOnceCostTime = options?.verticalMoveOnceCostTime || 30
    /**
     * 可选，默认0.3米。单个楼层每次垂直移动距离
     */
    this.verticalMoveOnceDistance = options?.verticalMoveOnceDistance || 0.3
    /**
     * 可选，默认40米。单个楼层水平移动总距离
     */
    this.horizontalMoveDistance = options?.horizontalMoveDistance || 40
    /**
     * 可选，默认20毫秒。单个楼层每次水平移动耗时
     */
    this.horizontalMoveOnceCostTime = options?.horizontalMoveOnceCostTime || 20
    /**
     * 可选，默认0.5米。单个楼层每次水平移动距离
     */
    this.horizontalMoveOnceDistance = options?.horizontalMoveOnceDistance || 0.5
    /**
     * 可选，默认0度，正东。单个楼层水平移动方向(-180~-180）,正东为0度，按逆时针方向为正，90为正北，-90为正南
     */
    this.horizontalMoveDirection = options?.horizontalMoveDirection ?? 0

    /**
     * 配置选项信息Map
     */
    this.floorConfigMap = null
    /**
     * 以楼层ID为key的楼层移动对象Map，{floorId:[{tileLayer\customObject}]}
     */
    this.floorObjectMap = null
    /**
     * 记录Actor所在图层ID,主要用于重置显示隐藏的Actor
     */
    this.configActorLayerIds = null
    /**
     * 记录Actor所在图层分组信息{layerId:[actorId]}
     */
    this.configActorMap = null
    /**
     * 记录所有实际可移动自定义对象ID
     */
    this.movableCustomObjectIds = null
    /**
     * 记录所有实际可移动图层对象，暂时无效
     */
    this.movableLyaerIds = null
    /**
     * 是否已准备好---有可移动的图层对象、自定义对象
     */
    this.isReady = false
    /**
     * 垂直移动状态：none/moving/up(向上)
     */
    this.verticalMovementStatus = 'none'
    /**
     * 水平移动状态：none/moving/pull-out(拉出)
     */
    this.horizontalMovementStatus = 'none'
    /**
     * 已拆卸楼层Id数组
     */
    this.pullOutFloorIds = null
    /**
     * 已拆卸楼层配置信息,暂时无效
     */
    this.dismantlementFloorConfig = null
    /**
     * 垂直移动定时器
     */
    this.verticalIntervalTimer = null
    /**
     * 水平拉出定时器
     */
    this.horizontalMoveTimerForPull = null
    /**
     * 水平推入定时器
     */
    this.horizontalMoveTimerForPush = null
    console.log('拆楼类实例化啦！')
    // 初始化
    this.initScence()
  }

  /**
   * 初始化
   */
  async initScence() {
    if (window?.fdapi?.isReady) {
      // 初始化全局变量
      this.floorConfigMap = {}
      this.floorObjectMap = {}
      this.movableLyaerIds = []
      this.movableCustomObjectIds = []
      this.configActorLayerIds = []
      this.configActorMap = {}
      this.dismantlementFloorConfig = []
      this.horizontalMoveTimerForPull = null
      this.horizontalMoveTimerForPush = null
      this.verticalMovementStatus = 'none'
      this.horizontalMovementStatus = 'none'

      // 移动图层、co对象Id数组，待验证真实性后，赋给对应的类变量
      let movableLyaerIdsTemp = []
      let movableCustomObjectIdsTemp = []
      // 所有图层id数组
      let arrLayerId = []
      // 配置Actors
      let configActors = []
      // 配置信息Map
      let configItemMapTemp = {}

      // 添加自定义对象
      this.floorInfoArr.forEach((item, index) => {
        // 楼层移动对象
        let floorItems = []
        // 解析所有图层ID，并初始化楼层Map
        if (item?.layerId && item?.floorId) {
          if (this.floorObjectMap.hasOwnProperty(item.floorId)) {
            floorItems = this.floorObjectMap[item.floorId]
          } else {
            this.floorObjectMap[item.floorId] = floorItems
            arrLayerId.push(item.layerId)
          }
        } else {
          console.log('拆楼对象初始化楼层配置信息缺少layerId或floorId')
        }

        // 解析移动图层及Actor
        if (item?.moveType?.toUpperCase() == 'TILELAYER') {
          // 如果移动的是TileLayer
          if (movableLyaerIdsTemp.indexOf(item?.layerId) < 0) {
            movableLyaerIdsTemp.push(item.layerId)
            configItemMapTemp[item.layerId] = item
          }
        } else if (item?.moveType?.toUpperCase() == 'ACTOR') {
          //如果是
          if (movableCustomObjectIdsTemp.indexOf(item?.objectId) < 0) {
            movableCustomObjectIdsTemp.push('ActorTwin_' + item.objectId)
            configItemMapTemp['ActorTwin_' + item.objectId] = item
            if (this.configActorLayerIds.indexOf(item?.layerId) < 0) {
              this.configActorLayerIds.push(item.layerId)
              this.configActorMap[item.layerId] = [item.objectId]
            } else {
              this.configActorMap[item.layerId].push(item.objectId)
            }
          }
        }

        // 待克隆Actor
        let o = {
          id: 'ActorTwin_' + item.objectId,
          tileLayerId: item.layerId,
          objectId: item.objectId,
          smoothMotion: 1, //1: 平滑插值，0: 跳跃
          rotation: [0, 0, 0],
          groupId: this.id,
          scale: [1, 1, 1]
        }
        configActors.push(o)
        // 将配置信息存入楼层map
        floorItems.push(item)
      })

      // 获取要移动的图层信息,缓存图层的原始信息，如坐标
      if (movableLyaerIdsTemp.length > 0) {
        let res = await window.fdapi.tileLayer.get(movableLyaerIdsTemp)
        let layerData = res?.data
        if (layerData?.length > 0) {
          layerData.forEach((item) => {
            let configItem = configItemMapTemp[item.id]
            configItem['metadata'] = { location: item.location }
            configItem['location'] = item.location
            this.movableLyaerIds.push(item.id)
          })
        }
      }
      // 添加co
      if (configActors?.length > 0) {
        await window.fdapi.customObject.addByTileLayer(configActors)
        let res = await window.fdapi.customObject.get(movableCustomObjectIdsTemp)
        let coData = res?.data
        //console.log("真实co查询结果：",coData);
        if (coData?.length > 0) {
          coData.forEach((item) => {
            this.movableCustomObjectIds.push(item.id)
            let configItem = configItemMapTemp[item.id]
            configItem['metadata'] = { location: item.location }
            configItem['location'] = item.location
          })
        }
      }
      //隐藏Actor
      let hideActors = []
      for (const key in this.configActorMap) {
        if (Object.hasOwnProperty.call(this.configActorMap, key)) {
          const element = this.configActorMap[key]
          hideActors.push({ id: key, objectIds: element })
        }
      }
      if (hideActors.length > 0) {
        await window.fdapi.tileLayer.hideActors(hideActors)
      }

      this.floorConfigMap = configItemMapTemp

      console.log('拆楼初始化信息,配置信息', this.floorConfigMap)
      console.log('Actor图层ID', this.configActorLayerIds)
      console.log('Actor图层分布', this.configActorMap, hideActors)
      console.log('真实移动图层IDs', this.movableLyaerIds)
      console.log('真实CO IDs', this.movableCustomObjectIds)
      console.log('楼层信息', this.floorObjectMap)
      if (this.movableLyaerIds?.length > 0 || this.movableCustomObjectIds?.length > 0) this.isReady = true
    } else {
      console.log('场景未初始化完成')
    }
  }

  /**
   * 楼层升起
   */
  async moveUp() {
    if (this.isReady && this.verticalMovementStatus == 'none') {
      // 打开位移状态
      this.verticalMovementStatus = 'moving'
      let index = 0
      this.verticalIntervalTimer = setInterval(async () => {
        let distance = index * this.verticalMoveOnceDistance
        if (distance >= this.verticalMoveDistance) {
          console.log('最后一次楼层升起，总共执行次数：', index + 1)
          distance = this.verticalMoveDistance
        }

        //co对象移动
        window.fdapi.customObject.updateBegin()
        for (const item of this.movableCustomObjectIds) {
          let configItem = this.floorConfigMap[item]
          let location = configItem?.metadata?.location
          if (location) {
            //CO高度坐标=整栋楼抬升高度+累计移动距离*层号
            let hight = this.buildVerticalMoveDistance + location[2] + configItem.floorIndex * distance
            window.fdapi.customObject.setLocation(item, [location[0], location[1], hight])
            configItem['location'] = [location[0], location[1], hight]
          }
        }
        window.fdapi.customObject.updateEnd()
        // tileLayer移动
        /*     window.fdapi.tileLayer.updateBegin()
        this.movableLyaerIds.forEach((item) => {
          let configItem = this.floorConfigMap[item]
          let location = configItem?.metadata?.location
          if (location) {
            //CO高度坐标=整栋楼抬升高度+累计移动距离*层号
            let hight = this.buildVerticalMoveDistance + location[2] + configItem.floorIndex * distance
            window.fdapi.tileLayer.setLocation(item, [location[0], location[1], hight])
            configItem['location'] = [location[0], location[1], hight]
          }
        })
        window.fdapi.tileLayer.updateEnd()*/
        index++
        // 判断最后一次楼层升起
        if (distance >= this.verticalMoveDistance) {
          // 关闭位移状态
          this.verticalMovementStatus = 'up'
          clearInterval(this.verticalIntervalTimer)
          this.verticalIntervalTimer = null
          console.log('上升动画完成，楼层信息', this.floorObjectMap)
          return
        }
      }, this.verticalMoveOnceCostTime)
    } else {
      console.log('已升起或正在升起中或未完成初始化', this.isReady, this.verticalMovementStatus)
    }
  }

  /**
   * 楼层下降
   */
  async moveDown() {
    if (this.isReady && this.verticalMovementStatus == 'up') {
      // 打开位移状态
      this.verticalMovementStatus = 'moving'
      let index = 0
      this.verticalIntervalTimer = setInterval(async () => {
        let distance = this.verticalMoveDistance - index * this.verticalMoveOnceDistance
        if (distance <= 0) {
          console.log('最后一次楼层下降，总共执行次数：', index + 1)
          distance = 0
        }

        //co对象移动
        window.fdapi.customObject.updateBegin()
        this.movableCustomObjectIds.forEach((item) => {
          let configItem = this.floorConfigMap[item]
          let location = configItem?.metadata?.location
          if (location) {
            //CO高度坐标=楼面高度+累计移动距离*层数
            let hight = location[2] + configItem.floorIndex * distance
            window.fdapi.customObject.setLocation(item, [location[0], location[1], hight])
            configItem['location'] = [location[0], location[1], hight]
          }
        })
        window.fdapi.customObject.updateEnd()
        // tileLayer移动
        /*      window.fdapi.tileLayer.updateBegin()
        this.movableLyaerIds.forEach((item) => {
          let configItem = this.floorConfigMap[item]
          let location = configItem?.metadata?.location
          if (location) {
            //CO高度坐标=楼面高度+累计移动距离*层数
            let hight = location[2] + configItem.floorIndex * distance
            window.fdapi.tileLayer.setLocation(item, [location[0], location[1], hight])
            configItem['location'] = [location[0], location[1], hight]
          }
        })
        window.fdapi.tileLayer.updateEnd()*/
        index++
        // 判断最后一次楼层下降
        if (distance <= 0) {
          // 关闭位移状态
          this.verticalMovementStatus = 'none'
          clearInterval(this.verticalIntervalTimer)
          this.verticalIntervalTimer = null
          console.log('下降动画完成，楼层对象为：', this.floorObjectMap)
          return
        }
      }, this.verticalMoveOnceCostTime)
    } else {
      console.log('已收起或正在收起中或未完成初始化', this.isReady, this.verticalMovementStatus)
    }
  }

  /**
   * 拉出楼层
   * @param {*} pullData 格式[{floorId,verticalMoveDistance}]
   */
  async pull(pullData) {
    if (this.isReady && this.verticalMovementStatus != 'moving' && this.horizontalMovementStatus != 'moving') {
      // 待平移列表
      let toDoList = []
      // 解析待平移对象列表
      let arrPullData = []
      if (pullData?.floorId) {
        arrPullData = [pullData]
      } else if (Array.isArray(pullData) && pullData.length > 0 && pullData[0]?.floorId) {
        arrPullData = pullData
      }
      // 最大垂直移动距离
      let maxVerticalMoveDistance = 0
      // 垂直移动列表
      let toDoListForVerticalMove = []

      arrPullData.forEach((pullItem) => {
        let arrConfigItem = this.floorObjectMap[pullItem.floorId]
        if (arrConfigItem?.length > 0) {
          arrConfigItem.forEach((configItem) => {
            if (configItem?.metadata) {
              //只有真实的图层或Actor才会有metadata属性
              let metalocation = configItem.metadata.location
              // 避免连续多次执行同一楼层的拉出，但又要考虑向上移动后的Z坐标
              configItem.pullConfig = { startingPoint: [metalocation[0], metalocation[1], configItem.location[2]], config: pullItem }
              toDoList.push(configItem)
              if (pullItem?.verticalMoveDistance > 0) {
                toDoListForVerticalMove.push(configItem)
                if (pullItem.verticalMoveDistance > maxVerticalMoveDistance) {
                  maxVerticalMoveDistance = pullItem.verticalMoveDistance
                }
              }
            }
          })
        }
      })
      console.log('待拉出列表-垂直移动列表-最大垂直移动距离', toDoList, toDoListForVerticalMove, maxVerticalMoveDistance)
      if (toDoList.length > 0) {
        // 垂直移动判断
        if (toDoListForVerticalMove.length > 0) {
          this.__pull_horizontalMove(toDoList, this.__pull_VerticalMove.bind(this), toDoListForVerticalMove, maxVerticalMoveDistance)
        } else {
          // 水平移动
          this.__pull_horizontalMove(toDoList)
        }
        this.dismantlementFloorConfig = toDoList
      }
    } else {
      console.log('正在移动中或未完成初始化')
    }
  }

  /**
   * 推入楼层
   * @param {*} pushData 格式[floorId1,floorId]
   */
  async push(pushData) {
    if (this.isReady && this.verticalMovementStatus != 'moving' && this.horizontalMovementStatus != 'moving') {
      // 待平移列表
      let toDoList = []
      // 解析待平移对象列表
      let arrPushData = pushData

      // 最大垂直移动距离
      let maxVerticalMoveDistance = 0
      // 垂直移动列表
      let toDoListForVerticalMove = []
      arrPushData.forEach((pullItem) => {
        let arrConfigItem = this.floorObjectMap[pullItem]
        if (arrConfigItem?.length > 0) {
          arrConfigItem.forEach((configItem) => {
            if (configItem?.metadata) {
              //只有真实的图层或Actor才会有metadata属性
              toDoList.push(configItem)
              let vS = configItem?.pullConfig?.config?.verticalMoveDistance
              if (vS > 0) {
                toDoListForVerticalMove.push(configItem)
                if (vS > maxVerticalMoveDistance) {
                  maxVerticalMoveDistance = vS
                }
              }
            }
          })
        }
      })
      console.log('待推入列表-垂直移动列表-最大垂直移动距离', toDoList, toDoListForVerticalMove, maxVerticalMoveDistance)
      if (toDoList.length > 0 && toDoList[0]?.pullConfig) {
        if (toDoListForVerticalMove?.length > 0) {
          this.__push_VerticalMove(toDoListForVerticalMove, maxVerticalMoveDistance, this.__push_horizontalMove.bind(this), toDoList)
        } else {
          // 水平推入
          this.__push_horizontalMove(toDoList)
        }
      } else {
        console.log('待推入列表为空或没有推出信息')
      }
    } else {
      console.log('正在移动中或未完成初始化')
    }
  }

  // 重置
  async reset() {
    if (window?.fdapi?.isReady) {
      console.log('拆楼对象重置啦！')
      //重置CO
      window.fdapi.tileLayer.showAllActors(this.configActorLayerIds)
      await window.fdapi.customObject.clear()
      //重置tileLayer
      if (this.movableLyaerIds?.length > 0) {
        window.fdapi.tileLayer.updateBegin()
        this.movableLyaerIds.forEach((item) => {
          let configItem = this.floorConfigMap[item]
          let location = configItem?.metadata?.location
          if (location) {
            window.fdapi.tileLayer.setLocation(item, [location[0], location[1], location[2]])
            configItem['location'] = [location[0], location[1], location[2]]
          }
        })
        window.fdapi.tileLayer.updateEnd()
      }
      //重置定时器
      clearInterval(this.verticalIntervalTimer)
      clearInterval(this.horizontalMoveTimerForPull)
      clearInterval(this.horizontalMoveTimerForPush)
      //初始化数据
      await this.initScence()
    }
  }

  /**
   * 内部函数，水平拉出,
   * @param {*} toDoList 待拉出列表
   */
  async __pull_horizontalMove(toDoList, verticalMoveFun = undefined, toDoListForVerticalMove = [], maxVerticalMoveDistance = 0) {
    this.horizontalMovementStatus = 'moving'
    let index = 0
    this.horizontalMoveTimerForPull = setInterval(async () => {
      let distance = index * this.horizontalMoveOnceDistance
      if (distance >= this.horizontalMoveDistance) {
        //与推入方法不同之处
        console.log('最后一次楼层拉出，总共执行次数：', index + 1)
        distance = this.horizontalMoveDistance
      }

      //co对象水平移动
      window.fdapi.customObject.updateBegin()
      toDoList.forEach((configItem) => {
        if (configItem.moveType.toUpperCase() == 'ACTOR') {
          let startingPoint = configItem?.pullConfig?.startingPoint
          let metalocation = configItem?.metadata?.location
          // 避免连续多次执行同一楼层的拉出
          let location = [metalocation[0], metalocation[1], startingPoint[2]]
          if (location) {
            let x = location[0] + distance * Math.cos(this.horizontalMoveDirection * (Math.PI / 180))
            let y = location[1] + distance * Math.sin(this.horizontalMoveDirection * (Math.PI / 180))
            window.fdapi.customObject.setLocation('ActorTwin_' + configItem.objectId, [x, y, location[2]])
            configItem['location'] = [x, y, location[2]]
          }
        }
      })
      window.fdapi.customObject.updateEnd()
      //tileLayer移动
      /*    window.fdapi.tileLayer.updateBegin()
      toDoList.forEach((configItem) => {
        if (configItem.moveType.toUpperCase() == 'TILELAYER') {
          let startingPoint = configItem?.pullConfig?.startingPoint
          let metalocation = configItem?.metadata?.location
          // 避免连续多次执行同一楼层的拉出
          let location = [metalocation[0], metalocation[1], startingPoint[2]]
          if (location) {
            let x = location[0] + distance * Math.cos(this.horizontalMoveDirection * (Math.PI / 180))
            let y = location[1] + distance * Math.sin(this.horizontalMoveDirection * (Math.PI / 180))
            window.fdapi.tileLayer.setLocation(configItem.layerId, [x, y, location[2]])
            configItem['location'] = [x, y, location[2]]
          }
        }
      })
      window.fdapi.tileLayer.updateEnd()*/

      index++
      // 判断最后一次楼层拉出位置
      if (distance >= this.horizontalMoveDistance) {
        //与推入方法不同之处
        // 关闭位移状态
        this.horizontalMovementStatus = 'pull-out'
        clearInterval(this.horizontalMoveTimerForPull)
        this.horizontalMoveTimerForPull = null
        console.log('拉出动画完成，楼层对象为：', this.floorObjectMap)
        // 垂直移动
        if (verticalMoveFun) {
          verticalMoveFun(toDoListForVerticalMove, maxVerticalMoveDistance)
        }
        return
      }
    }, this.horizontalMoveOnceCostTime)
  }

  /**
   * 内部函数，水平拉出后垂直移动,
   * @param {*} toDoList 拉出垂直列表
   */
  async __pull_VerticalMove(toDoList, maxVerticalMoveDistance) {
    this.horizontalMovementStatus = 'moving'
    let index = 0
    // 循环移动的总高度
    let distance = 0
    this.horizontalMoveTimerForPull = setInterval(async () => {
      let stepLen = 0 //移动步长
      if (distance + this.verticalMoveOnceDistance >= maxVerticalMoveDistance) {
        stepLen = maxVerticalMoveDistance - distance
      } else {
        stepLen = this.verticalMoveOnceDistance
      }
      distance = distance + stepLen
      //co对象水平移动
      window.fdapi.customObject.updateBegin()
      toDoList.forEach((configItem) => {
        if (configItem.moveType.toUpperCase() == 'ACTOR') {
          let location = configItem?.location
          if (location) {
            // 支持不同的楼层垂直移动的距离不同
            if (distance <= configItem?.pullConfig?.config?.verticalMoveDistance) {
              window.fdapi.customObject.setLocation('ActorTwin_' + configItem.objectId, [location[0], location[1], location[2] + stepLen])
              configItem['location'] = [location[0], location[1], location[2] + stepLen]
              //console.log('ActorTwin_' + configItem.objectId,"垂直上升,第N次",index,distance,maxVerticalMoveDistance,stepLen);
            }
          }
        }
      })
      window.fdapi.customObject.updateEnd()
      //tileLayer移动
      /*  window.fdapi.tileLayer.updateBegin()
      toDoList.forEach((configItem) => {
        if (configItem.moveType.toUpperCase() == 'TILELAYER') {
          let location = configItem?.location
          if (location) {
            // 支持不同的楼层垂直移动的距离不同
            if (distance <= configItem?.pullConfig?.config?.verticalMoveDistance) {
              window.fdapi.tileLayer.setLocation(configItem.layerId, [location[0], location[1], location[2] + stepLen])
              configItem['location'] = [location[0], location[1], location[2] + stepLen]
              //console.log(configItem.layerId,"图层垂直上升,第N次",index,distance,maxVerticalMoveDistance,stepLen);
            }
          }
        }
      })
      window.fdapi.tileLayer.updateEnd()*/
      index++

      // 判断最后一次
      if (distance >= maxVerticalMoveDistance) {
        // 关闭位移状态
        this.horizontalMovementStatus = 'pull-out'
        clearInterval(this.horizontalMoveTimerForPull)
        this.horizontalMoveTimerForPull = null
        console.log('拉出抬升动画完成，楼层对象-循环次数为：', this.floorObjectMap, index)
        return
      }
    }, this.verticalMoveOnceCostTime)
  }

  /**
   * 内部函数，水平推入,
   * @param {*} toDoList 待推入列表
   */
  async __push_horizontalMove(toDoList) {
    this.horizontalMovementStatus = 'moving'
    let index = 0
    this.horizontalMoveTimerForPush = setInterval(async () => {
      let distance = this.horizontalMoveDistance - index * this.horizontalMoveOnceDistance
      if (distance <= 0) {
        //与推出方法不同之处
        console.log('最后一次楼层推入，总共执行次数：', index + 1)
        distance = 0
      }

      //co对象水平0. 移动
      window.fdapi.customObject.updateBegin()
      toDoList.forEach((configItem) => {
        if (configItem.moveType.toUpperCase() == 'ACTOR') {
          let location = configItem?.pullConfig?.startingPoint
          if (location) {
            let x = location[0] + distance * Math.cos(this.horizontalMoveDirection * (Math.PI / 180))
            let y = location[1] + distance * Math.sin(this.horizontalMoveDirection * (Math.PI / 180))
            window.fdapi.customObject.setLocation('ActorTwin_' + configItem.objectId, [x, y, location[2]])
            configItem['location'] = [x, y, location[2]]
            //console.log("本次楼层推入次数、距离及坐标：",index,distance,configItem['location']);
          }
        }
      })
      window.fdapi.customObject.updateEnd()
      //tileLayer移动
      /*      window.fdapi.tileLayer.updateBegin()
      toDoList.forEach((configItem) => {
        if (configItem.moveType.toUpperCase() == 'TILELAYER') {
          let location = configItem?.pullConfig?.startingPoint
          if (location) {
            let x = location[0] + distance * Math.cos(this.horizontalMoveDirection * (Math.PI / 180))
            let y = location[1] + distance * Math.sin(this.horizontalMoveDirection * (Math.PI / 180))
            window.fdapi.tileLayer.setLocation(configItem.layerId, [x, y, location[2]])
            configItem['location'] = [x, y, location[2]]
            //console.log("本次楼层推入次数、距离及坐标：",index,distance,configItem['location']);
          }
        }
      })
      window.fdapi.tileLayer.updateEnd()*/
      index++
      // 判断最后一次楼层拉出位置
      if (distance <= 0) {
        //与推出方法不同之处
        // 关闭位移状态
        this.horizontalMovementStatus = 'none'
        clearInterval(this.horizontalMoveTimerForPush)
        this.horizontalMoveTimerForPush = null
        console.log('推入动画完成，楼层对象为：', this.floorObjectMap)
        return
      }
    }, this.horizontalMoveOnceCostTime)
    this.dismantlementFloorConfig = toDoList
  }

  /**
   * 内部函数，水平推入前垂直移动,
   * @param {*} toDoList 推入垂直移动列表
   */
  async __push_VerticalMove(toDoList, maxVerticalMoveDistance, horizontalMoveFun = undefined, toDoListForHorizontalMove = undefined) {
    this.horizontalMovementStatus = 'moving'
    let index = 0
    // 循环移动的总高度
    let distance = 0
    this.horizontalMoveTimerForPull = setInterval(async () => {
      let stepLen = 0 //移动步长
      if (maxVerticalMoveDistance - distance <= 0) {
        stepLen = maxVerticalMoveDistance - distance
      } else {
        stepLen = this.verticalMoveOnceDistance
      }
      distance = distance + stepLen
      //co对象水平移动
      window.fdapi.customObject.updateBegin()
      toDoList.forEach((configItem) => {
        if (configItem.moveType.toUpperCase() == 'ACTOR') {
          let location = configItem?.location
          if (location) {
            let startingPoint = configItem?.pullConfig?.startingPoint
            if (location[2] - stepLen >= startingPoint[2]) {
              window.fdapi.customObject.setLocation('ActorTwin_' + configItem.objectId, [location[0], location[1], location[2] - stepLen])
              configItem['location'] = [location[0], location[1], location[2] - stepLen]
              //console.log('ActorTwin_' + configItem.objectId,"垂直下降,第N次",index,distance,maxVerticalMoveDistance,stepLen);
            }
          }
        }
      })
      window.fdapi.customObject.updateEnd()
      //tileLayer移动
      /*      window.fdapi.tileLayer.updateBegin()
      toDoList.forEach((configItem) => {
        if (configItem.moveType.toUpperCase() == 'TILELAYER') {
          let location = configItem?.location
          if (location) {
            let startingPoint = configItem?.pullConfig?.startingPoint
            if (location[2] - stepLen >= startingPoint[2]) {
              window.fdapi.tileLayer.setLocation(configItem.layerId, [location[0], location[1], location[2] - stepLen])
              configItem['location'] = [location[0], location[1], location[2] - stepLen]
              //console.log(configItem.layerId,"图层垂直下降,第N次",index,distance,maxVerticalMoveDistance,stepLen);
            }
          }
        }
      })
      window.fdapi.tileLayer.updateEnd()*/
      index++
      // 判断最后一次
      if (distance >= maxVerticalMoveDistance) {
        // 关闭位移状态
        this.horizontalMovementStatus = 'pull-out'
        clearInterval(this.horizontalMoveTimerForPull)
        this.horizontalMoveTimerForPull = null
        console.log('拉出抬升动画完成，楼层对象-循环次数为：', this.floorObjectMap, index)
        if (horizontalMoveFun) {
          horizontalMoveFun(toDoListForHorizontalMove)
        }
        return
      }
    }, this.verticalMoveOnceCostTime)
  }
}
