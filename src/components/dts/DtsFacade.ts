/** 
 * DTS API包装工具
 * 
 * Author:zhouxq
 */
import store from '@/stores'
import RandomUtil from '@/utils/RandomUtil'
import TimeUtil from '@/utils/TimeUtil'
import { ElMessage } from 'element-plus'
import proj4 from 'proj4'
import DtsConverter from './DtsConverter'

export default class DtsFacade {
  /**用于保存场景绘制的各种对象 */
  private static dtsMap: Map<string, any> = new Map()
  //后期参数
  private static defaultPostProcessMode: any = null
  //后期参数--对比度
  private static defaultPMode_contrast: any = { contrast: 1.1 }
  /**
   * 高亮对象
   * [{id:'m1',type:'marker',highlightType:'marker3D',highlightId:'marker_highlight'}]
   */
  private static highlights: any[] = []
  /**相机调用计数 */
  private static cameraCount = 0

  public static getPlayer() {
    const api = this.getDtsApi()
    if (api) {
      return api.getPlayer()
    }
  }

  /**
   * Dts场景API对象
   *
   * @returns
   */
  public static getDtsApi(): any {
    if (__xapi.isReady) {
      return __xapi
    } else {
      console.error('DTS场景API未实例化!')
      return null
      // throw new Error('DTS场景API未实例化!')
    }
  }

  /**
   * 播放下雨效果
   *
   * @param strength 雨强度
   * @param speed 雨速度
   * @param raindropSize 雨滴大小
   * @param duration 多少秒后自动停止
   */
  public static async playRain(
    strength: number = 0.1, //[0-1]
    speed: number = 0.12, //[0-10]
    raindropSize: number = 0.6, //[0-5]
    duration: number = 10,
    fogDensity: number = 0, //[0-1]
    fogGroundDensity: number = 0.01, //[0-1]
    fogGroundHeight: number = 10, //[0-10]
    fogRange: number = 0.1 //[0-1]
  ) {
    const dtsApi = __xapi
    console.log(dtsApi)
    //dtsApi.weather.setDateTime(2023, 2, 19, 9, 30, false)

    //dtsApi.weather.setFogParam(fogDensity, fogGroundDensity, fogGroundHeight, fogRange, null)
    //store.dtsStore.hasSetFog = true
    dtsApi.weather.setRainParam(strength, speed, raindropSize, null)

    if (duration != -1) {
      setTimeout(() => {
        console.log('雨自动停了')
        this.stopRain()
      }, duration * 1000)
    }
  }

  /**设置工程后期环境参数 */
  public static async setPostProcessMode(options: any = null) {
    if (options) {
      let ppm = await this.getPostProcessMode()
      ppm = { ...ppm, ...options }
      const dtsApi = this.getDtsApi()
      console.log('设置环境参数')
      await dtsApi.settingsPanel.setPostProcessMode(ppm)
    }
  }

  /**获取工程后期环境参数 */
  public static async getPostProcessMode() {
    if (!this.defaultPostProcessMode || !this.defaultPostProcessMode.hasOwnProperty('contrast')) {
      const dtsApi = this.getDtsApi()
      const ppm = await dtsApi.settingsPanel.getPostProcessMode()
      store.dtsStore.defaultPostProcessMode = ppm
      this.defaultPostProcessMode = { ...ppm }
    }
    return { ...this.defaultPostProcessMode }
  }

  /**
   * 停止雨雪
   */
  public static async stopRain() {
    const dtsApi = __xapi
    if (dtsApi) {
      //dtsApi.weather.setDateTime(2023, 2, 19, 9, 30, false)
      //dtsApi.weather.setFogParam(0, [1, 1, 1, 1], 0, 0, null)
      //store.dtsStore.hasSetFog = false
      dtsApi.weather.disableRainSnow(null)
    }
  }

  /**
   * 关闭雾
   */
  public static async closeFog() {
    const dtsApi = __xapi
    dtsApi.weather.setFogParam(0, [1, 1, 1, 1], 0, 0, 0)
    store.dtsStore.hasSetFog = false
  }

  /**设置黑暗模式 */
  public static async setDarkMode(bDark: boolean = true) {
    const dtsApi = this.getDtsApi()
    if (dtsApi) {
      dtsApi.weather.setDarkMode(bDark)
    }
  }

  /**
   * 获取图层树信息，并缓存
   */
  public static async getLayerTree() {
    const dtsApi = __xapi
    if (!store.dtsStore?.infoTree) {
      await dtsApi.infoTree.get().then((reponse: any) => {
        if (reponse.resultMessage == 'OK' && reponse?.infotree) {
          const infotree = reponse.infotree
          store.dtsStore.infoTree = JSON.parse(JSON.stringify(infotree))
          if (infotree.length > 0) {
            const nameMap: any = {}
            infotree.forEach((item: any) => {
              nameMap[item.name] = item
            })
            store.dtsStore.infoTreeMap = nameMap
            console.log('图层树缓存成功!', infotree, nameMap)
          }
        }
        //console.log('图层树缓存...', reponse, store.dtsStore);
      })
    } else {
      console.log('图层树已缓存,未调用API!');
    }
  }

  /**
   * 根据图层名称获取图层ID
   * @param layerNames 图层中文名称
   * @returns
   */
  public static getLayerId(layerNames: String | Array<String>, filterNull: boolean = false) {
    const infoTreeMap = store.dtsStore.infoTreeMap
    // console.log('图层树缓存...', infoTreeMap);
    const result = new Array()
    let arrLayerName = new Array()

    if (typeof layerNames == 'string') {
      arrLayerName = Array.of(layerNames)
    } else {
      arrLayerName = Array.from(layerNames)
    }
    if (arrLayerName && infoTreeMap) {
      arrLayerName.forEach(item => {
        const layerInfo = infoTreeMap[item]
        if (layerInfo) {
          result.push(layerInfo.iD)
        } else {
          if (!filterNull) {
            result.push('');
          }
        }
      })
    }
    return result
  }

  /**
   * 根据图层的名称进行显/隐
   * @param layerNames 图层中文名称
   * @param visible 显示或隐藏
   */
  public static async layerSwitch(layerNames: String | Array<String>, visible: boolean = true) {
    const dtsApi = __xapi
    const layers = await this.getLayerId(layerNames)
    console.log('图层显隐：' + layers.join(',') + ':' + visible)
    if (dtsApi && layers?.length > 0) {
      if (visible) {
        await dtsApi.infoTree.show(layers, null)
        store.dtsStore.showLayer(layers)
      } else {
        await dtsApi.infoTree.hide(layers, null)
        store.dtsStore.hideLayer(layers)
      }
    }
  }

  /**
   * 根据图层的ID进行显/隐
   * @param layerNames 图层中文名称
   * @param visible 显示或隐藏
   */
  public static async layerSwitchById(layerIds: String | Array<String>, visible: boolean = true) {
    const dtsApi = __xapi
    console.log('图层显隐', layerIds, visible)
    if (typeof layerIds == 'string') {
      layerIds = [layerIds]
    }
    if (visible) {
      dtsApi.infoTree.show(layerIds, null)
      store.dtsStore.showLayer(layerIds)
    } else {
      dtsApi.infoTree.hide(layerIds, null)
      store.dtsStore.hideLayer(layerIds)
    }
  }

  /**
   * 相机位置调用
   * 
   * @param view 
   */
  static async setCamera(view: any, comments: string = '') {
    if (Array.isArray(view) && view.length > 0 && __xapi?.isReady) {
      await __xapi.camera.set(...view)
      DtsFacade.cameraCount++
    }
    console.log(`调用DtsFacade.setCamera统一相机定位方法--《${comments}》：`, view)
  }

  /**
   * 获取相机视角
   *
   */
  public static async getCamera() {
    const dtApi = __xapi
    const view = await dtApi.camera.get()
    return [...view.camera]
  }

  /**
   *撒点
   *
   * @param markers 单点或多点
   * eg:[{id:'m1',text:'',groupId:'group1',coordinate:[],userData:'']
   * eg:可以根据坐标数组调用buildGeoInfo方法生成该方法
   * @param autoZoom 是否自动缩放
   * @param style 样式定义
   * @calculateZ 是否计算Z，默认false
   * @autoDisplayPopup 默认显示弹窗，默认false
   * eg:{pointName:'',textSize:32,textColor:'#6BF4F7'}]
   *
   */
  public static async addMarker(
    markers: Object | [],
    autoZoom: boolean = false,
    style: any = null,
    calculateZ = false,
    autoDisplayPopup = false,
    clear = true
  ) {
    let arrObjects: any = []
    if (markers?.constructor === Object && Reflect.has(markers, 'id')) {
      arrObjects = Array.of(markers)
    } else if (markers?.constructor === Array && markers.length > 0 && Reflect.has((markers as Array<any>)[0], 'id')) {
      arrObjects = markers
    } else {
      console.info('数据格式有误')
      //throw new Error('数据格式有误')
    }
    const arrResult: any = new Array()
    const defalutStyle = {
      id: 'm2',
      groupId: 'def_gp_marker',
      coordinate: [492719.9375, 2491832.5], //坐标位置 自动高度开启可以不给坐标高度z 标注可以定位到下方物体上
      coordinateType: 0, //默认0是投影坐标系，也可以设置为经纬度空间坐标系值为1
      anchors: [-15, 30], //锚点，设置Marker的整体偏移，取值规则和imageSize设置的宽高有关，图片的左上角会对准标注点的坐标位置。示例设置规则：x=-imageSize.width/2，y=imageSize.height
      imageSize: [30, 30], //图片的尺寸
      hoverImageSize: [30, 30], //鼠标悬停时显示的图片尺寸
      range: [1, 1000000], //可视范围
      //imagePath: '@path:poi/demo.png', //显示图片路径
      //hoverImagePath: '@path:poi/demo_hover.png', // 鼠标悬停时显示的图片路径
      imagePath: '@path:poi/demo.png', //显示图片路径
      hoverImagePath: '@path:poi/demo_hover.png', // 鼠标悬停时显示的图片路径
      fixedSize: true, //图片固定尺寸，取值范围：false 自适应，近大远小，true 固定尺寸，默认值：false

      text: '招商银行', //显示的文字
      useTextAnimation: false, //关闭文字展开动画效果 打开会影响效率
      textRange: [1, 2000], //文本可视范围[近裁距离, 远裁距离]
      textOffset: [0, 0], // 文本偏移
      textBackgroundColor: [1, 1, 1, 0.85], //文本背景颜色
      fontSize: 14, //字体大小
      //fontOutlineSize: 1, //字体轮廓线大小
      //fontColor: Color.White, //字体颜色
      //fontOutlineColor: Color.Black, //字体轮廓线颜色

      //popupURL: '@path:samples/popup/chart.html', //弹窗HTML链接
      //popupBackgroundColor: [1.0, 1.0, 1.0, 0.5], //弹窗背景颜色
      //popupSize: [600, 600], //弹窗大小
      //popupOffset: [0, 0], //弹窗偏移
      //autoHidePopupWindow: true, //失去焦点后是否自动关闭弹出窗口

      showLine: true, //标注点下方是否显示垂直牵引线
      lineSize: [2, 30], //垂直牵引线宽度和高度[width, height]
      lineColor: [1, 1, 1, 0.85], //垂直牵引线颜色
      lineOffset: [15, 0], //垂直牵引线偏移，x=imageSize.width/2

      autoHeight: false, // 自动判断下方是否有物体
      displayMode: 1, // 智能显示模式: 根据当前相机高度自动适配以上模式，类似金字塔lod加载效果，内置规则:range范围的1%内取值2，1%至10%取值1，大于10%取值0
      autoDisplayModeSwitchFirstRatio: 0.01, //智能模式时的显示模式切换时range参数的首段比例，仅在displayMode=4时生效，取值范围：[0.01~1.0)，默认值0.01，示例：如果range=[1,1000]，则在[1,10]范围内dislayMode=2
      autoDisplayModeSwitchSecondRatio: 0.1, //智能模式时的显示模式切换时range参数的第二段比例，仅在displayMode=4时生效，取值范围：[0.01~1.0)，默认值0.1，示例：如果range=[1,1000]，则在[10,100]范围内dislayMode=1，大于100则dislayMode=1
      clusterByImage: true, // 聚合时是否根据图片路径分类，即当多个marker的imagePath路径参数相同时按路径对marker分类聚合
      priority: 0, //避让优先级
      occlusionCull: true //是否参与遮挡剔除
    }

    if (style) {
      style = { ...defalutStyle, ...style }
    } else {
      style = defalutStyle
    }
    const ids = new Array()
    arrObjects.forEach((value: any) => {
      value.groupId = value.groupId ? value.groupId : 'def_gp_marker'
      value.userData = value.userData ? value.userData : JSON.stringify(value)
      ids.push(value.id)
      arrResult.push({ ...style, ...value })
    })

    //自动计算高度
    if (calculateZ) {
      await DtsFacade.getZ(arrResult)
      console.log('计算高度')
    }

    console.log('-----addMarker---', arrResult)

    const dtsApi = this.getDtsApi()
    if (clear) {
      await dtsApi.marker.clear()
    }
    dtsApi.marker.delete(ids).then(async () => {
      dtsApi.marker.add(arrResult, () => {
        if (autoZoom) {
          if (ids.length == 1) {
            dtsApi.marker.focus(ids, 500)
          } else {
            dtsApi.marker.focus(ids)
          }
        }
        if (autoDisplayPopup) {
          dtsApi.marker.showAllPopupWindow()
        }
      })
    })
    return ids
  }

