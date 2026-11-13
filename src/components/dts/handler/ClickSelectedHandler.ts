import DtsFacade from '../DtsFacade'

/**
 * 鼠标点击默认选中处理
 *
 * 在OnEvent事件中调用ClickSelectedHandler.clickHande(e)
 * if (e.Type === 'marker' || e.Type === 'marker3d' || e.Type === 'CustomObj' || e.Type === 'Polyline') {
 *     ClickSelectedHandler.clickHande(e)      
 * }
 *
 */
export default class ClickSelectedHandler {
  // 是否自动缩放
  static autoZoom = true

  /**
   * 上次选中对象
   */
  static previousSelectedObj = {
    type: '', //类型
    objectId: '', //对象ID
    imagePath: '', //图片地址
    hoverImagePath: '', //悬浮图片地址
    object: null //上次选中对象
  }

  /**
   * 注册场景左键点击事件处理器
   */
  static async registerLeftMouseClickHandle(autoZoom = true) {
    this.autoZoom = autoZoom
  }

  /**
   * 取消注册场景左键点击事件处理器
   */
  static async unRegisteLeftMouseClickHandle() {
  }

  /**
   * 事件处理器
   *
   * @param {*} e
   */
  static async clickHande(e: any) {
    console.log('调用ClickSelectedHandler.clickHande', e, this.autoZoom)
    // 还原上次选中
    this.restorePrevious()
    switch (e.Type) {
      case 'marker':
        if (this.autoZoom) {
          if (e.UserData) {
            // 判断Marker数据中是否有相机数据，有相机数据，则使用相机数据进行缩放
            let userData = JSON.parse(e.UserData)
            if (userData['camera']?.length > 1) {
              __xapi.camera.set(...userData['camera'])
            } else {
              __xapi.marker.focus(e.Id, 10)
            }
          } else {
            __xapi.marker.focus(e.Id, 2)
          }
        }
        let resData = await __xapi.marker.get(e.Id)
        // 缓存数据
        if (resData?.data?.length > 0) {
          let obj = resData.data[0]
          // 更新选中状态
          let hoverImagePath = obj.hoverImagePath
          if (hoverImagePath.indexOf('_selected') !== -1) {
            this.previousSelectedObj.object = obj
            this.previousSelectedObj.imagePath = obj.imagePath
            this.previousSelectedObj.hoverImagePath = obj.hoverImagePath
            __xapi.marker.setImagePath(e.Id, hoverImagePath)
          }
        }
        break
      case 'marker3d':
        if (this.autoZoom) {
          __xapi.marker3d.focus(e.Id, 50)
        }
        break
      case 'CustomObj':
        if (this.autoZoom) {
          __xapi.customObject.focus(e.Id, 50)
        }
        break
      case 'Polyline':
        if (this.autoZoom) {
          let resData = await __xapi.polyline.get(e.Id)
          //console.log('Polyline数据：', resData)
          if (resData?.data?.length > 0) {
            let obj = resData.data[0]
            let coord = obj.coordinates
            DtsFacade.focusByBBox(coord)
          }
        }
        break
      default:
        break
    }
    this.previousSelectedObj.type = e.Type
    this.previousSelectedObj.objectId = e.Id
    //console.log('收到场景左键点击事件啦！-SelectedHandler', e, this.previousSelectedObj)
  }

  /**
   * 还原上一个选中对象
   */
  static async restorePrevious() {
    switch (this.previousSelectedObj.type) {
      case 'marker':
        // 如果上次marker对象的图片地址及悬浮图片地址不为空，则还原
        if (this.previousSelectedObj.objectId && this.previousSelectedObj.imagePath && this.previousSelectedObj.hoverImagePath) {
          let id = this.previousSelectedObj.objectId
          __xapi.marker.setImagePath(id, this.previousSelectedObj.imagePath)
          this.previousSelectedObj = {
            type: '', //类型
            objectId: '', //对象ID
            imagePath: '', //图片地址
            hoverImagePath: '', //悬浮图片地址
            object: null //上次选中对象
          }
          console.log(`已还原${id} Marker对象`)
        }
        break
      default:
        break
    }
  }
}
