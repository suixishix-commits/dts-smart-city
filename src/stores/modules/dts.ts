import LocalStorage from '@/utils/LocalStorage'
import SessionStorage from '@/utils/SessionStorage'
import { defineStore } from 'pinia'

export const dtsStore = defineStore('dtsStore', {
  state: () => ({
    // DigitalTwinAPI
    dtApi: undefined,
    infoTree: undefined,
    infoTreeMap: undefined,
    hasSetFog: undefined,
    defaultPostProcessMode: null, //后期面板参数
    twinPlayerVisible: false,//镜像场景是否显示
    xRayLayerIds: LocalStorage.getItem('XRayLayer'), //X光图层ID列表
    hiddenLayer: [], //隐藏的图层，但清空时，又要显示的图层
    displayLayer: [], //显示的图层，但清空时，又要隐藏的图层
    /** 是否处于 TileLayer 信息拾取状态（为 true 时 EventDispatcher 会派发 TileLayer_LeftClick） */
    inPickUpInfoState: false
  }),
  persist: {
    storage: sessionStorage,
    paths: ['infoTree', 'infoTreeMap', 'twinPlayerVisible'],
    debug: false
  },
  getters: {},
  actions: {
    pushXRayLayer(layerIds: any) {
      if (layerIds) {
        layerIds.forEach((value: any, index: any) => {
          if (this.xRayLayerIds.indexOf(value) < 0) {
            this.xRayLayerIds.push(value)
          }
        })
        LocalStorage.setItem('XRayLayer', this.xRayLayerIds)
      }
    },
    deleteXRayLayer(layerIds: any) {
      if (layerIds) {
        layerIds.forEach((value: any, index: any) => {
          let i = this.xRayLayerIds.indexOf(value)
          if (i > -1) {
            this.xRayLayerIds.splice(i, 1)
          }
        })
        LocalStorage.setItem('XRayLayer', this.xRayLayerIds)
      }
    },
    clearXRayLayer() {
      LocalStorage.setItem('XRayLayer', new Array())
    },
    showLayer(layerIds: any) {
      let showArr = SessionStorage.getItem('showLayer') || []
      let hideArr = SessionStorage.getItem('hideLayer') || []
      if (layerIds) {
        layerIds.forEach((value: any) => {
          if (!showArr.includes(value)) {
            showArr.push(value)
          }
          if (hideArr.includes(value)) {
            hideArr = hideArr.filter((item: any) => item !== value)
          }
        })
        SessionStorage.setItem('showLayer', showArr)
        SessionStorage.setItem('hideLayer', hideArr)
      }
    },
    hideLayer(layerIds: any) {
      let showArr = SessionStorage.getItem('showLayer') || []
      let hideArr = SessionStorage.getItem('hideLayer') || []
      if (layerIds) {
        layerIds.forEach((value: any) => {
          if (showArr.includes(value)) {
            showArr = showArr.filter((item: any) => item !== value)
          }
          if (!hideArr.includes(value)) {
            hideArr.push(value)
          }
        })
        SessionStorage.setItem('showLayer', showArr)
        SessionStorage.setItem('hideLayer', hideArr)
      }
    },
    restoreLayer() {
      let showArr = SessionStorage.getItem('showLayer') || []
      let hideArr = SessionStorage.getItem('hideLayer') || []
    }
  }
})

export default dtsStore