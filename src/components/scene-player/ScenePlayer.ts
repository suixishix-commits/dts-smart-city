import DtsFacade from '@/components/dts/DtsFacade'
import MittEvent from '@/utils/MittEvent'
import TimeUtil from '@/utils/TimeUtil'
import Timer from '@/utils/Timer'
import emits from '@/utils/emitter'
import ActorKeyframe from './ActorKeyframe'
import Keyframe from './Keyframe'
import KeyframePath from './KeyframePath'
import type ScenePlayerOption from './ScenePlayerOption'

/**
 *业务导览播放类
 *
 * Author:zhouxq
 *
 * 设计解释：
 * 帧为起点帧，即本帧播放完毕，位置在下一帧的坐标位置上
 * 帧持续时间duration：指本位置(coordinate)到达下一个位置所耗时间。尾帧持续时间为0秒
 * 帧isStopFrame:如果为true，会在本帧停止，再次调用play方法才能继续往下播放
 * 帧waitingTime：到达本帧位置后（即上一帧播放完毕），会在该位置停留waitingTime指定时间，
 *                然后才继续播放本帧到达下一位置。SuperTourPlayer会在该帧后插入一帖
 *                并将本帧的PlayDuration赋给插入帧
 * 0帧：会在首帧（keyFrames[0])前插入一帧，代表从当前位置飞向首帧,0帧耗时1秒,会复制首帧设置信息
 * visbleLayer\hiddenLayer\weatherConfig\hookFunction：都会在执行本帧时调用
 * hookFunction：为异步函数或'0'时间执行函数，否则可能会引起导览时间轴混乱,
 * isStopFrame与waitingTime同时存在时，不会插入等待帧，会在该帧暂停
 *
 * 二、主要配置参数
 *
 */
export default class ScenePlayer {
  // 场景调用接口基类
  protected dtsApi: any
  /**当前状态,-99:未知，-2:初始化中，-1：初始化完成 0:播放，1:暂停：2:继续：3:停止}*/
  private playState: number = -99
  //**动画播放总时长=各帧播放时间+各帧暂停时间 */
  private pathPlayDuration?: number
  //速度步长,time类型=playDuration/maxDuration,duration类型=1
  private speedStep: number = 1
  //加速度
  private speed: number = 1
  //速度倍率
  private speedRate: number[] = Array.of(0.5, 1, 1.5, 2, 4, 6, 8, 16, 32)
  //当前速度倍率索引
  private currSpeedRateIndex: number = 1

  //实际导览数据
  protected keyframes!: Keyframe[] | null
  /**当前正在播放的Dts导览数据 */
  private keyframePath!: KeyframePath | null

  //播放器参数
  /**当前帧 */
  protected currentPlayIndex: number = 0

  /**播放脚本图层信息 */
  private layerSet: Set<string> = new Set() //图层中文名称
  private layerIdMapper: Map<string, string> = new Map() //图层ID名称
  /**播放完毕，回调函数 */
  private endCallback?: Function | null
  /**勾子函数集合 */
  private hookFunction?: Map<string, Function> | null
  /**导览配置 */
  protected options?: any | null

  /**被打断位置 */
  protected lastInterruptedLocation: any

  /**计时类型为time时=关键第一帧与最后一帧的时间差
   * 计时类型为duration=playDuration
   */
  private pathDuration: number = 0

  /** 上一次定时器Id */
  private lastTimerId?: any
  /** 定时器id */
  private timerIds: any[] = []

  // 构造函数
  constructor(options: any, callback: Function | null = null) {
    this.dtsApi = DtsFacade.getDtsApi()
    if (callback) {
      this.endCallback = callback
    }
    this.options = options
    this.initOptions(options)
  }

