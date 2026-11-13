import RandomUtil from '@/utils/RandomUtil'
import TimeUtil from '@/utils/TimeUtil'
import DtsFacade from '../dts/DtsFacade'
import ActorKeyframe from './ActorKeyframe'
import type ActorPlayerOption from './ActorPlayerOption'
import ScenePlayer from './ScenePlayer'

/**
 * 对象播放器
 */
export default class ActorPlayer extends ScenePlayer {
  //实际导览数据
  declare protected keyframes: ActorKeyframe[] | null

  /**活动对象Id */
  private actorId: string = ''
  /**轨迹 */
  private lastActorLocation: any | null = null
  /**actor是否初始化 */
  private actorExists: boolean = false
  /**actor选项 */
  private actorOptions?: Object | null
  //是否显示导航线
  private showNavLine: boolean = false
  //导航线是否已绘制
  private navLineDrawed: boolean = false
  //导航线
  private navLine!: Array<any>
  /**轨迹线样式选项 */
  private navLineOptions?: Object

  //###以下为ActorPlayer专有配置
  /**当相邻两点间的距离小于该值时，跳过下一个点 */
  private minDistance: number = 10
  //###以上为ActorPlayer专有配置

  /**构造函数 */
  constructor(options: ActorPlayerOption, callback: Function | null = null) {
    super(options, callback)
    this.actorId = 'def_co_' + RandomUtil.getUUID(8)
    this.initActorPlayer(options)
  }

  //播放
  public async play() {
    console.log('执行play方法啦')
    if (!this.actorExists) {
      this.initActor()
    }
    super.play()
  }

  //暂停
  public async pause() {
    super.pause()
  }

  //恢复
  public async resume() {
    super.play()
  }

  //停止
  public async stop() {
    await this.dtsApi.customObject.hide(this.actorId)
    await this.dtsApi.customObject.delete(this.actorId)
    super.stop()
  }

  /**
   * 子类重载实现
   * 
   * @param keyframePath 
   */
  protected beforeInitKeyFrames(keyframePath: any) {
    if (keyframePath?.minDistance) {
      this.minDistance = keyframePath?.minDistance
    }
  }

  /**
   * 子类重载实现
   * 
   * 初始化ActorPlayer帧
   * 计算跳过点和欧拉角
   */
  protected initActorKeyFrames(keyframePath: any, keyFrames: any): any {
    let arrKeyframes: ActorKeyframe[] = new Array()
    if (keyFrames && keyFrames.length >= 2) {
      let lastKeyPoint!: ActorKeyframe //上一个关键点
      let distance: number

      keyframePath.distance = keyframePath.distance ? keyframePath.distance : 0

      //第一个点是关键点
      let kf = new ActorKeyframe()
      Object.assign(kf, keyFrames[0])
      kf.time = 0
      arrKeyframes.push(kf)
      lastKeyPoint = kf

      /**中间点 */
      for (let i = 1, count = keyFrames.length - 1; i < count; i++) {
        let kf = new ActorKeyframe()
        Object.assign(kf, keyFrames[i])
        distance = this.calcDistance(lastKeyPoint.coordinate, keyFrames[i].coordinate)
        distance = Number(distance.toFixed(2))
        if (keyFrames[i]?.isWaitingFrame) {
          //如果是等待帧，那么该帧，及下帧都不能跳过
          //该帧是新的关键点
          lastKeyPoint.distance = distance
          keyframePath.distance = keyframePath.distance + distance
          kf.time = lastKeyPoint.time + lastKeyPoint.playDuration
          if (this.options?.cameraFollowing) {
            kf.rotation = [0, 0, 0]
          }
          if (this.options?.cameraFollowing) {
            lastKeyPoint.rotation = this.dtsApi.camera.getEulerAngle(lastKeyPoint.coordinate, kf.coordinate)
          }
          //console.log('上一关键帧是', lastKeyPoint)
          arrKeyframes.push(kf)
          lastKeyPoint = kf
          //等待帧原帧
          let kf1 = new ActorKeyframe()
          Object.assign(kf1, keyFrames[i + 1])
          lastKeyPoint.distance = 0
          kf1.time = lastKeyPoint.time + lastKeyPoint.playDuration
          arrKeyframes.push(kf1)
          lastKeyPoint = kf1
          i++
        } else {
          if (distance < this.minDistance) {
            if (!lastKeyPoint.skipStep) {
              lastKeyPoint.skipStep = new Array()
            }
            lastKeyPoint.skipStep.push(keyFrames[i])
          } else {
            //是新的关键点
            lastKeyPoint.distance = distance
            keyframePath.distance = keyframePath.distance + distance
            kf.time = lastKeyPoint.time + lastKeyPoint.playDuration
            //计算相机伴随欧拉角
            if (this.options?.cameraFollowing) {
              lastKeyPoint.rotation = this.dtsApi.camera.getEulerAngle(lastKeyPoint.coordinate, kf.coordinate)
            }
            //console.log('上一关键帧是', lastKeyPoint)
            arrKeyframes.push(kf)
            lastKeyPoint = kf
          }
        }
      }

      //最后一个也是关键点
      kf = new ActorKeyframe()
      Object.assign(kf, keyFrames[keyFrames.length - 1])
      kf.time = lastKeyPoint.time

      //修改最后一个关键点的上一个关键点
      distance = this.calcDistance(lastKeyPoint.coordinate, keyFrames[keyFrames.length - 1].coordinate)
      distance = Number(distance.toFixed(2))
      keyframePath.distance = keyframePath.distance + distance
      lastKeyPoint.distance = distance

      if (this.options?.cameraFollowing) {
        lastKeyPoint.rotation = this.dtsApi.camera.getEulerAngle(lastKeyPoint.coordinate, kf.coordinate)
      }

      //添加最后一个关键点
      kf.distance = 0
      kf.time = lastKeyPoint.time + lastKeyPoint.playDuration
      arrKeyframes.push(kf)
    }
    return arrKeyframes
  }