  /**
   *添加动态效果Marker点
   *
   * @param marker3Ds 单点或多点
   * eg:[{id:'m1',text:'',groupId:'group1',coordinate:[],userData:'']
   * eg:可以根据坐标数组调用buildGeoInfo方法生成该方法
   * @param autoZoom 是否自动缩放
   * @param style 样式定义
   * eg:{pointName:'',textSize:32,textColor:'#6BF4F7'}]
   *
   */
  public static addMarker3D(marker3Ds: Object | [], autoZoom: boolean = false, style: any = null): Array<string> {
    let arrObjects
    if (marker3Ds?.constructor === Object && Reflect.has(marker3Ds, 'id')) {
      arrObjects = Array.of(marker3Ds)
    } else if (marker3Ds?.constructor === Array && marker3Ds.length > 0 && Reflect.has((marker3Ds as Array<any>)[0], 'id')) {
      arrObjects = marker3Ds
    } else {
      throw new Error('数据格式有误')
    }
    const arrResult: any = new Array()
    const defalutStyle = {
      textSize: 32, //3D标注显示文字大小
      textColor: '#6BF4F7', //3D标注显示文字颜色
      textOutlineSize: 0, //3D标注显示文字轮廓大小
      textOutlineColor: Color.Black, // 3D标注显示文字轮廓颜色
      textFixed: false, // 3D标注显示文字是否固定文本朝向
      textVisible: true, //3D标注显示文字是否显示文本
      textLocation: [0, 0, 0], // 文字位置
      textRotation: [0, 90, 0], // 文字旋转
      textScale: [1, 1, 1], // 文字缩放
      pointName: 'Point_B_5', //3D标注展示的特效名称
      pointVisible: true, //3D标注是否显示
      pointScale: 5, //3D标注整体缩放比例
      coordinateType: 0, //坐标系类型
      range: [1, 100000], //3D标注的可视距离范围：[min,max]，单位：米
      autoHeight: false //自动判断下方是否有物体，设置正确高度，默认值：false
    }
    console.log('-----addMarker3D---')
    if (style) {
      style = { ...defalutStyle, ...style }
    } else {
      style = defalutStyle
    }
    const ids = new Array()
    arrObjects.forEach((value: any, index) => {
      value.groupId = value.groupId ? value.groupId : 'def_gp_marker3d'
      value.userData = value.userData ? value.userData : JSON.stringify(value)
      ids.push(value.id)
      arrResult.push({ ...style, ...value })
    })

    console.log(arrResult)
    const dtsApi = this.getDtsApi()
    dtsApi.marker3d.clear().then(() => {
      dtsApi.marker3d.add(arrResult, () => {
        if (autoZoom) {
          if (ids.length == 1) {
            dtsApi.marker3d.focus(ids, 500)
          } else {
            dtsApi.marker3d.focus(ids)
          }
        }
      })
    })

    return ids
  }

  /**
   * 调整TileLayer图层的位置
   * @param originalLocation 初始坐标
   * @param x
   * @param y
   * @param z
   */
  public static async setTileLayerLocation(layerName: string, originalLocation: any, x: any = null, y: any = null, z: any = null) {
    const dtsApi = this.getDtsApi()
    const arrIds = this.getLayerId(layerName)
    const layerId = arrIds ? arrIds[0] : null
    if (layerId) {
      if (!originalLocation) {
        originalLocation = new Array(3)
      } else {
        originalLocation[0] = Number(originalLocation[0])
        originalLocation[1] = Number(originalLocation[1])
        originalLocation[2] = Number(originalLocation[2])
      }
      if (x && x?.constructor === Number) {
        originalLocation[0] = x
      }
      if (y && y?.constructor === Number) {
        originalLocation[1] = y
      }
      if (z && z?.constructor === Number) {
        originalLocation[2] = z
      }
      //console.log('修改' + layerName + '图层的坐标：', originalLocation, x, y, z)
      if (layerId && originalLocation?.length == 3) {
        dtsApi.tileLayer.setLocation(layerId, originalLocation)
      }
    } else {
      ElMessage('没有找到图层:' + layerName)
    }
  }

  /**
   * 调整TileLayer图层的位置
   * @param originalLocation 初始坐标
   * @param x
   * @param y
   * @param z
   */
  public static async setTileLayerLocationById(layerId: string, originalLocation: any, x: any = null, y: any = null, z: any = null) {
    const dtsApi = this.getDtsApi()
    if (layerId) {
      if (!originalLocation) {
        originalLocation = new Array(3)
      } else {
        originalLocation[0] = Number(originalLocation[0])
        originalLocation[1] = Number(originalLocation[1])
        originalLocation[2] = Number(originalLocation[2])
      }
      if (x && x?.constructor === Number) {
        originalLocation[0] = x
      }
      if (y && y?.constructor === Number) {
        originalLocation[1] = y
      }
      if (z && z?.constructor === Number) {
        originalLocation[2] = z
      }
      //console.log('修改' + layerName + '图层的坐标：', originalLocation, x, y, z)
      if (layerId && originalLocation?.length == 3) {
        dtsApi.tileLayer.setLocation(layerId, originalLocation)
      }
    } else {
      ElMessage('图层ID不能为空')
    }
  }

  /**
   * 调整TileLayer图层的位置
   * @param originalLocation 初始坐标
   * @param x
   * @param y
   * @param z
   */
  public static async setLayerLocation(layerId: string, location: Array<Number>) {
    const dtsApi = this.getDtsApi()
    if (layerId && location?.length == 3) {
      dtsApi.tileLayer.setLocation(layerId, location)
    } else {
      console.log('设置图层位置失败！', layerId, location)
      ElMessage('图层ID不能为空')
    }
  }

  /**
   * 获取图层坐标
   * @param layerName 图层中文名称
   */
  public static async getTileLayerLocation(layerName: string) {
    const dtsApi = this.getDtsApi()
    const arrIds = this.getLayerId(layerName)
    const layerId = arrIds ? arrIds[0] : null
    if (layerId) {
      const info = await dtsApi.tileLayer.get(layerId)
      const originalLocation = info ? info.data[0].location : null
      return originalLocation
    } else {
      return null
    }
  }

  /**
   * 清空场景对象
   */
  public static async clear() {
    const dtsApi = this.getDtsApi()
    if (dtsApi) {
      dtsApi.marker3d.clear()
      dtsApi.marker.clear()
      dtsApi.heatmap.clear()
      dtsApi.heatmap3d.clear()
      dtsApi.customObject.clear()
      dtsApi.polygon3d.clear()
      dtsApi.polygon.clear()
      dtsApi.polyline.clear()
      dtsApi.customMesh.clear()
      dtsApi.finiteElement.clear()
      dtsApi.fluid.clear()
      // 替代上述N个通过接口添加的对象
      // dtsApi.reset(1)
      //dtsApi.tools.stopMeasurement()
      //关闭所以交互并开启鼠标点击
      //dtsApi.settings.setMousePickMask(1)
      //早上9点
      //let now = new Date()
      //await dtsApi.weather.setDateTime(now.getFullYear(), now.getMonth() + 1, now.getDay(), 9, 1, false)
      //关闭雨雪雾
      //dtsApi.weather.setFogParam(0, 0, 0, 0, null)
      // if (store.dtsStore.hasSetFog) {
      // 	store.dtsStore.hasSetFog = false
      // }
      //await dtsApi.weather.disableRainSnow()      
    }
  }

  /**
   *清空对象
   * @param type 类型 {polygon3d}
   * @param ids
   */
  public static clearByClass(type: string) {
    const dtsApi = this.getDtsApi()
    switch (type) {
      case 'polygon3d':
        dtsApi.polygon3d.clear()
        break
      case 'polygon':
        dtsApi.polygon.clear()
        break
      case 'camera_tour':
        dtsApi.polygon.clear()
        break
      case 'polyline':
        dtsApi.polyline.clear()
        break
      case 'marker':
        dtsApi.marker.clear()
        break
      case 'marker3d':
        dtsApi.marker3d.clear()
        break
      case 'co':
        dtsApi.customObject.clear()
        break
      case 'mesh':
        dtsApi.customMesh.clear()
      default:
        break
    }
  }

  /**
   *删除对象
   * @param type 类型 {polygon3d}
   * @param ids
   */
  public static delete(type: string, ids: string | Array<string>) {
    const dtsApi = this.getDtsApi()
    switch (type) {
      case 'polygon3d':
        dtsApi.polygon3d.delete(ids, null)
        break
      case 'polygon':
        dtsApi.polygon.delete(ids, null)
        break
      case 'camera_tour':
        dtsApi.polygon.delete(ids, null)
        break
      case 'polyline':
        dtsApi.polyline.delete(ids, null)
        break
      case 'marker':
        dtsApi.marker.delete(ids, null)
        break
      case 'marker3d':
        dtsApi.marker3d.delete(ids, null)
        break
      case 'co':
        dtsApi.customObject.delete(ids, null)
        break
      case 'mesh':
        dtsApi.customMesh.delete(ids, null)
      default:
        break
    }
  }

  /**
   * 图层定位
   * type 类型
   * ids  图层id
   * distance 可视距离
   * flyTime  相机移动时长
   * rotation  相机旋转的旋转角度
   */
  public static focus(type: string, ids: string | Array<string>, distance: number, flyTime: number, rotation: Number[] = []) {
    const dtsApi = this.getDtsApi()
    switch (type) {
      case 'polygon':
        console.log('focus-polygon', ids)
        if (rotation?.length > 0) {
          dtsApi.polygon.focus(ids, distance, flyTime, rotation)
        } else {
          dtsApi.polygon.focus(ids, distance, flyTime)
        }
        break
      case 'marker3d': {
        dtsApi.marker3d.focus(ids, distance, flyTime)
      }
      case 'marker': {
        dtsApi.marker.focus(ids, distance, flyTime)
      }
      case 'co': {
        //高亮
        dtsApi.customObject.focus(ids, distance, flyTime)
      }
      case 'tileLayer': {
        //bim树图层类
        dtsApi.tileLayer.focus(ids, distance, flyTime)
      }
      default:
        break
    }
  }

  /**
   * 隐藏对象
   * @param type 类型 {polygon\marker3d\marker}
   * @param ids
   */
  public static hide(type: string, ids: string | Array<string>) {
    const dtsApi = this.getDtsApi()
    switch (type) {
      case 'polygon':
        dtsApi.polygon.hide(ids)
        break
      case 'marker3d': {
        dtsApi.marker3d.hide(ids)
      }
      case 'marker': {
        dtsApi.marker.hide(ids)
      }
      default:
        break
    }
  }

