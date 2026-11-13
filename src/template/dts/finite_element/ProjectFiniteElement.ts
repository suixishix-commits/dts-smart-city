import DtsFacade from '../../../components/dts/DtsFacade';
import { getData, getRemoteData } from '@/api/fileData'
import SessionStorage from '../../../utils/SessionStorage';

/**
 * 项目级有限元公共方法
 */
export default class ProjectFiniteElement {
  // 项目配置信息
  public static config: any = undefined

  public static async initFiniteElement() {
    if (!ProjectFiniteElement.config) {
      let res = await getData('finite-element/finiteEleConfig.json')
      if (res?.data) {
        //console.log("工程有限元配置信息：", res);
        ProjectFiniteElement.config = res.data
        return res?.data
      }
    }
  }

  /**
  * 获取有限元指标分量JSON文件
  * 
  * @param buildingModel 有限元模型
  * @param physicalQuantity 物理量
  * @param cycleId 周期ID
  * @returns 
  */
  protected static async getSchemeIndicator(buildingModel: any = 'ejxsz', physicalQuantity: any = 'SEEPAGE_P', cycleId: any = 'default', stepNo: any = 1) {
    let url = `${gVar.finiteElement.jsonServiceRootUrl}/${buildingModel}_${cycleId}_${stepNo}/${physicalQuantity}/info.json`;
    let result
    let res = await getRemoteData(url)
    if (res?.data?.D1) {
      result = res.data
    }
    //console.log("有限元分量最大最小值解析成功！", result);
    return result
  }

  /**
   * 
   * @param buildingModel 有限元模型
   * @param physicalQuantity 物理量
   * @param cycleId 周期ID
   * @param indicatorType 分量 
   */
  protected static async getIndicatorMinMax(buildingModel: any = 'ejxsz', physicalQuantity: any = 'SEEPAGE_P', cycleId: any = 'default', indicatorKey: any = 'S22', stepNo: any = 1) {
    indicatorKey = indicatorKey.toUpperCase()
    const cacheKey = `${buildingModel}_${cycleId}_${stepNo}_${physicalQuantity}`
    let minMaxJson = SessionStorage.getItem(cacheKey)
    if (!minMaxJson) {
      minMaxJson = await ProjectFiniteElement.getSchemeIndicator(buildingModel, physicalQuantity, cycleId, stepNo)
      SessionStorage.setItem(cacheKey, minMaxJson)
    }
    if (minMaxJson && minMaxJson[indicatorKey] > 0) {
      let scale = minMaxJson[indicatorKey]
      let min = minMaxJson[`${indicatorKey}Min`]
      let max = minMaxJson[`${indicatorKey}Max`]
      //console.log(`分量${indicatorKey}极值：${scale},最小值：${min},最大值：${max}`);
      return { min, max, scale }
    }
  }

  /**
   *  获取有限元构造
   * @param scheme 
   */
  protected static async getMaterialsStructure(buildingModel: any = 'ejxsz', physicalQuantity: any = 'SEEPAGE_P', cycleId: any = 'default', stepNo: any = 1) {

    let url = `${gVar.finiteElement.jsonServiceRootUrl}/${buildingModel}_${cycleId}_${stepNo}/${physicalQuantity}/typeInfo.json`;
    let result
    let res = await getRemoteData(url)
    if (res?.data) {
      result = res?.data
      //console.log("有限元材质构造解析成功：", result);
    }
    return result
  }

