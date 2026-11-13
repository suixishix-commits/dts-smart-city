import emitter from '@/utils/emitter'

/**
 * 多场景联动处理器
 * 
 * 监听CameraStartMove、CameraStopMove事件。
 * 
 * CameraChanged事件返回的相机位置非最新位置，为上次停留的位置
 * 
 */
export default class MultiSceneLinkageHandler {
  // 联动状态Map
  static linkageMap: any = {}
  // 参与联动的DTS实例
  static linkageInstance: any = []
  // 是否正在联动
  static isDuringLinkage: boolean = false
  // 引起联动的源实例ID
  static sourceInstanceId: any = undefined

  /**
   * 实例联动注册
   *
   * @param {*} instance 实例ID
   */
  public static register(instance: any) {
    if (instance instanceof Array && instance.length > 0) {
      console.log("多实例联动注册！")
      MultiSceneLinkageHandler.linkageInstance = instance
      MultiSceneLinkageHandler.isDuringLinkage = false
      instance.forEach((instance) => {
        let inst: any = window[instance]
        if (inst?.isReady) {
          inst.settings.setEnableCameraMovingEvent(true)
          console.log(`实例${instance}已初始化`)
        } else {
          console.log(`实例${instance}未初始化`)
        }
      })
      emitter.on('CameraEvent', MultiSceneLinkageHandler.cameraEventHandle)
      emitter.on('SceneOnReady', MultiSceneLinkageHandler.onReady)
    }

    // 设置相机事件监听
  }

  /**
   * 取消联动注册
   */
  public static unRegister() {
    console.log("多实例联动取消注册")
    emitter.off('CameraEvent', MultiSceneLinkageHandler.cameraEventHandle)
    emitter.off('SceneOnReady', MultiSceneLinkageHandler.onReady)
    if (MultiSceneLinkageHandler.linkageInstance instanceof Array && MultiSceneLinkageHandler.linkageInstance.length > 0) {
      MultiSceneLinkageHandler.linkageInstance.forEach((instance) => {
        let inst: any = window[instance]
        if (inst?.isReady) {
          inst.settings.setEnableCameraMovingEvent(false)
          inst.settings.setEnableInteract(true)
        }
      })
      MultiSceneLinkageHandler.isDuringLinkage = false
    }
  }

  /**
   * 相机事件处理
   *
   * @param {*} e
   */
  protected static async cameraEventHandle(e: any) {
    let arrInstance = MultiSceneLinkageHandler.linkageInstance
    //console.log(`MultiSceneLinkageHandler事件判别`, MultiSceneLinkageHandler.isDuringLinkage, e, arrInstance)
    // 如果是由联动引起的相机事件，忽略掉事件
    if (e.eventtype == 'CameraChanged' && MultiSceneLinkageHandler.linkageMap[e.playerId]) {
      MultiSceneLinkageHandler.linkageMap[e.playerId] = false
      return
    }

    // 仅当联源源实例为空时，且事件类型为CameraStartMove、CameraChanged时才开始联动
    if ((e.eventtype == 'CameraStartMove') && !MultiSceneLinkageHandler.sourceInstanceId) {
      //console.log(`多实例联动启动：${e.playerId},事件：${e.eventtype}`, e)
      MultiSceneLinkageHandler.sourceInstanceId = e.playerId
      // 联动中
      MultiSceneLinkageHandler.isDuringLinkage = true
      // 禁止其它实例鼠标交互
      MultiSceneLinkageHandler.setEnableInteract(MultiSceneLinkageHandler.sourceInstanceId, false)
    }

    // 联动判断退出条件
    if ((e.eventtype == 'CameraStopMove') && MultiSceneLinkageHandler.sourceInstanceId == e.playerId) {
      MultiSceneLinkageHandler.sourceInstanceId = undefined
      // 联动中
      MultiSceneLinkageHandler.isDuringLinkage = false
      // 启用其它实例鼠标交互
      MultiSceneLinkageHandler.setEnableInteract(MultiSceneLinkageHandler.sourceInstanceId, true)
      MultiSceneLinkageHandler.setCamera(e, e.playerId)
      //console.log(`多实例联动结束：${e.playerId},事件：${e.eventtype}`)
    }

    // 非源实例相机事件输出
    // if (MultiSceneLinkageHandler.sourceInstanceId && MultiSceneLinkageHandler.sourceInstanceId != e.playerId) {
    //   console.log(`非源实例${e.playerId}输出相机事件${e.eventtype}`, e)
    // }
  }

  // 设置除源实例之外的实例相机位置
  private static async setCamera(e: any, sourceInstanceId: any) {
    let arrInstance = MultiSceneLinkageHandler.linkageInstance
    if (arrInstance instanceof Array && arrInstance.length > 0) {
      arrInstance.forEach(async (instance, index) => {
        let inst: any = window[instance]
        if (inst?.isReady && instance != sourceInstanceId) {
          //console.log(`----实例${instance}设置相机位置`)
          // 设置该实例调用相机设置为tru，在cameraChanged事件中设成false，避免循环联动
          MultiSceneLinkageHandler.linkageMap[instance] = true
          inst.camera.set(e.Position[0], e.Position[1], e.Position[2], e.Pitch, e.Yaw, 0)
        }
      })
    }
  }

  /**
   * 设置除源实例之外的实例禁止交互
   * @param sourceInstanceId 源实例
   * @param enable 是否开启交互
   */
  private static async setEnableInteract(sourceInstanceId: any, enable: boolean) {
    let arrInstance = MultiSceneLinkageHandler.linkageInstance
    if (arrInstance instanceof Array && arrInstance.length > 0) {
      arrInstance.forEach(async (instance, index) => {
        let inst: any = window[instance]
        if (inst?.isReady && instance != sourceInstanceId) {
          //console.log(`----实例${instance}交互、相机移动事件设置为${enable}`)
          inst.settings.setEnableInteract(enable)
          inst.settings.setEnableCameraMovingEvent(enable)
        }
      })
    }
  }

  /**
   * 场景OnReady事件
   * @param e 
   */
  private static async onReady(mittEvent: any) {
    let e: any = mittEvent.data
    //console.log("MultiSceneLinkageHandler场景OnReady事件处理", e)
    let inst: any = window[e.playerId]
    if (inst?.isReady) {
      inst.settings.setEnableCameraMovingEvent(true)
      //console.log(`实例${e.playerId}已设置相机事件`)
    }
  }
}
