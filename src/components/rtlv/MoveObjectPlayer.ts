import DtsFacade from "@/components/dts/DtsFacade.ts";
import TimeUtil from "@/utils/TimeUtil";
import { ElMessage } from "element-plus";


/**
 * DTS API统一调用入口。避免对象频繁调用DTS API导致堵塞
 *
 * 只要移动列表中有值，就会定时（很短）去批量调用DTS API
 *
 * 待调用任务列表格式
 * [{id,dataSource,
 * location,rotation,smoothTime,
 * markerId,markerText,popupUrl,
 * historyLineId,historyPosition,
 * alarm,previousAlarmState,,alarmData}]
 */
export default class MoveObjectPlayer {
  // 任务列表
  static playList: Array<any> = []
  // 定时器ID
  static timer: any
  // 是否为播放状态
  static isPlaying: any = false
  // 批量调用次数
  static batchSize: number = gVar?.invokeDtsApiBatchSize ? gVar?.invokeDtsApiBatchSize : 100
  // 调用次数
  static invokeCount: number = 0
  // 划线延迟
  static drawLineDelayTime: number = 4000
  //需要移动的列表（平滑插值后的）
  static toMoveQue: any = []
  // 标志是否正在处理队列
  static isProcessing = false;
  // message控制关闭
  static messageClose: any = null
  // 防抖定时器：处理高频pushList
  static debounceTimer: any = null;

  /**
   * 推入待调用列表
   * 
   * @param list 待调用列表
   * @param rowData 行数据
   * @returns
   */
  public static pushList(list: any, rowData: any) {
    // console.log(`${TimeUtil.parseDateTime()},pushList`, this.playList?.length, this.isPlaying)    
    // 1、过滤无效数据
    if (!list) return

    // 2. 添加数据到队列（批量/单条）
    if (Array.isArray(list) && list?.length > 0) {
      MoveObjectPlayer.playList.push(...list)
    } else {
      MoveObjectPlayer.playList.push(list)
    }

    // 3. 防抖处理：高频调用时，仅在最后一次调用后触发play()
    // 防抖时间设为100ms（可根据业务调整，小于gVar.invokeDtsApiInterval即可）
    clearTimeout(MoveObjectPlayer.debounceTimer);
    MoveObjectPlayer.debounceTimer = setTimeout(() => {
      // 仅当队列有数据+未播放+无正在处理的play()，才触发
      if (MoveObjectPlayer.playList.length > 0 && !MoveObjectPlayer.isPlaying && !MoveObjectPlayer.isProcessing) {
        MoveObjectPlayer.play();
      }
    }, 200);
  }
  /**
   *
   * 修改maker弹框数据
   * */
  public static setPopupData(rowData) {
    let popupUrl: any = null
    let popupSize: any = null
    let imagePath: any = null
    let popupOffset: any = null
    const { userId = null, traceId = null, speed = null, height = null, legality = null } = rowData.data
    switch (Number(legality)) {
      case 1:
        //合约无人机合法飞行活动。
        popupUrl = `@path:szdk/popup/warning/wrjInfo.html?userId=${userId}&traceId=${traceId}&speed=${speed}&height=${height}` + '&.html'
        popupSize = [500, 180]
        popupOffset = [0, 0]
        imagePath = '@path:szdk/img/uav_dj_y.png'
        break
      case 2:
        //合约无人机非合法飞行活动。
        popupUrl = 'http://192.168.1.24:8080/adsbUav.html'
        break
      case 3:
        //黑飞无人机。
        popupUrl = `@path:szdk/popup/warning/wurenjiHeifei.html?userId=${userId}&traceId=${traceId}&speed=${speed}&height=${height}` + '&.html'
        popupSize = [500, 280]
        popupOffset = [-300, -40]
        imagePath = '@path:szdk/img/uav_dj_y_hf.png'
        break
      default:
        break
    }
    return { popupUrl, popupSize, imagePath, popupOffset }
  }
  /**
   * 处理队列数据 
   */
  protected static play() {
    // 三重防护：防止重复执行
    if (MoveObjectPlayer.isProcessing || MoveObjectPlayer.isPlaying || MoveObjectPlayer.playList.length === 0) return;

    // 加原子锁：标记正在处理play()，禁止其他调用进入
    MoveObjectPlayer.isProcessing = true;
    // console.log(`${TimeUtil.parseDateTime()}:执行play`)

    try {
      MoveObjectPlayer.isPlaying = true;

      // 立即执行第一批渲染
      MoveObjectPlayer.renderBatch();
      // 强制清除旧定时器（关键：杜绝多定时器）
      if (MoveObjectPlayer.timer) {
        clearInterval(MoveObjectPlayer.timer);
        MoveObjectPlayer.timer = null;
      }

      // 仅当还有数据时启动新定时器
      if (MoveObjectPlayer.playList.length > 0) {
        MoveObjectPlayer.timer = setInterval(MoveObjectPlayer.renderBatch, gVar.invokeDtsApiInterval);
      } else {
        MoveObjectPlayer.stop();
      }
    } finally {
      // 解锁：无论执行成功/失败，都释放原子锁
      MoveObjectPlayer.isProcessing = false;
    }
  }