  /**
   * 显示对象
   * @param type 类型 {polygon\marker3d\marker}
   * @param ids
   */
  public static show(type: string, ids: string | Array<string>) {
    const dtsApi = this.getDtsApi()
    switch (type) {
      case 'polygon':
        dtsApi.polygon.show(ids)
        break
      case 'marker3d': {
        dtsApi.marker3d.show(ids)
      }
      case 'marker': {
        dtsApi.marker.show(ids)
      }
      default:
        break
    }
  }

  /**
   * 对象移动
   * @param arrPathPoint 位置坐标点
   * @param options 移动对象参数，参考customObject.add方法
   */
  public static async actorMove(arrPathPoint: { time: number; coordinate: []; rotation?: [] }[], options?: Object | null) {
    const dtsApi = this.getDtsApi()
    if (!arrPathPoint || arrPathPoint.length < 1) {
      throw new Error('坐标不符合要求')
    }

    let actor: any = {
      id: 'def_co_' + RandomUtil.getUUID(8), //自定义对象唯一id
      groupId: 'def_gp_customObject',
      //pakFilePath: store.appStore.config.dts + '/media/pak/walkman.pak', //pak文件路径
      //assetPath: '/JC_CustomAssets/BP_Walk', //运动人物模型路径
      pakFilePath: '@path:DTS_Library.pak',
      assetPath: '/Game/Common/Asset_Bank/Mesh/Car/BP_Car_JiuHuChe',
      location: arrPathPoint[0].coordinate, //位置坐标
      coordinateType: 0, // 坐标系类型
      rotation: arrPathPoint[0].rotation, //旋转
      localRotation: [0, 0, 0],
      scale: [2000, 2000, 2000], //缩放
      smoothMotion: 1 //1: 平滑插值，0: 跳跃
    }

    if (options) {
      actor = { ...actor, ...options }
    }

    dtsApi.customObject.add(actor)
    //dtsApi.customObject.focus('dts_default_co', 500, 0, [-30, 4, 0], 0)
    dtsApi.customObject.startMove(actor.id, 0, arrPathPoint)
  }

  /**
   *添加线对象
   *
   * @param polyline 单条线坐标或多条线对象
   * @param options 线条样式
   */
  public static async addPolyline(polyline: [] | { id: string; coordinates: number[] }[], options?: Object | null, autoZoom: boolean = true) {
    const dtsApi = this.getDtsApi()
    if (!polyline) {
      throw new Error('坐标不符合要求')
    }

    let default_options = {
      id: '', //折线唯一标识id
      groupId: 'def_gp_polyline',
      coordinates: <any>[], //构成折线的坐标点数组
      coordinateType: 0, //坐标系类型，取值范围：0为Projection类型，1为WGS84类型，2为火星坐标系(GCJ02)，3为百度坐标系(BD09)，默认值：0
      range: [1, 1000000000], //可视范围：[近裁距离, 远裁距离]，取值范围: [任意负值, 任意正值]
      color: Color.Red, //折线颜色
      thickness: 100, //折线宽度
      intensity: 0.5, //亮度
      flowRate: 0.5, //流速
      shape: 0, //折线类型 0：直线， 1：曲线
      depthTest: false, //是否做深度检测 开启后会被地形高度遮挡
      style: PolylineStyle.Arrow, //折线样式 参考样式枚举：PolylineStyle
      tiling: 0 //材质贴图平铺比例
    }

    if (options) {
      default_options = { ...default_options, ...options }
    }

    const arrIds = new Array()
    let arrP = new Array()
    if (polyline && polyline[0].coordinates) {
      //多条线
      arrP = polyline.map(value => {
        const pline = { ...default_options, ...value }
        arrIds.push(pline?.id)
        return pline
      })
    } else {
      //单线
      const pline = { ...default_options }
      pline.id = 'def_polyline_' + RandomUtil.getUUID(8)
      arrIds.push(pline?.id)
      pline.coordinates = polyline
      arrP.push(pline)
    }
    console.log('画线：', arrP)
    dtsApi.polyline.add(arrP)
    if (autoZoom) {
      dtsApi.polyline.focus(arrIds, 500)
    }
    return arrIds
  }

  /**
   * 添加面对象
   *
   * @param polygon 面对象或面对象数组
   * @param options 选项
   * @param autoZoom 是否自动绽放,默认为true
   * @param clear 是否清空已绘面,默认为true
   * @returns
   */
  public static async addPolygon(
    polygon: any | { id: string; coordinates: number[] }[],
    options?: Object | null,
    autoZoom: boolean = true,
    clear: boolean = true
  ) {
    const dtsApi = this.getDtsApi()
    if (!polygon) {
      throw new Error('坐标不符合要求')
    }

    let default_options = {
      id: '',
      groupId: 'def_gp_polygon',
      coordinates: <any>[],
      coordinateType: 0, //坐标系类型，取值范围：0为Projection类型，1为WGS84类型
      range: [-10000000, 100000000000], //可视范围：[近裁距离, 远裁距离]，取值范围: [任意负值, 任意正值]
      color: [0, 0, 1, 0.8], //多边形的填充颜色
      frameColor: Color.Red, //边框颜色
      frameThickness: 0, //边框厚度
      intensity: 1, //亮度
      style: 0, //单色 请参照API开发文档选取枚举
      depthTest: false //是否做深度检测 开启后会被地形高度遮挡
    }

    if (options) {
      default_options = { ...default_options, ...options }
    }

    const arrIds = new Array()
    let arrP = new Array()
    if (polygon && polygon[0].coordinates) {
      //多个面
      arrP = polygon.map((value: any) => {
        const pgon = { ...default_options, ...value }
        arrIds.push(pgon?.id)
        return pgon
      })
    } else {
      //单个面
      const pgon = { ...default_options }
      pgon.id = 'def_polygon_' + RandomUtil.getUUID(8)
      arrIds.push(pgon?.id)
      pgon.coordinates = polygon
      arrP.push(pgon)
    }

    if (clear) {
      await dtsApi.polygon.clear()
    }
    console.log('DtsFacade.addPolygon:', arrP)

    await dtsApi.polygon.add(arrP)
    if (autoZoom) {
      dtsApi.polygon.focus(arrIds, 500)
    }
    return arrIds
  }

  /**
   * 蓝图调用
   * 参数参考DtsAPI
   */
  public static async callBPFunction(
    objectName: string,
    functionName: string,
    paramType?: number | null,
    paramValue?: any | null,
    parameters?: any[] | null,
    actorTag?: string
  ) {
    const dtsApi = this.getDtsApi()
    if (!objectName || !functionName) {
      throw new Error('蓝图对象或函数为空')
    }

    const default_options: any = {
      // 执行动画效果的Actor对象的ID，可以根据__xapi.tileLayer.getObjectIDs(tileLayerIds)方法获取
      objectName: objectName,
      // 待调用的蓝图函数名称，调用前需和设计蓝图函数的开发人员确认此函数已存在
      functionName: functionName,
      paramType: paramType,
      paramValue: paramValue,
      parameters: parameters
    }
    if (actorTag) {
      // 创建蓝图函数时在模型包含的Actor上添加的tag，调用前需和设计蓝图函数的开发人员确认
      default_options.actorTag = actorTag
    }
    //console.log('调用函数', default_options)
    if (dtsApi) {
      dtsApi.misc.callBPFunction(default_options)
    }
  }

  /**
   *添加导览
   * @param tour 导览数据
   */
  public static async addCameraTour(tour: CameraTourData) {
    const dtsApi = this.getDtsApi()
    if (!tour) {
      throw new Error('导览数据不符合要求！')
    }
    dtsApi.cameraTour.delete(tour.id, () => {
      dtsApi.cameraTour.add(tour)
      dtsApi.cameraTour.play(tour.id)
    })
  }

  /**
   *设置场景时间
   *
   * @param dateTime 时间,格式如:2023-02-19 18:18:18
   * 如果为空，默认为系统日期早上9点19分
   */
  public static async setDateTime(dateTime: string | null = null) {
    const dtsApi = __xapi
    if (!dateTime) {
      const dt = new Date()
      dtsApi.weather.setDateTime(dt.getFullYear(), dt.getMonth() + 1, dt.getDay(), 9, 19, false)
    } else {
      if (!dateTime && dateTime.length != 17) {
        throw new Error('输入的时间格式有误！')
      }
      const arrDateTime = dateTime.split(' ')
      const arrDate = arrDateTime[0].split('-')
      const arrTime = arrDateTime[1].split(':')
      await dtsApi.weather.setDateTime(
        Number(arrDate[0]),
        Number(arrDate[1]),
        Number(arrDate[2]),
        Number(arrTime[0]),
        Number(arrTime[1]),
        Number(arrTime[2]),
        false
      )
    }
  }

  /**
   *设置雾
   *
   * @param fogDensity 整体雾浓度，取值范围:[0~2.0]
   * @param fogHeightFalloff 高度衰减，取值范围:[0~2]
   * @param fogStartDistance 起雾距离，取值范围:[0~10000]
   * @param fogOpacity 透明度，取值范围:[0.00~1.00]
   */
  public static async setFog(
    fogDensity: number = 0.1,
    fogHeightFalloff: number = 0.01,
    fogStartDistance: number = 2,
    fogOpacity: number = 0.1,
    fogColor: number[] = [1, 1, 1, 1]
  ) {
    const dtsApi = __xapi
    await dtsApi.weather.setFogParam(fogDensity, fogColor, fogHeightFalloff, fogStartDistance, fogOpacity)
    store.dtsStore.hasSetFog = true
  }

  /**
   *设置雨
   * @param strength 强度（必须大于0，才会有下雨效果），取值范围:[0~1.0]
   * @param speed 速度，取值范围:[0~10]
   * @param raindropSize 雨滴大小，取值范围:[0~5]
   */
  public static async setRain(strength: number = 0.1, speed: number = 1, raindropSize: number = 1) {
    const dtsApi = __xapi
    await dtsApi.weather.setRainParam(strength, speed, raindropSize, null)
  }

  /**
   *设置雪
   * @param strength 强度（必须大于0，才会有下雪效果），取值范围:[0~1.0]
   * @param speed 速度，取值范围:[0~10]
   * @param snowflakeSize 雪花大小，取值范围:[0~25]
   */
  public static async setSnow(strength: number = 0.1, speed: number = 0.01, snowflakeSize: number = 2) {
    const dtsApi = __xapi
    await dtsApi.weather.setRainParam(strength, speed, snowflakeSize, null)
  }

  /**
   * 用marker3d高亮点击点
   * @param markerObj
   */
  public static async highlightMarker(markerObj: any) {
    console.log('开始高亮:', markerObj)
    DtsFacade.cancelHightlightMarker() //取消已有高亮
    if (markerObj?.id) {
      //先获marker的text及坐标
      const dtsApi = __xapi
      //6.0.0512版本get存在获取的坐标不对bug
      const obj = await dtsApi.marker.get(markerObj?.id)
      console.log('get MarkerInfo:', obj)
      if (obj?.data?.length == 1) {
        const marker3D = {
          id: markerObj?.id,
          text: obj.data[0].text,
          groupId: obj.data[0].groupId,
          //coordinate: [obj.data[0].coordinate[0], obj.data[0].coordinate[1], obj.data[0].coordinate[2]],
          coordinate: markerObj.mouseClickPoint,
          userData: obj.data[0].userData
        }
        //DtsFacade.__highlightByMarker3D(marker3D)
        await DtsFacade.__highlightByCustomObject(marker3D)
      }
    }
  }