  /**选项初始化 */
  public initOptions(options: ScenePlayerOption) {
    this.options = options
    this.playState = -2
    if (options) {
      if (options.speed) {
        this.setSpeed(options.speed)
      }
      if (options.playDuration) {
        this.setPathPlayDuration(options.playDuration)
      }
      if (options.hookFunction) {
        this.hookFunction = options.hookFunction
      }

      this.keyframePath = options.keyframePath
      if (this.keyframePath?.keyframes) {
        // 供子类重载
        this.beforeInitKeyFrames(this.keyframePath)
        //初始化速度
        this.initSpeedStep()
        //初始化持续时间
        this.initDuration()
        //初始化关键帧
        this.keyframes = this.initKeyFrames(this.keyframePath)

        //初始化图层ID
        let tmpLayer = [...this.layerSet]
        let tmpLayerId = DtsFacade.getLayerId(tmpLayer)
        tmpLayer.forEach((value: string, index: any) => {
          this.layerIdMapper.set(value, tmpLayerId[index])
        })
        this.keyframePath.displayText = this.keyframePath.displayText ? this.keyframePath.displayText : false
        this.keyframePath.playDuration = this.pathPlayDuration ? this.pathPlayDuration : 0
        this.keyframePath.duration = this.pathDuration
      }
      console.log('ScenePlayer初始化完成,关键帧', this.keyframes, this.keyframePath, this.speedStep)
    }
    this.playState = -1
  }

  /**
   * 设置播放速度
   * 不设置，默认=1倍速
   * @param speed
   */
  public setSpeed(speed: number) {
    this.speed = speed
  }

  /**
   * 设置播放总时间长
   * 如果option未设置，time类型时，播放时长=首尾帧dateTime之差
   * duration类型时，=各帧playDuarion+waitingTime
   * @param playDuration 动画播放总时长，单位秒
   */
  public setPathPlayDuration(playDuration: number) {
    this.pathPlayDuration = playDuration
  }

  /**
   * 开启新导览时，要清空
   */
  public reset(): void {
    this.keyframes = null
    this.keyframePath = null
    this.playState = -1
    this.pathDuration = 0
    this.dtsApi = null
    this.hookFunction = null
    this.endCallback = null
    this.options = null
  }

  protected async play() {
    this.playState = 0
    // 重置
    this.timerIds = []
    Timer.removeAll()
    // if (this.currentPlayIndex === 0 && this.keyframes) {
    //   //如果是0帧
    //   let toView = [...this.keyframes[0].coordinate, ...this.keyframes[0].rotation]
    //   toView[5] = 0
    //   DtsFacade.setCamera(toView)
    //   console.log('0帧初始化位置:', toView)
    //   await Timer.sleep(1)
    //   this.currentPlayIndex = 1
    // }

    if (this.lastInterruptedLocation) {
      //说明被暂停、加减速打断过
      let duration = this.playInterruptedFrame()
      this.lastTimerId = Timer.once(this.playNoInterruptList.bind(this), duration * 1000)
      this.timerIds.push(this.lastTimerId)
    } else {
      //播放未被打断过的帧
      this.playNoInterruptList()
    }
  }

  /** 供子类重载- 播放因暂停、加减速时被打断的帧，*/
  protected playInterruptedFrame(): number {
    console.log('ScenePlayer中的playInterruptedFrame')
    return 0
  }

  /**播放方法 */
  private async playNoInterruptList() {
    this.beforePlaySegmentFrames()
    let toList = this.getToPlayList()
    console.log('本次待播放列表:' + TimeUtil.parseDateTime(), toList)
    if (toList?.length >= 2) {
      await this.playToPlayList(toList)
      this.afterPlaySegmentFrames()
    } else if (toList?.length == 1) {
      //this.handleFinalFrame()
      console.log('播放列表只有1个，是尾帧不?', this.currentPlayIndex, this.keyframes)
    }
    if (this.keyframes && this.currentPlayIndex == this.keyframes?.length - 1) {
      //emits.emit(this.options?.topic, new MittEvent('beforePlayKeyFrame', { currIndex: this.keyframes.length - 1, keyframes: this.keyframes }))
      this.handleFinalFrame()
      console.log('索引重置')
      this.currentPlayIndex = 0
      this.currSpeedRateIndex = 1
      this.restPlayerIndex()
      if (this.endCallback) {
        /**导览播放完毕回调 */
        console.log('播放完回调')
        this.endCallback()
      }
    }
  }

