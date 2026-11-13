import CameraPlayer from '@/components/scene-player/CameraPlayer'
import emits from '@/utils/emitter'
import MittEvent from '@/utils/MittEvent'
import Timer from '@/utils/Timer'
import showScript1 from './show1-script'

export default class Show1 {
  private player: CameraPlayer | null
  private script = showScript1

  constructor() {
    let hooks = new Map([
      ['initShow', this.initShow.bind(this)]
    ])
    let options = {
      topic: 'Show-001',
      keyframePath: this.script,
      speed: 1,
      hookFunction: hooks
    }
    this.player = new CameraPlayer(options)
    this.registerEventListener()
  }

  public async play() {
    this.player?.play()
  }

  //暂停
  public async pause() {
    console.log('播放暂停前', Timer.getTimer())
    this.player?.pause()
    console.log('播放暂停后', Timer.getTimer())
  }

  //恢复
  public async resume() {
    this.player?.resume()
  }

  //下一帧
  public async next() {
    this.player?.next()
  }

  //上一帧
  public async back() {
    this.player?.back()
  }

  //停止
  public async stop() {
    this.player?.stop()
  }

  //停止
  public async go(index: number) {
    this.player?.go(index)
  }

  public getKeyFrameLength() {
    return this.player?.getKeyFrames()?.length
  }

  /**
   * 注册事件监听
   */
  private registerEventListener() {
    //消息注册
    emits.on('Show-001', (event: any) => {
      console.log('Show1接收到消息', event)
      let type = event.type
      switch (type) {
        case 'initPopupBuilding': // 初始化拆楼
          Chailou.reset()
          Chailou.newInstance(false)
        case 'showPopupBuilding': // 显示拆楼
          // 拆楼-弹开
          Chailou.moveUp()

          // 拆楼-收拢
          setTimeout(() => {
            Chailou.moveDown()
          }, 5000);

          //拆楼-拉出
          setTimeout(() => {
            let pullData = [
              { floorId: 'floor-2', verticalMoveDistance: 30 },
              { floorId: 'floor-3', verticalMoveDistance: 10 }
            ]
            Chailou.pull(pullData)
          }, 10000);

          //拆楼-推入
          setTimeout(() => {
            let pushData = ['floor-3', 'floor-2']
            Chailou.push(pushData)
          }, 16000);

          //拆楼-重置
          setTimeout(() => {
            Chailou.reset()
          }, 22000);
          break
        case 'showOver':
          setTimeout(() => {
            __xapi.reset(3)
            __xapi.weather.disableRainSnow()
            console.log('飞行结束666！');
          }, 10000);
          break
        default:
          break
      }
    })
  }

  /**初始化 */
  private initShow() {
    emits.emit('Show-001', new MittEvent('initShow'))
  }
}