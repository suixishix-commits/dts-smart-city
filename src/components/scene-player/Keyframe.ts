/**
 * 关键帧
 * Author:zhouxq
 *
 * 0、名词解释：0帧：基于首帧数据自动配置；P帧：waitingTime>0的帧；S帧：isStopFrame=true的帧
 * 1、CameraPlayer会自动在首帧前播放0帧，会将首帧的位置复制至0帧上，如果首帧不是P帧，0帧的playDuration=1秒
 * 2、场景会在P帧(waitingTime>0帧)位置暂停。实现思路：Player会在P帧前插入等待帧(W帧)，
 *    W帧位置为P帧位置，playDuration(暂停时间)为waitingTime，P帧的图层、天气、函数设置会转移到W帧上
 * 3、会在S帧(isStopFrame=true)位置暂停播放，代码再次调用play方法才会继续播放
 * 4、图层、天气、勾子函数在S帧到达位置时不会执行，当离开S帧位置时才会执行
 * 5、首帧的waitingTime会转移到0帧的playDuration上
 *
 */
export default class Keyframe {
  /**序号 */
  index!: any
  /**标注文本 */
  text?: string
  /**时间,如2023-03-17 10:15:20  */
  dateTime!: string
  /**三维坐标 */
  coordinate!: number[]
  /**方向，[上下旋转角度(俯仰)、左右旋转角度(航向)、翻转角(一般为0)]*/
  rotation!: number[]
  /**打开图层列表 */
  visbleLayer?: [] | null
  /**关闭图层列表 */
  hiddenLayer?: [] | null
  /**天气参数配置 */
  weatherConfig?: any
  /**帧开始时调用勾子函数 */
  customHandler?: any
  hookFunction?: any
  /**本帧暂停 */
  isStopFrame: boolean = false
  /**消息主题 */
  topic?: any

  /**------以下参数Player自动维护，无需设置 */
  /**播放状态 */
  playState?: number
  /** 帧类型:0:0帧，1:关键帧,2:暂停帧,9:尾帧 */
  keyFrameType: number = 1
  /**本帧暂停 */
  isWaitingFrame: boolean = false
  /**本段用时（至下一关键帧)*/
  declare duration: number
  /**本段播放耗时（至下一关键帧)*/
  declare playDuration: number
  /**到达时间，起点为0，等于上一节帧的(time+playDuration)*/
  time!: number
}
