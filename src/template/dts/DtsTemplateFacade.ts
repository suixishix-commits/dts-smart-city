import DtsFacade from "@/components/dts/DtsFacade"

/**
 * 模块工程方法静态类
 */
export default class DtsTemplateFacade {
  /**
   * 开闸放水切换
   * @param show 是否显示
   */
  public static toggleSluiceWaterFlow(show: boolean = true) {
    if (__xapi?.isReady) {
      if (show) {
        __xapi.camera.set(492706.689063, 2492008.843203, 72.053931, -42.869324, 101.457062)
        let tickUrl = gVar.dtsCloud.popupRootUrl + "/tick/sluice-water-flow-tick.html"
        console.log("开闸放水tickUrl：", tickUrl)
        __xapi.registerTick(tickUrl, {
          visible: false,  //是否显示调试窗口
          x: 50,          //调试窗口的位置
          y: 120,
          width: 460,     //调试窗口的尺寸
          height: 300
        })
      } else {
        // console.log("关闭开闸放水")
        __xapi.fluid.clear()
        __xapi.customObject.clear()
        __xapi.showTickWindow(false)
        __xapi.removeTick()
      }
    }
  }

}