  // 停止方法（清除所有定时器）
  static stop() {
    // 清除播放定时器
    if (MoveObjectPlayer.timer) {
      clearInterval(MoveObjectPlayer.timer);
      MoveObjectPlayer.timer = null;
    }
    // 清除防抖定时器
    if (MoveObjectPlayer.debounceTimer) {
      clearTimeout(MoveObjectPlayer.debounceTimer);
      MoveObjectPlayer.debounceTimer = null;
    }
    // 重置状态
    MoveObjectPlayer.isPlaying = false;
    MoveObjectPlayer.isProcessing = false; // 解锁
  }

  /**
   * 执行DTS API调用
   */
  protected static renderBatch() {
    // console.log(`${TimeUtil.parseDateTime()} renderBatch`, this.playList)
    // 队列空则停止
    if (MoveObjectPlayer.playList.length === 0) {
      MoveObjectPlayer.stop();
      return;
    }

    // 分批次
    let batch = MoveObjectPlayer.playList.splice(0, MoveObjectPlayer.batchSize)
    console.log(`${TimeUtil.parseDateTime()} MoveObjectPlayer批次调用${batch.length}条数据`);
    try {
      // 步骤1：更新报警CO颜色
      // MoveObjectPlayer.handAlarm(batch)
      // 步骤2：更新CO位置
      MoveObjectPlayer.updateCoLocation(batch)

      // 步骤3：更新跟随文字
      let updateMarkers = batch.map(item => {
        //更新marker位置
        // __xapi.marker.setCoordinate(item.markerId, ProjectSceneFacade.pro4jTransform(item.location))
        let result: any = {
          id: item.markerId,
          // text: item.markerText,
          //coordinate: DtsFacade.gcs2pcsLocally(item.location),
          coordinate: item.location,
          // ...this.setPopupData(rowData)
        }
        if (item?.popupUrl) {
          result.popupUrl = item.popupUrl
        }
        return result
      })
      // __xapi.marker.update(updateMarkers)

      // 步骤4：更新历史位置
      // MoveObjectPlayer.handHistory(batch)

      // 步骤5：处理info信息
      // MoveObjectPlayer.handleInfo(batch)

      //console.log(`${TimeUtil.parseDateTime()}DTS API分批次调用update方法,待调用列表长度${this.playList.length}`, batch, updateCo)
      MoveObjectPlayer.invokeCount++
      if (MoveObjectPlayer.invokeCount % 200 == 0) {
        console.log(`${TimeUtil.parseDateTime()},第${MoveObjectPlayer.invokeCount}批次调用DTS API,更新CO、Marker、Line次数`)
      }
    } catch (error) {
      console.error('三维平台渲染失败：', error);
      MoveObjectPlayer.playList.unshift(...batch);
      MoveObjectPlayer.stop();
    }

    // 渲染后队列空则停止
    if (MoveObjectPlayer.playList.length === 0) {
      MoveObjectPlayer.stop();
    }
  }

  //移动方案1
  protected static updateCoLocation(batch: any) {
    if (batch?.length > 0 && __xapi?.isReady) {
      __xapi.customObject.updateBegin();
      batch.forEach((item: any, index: any) => {
        __xapi.customObject.setLocation(item.id, item.location)
        // emitter.emit("focus", item)
      })

      __xapi.customObject.updateEnd();
    }
  }

  //移动方案2
  protected static updateCoLocation2(batch: any) {
    if (batch?.length > 0) {
      __xapi.customObject.updateBegin();
      let updateCo = batch.map((item: any) => {
        return {
          id: item.id,
          location: DtsFacade.gcs2pcsLocally(item.location),
          smoothTime: 0
        }
      })
      // 采用co移动
      __xapi.customObject.moveTo(updateCo)
      __xapi.customObject.updateEnd();
    }
  }