  /**初始化播放器选项 */
  protected async initActorPlayer(options: ActorPlayerOption) {
    this.showNavLine = options.showNavLine ? options.showNavLine : false
    this.navLineOptions = options.navLineOptions ? options.navLineOptions : undefined
    if (options?.actorOptions) {
      this.actorOptions = options.actorOptions
    }
    if (this.keyframes && this.keyframes.length >= 2) {
      this.initActor(this.keyframes![0].coordinate)
    }

    if (this.showNavLine && options.keyframePath?.keyframes?.length > 2) {
      this.navLine = new Array()
      let oKeyframes = options.keyframePath?.keyframes
      oKeyframes.forEach((value: any, index: any) => {
        this.navLine.push(value.coordinate)
      })
    }
  }

  /** 
   * 子类重载实现
   * 
   * 记录打断位置 
   * */
  protected async recordInterruptedLocation() {
    let lastActorId = this.actorId
    let co = await this.dtsApi.customObject.get(this.actorId)
    if (co.data) {
      this.actorId = 'def_co_' + RandomUtil.getUUID(8)
      let pre = co.data[0]
      this.lastInterruptedLocation = [...pre.location, ...pre.rotation]
      console.log('当前位置')
      console.log(this.lastInterruptedLocation)
      this.actorExists = false
      this.initActor(pre.location, pre.rotation)
      await this.dtsApi.customObject.delete(lastActorId)
    }
  }

  /**
   * 
   * 子类重载实现：播放被打断过的帧 
   * 
   * */
  protected playInterruptedFrame(): number {
    if (this.lastActorLocation?.length > 0 && this.currentPlayIndex < this.keyframes!.length - 1) {
      let result = new Array()
      let curr = this.keyframes![this.currentPlayIndex - 1]
      let next = this.keyframes![this.currentPlayIndex]
      let currCoor = [this.lastActorLocation[0], this.lastActorLocation[1], this.lastActorLocation[2]]
      //获取被打断的帧的播放时间
      let interruptedDist = this.calcDistance(currCoor, next.coordinate)
      let interruptedDuration = (interruptedDist * curr.playDuration) / curr.distance
      let coDur = this.getPlayDuration(interruptedDuration)
      console.log('被打断的剩余播放时间原为：' + interruptedDuration + '加速后为：' + coDur + '-' + TimeUtil.parseDateTime())

      result.push({ time: 0, coordinate: currCoor })
      result.push({ time: coDur, coordinate: next.coordinate })
      this.dtsApi.customObject.startMove(this.actorId, 0, result)
      this.lastActorLocation = null
      return coDur
    } else {
      return 0
    }
  }