  /**
   * 获取有限元配置信息   * 
   * 
   * @param scheme 
   */
  public static async getConfigInfo(buildingModel: any = 'ejxsz') {
    let config: any = this.config
    let result: any
    if (!config) {
      config = await ProjectFiniteElement.initFiniteElement()
    }
    if (config) {
      let keys = Object.keys(config)
      for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        let configItem = config[key]
        //console.log(index, key, configItem);
        if (configItem.bsm == buildingModel) {
          result = configItem
          break
        }
      }
    }
    //console.log(`${buildingModel}的配置信息：`, result);
    return result
  }


  /**
   * 添加有限元模型
   * 
   * @param buildingModel 模型名称
   * @param physicalQuantity 物理量
   * @param indicatorType 分量
   * @param cycleId 周期ID
   * @param structure 选中结构材质
   * @param valueRange 着色范围过滤
   * @returns 
   */
  public static async addFiniteElement(buildingModel: any = 'ejxsz', physicalQuantity: any = 'SEEPAGE_P', indicatorType: any = 's22', cycleId: any = 'default', stepNo: any = 1, structure: any = undefined, valueRange: any = []) {
    if (__xapi?.isReady || true) {
      console.log(buildingModel, physicalQuantity, indicatorType, cycleId, '参数');
      try {
        if (buildingModel && physicalQuantity && indicatorType && cycleId) {
          // 1、先获取配置信息
          // *A-模型配置信息*
          let configItem = await ProjectFiniteElement.getConfigInfo(buildingModel)
          if (!configItem) {
            console.log(`${buildingModel}的配置信息获取失败，请检查！`);
            return
          }
          console.log(`${buildingModel}的配置信息：`, configItem)

          // 2、获取分量配置信息
          // 物理量数组
          const arrPhysicalQuantity = configItem.physicalQuantity
          // 分量数组
          const physicalQuantityConfigFilter = arrPhysicalQuantity.filter((item: any) => item.name_en.toUpperCase() == physicalQuantity.toUpperCase())
          // *B-物理量配置信息*
          const physicalQuantityConfig = physicalQuantityConfigFilter[0]
          const arrIndicatorConfig = physicalQuantityConfig?.indicator?.filter((item: any) => item.type.toUpperCase() == indicatorType.toUpperCase())
          //console.log(`${indicatorType}分量：`, arrIndicatorConfig);
          // *C-分量配置信息*
          const indicatorConfig = arrIndicatorConfig[0]

          // 3、获取分量indicator的最大最小值信息。如果不传入，先从配置文件中获取，如果没有，则从有限元数据中获取
          let minMax
          if (valueRange?.length == 2) {
            minMax = {
              min: valueRange[0],
              max: valueRange[1],
              scale: 1
            }
          } else {
            if (indicatorConfig?.valueRange?.length == 2) {
              minMax = {
                min: indicatorConfig.valueRange[0],
                max: indicatorConfig.valueRange[1],
                scale: 1
              }
            } else {
              minMax = await ProjectFiniteElement.getIndicatorMinMax(buildingModel, physicalQuantity, cycleId, indicatorType, stepNo)
            }
          }
          // 如果没有获得分量的最大最小值，则退出
          if (!(minMax?.scale)) {
            console.log(`${indicatorType} 的分量最大最小值获取失败，请检查！`)
            return
          }
          //console.log(`${physicalQuantity} 分量最大最小值：`, minMax)

          // 3、获取材质构造信息.有限元Info.json中的key为材料号，value为API索引
          if (!structure) {
            let materialMapper = configItem?.materialMapper
            if (physicalQuantityConfig?.materialMapper?.length > 0) {
              materialMapper = physicalQuantityConfig.materialMapper
            }
            if (indicatorConfig?.materialMapper) {
              materialMapper = indicatorConfig.materialMapper
            }

            if (materialMapper?.length > 0) {
              let materialIndex: any = []
              materialMapper.forEach((item: any, index: any) => {
                materialIndex.push(item.num)
              })
              // console.log(`配置展示哪些材料？`, materialIndex, configItem, physicalQuantityConfig, indicatorConfig);
              // sections用到的index是typeInfo.json中的value
              let res = await ProjectFiniteElement.getMaterialsStructure(buildingModel, physicalQuantity, cycleId)
              if (res) {
                structure = []
                for (const key in res) {
                  if (!(materialIndex.indexOf(Number(key)) >= 0)) {
                    structure.push({ index: res[key], visible: false })
                  }
                }
              }
            }
          }
          console.log(`${buildingModel} 材质构造`, structure);

          const feId = `${buildingModel}_${cycleId}_${stepNo}_${physicalQuantity}_${indicatorType}`
          //构件分区
          let sections = structure
          let min = minMax.min * minMax.scale
          let max = minMax?.max * minMax.scale
          let step = (max - min) / 12
          let contourParams: any = []

          // 等值线,平分最大最小值
          for (let index = 1; index < 12; index++) {
            contourParams.push([min + step * index, 0.006])
          }

          let fe1 = {
            id: feId,
            dataPath: gVar.finiteElement.rootPath + '/' + `${buildingModel}_${cycleId}_${stepNo}/${physicalQuantity}`, //目录
            coordinate: configItem.coordinate,
            rotation: configItem.rotation,
            type: ProjectFiniteElement.config.typeMapper[indicatorConfig.type],
            valueRange: [min, max],
            showLine: false, //显隐等值线
            showColorLine: false, //是否显示成彩色线
            sections: sections,
            contourParams: contourParams,
            colors: {
              file: gVar.finiteElement.defaultColor
            }
          }
          console.log('有限元对象信息：', fe1, step, minMax);
          await __xapi.finiteElement.clear()
          DtsFacade.addFiniteElement(fe1, false, {})
          return { fe: fe1, minMax: minMax }
        }
      } catch (error) {
        console.log("添加有限元参数不正确！", error, buildingModel, physicalQuantity, indicatorType, cycleId, structure)
        await __xapi.finiteElement.clear()
      }
    }
  }
}