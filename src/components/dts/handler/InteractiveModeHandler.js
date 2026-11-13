import emitter from '@/utils/emitter.ts'

/**
 * 场景交互处理器
 *
 * 常用于第三人称、无人机交互
 *
 * 使用方法：
 * 先调用registerListener后，再调用setInteractiveMode即可
 */
export default class InteractiveModeHandler {
  // 当前交互模式。【0：漫游，1：人物，2：无人机，3：中心漫游（物体观察），4：地图】
  static interactiveMode = 0
  // 是否添加了监听事件
  static hasRegisterListener = false

  /**
   * 注册监听事件
   *
   * 监听交互指令
   */
  static registerListener() {
    emitter.off('LeftMouseButtonClick', this.leftMouseButtonClickHandle)
    emitter.on('LeftMouseButtonClick', this.leftMouseButtonClickHandle)
    InteractiveModeHandler.hasRegisterListener = true
  }

  /**
   * 取消监听
   */
  static unRegisterListener() {
    emitter.off('LeftMouseButtonClick', this.leftMouseButtonClickHandle)
    InteractiveModeHandler.hasRegisterListener = false
  }

  /**
   * 场景鼠标点击
   *
   * @param {*} e
   */
  static async leftMouseButtonClickHandle(e) {
    // 点击点坐标
    const clickCoord = e.MouseClickPoint
    const mode = sessionStorage.getItem('InteractiveMode')
    switch (mode) {
      case '1': //人物
        // 当前相机位置
        const { camera } = await __xapi.camera.get()
        // 第三人称，距离设置为3，第一人称，距离设置为0
        //__xapi.settingsPanel.setControlMode(1, 0.5, true, true)
        __xapi.settings.setCharacterRoaming(clickCoord, camera.splice(3), 3)
        // 关闭屏幕控制
        __xapi.settings.setScreenControlsVisible(false)
        // 开启鼠标拾取
        __xapi.settings.setMousePickMask(1)
        console.log('执行第三人称模式')
        break
      default:
        break
    }
  }

  /**
   * 设置交互模式
   * @param mode 五种交互模式，
   *
   * 默认值：0；【0：漫游，1：人物，2：无人机，3：中心漫游（物体观察），4：地图】
   */
  static setInteractiveMode(mode) {
    if (InteractiveModeHandler.hasRegisterListener) {
      InteractiveModeHandler.interactiveMode = mode
      sessionStorage.setItem('InteractiveMode', mode)
      if (__xapi?.isReady) {
        switch (mode) {
          case 1: // 第三人称
            console.log('[InteractiveModeHandler]请点击场景，选取着落点')
            break
          case 2: //无人机
            __xapi.settings.setInteractiveMode(mode)
            // 关闭屏幕控制
            __xapi.settings.setScreenControlsVisible(false)
            // 开启鼠标拾取
            __xapi.settings.setMousePickMask(1)
            break
          default:
            if (mode < 0 && mode > 4) {
              __xapi.settings.setInteractiveMode(0)
            } else {
              __xapi.settings.setInteractiveMode(mode)
            }
            break
        }
      }
    } else {
      console.log('请先调用registerListener方法进行事件监听')
    }
  }
}