  /**
   * 外部请勿调用
   * 高亮样式1
   * @param obj
   */
  public static async __highlightByMarker3D(obj: any) {
    const dtsApi = __xapi
    const style = { pointName: 'Point_B_7', textSize: 80, pointScale: 10, textLocation: [0, 0, 60], autoHeight: true }
    const hlId = obj.id + '_highlight'
    DtsFacade.hide('marker', obj?.id)
    DtsFacade.highlights.push({ type: 'marker', id: obj.id, highlightType: 'marker3D', highlightId: hlId })
    obj.id = hlId
    await DtsFacade.addMarker3D(obj, false, style)
    //判断当前相机高度，如果大于2000米，自动绽放过去
    // let cameraPos = await dtsApi.camera.get()
    // console.log('当前相机高度:', cameraPos, cameraPos.z)

    // if (cameraPos.z > 1000) {
    // 	DtsFacade.focus('marker3d', obj?.id, 500, 1)
    // }
  }

  public static ff() {
    //添加前清空所有customObject 防止id重复
  }

  /**
   * DTS 5.4版本存在Bug，只有文字能设计，其它设置不了
   * @param obj
   */
  public static async __highlightByCustomObject(obj: any, options: any = null, calculateZ: boolean = true) {
    const dtsApi = __xapi
    const hlId = obj.id + '_highlight'
    //不自动缩放，如果要缩放，在监听里进行绽放
    //DtsFacade.focus('marker', obj?.id, 200)
    DtsFacade.hide('marker', obj.id)
    DtsFacade.highlights.push({ type: 'marker', id: obj.id, highlightType: 'co', highlightId: hlId })
    obj.id = hlId

    let co: any = {
      id: obj.id, //自定义对象唯一id
      groupId: obj.groupId,
      userData: obj.userData,
      pakFilePath: '@path:DTS_Library.pak', //资源库pak文件路径,推荐使用cloud内置的文件资源管理器加载pak并使用@path方式传入参数
      assetPath: '/JC_CustomAssets/EffectLibrary/Exhibition/3DUI/3D_UI_C_3', //资源目录，自定义对象在pak文件资源包里的相对路径
      location, //位置坐标
      coordinateType: 0, // 坐标系类型
      rotation: [0, 0, 0], // 世界坐标系旋转
      localRotation: [0, 90, 0], //模型自身旋转
      scale: [2, 2, 2], //模型缩放
      smoothMotion: 1 //1: 平滑移动，0: 跳跃移动userData: obj.userData
    }
    co = { ...co, ...options }
    //求地面碰撞点Z值
    let coords: any = []
    if (calculateZ) {
      await DtsFacade.getZ([obj])
      console.log('相交求Z值为:' + obj.coordinate[2])
      //求Z可能为0
      if (obj.coordinate[2] == 0) {
        coords.push(obj.coordinate[0])
        coords.push(obj.coordinate[1])
        coords.push(220)
      }
    }
    coords = [...obj.coordinate]
    co.location = coords
    console.log('CO高亮', co)
    //添加包含蓝图函数的3DUI
    await dtsApi.customObject.add(co)
    const arrBp = [
      {
        id: obj.id,
        functionName: '文字',
        parameters: [
          { paramType: 5, paramValue: obj.text }, //文字内容
          { paramType: 2, paramValue: 160 }, //大小
          { paramType: 6, paramValue: [0, 0.556863, 0.686275, 1] }, //颜色
          { paramType: 3, paramValue: 1 }
        ]
      },
      {
        id: obj.id,
        functionName: '图标',
        functionParams: [
          { name: '图标样式', type: 16, defaultValue: '博物馆' },
          { name: '图标背景', type: 16, defaultValue: '图标背景A' }
        ]
      }
    ]
    await dtsApi.customObject.callBatchBPFunction(arrBp)
  }

  /**
   * 取消高亮
   */
  public static async cancelHightlightMarker() {
    //显示隐藏，删除动态点图标
    const hObjs = DtsFacade.highlights
    while (hObjs?.length > 0) {
      const obj = hObjs.pop()
      await DtsFacade.show(obj?.type, obj?.id)
      await DtsFacade.delete(obj?.highlightType, obj?.highlightId)
    }
  }

  /**
   * 定位最后一个高亮对象
   */
  public static async focusLastHighlightObj(distance: number = 1000, flyTime: number = 1, rotation: Number[] = []) {
    const hObj = DtsFacade.highlights[DtsFacade.highlights.length - 1]
    console.log('定位最后一个亮亮对象', hObj)
    //co.focus有问题，先用 marker
    //await DtsFacade.focus(hObj?.highlightType, hObj?.highlightId, distance, flyTime, rotation)
    await DtsFacade.focus(hObj?.type, hObj?.id, distance, flyTime, rotation)
  }

  /**
   * 求碰撞点Z值
   * @param points
   */
  public static async getZ(points: any[]) {
    if (points?.length > 0) {
      const dtsApi = __xapi
      const coords = points.map((value: any, index: any) => {
        if (Reflect.has(value, 'location')) {
          return value.location
        } else if (Reflect.has(value, 'coordinate')) {
          return value.coordinate
        }
      })
      const startEndPointArr: any[] = []
      coords.forEach((value: any, index: any) => {
        const seP = { start: [value[0], value[1], 2000], end: [value[0], value[1], -10] }
        startEndPointArr.push(seP)
      })
      const resultPoint = await dtsApi.tools.linesIntersect(startEndPointArr, true, true)
      if (resultPoint?.result == 0) {
        let intersectPoints: any
        if (Reflect.has(resultPoint, 'LineIntersectPoint')) {
          //单个点
          intersectPoints = [resultPoint]
        } else {
          intersectPoints = resultPoint.intersects
        }
        //console.log('转换结果：', intersectPoints, resultPoint)
        if (intersectPoints) {
          points.forEach((value: any, index: any) => {
            if (Reflect.has(value, 'location')) {
              value.location[2] = intersectPoints[index]['LineIntersectPoint'][2]
              value.autoHeight = false
            } else if (Reflect.has(value, 'coordinate')) {
              value.coordinate[2] = intersectPoints[index]['LineIntersectPoint'][2]
              value.autoHeight = false
            }
          })
        }
      } else {
        ElMessage.info('获取地表高程异常')
      }
      console.log('转换点', startEndPointArr, resultPoint, points)
      return points
    }
  }

  /**
   *设置图层为X光图层
   *
   * @param layerNames 图层名字
   */
  public static async enableXRay(layerNames: string | Array<string>) {
    if (layerNames) {
      const ids = DtsFacade.getLayerId(layerNames)
      const dtsApi = __xapi
      dtsApi.tileLayer.enableXRay(ids, [1, 1, 1, 0.0381])
      store.dtsStore.pushXRayLayer(ids)
      //console.log('完成图层X光：', ids, store.dtsStore.xRayLayerIds)
    }
  }

  /**
   *关闭X光图层
   *
   * @param layerNames 图层名字
   */
  public static async disableXRay(layerNames: string | Array<string>) {
    if (layerNames) {
      const ids = DtsFacade.getLayerId(layerNames)
      const dtsApi = __xapi
      dtsApi.tileLayer.disableXRay(ids)
      console.log('取消X光图层：', ids)
      store.dtsStore.deleteXRayLayer(ids)
    }
  }

  /**
   * 隐藏一个或多个Actor
   * @param actorIds
   */
  public static async hideActors(actorIds: { id: string; objectIds: Array<string> } | Array<{ id: string; objectIds: Array<string> }>) {
    if (actorIds) {
      const dtsApi = __xapi
      dtsApi.tileLayer.hideActors(actorIds)
    }
  }

  /**
   * 显示一个或多个Actor
   * @param actorIds
   */
  public static async showActors(actorIds: { id: string; objectIds: Array<string> } | Array<{ id: string; objectIds: Array<string> }>) {
    if (actorIds) {
      const dtsApi = __xapi
      dtsApi.tileLayer.showActors(actorIds)
    }
  }

  /**
   * 地理坐标转投影坐标
   * @param coordinates 坐标点数组，数组维度不超过2维
   * @param coordinateType 1为WGS84类型，2为火星坐标系(GCJ02)，3为百度坐标系(BD09)，默认值：1
   */
  public static async gcs2pcs(coordinates: any, coordinateType = 1) {
    if (coordinates?.length > 0) {
      const dtsApi = __xapi
      const result = await dtsApi.coord.gcs2pcs(coordinates, coordinateType)
      if (result.result == 0) {
        return result.coordinates
      } else {
        ElMessage.info('坐标转换失败', result.resultMessage)
        return result
      }
    } else {
      return null
    }
  }

  /**
   * 添加Mesh对象
   * @param cm customMesh对象
   * @param options
   * @param autoZoom
   * @param clear
   * @param isUpdate 更新操作
   * @returns
   */
  public static async addCustomMesh(
    cm: any | { id: string; coordinates: number[] }[],
    options?: Object | null,
    autoZoom: boolean = true,
    clear: boolean = true,
    isUpdate: boolean = false
  ) {
    const dtsApi = this.getDtsApi()
    if (!cm) {
      throw new Error('对象格式不符合要求')
    }

    let default_options = {
      id: '',
      groupId: 'def_gp_cm',
      coordinates: <any>[],
      coordinateType: 0, //坐标系类型，取值范围：0为Projection类型，1为WGS84类型
      indices: <any>[],
      color: [0, 0, 1, 0.8], //填充颜色
      createCollision: false //不创建碰撞体
      //material: '/JC_CustomAssets/MaterialLibrary/Exhibition/水/水面1', //资源库自带的透明水材质
      //scalarParameters: [{ name: '不透明度', value: 0.5 }], //材质不透明度
      //vectorParameters: [{ name: '颜色', value: [0.2, 0.5, 0.7, 1] }] //材质颜色
    }

    if (options) {
      default_options = { ...default_options, ...options }
    }

    const arrIds = new Array()
    let arrP = new Array()
    if (cm && cm instanceof Array && cm[0].coordinates) {
      //多个CM
      arrP = cm.map((value: any) => {
        const pgon = { ...default_options, ...value }
        arrIds.push(pgon?.id)
        return pgon
      })
    } else {
      //单个CM
      const pgon = { ...default_options }
      pgon.id = 'def_cm_' + RandomUtil.getUUID(8)
      arrIds.push(pgon?.id)
      pgon.coordinates = cm.coordinates
      pgon.indices = cm.indices
      arrP.push(pgon)
    }

    if (clear && !isUpdate) {
      console.log('删除customMesh')
      await dtsApi.customMesh.clear()
    }

    if (isUpdate) {
      console.log('DtsFacade-更新Mesh', isUpdate, arrP)
      await dtsApi.customMesh.update(arrP)
    } else {
      console.log('DtsFacade-添加Mesh', isUpdate, arrP)
      await dtsApi.customMesh.add(arrP)
    }

    if (autoZoom) {
      dtsApi.customMesh.focus(arrIds, 500)
    }
    return arrIds
  }

  /**
   *从PG库里获取BIM信息
   * @param data Actor对象或数组
   */
  public static async getActorInfoFromDB(
    data: Array<{ tileLayerId: string; objectIds: Array<string> }> | { tileLayerId: string; objectIds: Array<string> }
  ) {
    if (data) {
      const dtsApi = __xapi
      const result = await dtsApi.tileLayer.getActorInfoFromDB(data)
      return result
    } else {
      return null
    }
  }

  /**
   * 获取BIM对象的属性
   * @param data 从getActorInfoFromDB返回的对象
   */
  public static getActorProperties(data: any) {
    if (data?.properties?.length > 0) {
      const props = data.properties
      const propsMap: Map<string, string> = new Map()
      props.forEach((item: any, index: any) => {
        for (const key in item) {
          propsMap.set(key, item[key])
        }
      })
      return propsMap
    } else {
      return null
    }
  }

  /**
   *tileLayer actor定位
   * @param layerName 图层中文名称
   * @param objectId 对象Id
   * @param distance 距离，默认10米
   * @param flyTime 飞行时间，默认2秒
   */
  public static focusActor(layerName: string, objectId: string, distance: number = 10, flyTime: number = 2) {
    if (layerName && objectId) {
      const dtsApi = __xapi
      const arrLayerId = DtsFacade.getLayerId(layerName)
      if (arrLayerId?.length > 0) {
        dtsApi.tileLayer.focusActor(arrLayerId[0], objectId, distance, flyTime)
      }
    }
  }

