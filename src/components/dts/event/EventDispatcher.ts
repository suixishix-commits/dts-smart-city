/**
 * Dts事件处理
 * Author:zhouxq
 */
import DtsFacade from '@/components/dts/DtsFacade'
import store from '@/stores/index'
import emitter from '@/utils/emitter'
import MittEvent from '@/utils/MittEvent'

export default class EventDispatcher {
  /**
   * DTS Ready事件
   * @param e 
   * @param context 
   */
  public static async onReady(e: any, context: any) {
    console.log('Dts初始化回调')
    // 重置场景
    if (gVar?.dtsCloud?.dtsResetNum > 0) {
      console.log('重置场景：', gVar.dtsCloud.dtsResetNum)
      await __xapi.reset(gVar.dtsCloud.dtsResetNum)
    }
    // 更新指南针位置
    if (gVar?.dtsCloud?.campass?.visible && e.playerId == '__xapi') {
      DtsFacade.updateCampassPostion()
    }

    // 双屏联动相机事件设置。主场景触发相机事件，次场不触发
    if (store?.dtsStore?.twinPlayerVisible) {
      __xapi.settings.setEnableCameraMovingEvent(true)
      // 更新场景2默认位置
      if (__xapi2?.isReady) {
        let res = await __xapi.camera.get()
        await __xapi2.camera.set(...res.camera)
      }
    } else {
      __xapi.settings.setEnableCameraMovingEvent(false)
    }

    //触发事件
    emitter.emit('SceneOnReady', new MittEvent('SceneOnReady', e))

    // 跳转到默认位置
    if (gVar?.defaultView) {
      await __xapi.camera.set(...gVar.defaultView)
    }
  }

  /**
   * DTS onEvent事件
   * @param e 
   * @param context 
   */
  public static async onEvent(e: any) {
    console.log('触发事件啦！', e)
    // 分发OnEvent事件
    emitter.emit(e.eventtype, e)

    //事件类型 参考交互事件类型枚举对象
    var eventType = e.eventtype
    //当前点击位置
    var objectLocation = e.MouseClickPoint
    switch (eventType) {
      //鼠标左键点击时触发此事件
      case 'LeftMouseButtonClick':
        emitter.emit('SceneLeftMouseClick', new MittEvent('SceneLeftMouseClick', e))
        if (e.Type === 'marker' && e.GroupID) {
          let api = DtsFacade.getDtsApi()
          let screenPoint = await api.coord.world2Screen(objectLocation[0], objectLocation[1], objectLocation[2])
          let markerObj = {
            type: 'marker',
            screenPoint: screenPoint.screenPosition,
            mouseClickPoint: [...objectLocation],
            id: e.Id,
            groupId: e.GroupID,
            userData: e.UserData,
            playerId: e.playerId
          }
          //判断e.UserData中disableHighligh=true，如果为true，不高亮
          // 场景自带的标注 userData 可能是普通字符串（如 "case-…"），不是 JSON：解析失败时按空对象处理，不打断事件派发
          let objUserData: any = {}
          try {
            objUserData = JSON.parse(markerObj.userData || '{}')
          } catch {
            objUserData = {}
          }
          let disableH = objUserData.disableHighligh || true
          console.log('场景左键点击信息:', disableH, markerObj, screenPoint)
          if (disableH != true) {
            await DtsFacade.highlightMarker(markerObj)
          }
          emitter.emit(e.GroupID, new MittEvent(e.GroupID, markerObj))
          console.log('已emit事件', e.GroupID)
        } else if (e.Type === 'marker3d' && e.GroupID) {
          let api = DtsFacade.getDtsApi()
          let screenPoint = await api.coord.world2Screen(objectLocation[0], objectLocation[1], objectLocation[2])
          let markerObj = {
            type: 'marker3d',
            screenPoint: screenPoint.screenPosition,
            mouseClickPoint: [...objectLocation],
            id: e.Id,
            groupId: e.GroupID,
            userData: e.UserData,
            playerId: e.playerId
          }
          emitter.emit(e.GroupID, new MittEvent(e.GroupID, markerObj))
        } else if (e.Type === 'CustomObj') {
          //高亮对象点击也要触发
          let strId = e.Id
          let api = DtsFacade.getDtsApi()
          let screenPoint = await api.coord.world2Screen(objectLocation[0], objectLocation[1], objectLocation[2])
          let markerObj = {
            type: 'CustomObj',
            screenPoint: screenPoint.screenPosition,
            mouseClickPoint: [...objectLocation],
            id: String(strId.split('-')[0]),
            groupId: e.GroupID,
            userData: e.UserData,
            playerId: e.playerId
          }
          emitter.emit(e.GroupID, new MittEvent(e.GroupID, markerObj))
        } else if (e.Type === 'Polyline') {
          let strId = e.Id
          let api = DtsFacade.getDtsApi()
          let screenPoint = await api.coord.world2Screen(objectLocation[0], objectLocation[1], objectLocation[2])
          let obj = {
            type: 'Polyline',
            screenPoint: screenPoint.screenPosition,
            mouseClickPoint: [...objectLocation],
            id: strId,
            groupId: e.GroupID,
            userData: e.UserData
          }
          if (e.GroupID) {
            emitter.emit(e.GroupID, new MittEvent(e.GroupID, obj))
          }
        }
        else if (e.Type === 'TileLayer' && e.PropertyName) {
          if (store.dtsStore.inPickUpInfoState) {
            emitter.emit('TileLayer_LeftClick', new MittEvent(e.Id, e))
          }
        }
        break
      //鼠标悬停时触发此事件
      //注意需提前开启鼠标拾取：__xapi.settings.setMousePickMask(7);
      case 'MouseHovered':
        break
      //鼠标移动时触发此事件
      //注意需提前开启鼠标拾取：__xapi.settings.setMousePickMask(7);
      case 'MouseMoved':
        break
      //相机开始移动时触发此监听事件
      //注意需先开启事件：__xapi.settings.setEnableCameraMovingEvent(true);
      case 'CameraStartMove':
        break
      //相机正在移动时触发此监听事件
      //注意需先开启事件：__xapi.settings.setEnableCameraMovingEvent(true);
      case 'CameraMoving':
        break
      //相机停止移动时触发此监听事件
      //注意需先开启事件：__xapi.settings.setEnableCameraMovingEvent(true);
      case 'CameraStopMove':
        break
      //对象执行focus()或相机执行set()/lookAt()/lookAtBBox()方法时触发
      case 'CameraChanged':
        console.log('CameraChanged触发了')
        break
      // Marker弹窗回调
      case 'MarkerCallBack':
        //console.log('maerker回调',e);
        emitter.emit('MarkerCallBack', new MittEvent('MarkerCallBack', e))
        break
      //进入面剖切模式，编辑面剖切位置后触发事件并返回剖切结果
      case 'PlaneClipEdit':
        break
      //进入体剖切模式，编辑体剖切位置后触发事件并返回剖切结果
      case 'VolumeClipEdit':
        break
      //进入测量模式后，测量完成时触发此事件并返回测量结果
      case 'Measurement':
        break
      //播放导览结束触发此事件
      //__xapi.camera.playAnimation(id)和导览对象播放导览结束__xapi.cameraTour.play(id)均触发此事件
      case 'CameraTourFinished':
        break
      case 'ExitWorldFinished':
        break
      default:
        ''
    }
    // 多屏连动
    if (store.dtsStore.twinPlayerVisible && e.eventtype.includes('Camera')) {
      emitter.emit('CameraEvent', e)
    }
  }
}
