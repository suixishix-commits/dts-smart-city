import KeyframePath from './KeyframePath'

export default class ScenePlayerOption {
  /**订阅消息 */
  topic: String = 'ScenePlayerTopic'
  /**关键帧路线 */
  keyframePath!: KeyframePath
  /**加速度 */
  speed?: number
  /**最长播放时间 */
  playDuration?: number
  /**勾子函数 */
  hookFunction?: Map<string, Function>
}