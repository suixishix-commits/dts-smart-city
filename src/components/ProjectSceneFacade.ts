import Show1 from "./flyingScript/Show1"
import DispatchCenter from "./rtlv/DispatchCenter"

/**
 * 项目级场景公共方法
 */
export default class ProjectSceneFacade {
  // WebSocket实时位置调度中心
  public static dispatchCenter: DispatchCenter | undefined
  // 数据类是否默认显示，接收到新对象时，如果为true,则在场景中创建新对象
  private static visibleOption: any = {
    Uav: true, //无人机    
  }

  // 飞行脚本示例1
  static show1: Show1 | null = null

  public static getDtsApi(): any {
  }

  /**
   * 开启无人机实时位置监控
   * 
   * 请连接217服务器上的Cloud,或将无人机PAK资源拷贝到Cloud服务器上。
   */
  public static startMonitor(): any {
    // 如果存在旧的dispatchCenter，先停止并清空
    if (ProjectSceneFacade.dispatchCenter) {
      ProjectSceneFacade.dispatchCenter.stop()
      ProjectSceneFacade.dispatchCenter = undefined
    }
    // 创建新的dispatchCenter实例
    ProjectSceneFacade.dispatchCenter = new DispatchCenter({ visibleOption: this.visibleOption })
    ProjectSceneFacade.dispatchCenter.play()
    window.dispatchCenter = ProjectSceneFacade.dispatchCenter
  }

  /**
   * 停止无人机实时位置监控
   */
  public static stopMonitor(): any {
    if (ProjectSceneFacade.dispatchCenter) {
      ProjectSceneFacade.dispatchCenter.stop()
      ProjectSceneFacade.dispatchCenter = undefined
    }
  }

  /**
   * 开启相机导览播放
   */
  public static startScenePlayer(): any {
    if (!this.show1) {
      this.show1 = new Show1()
      this.show1.play()
    } else {
      this.show1.play()
    }
  }

  /**
   * 停止相机导览播放
   */
  public static stopScenePlayer(): any {
    if (this.show1) {
      this.show1.stop()
      this.show1 = null
    }
  }

}