  /** 供子类重载-40 播放关键帧列表前注入 */
  protected beforePlayKeyFrame(currIndex: number) {
    //emits.emit(this.options?.topic, new MittEvent('beforePlayKeyFrame', { currIndex: currIndex, keyframes: this.keyframes }))
  }
  /**供子类重载-30 播放分段帧列表前注入 */
  protected beforePlaySegmentFrames() { }
  /**供子类重载- 播放完分段帧列表前注入 */
  protected afterPlaySegmentFrames() { }
  /**供子类重载- 帧重置时注入,currentPlayIndex=0 */
  protected restPlayerIndex() { }

  /**暂停 */
  protected async pause() {
    if (this.playState != 0) {
      return
    }
    this.playState = 1
    this.recordInterruptedLocation()
    Timer.removeAll()
    //Timer.removeOnce([this.lastTimerId])
  }

  /**恢复 */
  protected async resume() {
    this.playState = 2
    this.play()
  }

  /**停止 */
  protected async stop() {
    this.playState = 3
    Timer.removeAll()
  }

  /**加速 */
  protected async speedUp() {
    if (this.currSpeedRateIndex >= this.speedRate.length - 1) {
      ElMessage.info('已经是最大倍速')
    } else {
      this.currSpeedRateIndex++
      await this.pause()
      await this.resume()
      ElMessage.info('当前倍速：✖ ' + this.speedRate[this.currSpeedRateIndex])
    }
  }

  /**减速 */
  protected async speedDown() {
    if (this.currSpeedRateIndex <= 0) {
      ElMessage.info('已经是最小倍速')
    } else {
      this.currSpeedRateIndex--
      await this.pause()
      await this.resume()
      ElMessage.info('当前倍速：✖ ' + this.speedRate[this.currSpeedRateIndex])
    }
  }

  /**供子类重载- 记录点击暂停位置 */
  protected async recordInterruptedLocation() { }

  /**供子类重载- 子类核心实现，场景移动处理，默认实现camera移动 */
  protected async moveHandler(curr: Keyframe, next: Keyframe, currIndex: number, keyframes: any) {
    if (this.keyframePath?.moveObject == 'camera') {
      let toView = [...next.coordinate, ...next.rotation]
      toView[5] = this.getPlayDuration(curr.playDuration)
      DtsFacade.setCamera(toView)
    }
  }

  /**尾帧处理 */
  private handleFinalFrame() {
    console.log('尾帧处理')
    if (this.keyframes) {
      let lastestFrame = this.keyframes[this.keyframes?.length - 1]
      //图层、勾子处理
      this.layerHander(lastestFrame.visbleLayer, lastestFrame.hiddenLayer, lastestFrame)
      this.hookFunctionHandler(lastestFrame.hookFunction, lastestFrame)
      this.weatherHandler(lastestFrame.weatherConfig, lastestFrame)
      this.handlerText(lastestFrame)
      // 消息转发
      if (this.options?.topic && lastestFrame?.topic && lastestFrame?.keyFrameType == 9) {
        emits.emit(this.options?.topic, new MittEvent(lastestFrame.topic, {}))
      }
    }
  }

  /**播放待播列表 */
  private async playToPlayList(toPlayList: Keyframe[]) {
    if (this.playState < -1) {
      ElMessage({
        message: '初始化未完成，不能播放！',
        type: 'info'
      })
    } else {
      if (!this.dtsApi) {
        this.dtsApi = DtsFacade.getDtsApi()
      }

      //Timer.removeAll() //清空所有的定时器
      await toPlayList.reduce(
        async (previousPromise: any, currentValue: Keyframe, currentIndex: number, keyFrames: Keyframe[]) => {
          await previousPromise
          return this.playKeyFrame(previousPromise, currentValue, currentIndex, keyFrames)
        },
        this.playKeyFrame(
          //执行首帧
          new Promise(() => { }),
          toPlayList[0],
          -1,
          toPlayList
        )
      )
    }
  }