  /**
   *
   * @param tileLayerIds
   */
  public static hideAllActors(tileLayerIds: string | Array<string>) {
    if (tileLayerIds) {
      const dtsApi = __xapi
      dtsApi.tileLayer.hideAllActors(tileLayerIds)
    }
  }

  /**
   *高亮单个Arctor
   * @param layerName 图层中文名称
   * @param objectId actor ID
   */
  public static highlightActor(layerName: string, objectId: string) {
    if (layerName && objectId) {
      const dtsApi = __xapi
      const arrLayerId = DtsFacade.getLayerId(layerName)
      if (arrLayerId?.length > 0) {
        dtsApi.tileLayer.highlightActor(arrLayerId[0], objectId)
      }
    }
  }

  /**
   * 批量高亮
   * @param data
   */
  public static highlightActors(data: { layerName: string; objectIds: Array<string> } | { layerName: string; objectIds: Array<string> }[]) {
    let objs: any = []
    if (data instanceof Array && data?.length > 0) {
      objs = data
    } else {
      objs = [data]
    }

    const dtsObj: any = []
    objs.forEach((item: any, index: any) => {
      if (item?.layerName && item?.objectIds) {
        const arrLayerId = DtsFacade.getLayerId(item?.layerName)
        dtsObj.push({ id: arrLayerId[0], objectIds: item.objectIds })
      }
    })

    if (dtsObj?.length > 0) {
      const dtsApi = __xapi
      dtsApi.tileLayer.highlightActors(dtsObj)
    }
  }

  /**
   * 停止高亮所有Actors
   */
  public static stopHighlightAllActors() {
    const dtsApi = __xapi
    dtsApi.tileLayer.stopHighlightAllActors()
  }

  /**
   * 批量获取Actor信息
   * @param data
   */
  public static async getActorInfo(data: Array<{ layerName: string; objectIds: Array<string> }>) {
    if (data?.length > 0) {
      let result: any = null
      const dtsObj: any = []
      data.forEach((item: any, index: any) => {
        if (item?.layerName && item?.objectIds) {
          const arrLayerId = DtsFacade.getLayerId(item?.layerName)
          dtsObj.push({ id: arrLayerId[0], objectIds: item.objectIds })
        }
      })
      console.log('调用getActorInfo', dtsObj, data)
      if (dtsObj?.length > 0) {
        const dtsApi = __xapi
        result = await dtsApi.tileLayer.getActorInfo(dtsObj)
      }

      return result
    }
  }

  /**
   * 设置交互模式
   * @param mode 五种交互模式，取值范围：[0,1,2,3,4]，默认值：0；【0：漫游，1：人物，2：无人机，3：中心漫游（物体观察），4：地图】
   */
  public static setInteractiveMode(mode: number) {
    const dtsApi = __xapi
    if (mode >= 0 && mode <= 4) {
      dtsApi.settings.setInteractiveMode(mode)
    } else {
      dtsApi.settings.setInteractiveMode(0)
    }
  }

  public static async addHeatMap3D2(pointsArr: any[], indicesTemp: any[]) {
    __xapi.heatmap3d.clear()
    const heatmap3d = [
      {
        id: 'heatmap3d_byVolumePoints',
        displayMode: 1, //显示模式
        brightness: 3, //亮度，取值范围：[0~100]
        //volumeBoxLocation: [390956.059453, 5373919.336875, 120], //三维热力图坐标位置：[X,Y,Z]
        heatValueMode: 0, // 热力值模式
        voxelAlphaMode: 0, //三维体素块透明模式
        voxelShape: 0, //三维体素块形状
        volumeBoxRotation: [-44.96555709838867, 53.81494903564453, 0], //旋转
        //heatValueRange: [0, 100000], //取值范围
        textureSize: 256, //纹理尺寸
        denoise: 0,
        colors: {
          gradient: true,
          invalidColor: [1, 1, 1, 1],
          colorStops: [
            // { value: 0, color: [0, 0, 1, 1] },//-2696.17  -4.28822 蓝色
            // { value: 30, color: [0, 0.8, 1, 1] }, //51.0275  174.751 浅蓝色
            // { value: 50, color: [0, 1, 0.4, 1] }, //305.944  8269.49 绿色
            // { value: 95, color: [1, 0.4, 0, 1] }, //16143 24954.3 橙色
            // { value: 100, color: [1, 0, 0, 1] } //36480.5  82748.6  红色
            { value: -2696.17, color: [0, 0, 1, 1] },
            { value: 51.0275, color: [0, 0.8, 1, 1] },
            { value: 305.944, color: [0, 1, 0.4, 1] },
            { value: 16143, color: [1, 0.4, 0, 1] },
            { value: 36480.5, color: [1, 0, 0, 1] },
            { value: -4.28822, color: [0, 0, 1, 1] },
            { value: 174.751, color: [0, 0.8, 1, 1] },
            { value: 8269.49, color: [0, 1, 0.4, 1] },
            { value: 24954.3, color: [1, 0.4, 0, 1] },
            { value: 82748.6, color: [1, 0, 0, 1] }
          ]
        },
        voxels: pointsArr,
        indices: indicesTemp
      }
    ]
    console.log('调用HeatMap3D API啦！', heatmap3d)
    await __xapi.heatmap3d.add(heatmap3d)
    __xapi.heatmap3d.focus('heatmap3d_byVolumePoints')
  }

  /**
   * 热力图
   * @param heatObjs 热力图对象基本信息
   * @param options 选项
   * @param autoZoom 是否自动缩放
   * @param clear 添加或修改前是否清空所有热力图
   * @param isUpdate 如果为true，执行update方法
   * @returns
   */
  public static async addHeatMap3D(
    heatObjs: any | { id: string; voxels: number[]; indices: number[] }[],
    options?: Object | null,
    autoZoom: boolean = true,
    clear: boolean = true,
    isUpdate: boolean = false
  ) {
    const dtsApi = this.getDtsApi()
    if (!heatObjs) {
      throw new Error('对象格式不符合要求')
    }

    let default_options: any = {
      id: '',
      displayMode: 1, //显示模式
      brightness: 100, //亮度，取值范围：[0~100]
      //volumeBoxLocation: [390956.059453, 5373919.336875, 120], //三维热力图坐标位置：[X,Y,Z]
      heatValueMode: 0, // 热力值模式
      voxelAlphaMode: 1, //三维体素块透明模式
      voxelShape: 0, //三维体素块形状
      //volumeBoxRotation: [-44.96555709838867, 53.81494903564453, 0], //旋转
      //heatValueRange: [0, 100], //取值范围
      denoise: 0,
      colors: {
        gradient: true,
        invalidColor: [1, 1, 1, 1],
        colorStops: [
          { value: 0, color: [0, 0, 1, 1] },
          { value: 30, color: [0, 0.8, 1, 1] },
          { value: 50, color: [0, 1, 0.4, 1] },
          { value: 95, color: [1, 0.4, 0, 1] },
          { value: 100, color: [1, 0, 0, 1] }
        ]
      }
    }

    if (options) {
      default_options = { ...default_options, ...options }
    }

    const arrIds = new Array()
    let arrP = new Array()
    if (heatObjs && heatObjs instanceof Array && heatObjs[0].id) {
      //多个
      arrP = heatObjs.map((value: any) => {
        const heatObj = { ...default_options, ...value }
        arrIds.push(heatObj?.id)
        return heatObj
      })
    } else {
      //单个
      const heatObj = { ...default_options }
      heatObj.id = 'def_h3d_' + RandomUtil.getUUID(8)
      arrIds.push(heatObj?.id)
      heatObj.voxels = heatObjs.voxels
      heatObj.indices = heatObjs.indices
      arrP.push(heatObj)
    }

    if (clear && !isUpdate) {
      await dtsApi.heatmap3d.clear()
    }

    console.log('调用HeatMap3D API啦！', arrP)
    if (isUpdate) {
      console.log('DtsFacade-更新HeatMap3D', isUpdate, arrP)
      await dtsApi.heatmap3d.update(arrP)
    } else {
      console.log('DtsFacade-添加HeatMap3D', isUpdate, arrP)
      await dtsApi.heatmap3d.add(arrP)
    }

    if (autoZoom) {
      dtsApi.heatmap3d.focus(arrIds, 10)
    }
    return arrIds
  }

  /**
   * 更新Marker标签值
   * @param id MarkerId
   * @param newVal 新值
   */
  public static updateMarkerText(id: String, newVal: String) {
    const dtsApi = __xapi
    if (dtsApi && id?.length > 1) {
      dtsApi.marker.setText(id, newVal)
    }
  }

  /**
   * 添加有限元
   * @param data
   * @param autoZoom
   * @param style
   * @returns
   */
  public static addFiniteElement(data: Object | [], autoZoom: boolean = false, style: any = null) {
    const dtsApi = __xapi
    if (dtsApi) {
      let arrObjects
      if (data?.constructor === Object && Reflect.has(data, 'id')) {
        arrObjects = Array.of(data)
      } else if (data?.constructor === Array && data.length > 0 && Reflect.has((data as Array<any>)[0], 'id')) {
        arrObjects = data
      } else {
        throw new Error('数据格式有误')
      }
      const arrResult: any = new Array()
      const defalutStyle = {
        id: 'fe_1',
        dataPath: 'E:\\101DtsCloud\\youxianyuan\\out\\dam3_218', //目录
        coordinate: [391873.45, 5374842.24, 250],
        rotation: [0, 46, 0],
        type: 8,
        valueRange: [0.0, 0.724166989],
        showLine: true, //显隐等值线
        showColorLine: false, //是否显示成彩色线
        contourParams: [
          [0.08333391912850335, 0.006], //等值线的位置，第二个参数是线宽。
          [0.16666783825700687, 0.006],
          [0.2500017573855102, 0.006],
          [0.3333330729799244, 0.006],
          [0.41666699210842784, 0.006],
          [0.5000009112369311, 0.003],
          [0.5833348303654347, 0.003],
          [0.6666669270200756, 0.003],
          [0.7500003254417611, 0.003],
          [0.8333334635100378, 0.003],
          [0.9166668358963824, 0.0007]
        ],
        sections: [
          {
            index: 0,
            visible: true
          },
          {
            index: 1,
            visible: false
          }
        ],
        colors: {
          file: 'E:/101DtsCloud/youxianyuan/out/dam2_213_37/dam2_213_37.png'
        }
      }
      if (style) {
        style = { ...defalutStyle, ...style }
      } else {
        style = defalutStyle
      }
      const ids = new Array()
      arrObjects.forEach((value: any, index) => {
        value.groupId = value.groupId ? value.groupId : 'def_finite'
        value.userData = value.userData ? value.userData : JSON.stringify(value)
        ids.push(value.id)
        arrResult.push({ ...style, ...value })
      })

      console.log('添加有限元', arrResult)
      dtsApi.finiteElement.add(arrResult, () => {
        if (autoZoom) {
          if (ids.length == 1) {
            dtsApi.finiteElement.focus(ids, 200)
          } else {
            dtsApi.finiteElement.focus(ids)
          }
        }
      })

      return ids
    }
    return null
  }

  /**
   * wgs84转投影坐标
   * @param coordinates 坐标点数组，数组维度不超过2维
   * @param lonField 经度字段名称
   * @param latField 纬度字段名称
   */
  public static async wgs2pcs(arrGeoObj: any, lonField: string, latField: string) {
    const dtsApi = __xapi
    if (dtsApi && arrGeoObj?.length > 0) {
      const coordinates: Array<any> = []
      arrGeoObj.forEach((item: any) => {
        coordinates.push([Number(item[lonField]), Number(item[latField])])
      })
      const result = await dtsApi.coord.gcs2pcs(coordinates, 1)
      if (result.result == 0) {
        if (result.coordinates?.length == arrGeoObj.length) {
          arrGeoObj.forEach((item: any, index: number) => {
            item.coordinate = result.coordinates[index]
          })
        }
        return arrGeoObj
      } else {
        ElMessage.info('坐标转换失败', result.resultMessage)
        return result
      }
    } else {
      return null
    }
  }

