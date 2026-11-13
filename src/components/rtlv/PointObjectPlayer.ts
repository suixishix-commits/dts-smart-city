import TimeUtil from "@/utils/TimeUtil"
import ProjectSceneFacade from "@/components/ProjectSceneFacade"

/**
 * 采用统一移动对象调用入口，避免移动对象频繁调用DTS API
 * 
 * 只要移动列表中有值，就会定时（很短）去批量调用DTS API
 */
export default class PointObjectPlayer {
  // 待调用列表[{id,location,rotation,smoothTime}]
  private static playList: Array<any> = []
  // 定时器ID
  private static timeId: any
  // 是否忙碌状态
  private static isBusying: any = false
  // 批量调用次数
  private static batchSize: number = 10
  // 调用次数
  private static invokeCount: number = 0

  /**
   * 推入待调用列表
   * 
   * 当调用列表为空时，调用DTS API
   * @param list 待调用列表
   * @returns 
   */
  public static pushList(list: any) {
    //是否自动播放
    let playflag = this.playList?.length == 0 ? true : false
    if (list?.length > 0) {
      this.playList = this.playList.concat(list)
    }
    if (playflag && !this.isBusying) {
      this.invokeDtsApi()
    }

  }

  /**
   * 批量调用 DTS API 方法
   */
  protected static invokeDtsApi() {
    let len = this.playList.length
    if (len > 0) {
      this.timeId = setInterval(() => {
        len = this.playList.length
        if (len > 0) {
          this.isBusying = true
          // 批次
          let batch
          if (len > this.batchSize) {//分批次调用
            batch = this.playList.splice(0, this.batchSize)
          } else {
            batch = this.playList.splice(0, len)
          }
          let updateCo = batch.map(item => {
            return {
              id: item.id,
              location: item.location,
              //rotation:item.rotation?item.rotation:[],
              smoothTime: item.smoothTime
            }
          })
          // 更新位置
          __xapi.customObject.moveTo(updateCo)
          // 更新文字
          let updateMarkers = batch.map(item => {
            let result: any = {
              id: item.markerId,
              text: item.markerText
            }
            if (item?.popupUrl) {
              result.popupUrl = item.popupUrl
            }
            return result
          })
          __xapi.marker.update(updateMarkers)
          // 更新历史位置
          this.handHistory(batch)
          //console.log("批量调用CO moveTo方法", batch,updateCo, this.playList)
          this.invokeCount++
          if (this.invokeCount % 10 == 0) {
            console.log("批量更新CO、Marker、Line次数", this.invokeCount, TimeUtil.parseDateTime())
          }
        } else {
          clearInterval(this.timeId)
          this.timeId = null
          this.isBusying = false
        }
      }, 2000)
    } else {
      if (this.timeId) {
        clearInterval(this.timeId)
        this.timeId = null
        this.isBusying = false
      }
    }
  }

  // 更新历史位置
  protected static handHistory(batchList: any) {
    if (batchList?.length > 0) {
      let arrObj: any = []
      batchList.forEach((item: any, index: any) => {
        if (item?.historyPosition?.length > 1) {
          let lineCoords = item.historyPosition.map((point: any, index: any) => {
            return [Number(point.lng), Number(point.lat), Number(point.height)]
          })
          arrObj.push({
            id: item.historyLineId,//折线唯一标识id
            coordinates: ProjectSceneFacade.pro4jTransform(lineCoords),//构成折线的坐标点数组
            coordinateType: 0
          })
        }
      })

      if (arrObj.length > 0) {
        __xapi.polyline.update(arrObj)
      }
      //console.log("更新尾巴线：", batchList, arrObj);
    }
  }

  public static getPlayList() {
    return this.playList
  }
}