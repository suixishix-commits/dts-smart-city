import { getData } from '@/api/fileData'


/**
 * 画面类
 */
export default class DrawPolygon {
  /**
 * 获取uuid字符串
 * @param { Number } len uuid长度
 * @return { String } uuid
 */
  static getUUID(len = 32) {

  }


  /**
   * 画面并附加中心点文字
   */
  static async drawPolygon3DText() {
    let polygonList: any[] = []
    let ids: any[] = []
    let markerDropArr: any = []
    let res = await getData('polygon/forbiddenArea.json')
    console.log(res)
    if(res?.data?.features?.length > 0) {
      const data = res.data.features

      data.forEach((item: any) => {
        ids.push(item.attributes.Name)
        polygonList.push({
          id: `${item.attributes.Name}`,
          groupId: `polygon3d_${item.attributes.Name}`,
          coordinates: item.geometry.rings,
          coordinateType: 0,//坐标系类型，取值范围：0为Projection类型，1为WGS84类型，2为火星坐标系(GCJ02)，3为百度坐标系(BD09)，默认值：0
          // color: color,        //颜色值
          color: [1, 0, 0, 0.5],
          range: [1, 1000000],
          viewHeightRange: [1, 10000000],
          height: 888,                //3D多边形的高度
          intensity: 1.0,             //亮度
          style: 17, //3DPolygon的样式 请参照API开发文档选取枚举
          tillingX: 0, //可选，仅当3DPolygon的样式支持贴图显示，贴图横向平铺
          tillingY: 0,  //可选，仅当3DPolygon的样式支持贴图显示，贴图纵向平铺
          generateTop: true, //是否生成顶面
          generateSide: true,//是否生成侧面
          generateBottom: true,//是否生成底面
        })
      })

      // console.log(polygonList)

      markerDropArr = await this.findForbiddenAreaCenter(polygonList, '禁飞区')
      await __xapi.polygon3d.delete(ids); // 清除之前的禁飞区
      await __xapi.polygon3d.add(polygonList, () => {
        console.log('绘制禁飞区完成', polygonList)
      }); // 绘制禁飞区
      await __xapi.marker.add(markerDropArr)
      await __xapi.polygon3d.focus(ids, 0, 1, [-85.997421, -90.497612, 0]); // 定位
    }
  }

  /**
   * 找到禁飞区的中心点
   */
  static async findForbiddenAreaCenter(area: any, upperLevelName: any) {
    let nameList: any = area.map((item: any) => item.id) // 禁飞区名称数组
    let pointData: any = [] // 点位数据
    let centerPointConfig: any = [] // 中心点位信息
    let res = await getData('marker/forbiddenAreaPoint.json') // 获取中心点数据
    pointData = res.data.features.filter((item: any) => nameList.includes(item.attributes.Name)) // 找到中心点数据

    if (pointData.length > 0) {
      pointData.forEach((item: any) => {
        centerPointConfig.push({
          id: `marker_${item.attributes.Name}`,
          groupId: `marker_${upperLevelName}`,
          coordinate: [item.geometry.x, item.geometry.y],//坐标位置geometry
          coordinateType: 0,//默认0是投影坐标系，也可以设置为经纬度空间坐标系值为1
          anchors: [-25, 70],//锚点，设置Marker的整体偏移，取值规则和imageSize设置的宽高有关，图片的左上角会对准标注点的坐标位置。示例设置规则：x=-imageSize.width/2，y=imageSize.height
          imageSize: [50, 70],//图片的尺寸
          hoverImageSize: [50, 50],//鼠标悬停时显示的图片尺寸
          range: [1, 30000],//可视范围
          viewHeightRange: [1, 30000],// 可见高度范围
          rangeRatio: 0.01,//可见高度范围的调整系数
          imagePath: ``,//显示图片路径
          fixedSize: true,//图片固定尺寸，取值范围：false 自适应，近大远小，true 固定尺寸，默认值：false

          text: item.attributes.Name,//显示的文字
          useTextAnimation: false,//关闭文字展开动画效果 打开会影响效率
          textRange: [1, 3000],//文本可视范围[近裁距离, 远裁距离]
          textOffset: [0, -8],// 文本偏移
          textBackgroundColor: [0, 1, 0, 0],//文本背景颜色
          fontSize: 20,//字体大小
          fontOutlineSize: 1,//字体轮廓线大小
          fontColor: Color.White,//字体颜色
          fontOutlineColor: Color.Black,//字体轮廓线颜色

          autoHidePopupWindow: false,//失去焦点后是否自动关闭弹出窗口
          autoHideText: true, //打开弹窗时是否自动隐藏文字，默认值：true
          autoHeight: true,// 自动判断下方是否有物体
          displayMode: 2,//智能显示模式  开发过程中请根据业务需求判断使用四种显示模式
          clusterByImage: false,// 聚合时是否根据图片路径分类，即当多个marker的imagePath路径参数相同时按路径对marker分类聚合
          priority: 0,//避让优先级
          occlusionCull: false,//是否参与遮挡剔除
          // ...config,
        })
      })
    }

    return centerPointConfig
  }
}
// 具名导出：unplugin-auto-import 21 按类名自动导入（import { DrawPolygon }）
export { DrawPolygon }
