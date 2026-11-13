import type ActorKeyframe from './ActorKeyframe'
import KeyframePath from './KeyframePath'
/**
 * 关键帧路径
 *
 * Author:zhouxq
 * 说明：
 * 1、timingType:两帧之间的时差计算方式，time:使用dateTime字段计算
 * duration:使用playDuration字段，单位秒，代表本帧coordinate到下帧定义的coordinate之间的耗时
 * 2、moveObject:移动对象，[camera、actor],分别实例化[CameraPlayer、ActorPlayer]
 * 3、isStopFrame:false/true 在本位置暂停，需要点一下才能继续前进
 * 4、waitingTime:10 在本位置停留10秒
 */
export default class ActorKeyframePath extends KeyframePath {
  /**关键帧，必赋值 */
  declare keyframes: ActorKeyframe[]
  /**运动对象=[camera、actor],要分别实例化[CameraPlayer、ActorPlayer] */
  moveObject: string = 'actor'

  /**###以下配置为actor专用### */
  distance!: number
  /**当相邻两点间的距离小于该值时，跳过下一个点 */
  minDistance!: number
}
