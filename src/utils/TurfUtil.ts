import * as turf from "@turf/turf"

/**
 * Turf工具类
 */
export default class TurfUtil {

  /**
   * 
   * @param polygonList 多边形数组 
   * @param point 单点 [x,y]
   * @returns 
   */
  public static booleanContainsForAreaFilter(polygonList: any, point: any) {
    let p = turf.point(point);
    let flag = false
    if (polygonList?.length > 0) {
      for (let index = 0; index < polygonList.length; index++) {
        const element = polygonList[index];
        let polygon = turf.polygon(element[0])
        flag = turf.booleanContains(polygon, p)
        if (flag) {
          break
        }
      }
    }
    //console.log("booleanContainsForAreaFilter", flag);
    return flag
  }

  /**
   * 获取中心位置
   */
  public static getCenter = (coordinates: any) => {
    const polygon = turf.polygon(coordinates)
    // 使用turf.center方法计算多边形的中心点
    const centerPoint = turf.center(polygon)
    // 打印出中心点的坐标
    // console.log(centerPoint.geometry.coordinates);
    return centerPoint.geometry.coordinates
  }
}
// 具名导出：unplugin-auto-import 21 按类名自动导入（import { TurfUtil }）
export { TurfUtil }
