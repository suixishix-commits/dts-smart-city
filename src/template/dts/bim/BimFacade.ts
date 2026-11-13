import { getData } from '@/api/fileData'
import DtsFacade from '@/components/dts/DtsFacade'
import Timer from '@/utils/Timer'


/**
 * BIM信息接口
 * 
 * 1、获取Actor信息思路。
 * 1)根据BIM信息中的业务唯一标识字段，先线下调用getActorIdMapper方法，将输出结果手动存储在public\data\bim\actor_mapper目录下。
 * 2)根据业务唯一标识调用getActorInfoByBsm获取db中的Actor BIM信息
 * 
 */
export default class BimFacade {
  /** BIM信息缓存 */
  private static bimInfoCache: any = {}
  // 以图层ActorId映射缓存
  private static layerActorIdMapperCache: any = {}

  /**
   * 重要方法1：调用DTS API从SDB中解析BIM数据
   * @param layerId 
   * @returns 
   */
  public static async getBimLayerDbData(layerId: string) {
    if (__xapi?.isReady) {
      //1. 获取图层所有的Actor Id
      const res = await __xapi.tileLayer.getObjectIDs(layerId)
      if (res?.data?.length == 1) {
        const arrActorId = res.data[0].objectIds
        console.log(`图层${layerId} Actor数量：${arrActorId?.length}`)

        //2.根据ActorId获取数据库信息，采取批次获取
        let loopResult: any = { dataList: arrActorId, sliceSize: 1000, result: [] }
        async function getActorInfoFromDB(list: any) {
          let result: any = []
          try {
            let resTemp = await __xapi.tileLayer.getActorInfoFromDB([{ tileLayerId: layerId, objectIds: list }])
            if (resTemp?.data && resTemp.data[layerId]) {
              let infoMap = resTemp.data[layerId]
              for (const actorId in infoMap) {
                if (Object.prototype.hasOwnProperty.call(infoMap, actorId)) {
                  const actor = infoMap[actorId];
                  let properties: any = {}
                  //SDB为Properties，PG为properties
                  if (actor?.Properties?.length > 0) {
                    let arrProperties = actor.Properties
                    arrProperties.forEach((item: any, index: any) => {
                      for (const key in item) {
                        if (Object.prototype.hasOwnProperty.call(item, key)) {
                          const element = item[key];
                          properties[key] = element
                        }
                      }
                    })
                  }
                  // actorId与UniqueID不完全一致。
                  properties['ActorId'] = actorId
                  result.push(properties)
                }
              }
            } else {
              console.log("tileLayer.getActorInfoFromDB返回数据为空", resTemp)
            }
          } catch (error) {
            console.log("调用tileLayer.getActorInfoFromDB失败", list)
          }
          console.log(`批次调用tileLayer.getActorInfoFromDB,请求ID数量${list?.length},结果数量${result?.length}`)
          return result
        }
        await Timer.loopCallFunction(getActorInfoFromDB, loopResult)
        console.log(`图层${layerId}的BIM信息：`, loopResult);
        return loopResult.result
      }
    }
  }

  /**
   * 重要方法2：调用DTS API从SDB中解析BIM数据带坐标
   * @param layerId 
   * @returns 
   */
  public static async getBimLayerDbDataInculdingLocation(layerId: string) {
    const res = await this.getBimLayerDbData(layerId)
    if (res?.length > 0) {
      const arrBimInfo: any = res
      const arrActorId = arrBimInfo.map((item: any, index: any) => {
        return item.ActorId
      })
      //2.根据ActorId获取数据库信息，采取批次获取
      const loopResult: any = { dataList: arrActorId, sliceSize: 1000, result: [] }
      async function getActorInfo(list: any) {
        const result: any = []
        try {
          const resTemp = await __xapi.tileLayer.getActorInfo({ id: layerId, objectIds: list })
          //console.log('getActorInfo信息1:', resTemp)
          if (resTemp?.data?.length == list.length) {
            const arrActorInfo = resTemp.data
            arrActorInfo.forEach((item: any, index: any) => {
              result.push({ actorId: list[index], location: item.location, rotation: item.rotation, scale: item.scale })
            })

          } else {
            console.log("tileLayer.getActorInfo返回数据为空", resTemp)
          }
        } catch (error) {
          console.log("调用tileLayer.getActorInfo失败", error, list)
        }
        console.log("批次调用tileLayer.getActorInfo", result?.length)
        return result
      }
      await Timer.loopCallFunction(getActorInfo, loopResult)
      if (loopResult.result.length == arrBimInfo.length) {
        arrBimInfo.forEach((bimInfo: any, index: any) => {
          let temp = loopResult.result[index]
          if (bimInfo?.ActorId == temp.actorId) {
            bimInfo.location = temp.location
            bimInfo.rotation = temp.rotation
            bimInfo.scale = temp.scale
            loopResult.result[index] = bimInfo
          }
        })
        //console.log(`图层${layerId}的BIM信息（带坐标）2：`, loopResult)
      }
      console.log(`图层${layerId}的BIM信息（带坐标）：`, loopResult);
      return loopResult
    }
  }