  /**播放关键帧 */
  private playKeyFrame(previousPromise: any, currentValue: Keyframe, currentIndex: number, keyFrames: Keyframe[]) {
    return new Promise((resolve, reject) => {
      if (currentIndex >= 0 && currentIndex < keyFrames.length - 1) {
        this.handler(keyFrames[currentIndex], keyFrames[currentIndex + 1])
        this.lastTimerId = Timer.once(() => {
          resolve([currentValue.text + '-' + this.currentPlayIndex])
        }, this.getPlayDuration(currentValue.playDuration * 1000))
        this.timerIds.push(this.lastTimerId)
      } else {
        resolve([])
      }
    })
  }

  /**业务逻辑处理 */
  private handler(curr: Keyframe, next: Keyframe) {
    //播放关键帧时处理
    this.beforePlayKeyFrame(this.currentPlayIndex)
    // 消息转发
    if (this.options?.topic && curr?.topic && curr?.keyFrameType == 1) {
      emits.emit(this.options?.topic, new MittEvent(curr.topic, {}))
    }

    // console.log(
    // 	'---执行关键帧，帧索引=' +
    // 		this.currentPlayIndex +
    // 		',' +
    // 		curr.text +
    // 		'帧类型[0:0帧,1:关键帧,2:暂停帧,3:尾帧]' +
    // 		curr.keyFrameType +
    // 		',' +
    // 		TimeUtil.parseDateTime()
    // )
    // console.log('定时器ID数组', this.timerIds, this.lastTimerId)

    if (!curr.isWaitingFrame && next?.coordinate) {
      this.moveHandler(curr, next, this.currentPlayIndex, this.keyframes)
    } else {
      //console.log('这里不知道为啥跳过了,可能是等待帧或下帧坐标错误', this.currentPlayIndex, curr, next)
    }

    //图层、勾子处理
    this.handlerText(curr)
    this.layerHander(curr.visbleLayer, curr.hiddenLayer, curr)
    this.hookFunctionHandler(curr.hookFunction, curr)
    this.weatherHandler(curr.weatherConfig, curr)
    this.currentPlayIndex++
  }

  /**
   * 供子类重载-10
   * @param keyframePath 
   */
  protected beforeInitKeyFrames(keyframePath: any) { }

  /**
   * 供子类重载-20
   */
  protected initActorKeyFrames(keyframePath: any, keyFrames: any): any { }