  // 添加线
  private static addRouteLine = async (id: any, coordinates: any, cfg: any = {}) => {
    //使用PolylineStyle样式的折线
    const p = {
      id: id, //折线唯一标识id
      coordinates: DtsConverter.addZ(coordinates, 220), //构成折线的坐标点数组
      coordinateType: 0, //坐标系类型，取值范围：0为Projection类型，1为WGS84类型，2为火星坐标系(GCJ02)，3为百度坐标系(BD09)，默认值：0
      range: [1, 100000], //可视范围：[近裁距离, 远裁距离]，取值范围: [任意负值, 任意正值]
      color: Color.Blue, //折线颜色
      thickness: 50, //折线宽度
      intensity: 0.3, //亮度
      flowRate: 0.5, //流速
      shape: 0, //折线类型 0：直线， 1：曲线
      depthTest: false, //是否做深度检测 开启后会被地形高度遮挡
      style: PolylineStyle.Arrow, //折线样式 参考样式枚举：PolylineStyle
      tiling: 0 //材质贴图平铺比例
    }
    await __xapi.polyline.add(p)
  }

  // 添加marker
  public static addRouteMarker = async (id: any, coord: any, txt: any, imagePath = '@path:/poi/xjd.png') => {
    const marker = {
      id: id,
      groupId: 'gp_df_marker',
      coordinate: [...coord, 220],
      coordinateType: 0, //0投影，1地理
      fontSize: 12, //字体大小
      hoverImagePath: '',
      textRange: [1, 500],
      imagePath: imagePath,
      text: txt,
      showLine: false,
      priority: 1,
      displayMode: 2, //相机移动不显示，参与避让聚合
      disableHighligh: true, //不高亮
      occlusionCull: false,
      autoHeight: false
    }
    await DtsFacade.addMarker([marker], false, null, false, false, false)
  }

  /**
   * 显示路由轨迹
   * @param cfg
   * cfg={
   * geoList:[{id,coordinate,markerId,markerText,markerImagePath}],
   * coId,
   * coAssetPath,
   * markerImagePath
   * }
   */
  public static async showRoute(cfg: any) {
    const arrGeoObj = cfg.geoList
    const timerInterval = cfg?.timerInterval > 0 ? cfg.timerInterval : 500
    if (arrGeoObj?.length > 1) {
      const firstPoint = [...arrGeoObj[0].coordinate]
      //console.log('路线数据为：', arrGeoObj)
      // 所有撒点Id
      const markerIds: any = []
      //渲染co
      const coId = cfg.coId
      const obj = {
        id: coId,
        pakFilePath: '@path:DTS_Library.pak',
        assetPath: cfg?.coAssetPath?.length > 0 ? cfg.coAssetPath : '/JC_CustomAssets/RoleLibrary/Exhibition/动态人物/工人_1',
        location: firstPoint,
        rotation: [0, 0, 0], // 世界坐标系旋转
        localRotation: [0, 0, 0], //模型自身旋转
        scale: [10, 10, 10], //模型缩放
        coordinateType: 0,
        smoothMotion: 1
      }
      const markerId: any = arrGeoObj[0].markerId
      const markerImagePath = arrGeoObj[0]?.markerImagePath ? arrGeoObj[0].markerImagePath : cfg.markerImagePath
      //console.log(arrGeoObj[0]?.markerImagePath, arrGeoObj[0]?.markerImagePath ? 1 : 2)
      this.addRouteMarker(markerId, firstPoint, arrGeoObj[0].markerText, markerImagePath)
      markerIds.push(markerId)
      await __xapi.customObject.add(obj)
      //__xapi.marker.setAttachCustomObject({ markerId: markerId, objectId: coId, offset: [0, 0, 0] })

      //co动画
      const pathPointArr: any = []
      let count = 0
      arrGeoObj.forEach((item: any) => {
        if (item?.coordinate) {
          pathPointArr.push({
            time: (count * timerInterval) / 1000,
            coordinate: [item.coordinate[0], item.coordinate[1], 220],
            rotation: [0, 0, 0]
          })
          count++
        }
      })
      //console.log('co动画坐标:', coId, pathPointArr)
      __xapi.customObject.startMove(coId, 0, pathPointArr)

      // 跟随线
      // 记录上一次co运行的点
      let movingIndex = 1
      let lastPoint = firstPoint
      let moveToPoint
      // 待绘线
      let lastCoSecion = [lastPoint]
      const timerId = setInterval(() => {
        if (lastCoSecion?.length == 2) {
          this.addRouteLine(coId + '_' + movingIndex, lastCoSecion)
          lastCoSecion = [lastPoint]
        }
        if (movingIndex < arrGeoObj.length) {
          const currItem: any = arrGeoObj[movingIndex]
          if (currItem?.coordinate) {
            moveToPoint = [...currItem.coordinate]
            const tempId = currItem.markerId
            const strText = currItem.markerText
            const markerImagePath = currItem.markerImagePath ? currItem.markerImagePath : cfg.markerImagePath
            //__xapi.marker.setText(markerId, strText)
            this.addRouteMarker(tempId, moveToPoint, strText, markerImagePath)
            markerIds.push(tempId)
            // 线段
            lastCoSecion.push(moveToPoint)
            lastPoint = moveToPoint
          } else {
            console.log('该点无坐标', currItem)
          }
          movingIndex++
        } else {
          // 绘制最后一段
          if (lastCoSecion?.length == 2) {
            this.addRouteLine(coId + '_' + movingIndex, lastCoSecion)
          }
          __xapi.marker.focus(markerIds)
          clearInterval(timerId)
        }
      }, timerInterval)
    } else if (arrGeoObj?.length == 1) {
      const markerImagePath = arrGeoObj[0]?.markerImagePath ? arrGeoObj[0].markerImagePath : cfg.markerImagePath
      await this.addRouteMarker(arrGeoObj[0].markerId, arrGeoObj[0].coordinate, arrGeoObj[0].markerText, markerImagePath)
      setTimeout(() => {
        __xapi.marker.focus(arrGeoObj[0].markerId, 100)
      }, 500)

      console.log('巡线任务点只有一个:', arrGeoObj[0].markerId)
    } else {
      console.log('线路geoList长度<1')
    }
  }

  /**
   * 高亮一个图层
   * @param layerId 图层id
   * @param duration 闪烁时间
   */
  public static async highlightLayer(layerId: any, duration: any) {
    if (typeof layerId == 'string' && layerId.length > 0) {
      //获取图层所有Actor
      const res = await __xapi.tileLayer.getObjectIDs(layerId)
      if (res?.data?.length > 0) {
        await __xapi.tileLayer.highlightActors(res.data)
        console.log('高亮对象', res.data)
      }
      setTimeout(() => {
        __xapi.tileLayer.stopHighlightAllActors()
      }, duration * 1000)
    }
  }

  /**
   * 高亮线
   * @param id 线的ID
   */
  public static async highlightPolyline(id: any) {
    if (__xapi.isReady) {
      __xapi.infoTree.deleteByGroupId('gp_highlight')
      //console.log('高亮线', id);
      const obj = await __xapi.polyline.get(id)
      console.log('get polyline info:', obj)
      if (obj?.data?.length == 1) {
        const highlightObj: any = Object.assign({}, obj.data[0])
        highlightObj.id = id + '_highlight'
        highlightObj.groupId = 'gp_highlight'
        highlightObj.color = '#0288d1'
        highlightObj.thickness = highlightObj.thickness * 1.2
        __xapi.polyline.add(highlightObj)
        console.log('高亮线对象', highlightObj);
      }
    }
  }

  /**
   *给二维坐标加上Z坐标
   * @param coordinates 二维坐标
   * @param z z坐标
   * @returns
   */
  public static addZ(coordinates: Array<any>, z: number = 0): Array<any> {
    let result: Array<any>
    if (coordinates?.constructor === Array && coordinates.length > 0) {
      let result1: Array<number>
      if (coordinates[0]?.constructor === Number) {
        result1 = Array.from(coordinates)
        if (result1.length >= 3) {
          result1 = result1.slice(0, 2)
          result1[2] = z
        } else if (result1.length == 2) {
          result1[2] = z
        }
        return result1
      } else {
        result = new Array()
        coordinates.forEach((value: any, index) => {
          result.push(this.addZ(value, z))
        })
      }
    } else {
      throw new Error('数据格式不符合要求!')
    }
    return result
  }

  /**
   * 扁平化点
   * @param geo 
   */
  public static flattenPoint(geo: Array<any>, result: any[] = []) {
    if (geo?.constructor === Array && geo.length > 0) {
      let result1: Array<number>
      if (geo[0]?.constructor === Number) {
        result1 = Array.from(geo)
        result.push(result1)
        return result
      } else {
        geo.forEach((value: any, index) => {
          result.concat(this.flattenPoint(value, result))
        })
      }
    } else {
      throw new Error('数据格式不符合要求!')
    }
    return result
  }

  /**
   * 获取几何对象的BBOX
   * @param pointArray 点数组
   * @param defaultZ 默认Z
   * @returns 
   */
  public static getBBox(pointArray: any[], defaultZ: number = 0) {
    const arr0: any = []
    const arr1: any = []
    const arr2: any = []
    let flag: any = false
    const allPoint = this.flattenPoint(pointArray)
    for (let i = 0; i < allPoint.length; i++) {
      const point = allPoint[i]
      arr0.push(point[0])
      arr1.push(point[1])
      if (point.length === 3) {
        arr2.push(point[2])
      } else if (point.length === 2 && !flag) {//如果只有两个点，添加一次
        arr2.push(defaultZ)
        flag = true
      }
    }
    const bbox = [
      Math.min.apply(Math, arr0),
      Math.min.apply(Math, arr1),
      Math.min.apply(Math, arr2),
      Math.max.apply(Math, arr0),
      Math.max.apply(Math, arr1),
      Math.max.apply(Math, arr2)
    ]
    //console.info('BBOX是：', bbox)
    return bbox
  }

  /**
   * 缩放几何对象
   * 
   * @param geo 几何坐标
   * @param defaultZ 默认Z，如果坐标带Z，按坐标的最大、最小Z
   */
  public static async focusByBBox(geo: any, defaultZ: number = 0, isLookDown: boolean = true) {
    const bbox = DtsFacade.getBBox(geo, defaultZ)
    if (__xapi.isReady) {
      const bboxResult = bbox
      // if (bbox[0] < 180 && bbox[0] > -180) {//说明是地理坐标
      //   let res = await DtsFacade.gcs2pcs([[bbox[0], bbox[1], bbox[2]], [bbox[3], bbox[4], bbox[5]]])
      //   bboxResult = [...res[0]]
      //   bboxResult = bboxResult.concat(res[1])
      //   //console.log('坐标转换', bbox, res, bboxResult);
      // }       
      const dis = Math.sqrt(Math.pow(bbox[0] - bbox[3], 2) + Math.pow(bbox[1] - bbox[4], 2) + Math.pow(bbox[2] - bbox[5], 2))
      console.log('BBOX对角距离', bbox, dis)
      // 如果两点间距离太短,则单点定位
      if (dis < 2) {
        console.log('两点距离太短，采用点定位', geo[0])
        if (isLookDown) {
          await __xapi.camera.lookAt(geo[0][0], geo[0][1], geo[0][2], 8, - 90, -90, 1, null)
        } else {
          await __xapi.camera.lookAt(geo[0][0], geo[0][1], geo[0][2], 8, -23.301046, -89.999969, 1, null)
        }
      } else {
        if (isLookDown) {
          await __xapi.camera.lookAtBBox(bboxResult, -90, -90, 1, null)
        } else {
          await __xapi.camera.lookAtBBox(bboxResult, -23.301046, -89.999969, 1, null)
        }
      }
      console.info('BBOX缩放完成', bboxResult, TimeUtil.parseDateTime())
    }
  }

