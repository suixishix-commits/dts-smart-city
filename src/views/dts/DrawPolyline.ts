import DtsFacade from "@/components/dts/DtsFacade";
import {startFlyByLocation, clearAllFlyPath, createMarkerPopup} from "./FlyPlanFacade";

/**
 * 画线方法类
 */
export default class DrawPolyline {
  /**
   * 画线
   * 
   * @param list 对象数组
   */
  static async drawFlyRoute(list: any) {
    // console.log("传进了啥对象？：", list)
    let lineArr :any = []
    if (__xapi?.isReady && list?.length > 0) {
      // 对象数组
      let arr: any = [];
      // 所有点数组，用于求bbox实现自动缩放
      let arrCoord: any[] = []
      let arrId: any[] = []
      list.forEach((item: any, index: any) => {
        let coor = item

        //构造飞行胶囊需要的数据（co)
        let id = "flyPath_" + index
        lineArr.push({
          id: id,
          coordinates: item,
          userData:{
            id: index + "",
            "geom": "{\"type\":\"LineString\",\"coordinates\":"+JSON.stringify(item) + "}",
          }
        })

        const obj = {
          id: id,//唯一标识id
          groupId: "gp_flightplan_line",
          coordinates: item,//构成折线的坐标点数组
          coordinateType: 0,//坐标系类型，取值范围：0为Projection类型，1为WGS84类型，2为火星坐标系(GCJ02)，3为百度坐标系(BD09)，默认值：0
          range: [1, 1000000],//可视范围：[近裁距离, 远裁距离]，取值范围: [任意负值, 任意正值]
          // color: (item.alarm == true ? Color.Red : Color.White),//折线颜色
          color: Color.White,//折线颜色
          thickness: 200,//折线宽度
          intensity: 0.5,//亮度
          flowRate: 0.5,//流速
          shape: 0, //折线类型 0：直线， 1：曲线
          depthTest: false,//是否做深度检测 开启后会被地形高度遮挡
          style: PolylineStyle.Arrow,//折线样式 参考样式枚举：PolylineStyle
          tiling: 0,//材质贴图平铺比例
          userData: lineArr[index].userData,//用户自定义数据          
        }
        arr.push(obj)
        arrId.push(id)
        arrCoord = arrCoord.concat(coor)
      })

      await clearAllFlyPath() //先清除上次的
      // 计算bbox
      if (arr.length > 0) {
        await __xapi.polyline.delete(arrId)
        await __xapi.polyline.add(arr)
        await DtsFacade.focusByBBox(arrCoord)
        // console.log("画线成功：", arr)

        //按路线飞行
        startFlyByLocation(lineArr)
      }
    }

    return lineArr;
  }
}
// 具名导出：unplugin-auto-import 21 按类名自动导入（import { DrawPolyline }）
export { DrawPolyline }