  /**将用户导览数据变成关键帧数据 */
  private initKeyFrames(keyframePath: any): any {
    if (keyframePath && keyframePath.keyframes instanceof Array && keyframePath.keyframes.length > 1) {
      let keyFrames: Array<any> = keyframePath.keyframes
      let keyDuration: number
      let arrTourPoint = new Array()
      keyFrames.forEach((value: any, index: any) => {
        //初始化图层信息
        if (value.visbleLayer) {
          value.visbleLayer.forEach((value: any, index: any) => {
            this.layerSet.add(value)
          })
        }
        if (value.hiddenLayer) {
          value.hiddenLayer.forEach((value: any, index: any) => {
            this.layerSet.add(value)
          })
        }

        //初始化关键帧
        let keyFrame = this.newKeyFrame()
        Object.assign(keyFrame, value)

        //添加一帧，从当前位置到第一帧位置
        if (index == 0) {
          if (this.keyframePath?.moveObject === 'camera') {
            let zeroFrame = this.newKeyFrame()
            Object.assign(zeroFrame, value)
            zeroFrame.index = -1
            zeroFrame.time = 0
            zeroFrame.playDuration = value?.toDuration || 0
            zeroFrame.text = '0帧'
            zeroFrame.duration = 0
            zeroFrame.isWaitingFrame = false
            zeroFrame.isStopFrame = false
            zeroFrame.keyFrameType = 0
            zeroFrame.visbleLayer = []
            zeroFrame.hiddenLayer = []
            zeroFrame.weatherConfig = null
            zeroFrame.hookFunction = ''
            arrTourPoint.push(zeroFrame)
            if (keyFrames[0]?.waitingTime > 0) {
              //插入停顿键
              let keyFrame2 = this.newKeyFrame()
              Object.assign(keyFrame2, keyFrames[index])
              keyFrame2.duration = 0
              keyFrame2.playDuration = keyFrames[index]?.waitingTime
              keyFrame2.isWaitingFrame = true
              keyFrame2.index = keyFrames[index]?.index + '-1'
              keyFrame2.text = keyFrames[index]?.text
              keyFrame2.keyFrameType = 2
              keyFrame2.time = arrTourPoint[arrTourPoint.length - 1].time + arrTourPoint[arrTourPoint.length - 1].playDuration
              arrTourPoint.push(keyFrame2)
              /**帧行为转移至插入帧 */
              keyFrame.visbleLayer = []
              keyFrame.hiddenLayer = []
              keyFrame.weatherConfig = null
              keyFrame.hookFunction = ''
              keyFrame.text = ''
            }
          }
        }

        if (index == keyFrames.length - 1) {
          //最后一帧
          keyFrame.duration = 0
          keyFrame.playDuration = 0
          keyFrame.keyFrameType = 9
        } else {
          if (this.keyframePath?.timingType === 'time') {
            keyDuration = this.getKeyFrameDuration(keyFrames[index], keyFrames[index + 1])
            keyDuration = Number(keyDuration.toFixed(2))
            keyFrame.duration = keyDuration
            keyFrame.playDuration = Number(((keyDuration * this.speedStep) / this.speed).toFixed(2))
          } else if (this.keyframePath?.timingType === 'duration') {
            keyFrame.duration = keyFrame.playDuration
          }
        }

        //如果当前帧是等待帧，插入停顿键,首、尾帧不插入
        if (keyFrames[index]?.waitingTime > 0 && index > 0 && index != keyFrames.length - 1) {
          //插入停顿键
          let keyFrame2 = this.newKeyFrame()
          Object.assign(keyFrame2, keyFrames[index])
          keyFrame2.duration = 0
          keyFrame2.playDuration = keyFrames[index]?.waitingTime
          keyFrame2.isWaitingFrame = true
          keyFrame2.index = keyFrames[index]?.index + '-1'
          keyFrame2.text = keyFrames[index]?.text
          keyFrame2.keyFrameType = 2
          keyFrame2.time = arrTourPoint[arrTourPoint.length - 1].time + arrTourPoint[arrTourPoint.length - 1].playDuration
          arrTourPoint.push(keyFrame2)

          /**帧行为转移至插入帧 */
          keyFrame.visbleLayer = []
          keyFrame.hiddenLayer = []
          keyFrame.weatherConfig = null
          keyFrame.hookFunction = ''
        }

        if (index == 0) {
          keyFrame.time = 0
        } else {
          keyFrame.time = arrTourPoint[arrTourPoint.length - 1].time + arrTourPoint[arrTourPoint.length - 1].playDuration
        }

        arrTourPoint.push(keyFrame)
      })

      if (keyframePath?.moveObject === 'actor') {
        arrTourPoint = this.initActorKeyFrames(keyframePath, arrTourPoint)
      }
      //console.log('关键帧初始化-1:', arrTourPoint)
      return arrTourPoint
    }
  }



  /**获取每帧的播放时间 */
  protected getPlayDuration(playDuration: number) {
    return playDuration / this.speedRate[this.currSpeedRateIndex]
  }

  /**
   * 计算关键帧的持续时间
   * @param beginTime
   * @param endTime
   * @returns
   */
  private getKeyFrameDuration(fromKeyFrame: any, toKeyFrame: any): number {
    let duration = 0
    if (fromKeyFrame?.dateTime && toKeyFrame?.dateTime) {
      duration = TimeUtil.getDuration(fromKeyFrame.dateTime, toKeyFrame.dateTime)
    }
    return duration
  }

