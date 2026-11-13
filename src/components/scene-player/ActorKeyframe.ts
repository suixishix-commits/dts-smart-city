import Keyframe from './Keyframe';
/**
 * 关键帧
 * Author:zhouxq
 *
 * 1、CameraPlayer会自动在首帧前播放0帧，会将首帧的位置复制至0帧上，如果首帧不是P帧，0帧的playDuration=1秒
 * 2、场景会在P帧(waitingTime>0帧)位置暂停。实现思路：Player会在P帧前插入等待帧(W帧)，
 *    W帧位置为P帧位置，playDuration(暂停时间)为waitingTime，P帧的图层、天气、函数设置会转移到W帧上
 * 3、会在S帧(isStopFrame=true)位置暂停播放，代码再次调用play方法才会继续播放
 * 4、图层、天气、勾子函数在S帧到达位置时不会执行，当离开S帧位置时才会执行
 * 5、首帧的waitingTime会转移到0帧的playDuration上
 *
 */
export default class ActorKeyframe extends Keyframe {
  //###以下是actor帧独有标记  
  /**
   * 与N+1有效点的距离
   */
  distance!: number
  /**
   * 当前时间点之后跳过的点
   * 跳过在"原地不动的点"
   */
  skipStep!: Keyframe[]
}