  /**
   * 重要方法3：获取图层Actor带坐标映射
   * 
   * @param layerId 
   * @param keyField 
   */
  public static async getActorMapper(layerId: string, keyField = '构件编码', returnMultiActor: boolean = false) {
    let res = await BimFacade.getBimLayerDbDataInculdingLocation(layerId);
    // 以测点编号为key
    let keyFieldMap: any = undefined
    let count = 0
    if (res?.result?.length > 0) {
      const arrBimInfo: any = res.result;
      // 以测点编号为key
      keyFieldMap = {}
      arrBimInfo.forEach((bimInfo: any, index: any) => {
        if (bimInfo[keyField]) {
          let item = { layerId: layerId, actorId: bimInfo.ActorId, location: bimInfo.location }
          if (returnMultiActor) {
            if (!keyFieldMap[bimInfo[keyField]]) {
              keyFieldMap[bimInfo[keyField]] = []
            }
            keyFieldMap[bimInfo[keyField]].push(item)
          } else {
            keyFieldMap[bimInfo[keyField]] = item
          }
          count++
        }
      })
    }
    console.log(`含坐标BIM映射关系总数为${count},请复制另存为：`, keyFieldMap)
    return keyFieldMap
  }

  /**
   * 重要方法4：获取图层ActorID映射
   * 以指定字段为key，创建与Actor ID的映射关系
   * 
   * @param layerId 图层ID
   * @param keyField BIM信息字段
   */
  public static async getActorIdMapper(layerId: string, keyField: string, isMultiActor: boolean = false) {
    let dataList: any = await this.getBimLayerDbData(layerId)
    let result: any = {}
    if (dataList?.length > 0) {
      // 构件总数
      let actorCount = dataList.length
      // 有keyField字段的个数
      let hasKeyFieldActorCount = 0
      dataList.forEach((item: any, index: any) => {
        if (Object.hasOwn(item, keyField)) {
          hasKeyFieldActorCount++
          let strKey = item[keyField]
          // GZB特殊处理
          if (strKey.indexOf('__') > -1) {
            strKey = strKey.split('__')[0]
          }
          if (isMultiActor) {//一个主键对应多个Actor
            if (Object.hasOwn(result, strKey)) {
              result[strKey].push(item.ActorId)
            } else {
              result[strKey] = [item.ActorId]
            }
          } else {//一个主键对应一个Actor
            result[strKey] = item.ActorId
          }
        }
      })
      console.log(`图层${layerId}共有${actorCount}个Actor,有${keyField}字段的Actor个数：${hasKeyFieldActorCount},${keyField}重复：${hasKeyFieldActorCount - Object.keys(result).length}`);
      console.log(`图层${layerId}的BIM信息,共${Object.keys(result).length}个有效构件，请右键另存为映射文件：`, result);
    } else {
      console.log(`获取ActorId映射失败,图层${layerId}BIM信息为空`);
    }
  }


  /**
   * 重要方法5：通过ActorId找Actor信息数组
   * 
   * @param layerId 图层Id
   * @param actorId 构件Id
   */
  public static async getArrayInfoOfSingleActor(layerId: string, actorId: string) {
    let result: any = await this.getArrayInfoOfActor(layerId, [actorId])
    if (result && result[actorId]) {
      return result[actorId]
    } else {
      return undefined
    }
  }

  /**
   * 通过ActorId数组找Actor信息
   * 
   * @param layerId 图层Id
   * @param arrActorId 构件Id数组
   */
  public static async getArrayInfoOfActor(layerId: string, arrActorId: Array<string>) {
    let result: any = undefined
    if (layerId && arrActorId?.length > 0 && __xapi.isReady) {
      try {
        let resTemp = await __xapi.tileLayer.getActorInfoFromDB([{ tileLayerId: layerId, objectIds: arrActorId }])
        if (resTemp?.data && resTemp.data[layerId]) {
          result = {}
          let infoMap = resTemp.data[layerId]
          // 中文属性判断
          let chineseReg = /[\u4e00-\u9fa5]/;
          for (const actorId in infoMap) {
            if (Object.prototype.hasOwnProperty.call(infoMap, actorId)) {
              const actor = infoMap[actorId];
              let properties: Array<any> = []
              let property: any = undefined
              //SDB为Properties，PG为properties
              if (actor?.Properties?.length > 0) {
                let arrProperties = actor.Properties
                arrProperties.forEach((item: any, index: any) => {
                  for (const key in item) {
                    if (Object.prototype.hasOwnProperty.call(item, key) && chineseReg.test(key)) {
                      property = {}
                      const element = item[key];
                      property['field'] = key
                      property['fieldValue'] = element
                      // property['actorId'] = actorId
                      properties.push(property)
                    }
                  }
                })
              }
              // 貌似跟UniqueID一致。              
              result[actorId] = properties
            }
          }
        } else {
          console.log(`${layerId}.${arrActorId.join(',')}getActorInfoFromDB返回数据为空`, resTemp, layerId, arrActorId)
        }
      } catch (error) {
        console.log(`${layerId}.${arrActorId.join(',')}调用tileLayer.getActorInfoFromDB失败`, error, arrActorId)
      }
    }
    return result
  }