  /**初始化速度步长 */
  private initSpeedStep() {
    if (this.keyframePath && this.keyframePath?.keyframes instanceof Array) {
      let arrKeyPoint = this.keyframePath?.keyframes
      //存储全局变量
      if (this.keyframePath.timingType === 'time') {
        this.pathDuration = TimeUtil.getDuration(arrKeyPoint[0].dateTime, arrKeyPoint[arrKeyPoint.length - 1].dateTime)
        if (!this.pathPlayDuration) {
          this.pathPlayDuration = this.pathDuration
        }
        this.speedStep = this.pathPlayDuration / this.pathDuration
      } else {
        this.speedStep = 1
      }
    } else {
      this.speedStep = 1
    }
  }

  /**初始化持续时间 */
  private initDuration() {
    if (this.keyframePath && this.keyframePath?.keyframes instanceof Array) {
      let arrKeyPoint = this.keyframePath?.keyframes
      //存储全局变量
      if (this.keyframePath.timingType === 'duration') {
        let kfs = this.keyframePath.keyframes
        this.pathPlayDuration = 0
        this.pathDuration = 0
        kfs.forEach((item: any, index: any) => {
          this.pathPlayDuration = this.pathPlayDuration + item.playDuration
          if (item?.waitingTime && !item?.isStopFrame) {
            this.pathPlayDuration = this.pathPlayDuration + item.waitingTime
          }
        })
        this.pathDuration = this.pathPlayDuration
      } else {
        //timingType=time时，this.pathPlayDuration来自于options
        //this.pathDuration在initSpeedStep已经算过
      }
    }
  }

  /**获取待播放帧 */
  private getToPlayList(): Array<Keyframe> {
    let toList = new Array()
    if (this.keyframes && this.keyframes.length > this.currentPlayIndex) {
      for (let index = this.currentPlayIndex; index < this.keyframes.length; index++) {
        const element = this.keyframes[index]
        if (element.isStopFrame && this.currentPlayIndex != index) {
          //遇到暂停时退出，但当前帧是暂停帧，说明从当前帧开始播放
          toList.push(element)
          break
        } else {
          toList.push(element)
        }
      }
    }
    return toList
  }

  /**图层显隐处理 */
  private async layerHander(visbleLayer: [] | null | undefined, hiddenLayer: [] | null | undefined, keyFrame: Keyframe) {
    this.switchLayer(visbleLayer, true, keyFrame)
    this.switchLayer(hiddenLayer, false, keyFrame)
  }

  /**根据图层中文名称进行显隐 */
  private async switchLayer(arrLayer: [] | null | undefined, visble: boolean = true, keyFrame: Keyframe) {
    let layerId: any
    // console.log('图层处理' + arrLayer + ':' + visble)
    // console.log(this.layerIdMapper)
    if (arrLayer && arrLayer.length > 0) {
      let vLayer = new Array()
      arrLayer.forEach((value: any, index: any) => {
        layerId = this.layerIdMapper.get(value)
        if (layerId) {
          vLayer.push(layerId)
        }
      })
      if (vLayer.length > 0) {
        await DtsFacade.layerSwitchById(vLayer, visble)
      }
    }
  }

  /**勾子函数调用 */
  private async hookFunctionHandler(funName: string | null, keyFrame: Keyframe) {
    //console.log('准备执行方法:' + funName)

    if (funName && this.hookFunction) {
      let fun = this.hookFunction.get(funName)
      if (fun) {
        fun()
        //console.log('已执行方法:' + funName)
      }
    }
  }

