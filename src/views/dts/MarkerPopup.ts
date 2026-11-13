import { clearAllFlyPath } from "./FlyPlanFacade";

/**
 * 弹框展示
 */

export default class MarkerPopup {
  /**
   * 撒点-弹框展示
   */

  static async showMarkerPopup(list: any) {
    console.log(gVar.dtsCloud.popupRootUrl, 'list')

    // let popupURL = gVar.dtsCloud.popupRootUrl + '/popup/html/echartsMarkerPopup.html'
    let popupURL = 'http://172.16.190.216:9090/' + 'popup/echartsMarkerPopup.html'
    console.log(popupURL, 'popupURL')
    let markerList = {
      id: 'm22222',
      groupId: 'def_marker_popup',
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

      text: '故障回放', //显示的文字
      useTextAnimation: false, //关闭文字展开动画效果 打开会影响效率
      textRange: [1, 2000], //文本可视范围[近裁距离, 远裁距离]
      textOffset: [0, 0], // 文本偏移
      textBackgroundColor: [1, 1, 1, 0.85], //文本背景颜色
      fontSize: 14, //字体大小
      //fontOutlineSize: 1, //字体轮廓线大小
      //fontColor: Color.White, //字体颜色
      //fontOutlineColor: Color.Black, //字体轮廓线颜色

      popupURL: popupURL, //弹窗HTML链接
      popupBackgroundColor: [1.0, 1.0, 1.0, 0.5], //弹窗背景颜色
      popupSize: [500, 250], //弹窗大小
      popupOffset: [-118, -30], //弹窗偏移
      autoHidePopupWindow: false, //失去焦点后是否自动关闭弹出窗口

      showLine: false, //标注点下方是否显示垂直牵引线
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

    await clearAllFlyPath() //先清除上次的

    await __xapi.marker.add([markerList]).then(() => {
      console.log('marker add success')
    })
  }
}
// 具名导出：unplugin-auto-import 21 按类名自动导入（import { MarkerPopup }）
export { MarkerPopup }