  /**
   * 更新罗盘位置,根据项目修改
   */
  public static async updateCampassPostion() {
    let baseWidth = 1920
    const baseHeight = 1080
    const left = gVar?.dtsCloud?.campass?.left ? gVar.dtsCloud.campass.left : -1;
    const top = gVar?.dtsCloud?.campass?.top ? gVar.dtsCloud.campass.top : -1;
    const api = DtsFacade.getDtsApi()
    if (api) {
      const size = api.getPlayer().getVideoStreamSize();
      const playerWidth = size.width;
      const playerHeight = size.height;
      //如果双屏时
      let offSize = 0
      if (store.dtsStore.twinPlayerVisible) {
        baseWidth = baseWidth
        offSize = 34
      }
      const ratio = window.innerHeight / baseHeight;
      const realLeft = left * (playerWidth / baseWidth) - offSize;
      const realTop = top * (playerHeight / baseHeight) * ratio;
      console.log('更新罗盘位置', left, top, realLeft, realTop, playerWidth, playerHeight, ratio);
      api.settings.setCampassPosition(realLeft, realTop);
    }
  }

  /**
   * 地理坐标系转投影坐标
   * 
   * @param coordinates 坐标串
   */
  public static gcs2pcsLocally(coordinates: any) {
    const toCrs = '+proj=tmerc +lat_0=0 +lon_0=120 +k=1 +x_0=500000 +y_0=0 +ellps=CGCS2000 +units=m +no_defs +type=crs'
    let result: Array<any>
    if (coordinates?.constructor === Array && coordinates.length > 0) {
      let result1: Array<number>
      if (coordinates[0]?.constructor === Number) {
        result1 = Array.from(coordinates)
        try {
          result1 = proj4('EPSG:4326', toCrs, result1)
        } catch (error) {
          result1 = []
        }
        return result1
      } else {
        result = new Array()
        coordinates.forEach((value: any, index) => {
          result.push(this.gcs2pcsLocally(value))
        })
      }
    } else {
      throw new Error('数据格式不符合要求!')
    }
    return result
  }

  /**
   * 地理坐标系转投影坐标
   * 
   * @param coordinates 坐标串
   */
  public static pcs2gcsLocally(coordinates: any) {
    const fromCrs = '+proj=tmerc +lat_0=0 +lon_0=108 +k=1 +x_0=500000 +y_0=0 +ellps=CGCS2000 +units=m +no_defs +type=crs'
    let result: Array<any>
    if (coordinates?.constructor === Array && coordinates.length > 0) {
      let result1: Array<number>
      if (coordinates[0]?.constructor === Number) {
        result1 = Array.from(coordinates)
        try {
          result1 = proj4(fromCrs, 'EPSG:4326', result1)
        } catch (error) {
          result1 = []
        }
        return result1
      } else {
        result = new Array()
        coordinates.forEach((value: any, index) => {
          result.push(this.pcs2gcsLocally(value))
        })
      }
    } else {
      throw new Error('数据格式不符合要求!')
    }
    return result
  }

  /**
 * 显示 Marker popupURL弹窗
 * 
 * 解决弹窗受遮挡、避让影响
 * 
 * @param markerID markerID或ID数组
 */
  public static async showPopupWindow(markerID: any) {
    if (markerID?.length > 0 && __xapi.isReady) {
      let arr: any = []
      if (markerID?.constructor === Array && markerID.length > 0) {
        arr = markerID
      } else {
        arr.push(markerID)
      }

      const updateObj: any = []
      arr.forEach((item: any, index: any) => {
        const obj = {
          id: item,
          displayMode: 2,
          range: [1, 1000000000],
          occlusionCull: false
        }
        updateObj.push(obj)
      })
      await __xapi.marker.update(updateObj)
      __xapi.marker.showPopupWindow(arr)
    }
  }

  /**
   * 闪烁Actor对象
   * 
   * @param layerId 图层Id
   * @param actorId 对象Id
   */
  public static flashingActor(layerId: string, actorId: any, count: number = 16, interval: number = 500) {
    const dtsApi = DtsFacade.getDtsApi()
    if (dtsApi?.isReady) {
      let i = 0
      let timeId: any
      timeId = setInterval(() => {
        if (i % 2 == 0) {
          dtsApi.tileLayer.hideActor(layerId, actorId)
        } else {
          dtsApi.tileLayer.showActor(layerId, actorId)
        }
        i++
        if (i > count) {
          dtsApi.tileLayer.showActor(layerId, actorId)
          clearInterval(timeId)
        }
      }, interval);
    }
  }

  /**
   * 日志输出处理耗时
   *
   * @param {*} startTime 开始时间
   * @param {*} desc 耗时描述
   */
  public static async getExecutionTime(startTime: any, desc: any, ...params: any) {
    const endTime = new Date().getTime()
    const time = endTime - startTime
    const strTime = (time / 1000).toFixed(2)
    console.log(`${desc}耗时：${strTime}秒`, ...params)
  }

  /**
   *
   * @param {*} layerId 图层ID
   * 
   */
  public static async addCOByTileLayer(layerId: any) {
    if (layerId?.length && __xapi?.isReady) {
      const beginTime = new Date()
      // ActorID数组     
      let actorIdArr: any = []
      // 1、获取指定图层的ActorID
      const resData = await __xapi.tileLayer.getObjectIDs(layerId)
      if (resData?.data?.length > 0) {
        actorIdArr = resData.data[0]?.objectIds
        console.log('ActorID数组:', actorIdArr)
        DtsFacade.getExecutionTime(beginTime, '初始化ActorId耗时')
        // actor转Co配置信息
        const actorConfigArr: any = []
        actorIdArr.forEach((item: any, index: any) => {
          actorConfigArr.push({
            id: item,
            tileLayerId: layerId, // 层id
            objectId: item, // 数组
            coordinateType: 0, // 坐标系类型
            smoothMotion: 1, //1: 平滑移动，0: 跳跃移动
            scale: [2, 2, 2],//模型缩放
            tintColor: [1, 0, 0, 1],
            groupId: 'co_jiance'
          })
        })
        DtsFacade.getExecutionTime(actorConfigArr, 'CO配置信息')

        if (actorConfigArr?.length > 0) {
          // 分批渲染
          let count = 1
          const n = 1000
          if (actorConfigArr?.length > n) {
            __xapi.customObject.addByTileLayer(actorConfigArr.slice((count - 1) * n, count * n))
            count++
            const timerId = setInterval(() => {
              __xapi.customObject.addByTileLayer(actorConfigArr.slice((count - 1) * n, count * n))
              DtsFacade.getExecutionTime(beginTime, `渲染第${(count - 1) * n}至${count * n}个耗时`)
              console.log()
              if (count * n >= actorConfigArr.length) {
                clearInterval(timerId)
              }
              count++
            }, 200)
          } else {
            __xapi.customObject.addByTileLayer(actorConfigArr)
          }

          // 分批更改CO颜色
          count = 1
          const tintColor = [0, 0, 0.95, 0.2]
          if (actorIdArr?.length > n) {
            __xapi.customObject.setTintColor(actorIdArr.slice((count - 1) * n, count * n), tintColor)

            count++
            const timerId = setInterval(() => {
              __xapi.customObject.setTintColor(actorIdArr.slice((count - 1) * n, count * n), tintColor)
              DtsFacade.getExecutionTime(beginTime, `渲染第${(count - 1) * n}至${count * n}个耗时`)
              console.log()
              if (count * n >= actorIdArr.length) {
                clearInterval(timerId)
              }
              count++
            }, 200)
          } else {
            __xapi.customObject.addByTileLayer(actorConfigArr)
          }
        }
      }
    } else {
      console.log('图层ID为空，请检查！')
    }
  }

  /**
   * 根据Actor BBox定位
   * 
   * @param layerId 图层Id
   * @param objectId ActorId
   */
  public static async focusActorByBBox(layerId: string, objectIds: any) {
    if (__xapi?.isReady && objectIds?.length > 0) {
      const resTemp = await __xapi.tileLayer.getActorInfo({ id: layerId, objectIds: objectIds })
      //console.log('getActorInfo信息1:', resTemp)
      if (resTemp?.data?.length == objectIds.length) {
        const point: any = []
        const arrActorInfo = resTemp.data
        arrActorInfo.forEach((item: any, index: any) => {
          point.push(item.boundsMin)
          point.push(item.boundsMax)
        })
        console.log('ActorBBOX定位：:', point)
        DtsFacade.focusByBBox(point)
      } else {
        console.log("tileLayer.getActorInfo返回数据为空", resTemp)
      }
    }
  }

  /**
  * 右对齐，左边补空
  * 
  * @param arrStr 字符串数组
  * @returns 
  */
  public static rightAlign(arrStr: any) {
    if (arrStr.length === 0) {
      return [];
    }
    const maxLength = Math.max(...arrStr.map((s: any) => s.length));
    return arrStr.map((s: any) => ({
      spaces: (maxLength - s.length) * 1,
      content: s
    }));
  }

  /**
   * 根据节点名称切换节点状态
   * 
   * @param nodeNames 节点名称
   * @param visible 是否可见
   * @param displayPrority 显示优先执行
   */
  public static async switchInfoTreeVisible(nodeNames: string[], visible: boolean | undefined = undefined, displayPrority: boolean = true) {
    console.log("调用ProjectFacade.switchInfoTreeVisible", arguments)
    // 待显示节点
    const showNode: any = []
    // 待隐藏节点
    const hideNode: any = []
    if (__xapi?.isReady) {
      await __xapi.infoTree.get().then((reponse: any) => {
        if (reponse.resultMessage == 'OK') {
          const infotree = reponse.infotree;
          if (infotree.length > 0) {
            infotree.forEach((item: any) => {
              if (nodeNames.includes(item.name)) {
                if (visible == undefined) {
                  // 当前显示
                  if (item.visiblity) {
                    hideNode.push(item.iD)
                  } else {
                    showNode.push(item.iD)
                  }
                } else if (visible) {
                  // 当前隐藏
                  if (!item.visiblity) {
                    showNode.push(item.iD)
                  }
                } else {
                  // 当前显示
                  if (item.visiblity) {
                    hideNode.push(item.iD)
                  }
                }
              }
            })
          }
        }
      });
      // console.log("显示-隐藏节点：", showNode, hideNode);
      // 先显示后隐藏
      if (displayPrority) {
        if (showNode.length > 0) {
          await __xapi.infoTree.show(showNode)
        }
        if (hideNode.length > 0) {
          await __xapi.infoTree.hide(hideNode)
        }
        // console.log("先显示后隐藏,显示-隐藏节点：", showNode, hideNode);
      } else {// 先隐藏后显示
        if (hideNode.length > 0) {
          await __xapi.infoTree.hide(hideNode)
        }
        if (showNode.length > 0) {
          await __xapi.infoTree.show(showNode)
        }
        // console.log("先隐藏后显示,隐藏-显示-节点：", hideNode, showNode);
      }
    } else {
      console.log("场景未初始化")
    }
  }