  /**天气环境设置 */
  private async weatherHandler(config: any, keyFrame: Keyframe) {
    //console.log('进入天气环境处理,type=' + keyFrame.keyFrameType)
    if (config) {
      if (Reflect.has(config, 'dateTime')) {
        let state = config.dateTime.state
        if (state === 'on') {
          //console.log('设置时间' + config.dateTime.time)
          await DtsFacade.setDateTime(config.dateTime.time)
        } else if (state === 'off') {
          await DtsFacade.setDateTime()
          //console.log('取消时间')
        }
      }
      if (Reflect.has(config, 'fog')) {
        let state = config.fog.state
        if (state === 'on') {
          //console.log('设置雾')
          let fogDensity: number = config.fog?.fogDensity || 0.1
          let fogColor: number[] = config.fog?.fogColor || [1, 1, 1]
          let fogHeightFalloff: number = config.fog?.fogHeightFalloff || 0.05
          let fogStartDistance: number = config.fog?.fogStartDistance || 10
          let fogOpacity: number = config.fog?.fogOpacity || 0.2
          await __xapi.weather.setFogParam(fogDensity, fogColor, fogHeightFalloff, fogStartDistance, fogOpacity)
        } else if (state === 'off') {
          //console.log('取消雾')
          await __xapi.weather.setFogParam(0, [1, 1, 1], 0, 0, 0)
        }
      }
      if (Reflect.has(config, 'rain')) {
        let state = config.rain.state
        if (state === 'on') {
          //console.log('设置雨')
          let cloudThickness: number = config.rain?.cloudThickness || 2
          let strength: number = config.rain?.strength || 1
          let speed: number = config.rain?.speed || 1
          let raindropSize: number = config.rain?.raindropSize || 1
          let rainColor: number[] = config.rain?.rainColor || [0.5, 0.5, 0.5, 0.1]
          let alignCamera: number = config.rain?.alignCamera || 0.5
          let overcastStrength: number = config.rain?.overcastStrength || 0.5
          await __xapi.weather.setCloudThickness(cloudThickness);
          await __xapi.weather.setRainParam(strength, speed, raindropSize, rainColor, alignCamera, overcastStrength)
        } else if (state === 'off') {
          //console.log('取消雨')
          await __xapi.weather.disableRainSnow()
        }
      }

      if (Reflect.has(config, 'snow')) {
        let state = config.snow.state
        if (state === 'on') {
          //console.log('设置雪')
          let cloudThickness: number = config.snow?.cloudThickness || 2
          let strength: number = config.snow?.strength || 1
          let speed: number = config.snow?.speed || 1
          let snowflakeSize: number = config.snow?.snowflakeSize || 1
          let snowColor: number[] = config.snow?.snowColor || [0.5, 0.5, 0.5, 0.1]
          let alignCamera: number = config.snow?.alignCamera || 0.5
          let overcastStrength: number = config.snow?.overcastStrength || 0.5
          await __xapi.weather.setCloudThickness(cloudThickness);
          await __xapi.weather.setSnowParam(strength, speed, snowflakeSize, snowColor, alignCamera, overcastStrength)
        } else if (state === 'off') {
          //console.log('取消雪')
          await __xapi.weather.disableRainSnow()
        }
      }
    }
  }

  /**标题处理 */
  private handlerText(keyFrame: Keyframe) {
    if (this.keyframePath?.displayText && keyFrame.keyFrameType != 0) {
      let text = keyFrame.text ?? ''
      if (text && text.indexOf('等待帧完成') < 0 && keyFrame.keyFrameType == 1) {
        console.log("显示文字处理：", keyFrame.text);
        ElMessage.info(keyFrame.text)
        //ElMessage(keyFrame.text)
        // ElMessage({
        //   message: keyFrame.text,
        //   type: 'info',
        //   customClass: 'custom-message'
        // })
      }
    }
  }

  /**计算两点间距离 */
  protected calcDistance(p1: number[], p2: number[]) {
    if (!p1 || !p2 || p1.length < 2 || p2.length < 2) {
      throw new Error('坐标格式有误')
    }
    if (p1.length == 2) {
      p1[2] = 0
    }
    if (p2.length == 2) {
      p2[2] = 0
    }
    let dx = p2[0] - p1[0]
    let dy = p2[1] - p1[1]
    let dz = p2[2] - p1[2]

    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  /**获取关键帧 */
  public getKeyFrames() {
    return this.keyframes
  }

  /**获取定时器 */
  public getTimerIds() {
    return this.timerIds
  }

  // 实现化关键帧
  protected newKeyFrame() {
    if (this.keyframePath?.moveObject === 'actor') {
      return new ActorKeyframe()
    } else {
      return new Keyframe()
    }
  }
}