  /**子类重载实现：播放分段帧列表前注入 */
  protected beforePlaySegmentFrames() {
    this.handleNvLine()
    if (this.actorExists) {
      this.dtsApi.customObject.show(this.actorId)
    }
  }

  /**子类重载实现：播放完分段帧列表前注入 */
  protected restPlayerIndex() {
    /**回到起点 */
    let data = [
      {
        id: this.actorId,
        location: this.keyframes![0].coordinate,
        smoothTime: 1
      }
    ]
    this.dtsApi.customObject.moveTo(data)
    this.dtsApi.customObject.hide(this.actorId)
    console.log('回到起点')
  }

  /**子类重载实现：子类核心实现，场景移动处理，默认实现camera移动 */
  protected async moveHandler(curr: ActorKeyframe, next: ActorKeyframe, currIndex: number, keyframes: any) {
    let dur = this.getPlayDuration(curr.playDuration)
    let result = new Array()
    result.push({ time: 0, coordinate: curr.coordinate })
    result.push({ time: dur, coordinate: next.coordinate })
    this.dtsApi.customObject.startMove(this.actorId, 0, result)
    // if (this.options?.cameraFollowing && !curr?.isWaitingFrame) {
    // 	let toView = [...next.coordinate, ...curr.rotation]
    // 	toView[2] = toView[2] + 5
    // 	toView[5] = curr.playDuration
    // 	DtsFacade.setCamera(toView)
    // }
  }

  /**
   * 运动对象初始化
   * @param location 初始坐标
   * @param rotation 旋转
   * @param actorOption 配置选项
   */
  private initActor(location: number[] | null = null, rotation?: [] | null, actorOption?: Object | null) {
    if (this.actorExists) {
      return
    }

    if (this.actorOptions) {
      actorOption = this.actorOptions
    }
    let actor: any = {
      id: this.actorId,
      groupId: 'gp_co_gongcheng',
      //pakFilePath: store.appStore.config.dts + '/media/pak/walkman.pak', //pak文件路径
      //assetPath: '/JC_CustomAssets/BP_Walk', //运动人物模型路径
      pakFilePath: '@path:DTS_Library.pak',
      assetPath: '/JC_CustomAssets/RoleLibrary/Exhibition/动态人物/男角色_1',
      location: location, //位置坐标
      coordinateType: 0, // 坐标系类型
      localRotation: [0, 0, 0],
      scale: [2000, 2000, 2000], //缩放
      smoothMotion: 1 //1: 平滑插值，0: 跳跃
    }

    if (actorOption) {
      actor = { ...actor, ...actorOption }
    }
    if (rotation) {
      actor.rotation = rotation
    }
    if (location) {
      actor.location = location
    } else {
      if (this.lastActorLocation?.length > 0) {
        actor.location = [this.lastActorLocation[0], this.lastActorLocation[1], this.lastActorLocation[2]]
        actor.rotation = [this.lastActorLocation[3], this.lastActorLocation[4]]
      } else {
        actor.location = this.keyframes![0].coordinate
      }
    }
    this.dtsApi.customObject.add(actor)
    if (this.options?.cameraFollowing) {
      this.dtsApi.customObject.focus(this.actorId, 5, 1, [], 1)
    }
    this.actorExists = true
    console.log('initActor对象', actor, this, this.actorId, this.actorExists)
  }

  //导航线处理
  private handleNvLine() {
    if (this.showNavLine && !this.navLineDrawed) {
      DtsFacade.addPolyline([{ id: 'def_gp_polyline_track', coordinates: this.navLine }], this.navLineOptions, false)
      this.navLineDrawed = true
    }

    if (!this.showNavLine && this.navLineDrawed) {
      DtsFacade.delete('polyline', 'def_gp_polyline_track')
      this.navLineDrawed = false
    }
  }
}
