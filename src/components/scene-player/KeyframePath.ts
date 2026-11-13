import Keyframe from '@/components/scene-player/Keyframe'
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
export default class KeyframePath {
  id!: string
  name!: string
  /**关键帧，必赋值 */
  keyframes!: Keyframe[]
  /**计时类型:[duration,time] */
  timingType: string = 'duration'
  /**
   * 业务持续时间(秒)
   * 如果timingType=time，通过起止点dateTime计算出的时间差
   * 如果timingType=duration,该值=playDuration
   */
  duration?: number = 120
  /**
   * 播放耗时，整个动画播放的时长(秒)
   * 如果timingType=time,该值必须设
   * 如果timingType=duration,该值可自动计算
   */
  playDuration?: number = 120
  /**是否弹窗显示关键帧text */
  displayText: boolean = false
  /**运动对象=[camera、actor],要分别实例化[CameraPlayer、ActorPlayer] */
  moveObject: string = 'camera'
}