  //移动方案3
  protected static updateCoLocation3(batch: any) {
    if (batch?.length > 0) {
      let updateCo = batch.map((item: any) => {
        return {
          id: item.id,
          location: DtsFacade.gcs2pcsLocally(item.location),
          smoothMotion: 0
        }
      })
      __xapi.customObject.update(updateCo)
    }
  }

  /**
  * 全量更新历史尾巴
  *
  * @param batchList
  */
  protected static handHistory(batchList: any) {

    if (batchList?.length > 0) {
      let arrObj: any = []
      batchList.forEach((item: any, index: any) => {
        if (item?.historyPosition?.length > 1 && item.dataSource == 'Uav' && item.hasAddedToScene) {
          let lineCoords = item.historyPosition
          // 只取最后20个点，且排除最后一个点
          lineCoords = getLast20ExceptLast(lineCoords)
          let updateLineObj: any = {
            id: item.historyLineId,//折线唯一标识id
            coordinates: lineCoords,//构成折线的坐标点数组
            coordinateType: 0
          }
          if (item.alarm) {
            updateLineObj.color = '#FF0000'
          } else {
            updateLineObj.color = '#24FFFB'
          }
          // 当大于500个点的轨迹时不渲染
          if (lineCoords?.length < 500) {
            arrObj.push(updateLineObj)
          }
        }
      })

      if (arrObj.length > 0 && __xapi?.isReady) {//延迟画线，避免线走在胶囊前面
        let timeID = setTimeout(() => {
          __xapi.polyline.update(arrObj)
          clearTimeout(timeID)
        }, this.drawLineDelayTime)
      }

    }

    // 核心逻辑：提取最后20个但排除最后一个
    function getLast20ExceptLast(arr) {
      // 处理边界情况：如果数组长度 <= 20，返回除最后一个外的所有元素
      if (arr.length <= 20) {
        return arr.slice(0, -1);
      }
      // 正常情况：取倒数第21个到倒数第1个（不包含）的元素，共20个
      return arr.slice(-21, -1);
    }
  }

  //更新报警信息,只有无人机才做碰撞检测
  protected static handAlarm(batchList: any) {
    if (batchList?.length > 0) {
      let arrObj: any = []
      batchList.forEach((item: any, index: any) => {
        // 只改变上次变色的无人机
        if (item.alarm != item.previousAlarmState && item.dataSource == 'RoadUav' && item.hasAddedToScene) {
          let updateObj: any = {
            id: item.id,
            functionName: '颜色'
          }
          if (item.alarm) {
            updateObj.parameters = [
              { "paramType": 6, "paramValue": [1, 0, 0, 1] }
            ]
          } else {
            updateObj.parameters = [
              { "paramType": 6, "paramValue": [0, 0.545098, 0.545098, 1] }
            ]
          }
          arrObj.push(updateObj)
        }
      })

      if (arrObj.length > 0 && __xapi?.isReady) {
        //console.log("调用co蓝图函数啦", arrObj);
        let timeID = setTimeout(() => {
          __xapi.customObject.callBatchBPFunction(arrObj)
          clearTimeout(timeID)
        }, this.drawLineDelayTime)
      }
    }
  }

  public static getPlayList() {
    return this.playList
  }


  // 处理队列的函数（持续监听）
  private static processToMoveQueue() {

    if (this.isProcessing) return; // 防止重复启动

    this.isProcessing = true;

    const interval = setInterval(() => {
      if (this.toMoveQue.length > 0) {
        const itemGroup = this.toMoveQue.shift(); // 取出第一个元素(组)
        //批量移动
        __xapi.customObject.updateBegin();
        itemGroup.forEach(item => {
          __xapi.customObject.setLocation(item.id, item.loc)
        })
        __xapi.customObject.updateEnd();

      } else {
        // 队列为空，继续等待
        console.log("Queue is empty, waiting for new data...");

      }
    }, 500); // 每隔 0.5 秒检查一次
  }