  /**
   * 根据节点Id切换节点状态
   * 
   * @param nodeIds 节点Id
   * @param visible 是否可见
   * @param displayPrority 显示优先执行
   */
  static async switchInfoTreeVisibleById(nodeIds: string[], visible: boolean | undefined = undefined, displayPrority: boolean = true) {
    console.log("调用ProjectFacade.switchInfoTreeVisibleById", arguments)
    // 待显示节点
    const showNode: any = []
    // 待隐藏节点
    const hideNode: any = []
    if (__xapi?.isReady) {
      await __xapi.infoTree.get().then((reponse: any) => {
        if (reponse.resultMessage == 'OK') {
          const infotree = reponse.infotree;
          if (infotree.length > 0) {
            infotree.forEach((item: any) => {
              if (nodeIds.includes(item.iD)) {
                if (visible == undefined) {
                  // 当前显示
                  if (item.visiblity) {
                    hideNode.push(item.iD)
                  } else {
                    showNode.push(item.iD)
                  }
                } else if (visible) {
                  // 当前隐藏
                  if (!item.visiblity) {
                    showNode.push(item.iD)
                  }
                } else {
                  // 当前显示
                  if (item.visiblity) {
                    hideNode.push(item.iD)
                  }
                }
              }
            })
          }
        }
      });
      // console.log("显示-隐藏节点：", showNode, hideNode);
      // 先显示后隐藏
      if (displayPrority) {
        if (showNode.length > 0) {
          await __xapi.infoTree.show(showNode)
        }
        if (hideNode.length > 0) {
          await __xapi.infoTree.hide(hideNode)
        }
      } else {// 先隐藏后显示
        if (hideNode.length > 0) {
          await __xapi.infoTree.hide(hideNode)
        }
        if (showNode.length > 0) {
          await __xapi.infoTree.show(showNode)
        }
      }
    } else {
      console.log("场景未初始化")
    }
  }

  /**
   * 根据名称显示及隐藏图层树节点
   * 
   * 不适合显示父节点，隐藏子节点或隐藏父节点，显示子节点
   * 
   * @param showNodeName 显示节点名称
   * @param hideNodeName 隐藏节点名称
   * @param displayPrority 显示优先执行
   */
  static async showAndHideInfoTreeV2(showNodeName: string[], hideNodeName: string[], displayPrority: boolean = true) {
    console.log("调用ProjectFacade.switchInfoTreeVisible", arguments)
    // 待显示节点
    const showNode: any = []
    // 待隐藏节点
    const hideNode: any = []
    if (__xapi?.isReady) {
      await __xapi.infoTree.get().then((reponse: any) => {
        if (reponse.resultMessage == 'OK') {
          const infotree = reponse.infotree;
          if (infotree.length > 0) {
            infotree.forEach((item: any) => {
              if (showNodeName.includes(item.name)) {
                showNode.push(item.iD)
              }
              if (hideNodeName.includes(item.name)) {
                // 当前显示
                hideNode.push(item.iD)
              }
            })
          }
        }
      });
      // console.log("显示-隐藏节点：", showNode, hideNode);
      // 先显示后隐藏
      if (displayPrority) {
        if (showNode.length > 0) {
          await __xapi.infoTree.show(showNode)
        }
        if (hideNode.length > 0) {
          await __xapi.infoTree.hide(hideNode)
        }
        console.log("先显示后隐藏,显示-隐藏节点：", showNode, hideNode);
      } else {// 先隐藏后显示
        if (hideNode.length > 0) {
          await __xapi.infoTree.hide(hideNode)
        }
        if (showNode.length > 0) {
          await __xapi.infoTree.show(showNode)
        }
        console.log("先隐藏后显示,隐藏-显示节点：", hideNode, showNode);
      }
    } else {
      console.log("场景未初始化")
    }
  }

  /**
   * 根据名称显示及隐藏图层树节点
   * 
   * @param showNodeName 显示节点名称
   * @param hideNodeName 隐藏节点名称
   * @param displayPrority 显示优先执行
   */
  static async showAndHideInfoTree(showNodeName: string[], hideNodeName: string[], displayPrority: boolean = true) {
    console.log("调用ProjectFacade.switchInfoTreeVisible", arguments)
    // 待显示节点
    let showNode: any = []
    // 待隐藏节点
    let hideNode: any = []
    if (__xapi?.isReady) {
      showNode = DtsFacade.getLayerId(showNodeName, true)
      hideNode = DtsFacade.getLayerId(hideNodeName, true)
      // console.log("显示-隐藏节点：", showNode, hideNode);
      // 先显示后隐藏
      if (displayPrority) {
        if (showNode.length > 0) {
          await __xapi.infoTree.show(showNode)
        }
        if (hideNode.length > 0) {
          await __xapi.infoTree.hide(hideNode)
        }
        console.log("先显示后隐藏,显示-隐藏节点：", showNodeName, hideNodeName, showNode, hideNode);
      } else {// 先隐藏后显示
        if (hideNode.length > 0) {
          await __xapi.infoTree.hide(hideNode)
        }
        if (showNode.length > 0) {
          await __xapi.infoTree.show(showNode)
        }
        console.log("先隐藏后显示,隐藏-显示节点：", hideNodeName, showNodeName, hideNode, showNode);
      }
    } else {
      console.log("场景未初始化")
    }
  }

  /**
   * 根据Id显示及隐藏图层树节点
   * 
   * 不适合显示父节点，隐藏子节点或隐藏父节点，显示子节点
   * 
   * @param showNodeIds 显示节点Id
   * @param hideNodeIds 隐藏节点Id
   * @param displayPrority 显示优先执行
   */
  static async showAndHideInfoTreeById(showNodeIds: string[], hideNodeIds: string[], displayPrority: boolean = true) {
    console.log("调用ProjectFacade.switchInfoTreeVisible", arguments)
    // 待显示节点
    const showNode: any = []
    // 待隐藏节点
    const hideNode: any = []
    if (__xapi?.isReady) {
      await __xapi.infoTree.get().then((reponse: any) => {
        if (reponse.resultMessage == 'OK') {
          const infotree = reponse.infotree;
          if (infotree.length > 0) {
            infotree.forEach((item: any) => {
              if (showNodeIds.includes(item.iD)) {
                // 当前隐藏
                if (!item.visiblity) {
                  showNode.push(item.iD)
                }
              }
              if (hideNodeIds.includes(item.iD)) {
                // 当前显示
                if (item.visiblity) {
                  hideNode.push(item.iD)
                } else {
                  if (item.type == 'EPT_Folder') {
                    hideNode.push(item.iD)
                  }
                }
              }
            })
          }
        }
      });
      // console.log("显示-隐藏节点：", showNode, hideNode);
      // 先显示后隐藏
      if (displayPrority) {
        if (showNode.length > 0) {
          await __xapi.infoTree.show(showNode)
        }
        if (hideNode.length > 0) {
          await __xapi.infoTree.hide(hideNode)
        }
      } else {// 先隐藏后显示
        if (hideNode.length > 0) {
          await __xapi.infoTree.hide(hideNode)
        }
        if (showNode.length > 0) {
          await __xapi.infoTree.show(showNode)
        }
      }
    } else {
      console.log("场景未初始化")
    }
  }

  /**
   * 设置Actor颜色 
   * @param layerId 图层ID
   * @param arrActorId ActorID
   * @param color 颜色
   */
  static async setActorColor(layerId: any, arrActorId: any, color = 'green') {
    if (layerId && arrActorId?.length > 0) {
      // 转数组
      if (!Array.isArray(arrActorId)) {
        arrActorId = [arrActorId]
      }
      const actorArr: any = [];
      arrActorId.forEach(item => {
        actorArr.push({
          id: item,
          tileLayerId: layerId, // 层id
          objectId: item, // 数组
          partId: layerId,
          coordinateType: 0, // 坐标系类型
          smoothMotion: 1, //1: 平滑移动，0: 跳跃移动
          groupId: 'gp_singleComp',
          collision: false // 取消可选择
        });
      });

      console.log("actor转Co:", actorArr)
      await __xapi.customObject.addByTileLayer(actorArr);
      __xapi.customObject.highlight(arrActorId);
      switch (color) {
        case "red":
          __xapi.customObject.setTintColor(arrActorId, [1, 0.4, 0.4, 0.3])
          break;
        case "yellow":
          __xapi.customObject.setTintColor(arrActorId, [1, 0.8, 0.4, 0.3])
          break;
        case "green":
          __xapi.customObject.setTintColor(arrActorId, [0.5, 1, 0.5, 0.3])
          break;
        default:
          break;
      }
    }
  }

  /**
   * rem 转px
   * 
   * @param rem 
   * @returns 
   */
  static getRemValue(rem) {
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return rem * rootFontSize;
  }
  /**
   *贴图效果
   * */
  static async setDecal(obj: any) {
    console.log(obj, 'obj')
    if (obj.location.length < 3) DtsFacade.getZ([obj])
    await __xapi.decal.delete(obj?.id)
    await __xapi.decal.add({
      id: obj?.id || Math.random(),
      decalBlendMode: 1,//贴花类型，取值范围：[0,1]；取值说明：0背景混合，1仅贴花（剔除png半透明）；默认值：0
      order: 1,//贴花层级，值越大层级越高，层级最高的显示在最上面一层
      texturePath: obj.imgUrl,//贴图文件路径
      location: obj.location,
      rotation: obj?.rotation ?? [-90, 180, 0],
      scale: obj?.scale ?? [200, 200, 200],
    });
    __xapi.decal.focus(obj?.id, 400)
  }

  /**
   * 计算两点之间的距离
   * @param startPoint 起点
   * @param endPoint 终点
   * @returns 距离
   */
  static calculateDistance3D(startPoint, endPoint) {
    const x1 = startPoint[0]
    const y1 = startPoint[1]
    const z1 = startPoint[2]
    const x2 = endPoint[0]
    const y2 = endPoint[1]
    const z2 = endPoint[2]
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) + (z2 - z1) * (z2 - z1))
  }

  /**
   * 计算两点间的飞行参数,包括速度、水平速度、垂直速度、航向角、俯仰角、翻滚角
   * @param startPoint 起点
   * @param endPoint 终点
   * @param duration 飞行时间，单位秒 
   * return {speed,hSpeed,vSpeed,heading,pitch,roll}
   */
  static calculateFlightParameters(startPoint, endPoint, duration = 1) {
    // 边界值校验（适配数组格式）
    if (duration <= 0) {
      throw new Error('飞行时间必须大于0秒');
    }
    if (!Array.isArray(startPoint) || !Array.isArray(endPoint) ||
      startPoint.length !== 3 || endPoint.length !== 3) {
      throw new Error('起点和终点必须是包含3个数值的数组，格式为 [x, y, z]');
    }
    if (startPoint.some(val => typeof val !== 'number') ||
      endPoint.some(val => typeof val !== 'number')) {
      throw new Error('起点和终点数组中的所有元素必须为数值类型');
    }

    // 解构数组获取坐标（核心修改点）
    const [startX, startY, startZ] = startPoint;
    const [endX, endY, endZ] = endPoint;

    // 1. 计算水平位移 (Δx, Δy) 和垂直位移 (Δz)
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const deltaZ = endZ - startZ;

    // 2. 计算水平距离和总距离
    const horizontalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY); // 水平平面距离
    const totalDistance = Math.sqrt(horizontalDistance * horizontalDistance + deltaZ * deltaZ); // 空间直线距离

    // 3. 计算核心速度参数
    const speed = totalDistance / duration; // 合速度 (空间直线速度)
    const hSpeed = horizontalDistance / duration; // 水平速度
    const vSpeed = deltaZ / duration; // 垂直速度 (正值上升，负值下降)
    // 欧拉角
    const angle = DtsFacade.getEulerAngle(startPoint, endPoint)

    // 返回计算结果（保留4位小数，避免精度冗余）
    const result = {
      speed: Number(speed.toFixed(1)),
      hSpeed: Number(hSpeed.toFixed(1)),
      vSpeed: Number(vSpeed.toFixed(1)),
      heading: angle[1],
      pitch: angle[0],
      roll: angle[2]
    };
    console.log('计算飞行参数:', result, angle)
    return result;
  }

  /**
   * 获取两个点之间的欧拉角
   * @param a 起点
   * @param b 终点
   * @returns 欧拉角
   */
  static getEulerAngle(a, b) {
    const c = 360 / (2 * Math.PI);
    const d = b[0] - a[0], e = b[1] - a[1];
    return [Math.atan2(b[2] - a[2], Math.sqrt(d * d + e * e)) * c, Math.atan2(d, e) * c - 90, 0]
  }
}
