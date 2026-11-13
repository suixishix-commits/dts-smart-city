import type ActorKeyframePath from './ActorKeyframePath'
import ScenePlayerOption from './ScenePlayerOption'

export default class ActorPlayerOption extends ScenePlayerOption {
  /**关键帧路线 */
  declare keyframePath: ActorKeyframePath

  //###AcotorPlayer专属配置
  /**是否显示导航线 */
  showNavLine?: boolean
  /**actor选项 */
  actorOptions?: Object
  /**轨迹线样式选项 */
  navLineOptions?: Object
  /**相机是否跟随 */
  cameraFollowing?: boolean

}