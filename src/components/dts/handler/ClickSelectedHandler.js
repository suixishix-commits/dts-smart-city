import DtsFacade from '../DtsFacade'
import bus from '@/utils/bus'
import ProjectDtsFacade from './ProjectDtsFacade'
import DtsSceneSwitchFacade from '@/api/feiduApi/DtsSceneSwitchFacade'
import router from '@/router'
import { setCameraOwn } from '@/api/feidu'
/**
 * 鼠标点击默认选中处理
 */
export default class ClickSelectedHandler {
  // 是否字段缩放
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
    bus.$on(this.clickHande)
  }

  /**
   * 取消注册场景左键点击事件处理器
   */
  static async unRegisteLeftMouseClickHandle() {
    bus.$off(this.clickHande)
  }

  /**
   * 事件处理器
   *
   * @param {*} e
   */
  static async clickHande(e) {
    // 还原上次选中
    this.restorePrevious()
    switch (e.Type) {
      case 'marker':
        if (this.autoZoom) {
          if (e.UserData) {
            // 判断Marker数据中是否有相机数据，有相机数据，则使用相机数据进行缩放
            let userData = JSON.parse(e.UserData)
            if (userData['camera']?.length > 1) {
              fdapi.camera.set(...userData['camera'])
            } else {
              fdapi.marker.focus(e.Id, 10)
            }
          } else {
            // fdapi.marker.focus(e.Id, 10)
          }
        }
        let resData = await fdapi.marker.get(e.Id)
        // 缓存数据
        if (resData?.data?.length > 0) {
          let obj = resData.data[0]
          // 更新选中状态
          let hoverImagePath = obj.hoverImagePath
          if (hoverImagePath.indexOf('_selected') !== -1) {
            this.previousSelectedObj.object = obj
            this.previousSelectedObj.imagePath = obj.imagePath
            this.previousSelectedObj.hoverImagePath = obj.hoverImagePath
            fdapi.marker.setImagePath(e.Id, hoverImagePath)
          }
        }
        if(e.Id==="jindu_4"){
          let path=window.location
          console.log('path:', path)
          if(path.hash==="#/ScheduleSubject/progressOverview"){
            router.push('progressSimulation')
          }else if(path.hash==="#/QualitySubject/qualityOverView"){
            setCameraOwn("导流洞正面")
            SwitchSceneFacade.switchToDiversionTunnelScene('Concrete')
          }
        }
        break
      case 'marker3d':
        if (this.autoZoom) {
          fdapi.marker3d.focus(e.Id, 50)
        }
        break
      case 'CustomObj':
        if (this.autoZoom) {
          fdapi.customObject.focus(e.Id, 50)
        }
        break
      case 'Polyline':
        if (this.autoZoom) {
          let resData = await fdapi.polyline.get(e.Id)
          //console.log('Polyline数据：', resData)
          if (resData?.data?.length > 0) {
            let obj = resData.data[0]
            let coord = obj.coordinates
            ProjectDtsFacade.focusByBBox(coord)
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
          fdapi.marker.setImagePath(id, this.previousSelectedObj.imagePath)
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