  /**
   * 处理3D坐标移动的函数 - 从当前坐标移动到目标坐标
   * @param {Array} currentPos - 当前坐标 [x, y, z]
   * @param {Array} targetPos - 目标坐标 [x, y, z]
   * @param {number} moveDistance - 每次移动的距离（米）
   * @param {number} interval - 移动间隔时间（秒）
   * @param {Function} onUpdate - 每次位置更新后的回调函数，接收新坐标作为参数
   * @param {Function} onComplete - 移动完成后的回调函数
   * @returns {Function} 停止移动的函数
   */
  public static moveToTarget(currentPos, targetPos, moveDistance, interval, onUpdate, onComplete) {
    // 验证输入
    if (!Array.isArray(currentPos) || currentPos.length !== 3) {
      throw new Error('当前坐标必须是包含3个元素的数组 [x, y, z]');
    }

    if (!Array.isArray(targetPos) || targetPos.length !== 3) {
      throw new Error('目标坐标必须是包含3个元素的数组 [x, y, z]');
    }

    if (typeof moveDistance !== 'number' || moveDistance <= 0) {
      throw new Error('每次移动距离必须是正数');
    }

    if (typeof interval !== 'number' || interval <= 0) {
      throw new Error('移动间隔时间必须是正数');
    }

    if (typeof onUpdate !== 'function') {
      throw new Error('必须提供位置更新的回调函数');
    }

    // 计算坐标差值（目标 - 当前）
    const deltaX = targetPos[0] - currentPos[0];
    const deltaY = targetPos[1] - currentPos[1];
    const deltaZ = targetPos[2] - currentPos[2];

    // 计算总距离
    const totalDistance = Math.sqrt(deltaX ** 2 + deltaY ** 2 + deltaZ ** 2);

    // 如果总距离为0，直接完成
    if (totalDistance === 0) {
      onUpdate([...currentPos]);
      onComplete && onComplete(currentPos);
      return () => { };
    }

    // 归一化方向向量
    const dirX = deltaX / totalDistance;
    const dirY = deltaY / totalDistance;
    const dirZ = deltaZ / totalDistance;

    // 当前位置
    let position = [...currentPos];
    let intervalId;

    // 移动一步
    function moveStep() {
      // 计算剩余距离
      const remainingDistance = Math.sqrt(
        (targetPos[0] - position[0]) ** 2 +
        (targetPos[1] - position[1]) ** 2 +
        (targetPos[2] - position[2]) ** 2
      );

      // 如果剩余距离小于等于步长，直接移动到目标位置
      if (remainingDistance <= moveDistance) {
        position = [...targetPos];
        onUpdate([...position]);
        clearInterval(intervalId);
        onComplete && onComplete(position);
        return;
      }

      // 否则按步长移动
      position[0] += dirX * moveDistance;
      position[1] += dirY * moveDistance;
      position[2] += dirZ * moveDistance;

      onUpdate([...position]);
    }

    // 开始移动（转换为毫秒）
    intervalId = setInterval(moveStep, interval * 1000);

    // 立即执行第一步
    moveStep();

    // 返回停止移动的函数
    return function stopMovement() {
      clearInterval(intervalId);
      console.log('移动已停止');
    };
  }

  /**
   * 处理info信息
   * @param batch
   */
  public static handleInfo(batch: any[]) {
    // console.info('处理info信息', batch)
    batch.forEach(item => {
      item?.info.forEach(info => {
        switch (info.type) {
          case "mes":
            if (this.messageClose) this.messageClose.close() // 第一次判断是否为null
            if (info.content === '') { // 判断是否为空字符串
              this.messageClose.close()
            } else {
              // 展示预警信息
              if (info.content.includes('注意安全')) {
                this.messageClose = ElMessage({
                  message: h('div', { class: 'blinking-message-container' }, [
                    h('img', {
                      src: 'tipAbnormalIconBg',
                      class: 'blinking-icon',
                      alt: '闪烁图标'
                    }),
                    h('span', { class: 'message-text' }, info.content)
                  ]),
                  type: 'info',
                  customClass: 'custom-message-warning',
                  duration: 0,
                })
              } else {
                this.messageClose = ElMessage({
                  message: info.content,
                  type: 'info',
                  customClass: 'custom-message',
                  duration: 0,
                })
              }
            }
            break;
          case "actor":
            switch (info.content) {
              case "stopTheRotor":
                break;
              case "startTheRotor":
                break;
              case "openCapsule":
                __xapi.customObject.callBPFunction([
                  {
                    id: item.id,
                    functionName: '显示胶囊',
                    parameters: [
                      { "paramType": 0, "paramValue": true },
                    ]
                  }
                ]);
                break;
              case "closeCapsule":
                __xapi.customObject.callBPFunction([
                  {
                    id: item.id,
                    functionName: '显示胶囊',
                    parameters: [
                      { "paramType": 0, "paramValue": false },
                    ]
                  }
                ]);
                break;
            }
            break;
          case "line":
            if (info.content === 'clear') {
              __xapi.splineMesh.clear()
            } else {
              if (info.content === '避让航线') {

              } else {

              }
            }
            break
          default:
            break;
        }
      })
    })
  }
}