  /**
   * 根据ActorId获取数据库信息
   * 
   * @param layerId 图层ID
   * @param arrActorIds ActorId
   * @returns 
   */
  public static async getActorInfoFromDB(layerId: string, arrActorIds: any) {
    let result: any = {}
    try {
      let resTemp = await __xapi.tileLayer.getActorInfoFromDB([{ tileLayerId: layerId, objectIds: arrActorIds }])
      if (resTemp?.data && resTemp.data[layerId]) {
        let infoMap = resTemp.data[layerId]
        for (const actorId in infoMap) {
          if (Object.prototype.hasOwnProperty.call(infoMap, actorId)) {
            const actor = infoMap[actorId];
            let properties: any = {}
            //SDB为Properties，PG为properties
            if (actor?.Properties?.length > 0) {
              let arrProperties = actor.Properties
              arrProperties.forEach((item: any, index: any) => {
                for (const key in item) {
                  if (Object.prototype.hasOwnProperty.call(item, key)) {
                    const element = item[key];
                    properties[key] = element
                  }
                }
              })
            }
            // 貌似跟UniqueID一致。
            properties['ActorId'] = actorId
            result[actorId] = properties
          }
        }
      } else {
        console.log("tileLayer.getActorInfoFromDB返回数据为空", resTemp)
      }
    } catch (error) {
      console.log("调用tileLayer.getActorInfoFromDB失败", arrActorIds)
    }
    return result
  }

  /**
   * 根据标识码获取ActorId
   * 
   * @param layerId 图层ID
   * @param arrBsm 标识码
   */
  public static async getActorId(layerId: string, layerName: string, arrBsm: string[]) {
    let result: any = undefined
    if (arrBsm?.length > 0) {
      let arrActorId: any[] = []
      let layerActorIdMapper = undefined
      // 从缓存里找图层的ActorID映射
      if (!this.layerActorIdMapperCache[layerId]) {
        let res = await getData(`bim/actor_mapper/${layerName}.json`)
        if (res.data) {
          this.layerActorIdMapperCache[layerId] = res.data
        }
      }
      layerActorIdMapper = this.layerActorIdMapperCache[layerId]
      if (layerActorIdMapper) {
        arrBsm.forEach((bsm: any) => {
          if (Array.isArray(layerActorIdMapper[bsm])) {
            arrActorId = arrActorId.concat(layerActorIdMapper[bsm])
          } else if (layerActorIdMapper[bsm]) {
            arrActorId.push(layerActorIdMapper[bsm])
          }
        })
      }
      result = arrActorId
      console.log(`${arrBsm.length}个标识码,有ActorId${arrActorId.length}个`);
    }

    return result
  }

  /**
   * 显示Actor
   *
   */
  public static async showActors(layerId: string, layerName: string, arrBsm: string[]) {
    if (__xapi.isReady) {
      let arrActorId = await this.getActorId(layerId, layerName, arrBsm)
      console.log("显示Actor:", layerId, arrActorId);
      __xapi.tileLayer.showActors({ id: layerId, objectIds: arrActorId })
    }
  }

  /**
   * 隐藏Actor
   *
   */
  public static async hideActors(layerId: string, layerName: string, arrBsm: string[]) {
    if (__xapi.isReady) {
      let arrActorId = await this.getActorId(layerId, layerName, arrBsm)
      console.log("隐藏Actor:", layerId, arrActorId);
      __xapi.tileLayer.hideActors({ id: layerId, objectIds: arrActorId })
    }
  }

  /**
   * 通过标识码找Actor信息
   * 
   * @param layerId 
   * @param bsm 
   */
  public static async getActorInfoByBsm(layerId: string, layerName: string, bsm: string) {
    let properties: any = undefined
    let layerActorIdMapper: any = undefined
    // 从缓存里找图层的ActorID映射
    if (!this.layerActorIdMapperCache[layerName]) {
      let res = await getData(`bim/actor_mapper/${layerName}.json`)
      if (res.data) {
        this.layerActorIdMapperCache[layerName] = res.data
      }
    }
    layerActorIdMapper = this.layerActorIdMapperCache[layerName]
    //console.log(`图层${layerId} ActorID映射表`, layerActorIdMapper)
    if (layerActorIdMapper?.hasOwnProperty(bsm)) {
      let actorId = layerActorIdMapper[bsm]
      if (Array.isArray(actorId)) {
        actorId = actorId[0]
      }

      let infoMap = await this.getActorInfoFromDB(layerId, [actorId])
      if (infoMap[actorId]) {
        properties = {}
        let info = infoMap[actorId]
        // 中文属性判断
        let chineseReg = /[\u4e00-\u9fa5]/;
        for (const key in info) {
          if (Object.prototype.hasOwnProperty.call(info, key)) {
            const element = info[key];
            //判断是不是中文属性
            if (chineseReg.test(key) || key == 'UniqueID' || key == 'ActorId') {
              properties[key] = element
            }
          }
        }
      }
      console.log(`Actor ${actorId}的BIM信息:`, properties)
    }
    return properties
  }
}