/**
 * 飞行计划场景公共方法
 */
import qs from 'qs'
import {  initFlyStartMove, initInterpolatePoints } from '@/utils/distance.js';
import TimeUtil from '@/utils/TimeUtil';
import DtsFacade from '@/components/dts/DtsFacade'


export default class FlyPlanFacade {

  /**
     *
     * @param region 区域范围
     * @param heightRange 高度范围
     * @param timeRange 时间范围
     * @param 飞行计划路线数据
     * @returns
     */
  public static showFlyPathByFilter(filterObj: {
    region: any,
    heightRange: { heightMin: number, heightMax: number, isSelected: boolean },
    timeRange: { startTime: string, endTime: string, isSelected: boolean },
    where: any,
  }, flyPathData: any[]) {
    console.log("showFlyPathByFilter be called", filterObj);

    if (!__xapi?.isReady) {
      console.log("__xapi not ready");
      return
    }
    if (flyPathData == null && flyPathData == undefined || flyPathData.length == 0) {
      console.log("flyPathData is Empty");
      return;
    }
    let needShow: any = [];
    needShow = flyPathData;

    //时间过滤
    let timeRange = filterObj.timeRange;
    if (timeRange
      && timeRange.startTime && timeRange.startTime.length > 0
      && timeRange.startTime && timeRange.startTime.length > 0
      && timeRange.isSelected == true) {

      let queryStartTime = TimeUtil.parseYearMonth(timeRange.startTime).getTime();
      let queryEndTime = TimeUtil.parseYearMonth(timeRange.endTime).getTime();
      let isNeedFilterTime = true;
      if (Number.isNaN(queryStartTime) || Number.isNaN(queryEndTime)) {
        isNeedFilterTime = false;
      }
      if (isNeedFilterTime) {
        if (queryEndTime < queryStartTime) {
          console.log("结束时间小于开始时间")
          return [];
        }
        console.log("queryStartTime:" + queryStartTime)
        console.log("queryEndTime:" + queryEndTime)
        needShow = needShow.filter((item: any) => {
          let itemStartTime = TimeUtil.parseYearMonth(item.userData.startTime).getTime();
          let itemEndTime = TimeUtil.parseYearMonth(item.userData.endTime).getTime();
          return queryEndTime >= itemStartTime && itemEndTime >= queryStartTime;
        })
      }

    }

    //高度过滤
    let heightRange = filterObj.heightRange;
    if (heightRange
      && heightRange.isSelected == true
      && !Number.isNaN(heightRange.heightMin)
      && !Number.isNaN(heightRange.heightMax)) {

      let queryHeightMin = heightRange.heightMin
      let queryHeightMax = heightRange.heightMax
      if (queryHeightMax < queryHeightMin) {
        console.log("最高高度小于最低高度")
        return [];
      }
      needShow = needShow.filter((item: any) => {
        let itemHeightMin = item.userData.heightMin;
        let itemHeightMax = item.userData.heightMax;
        return queryHeightMax >= itemHeightMin && itemHeightMax >= queryHeightMin;
      })
    }
    //TODO:行政过滤

    console.log("过滤前:" + flyPathData.length + " 过滤后：" + needShow.length);
    // console.log(needShow);
    //路线与模拟飞行胶囊id 处理
    let flyPathIds: any = [];
    let coFlyObjIds: any = [];
    let collisionIds: any = [];

    needShow.forEach((toShowItem: any) => {
      let splitStrs = toShowItem.id.split("_")
      let id = "";
      if (splitStrs.length > 1) {
        id = splitStrs[1];
      }
      else {
        id = splitStrs[0];
      }
      flyPathIds.push("flyPath_" + id);
      coFlyObjIds.push("coFlyObj_" + id);
      collisionIds.push(...toShowItem.collisionIds);
    });

    // 先通过groupid隐藏所有的飞行计划路线
    __xapi.infoTree.hideByGroupId('gp_flightplan_co');
    __xapi.infoTree.hideByGroupId('gp_flightplan_line');
    __xapi.marker.hideByGroupId('flyCollision');
    

    // 在通过id显示选中的飞行计划路线
    if (flyPathIds.length > 0) {
      __xapi.polyline.show(flyPathIds);
      __xapi.customObject.show(coFlyObjIds);
      __xapi.marker.show(collisionIds);
      console.log("collisionIds:", collisionIds);
    }

  }



}

/**
 * 基于dts marker创建弹窗
 * @param coordinate 创建点坐标
 * @param userData 附加用户数据
 * @param options 选项参数, 其中markerId与url为必含属性，setting为定制marker相关参数可选参数对象
 */
export async function createMarkerPopup(coordinate: [], userData: any, options: any) {
  if (!options.hasOwnProperty('markerId') || !options.hasOwnProperty('url')) {
    throw new Error('Options object is missing required properties: markerId, url');
  }

  console.log(userData, 'userDatauserData');

  // //检查是否有起降点进行连接
  // if (options.hasOwnProperty("checkLandingPoint") && options.checkLandingPoint == true) {
  //   let coordinatesData = JSON.parse(userData.geom).coordinates;
  //   let startPoint = coordinatesData[0];
  //   let endPoint = coordinatesData[coordinatesData.length - 1];
  //   let startLandPoint = [];
  //   let endLandPoint = [];
  //   if (startPoint[2] > 0 || endPoint[2] > 0) {
  //     startLandPoint = [...startPoint];
  //     endLandPoint = [...endPoint];
  //     startLandPoint[2] = 0;
  //     endLandPoint[2] = 0;

  //     let lines: any = [];
  //     let line: any = [];
  //     //起升点
  //     line.push(startLandPoint);
  //     line.push(startPoint);
  //     lines.push(line);
  //     //降落点
  //     line = [];
  //     line.push(endLandPoint);
  //     line.push(endPoint);
  //     lines.push(line);
  //     console.log("飞行起降点连接线", lines)
  //     drawLines(lines, {});
  //   }

  // }
  // console.log(qs.stringify(userData), 'userDatauserData--------------');
  //复制一份
  let copyUserData = Object.assign({}, userData)
  //清除一些不必要的又量大的数据
  copyUserData.geom = null;
  copyUserData.alarmList = null;

  let jsonData = qs.stringify(copyUserData)
  let popupUrl = gVar.dtsCloud.popupRootUrl + options.url + `?${jsonData}`

  //支持经纬度坐标和普通投影坐标两种类型
  let o1 = {
    id: 'flyPath_marker',
    groupId: 'markerAdd',
    coordinate: coordinate,//坐标位置
    coordinateType: 0,//默认0是投影坐标系，也可以设置为经纬度空间坐标系值为1
    anchors: [-48 / 2, 48],
    imageSize: [48, 48], //图片的尺寸
    hoverImageSize: [50, 50],//鼠标悬停时显示的图片尺寸
    range: [1, 10000000],//可视范围
    viewHeightRange: [10, 10000000],// 可见高度范围
    rangeRatio: 0.01,//可见高度范围的调整系数
    fixedSize: true,//图片固定尺寸，取值范围：false 自适应，近大远小，true 固定尺寸，默认值：false 

    popupURL: popupUrl,//弹窗HTML链接
    popupBackgroundColor: [1.0, 1.0, 1.0, 1],//弹窗背景颜色
    popupSize: [355, 548],//弹窗大小
    popupOffset: [0, 0],//弹窗偏移

    autoHidePopupWindow: false,//失去焦点后是否自动关闭弹出窗口
    autoHeight: false,// 自动判断下方是否有物体
    displayMode: 1,//智能显示模式  开发过程中请根据业务需求判断使用四种显示模式
    clusterByImage: true,// 聚合时是否根据图片路径分类，即当多个marker的imagePath路径参数相同时按路径对marker分类聚合
    priority: 0,//避让优先级
    occlusionCull: false//是否参与遮挡剔除
  };

  if (options && options.setting) {
    Object.assign(o1, options.setting);
  }
  let markerArr: any = [];
  markerArr.push(o1);
  DtsFacade.focusByBBox(JSON.parse(userData.geom).coordinates)
  //海量poi添加请使用批量添加 提供效率
  await __xapi.marker.delete('flyPath_marker')
  await __xapi.marker.add(markerArr).then(() => {
    DtsFacade.showPopupWindow('flyPath_marker');
    //高亮
    DtsFacade.highlightPolyline("flyPath_" + userData.id);
    console.log("飞行计划撒点：", popupUrl, markerArr);
  });
}


/**
 * 初始飞行计划路线
 * @returns 初始化的飞行计划路线数组
 */
// export async function initFlyPlanPath() {
//   try {
//     const res: any = await getFlyPlanList();
//     if (res == undefined || res == null || res.code != 200) {
//       console.log("飞行计划数据为空,飞行路线初始化失败");
//       return
//     }
//     // //获取飞行骑手信息数据
//     // const flyerRes = await getFlyerList();
//     // const flyerMap = new Map();
//     // if (flyerRes
//     //   && flyerRes.hasOwnProperty("code")
//     //   && flyerRes.code == 200
//     //   && flyerRes.data.list
//     //   && flyerRes.data.list.length > 0) {
//     //   //获取飞手数据
//     //   flyerRes.data.list.forEach((item: { id: any }) => {
//     //     flyerMap.set(item.id + '', item);
//     //   });
//     // }


//     // console.log(res.data, '飞行计划路线');
//     //飞行计划路线数组
//     let pArr: any = [];
//     res.data.list.forEach(async (item: any) => {
//       // //飞行骑手信息处理
//       // if (item.planFlyers
//       //   && item.planFlyers
//       //   && item.planFlyers.length > 0) {
//       //   let flyerIds = item.planFlyers.split(",");
//       //   let names = "";
//       //   // let value = "";
//       //   for (let i = 0; i < flyerIds.length; i++) {
//       //     let obj = flyerMap.get(flyerIds[i]);
//       //     if (obj && obj.flyerName) {
//       //       names = names + obj.flyerName + ",";
//       //     }
//       //   }
//       //   if (names.length > 0) {
//       //     names = names.substring(0, names.length - 1);
//       //   }
//       //   item.planFlyerNames = names;
//       // }
//       // //对坐标数据最小高度进行修正
//       // let handledCoordinates = JSON.parse(item.geom).coordinates;
//       // //首尾两点不处理（可能是起降点）
//       // for(let i = 1;i < handledCoordinates.length - 1; i++) {
//       //    let z = handledCoordinates[i][2];
//       //    if(z <= 200){
//       //     // console.log("修正前coord", handledCoordinates[i])
//       //     handledCoordinates[i][2] = 200;
//       //     // console.log("修正后coord", handledCoordinates[i])
//       //   }
//       // }

//       let p1 = {
//         id: "flyPath_" + item.id,//折线唯一标识id
//         groupId: "gp_flightplan_line",
//         coordinates: ProjectSceneFacade.pro4jTransform(handledCoordinates),//构成折线的坐标点数组
//         coordinateType: 0,//坐标系类型，取值范围：0为Projection类型，1为WGS84类型，2为火星坐标系(GCJ02)，3为百度坐标系(BD09)，默认值：0
//         range: [1, 1000000],//可视范围：[近裁距离, 远裁距离]，取值范围: [任意负值, 任意正值]
//         // color: (item.alarm == true ? Color.Red : Color.White),//折线颜色
//         color: Color.White,//折线颜色
//         thickness: 200,//折线宽度
//         intensity: 0.5,//亮度
//         flowRate: 0.5,//流速
//         shape: 0, //折线类型 0：直线， 1：曲线
//         depthTest: false,//是否做深度检测 开启后会被地形高度遮挡
//         style: PolylineStyle.Arrow,//折线样式 参考样式枚举：PolylineStyle
//         tiling: 0,//材质贴图平铺比例
//         userData: item,//用户自定义数据
//         collisionIds:[], //飞行冲突点(marker)
//       };
//       pArr.push(p1);
//     });
//     await __xapi.polyline.add(pArr, () => {
//       console.log('飞行计划路线添加成功');
//       //mark 冲突点
//       // addCollisionMark(pArr);
//     });
//     return pArr;

//   } catch (err) {
//     console.log("异常:", err);
//   };
// }


/**
 * 按飞行线路进行模拟飞行(通过customObject startMove来实现移动)
 * @param ptr 飞行线路数组
 * @returns
 */
export async function startFlyByPath(ptr: any) {
  try {
    console.log('相机跟随：', ptr);
    //co 数组（飞机)，撤点
    let coArr: any = [];
    if (ptr == undefined || ptr == null || ptr.length == 0) {
      console.log("飞行计划数据为空,无法模拟飞行")
      return
    }
    let coIdArr = new Array();
    let coId = ''
    ptr.forEach(async (item: any) => {
      // coId = "coFlyObj_camera_view"
      coId = "coFlyObjCameraView_" + item.id.split("_")[1]
      let co = {
        id: coId, //自定义对象唯一id
        groupId: "gp_flightplan_co",
        userData: JSON.stringify(item.userData),
        pakFilePath: '@path:DTS_Library.pak', //资源库pak文件路径,推荐使用cloud内置的文件资源管理器加载pak并使用@path方式传入参数
        //assetPath: '/JC_CustomAssets/ObjectLibrary/Exhibition/交通工具/其他/无人机_1', //资源目录，自定义对象在pak文件资源包里的相对路径
        assetPath: '/JC_CustomAssets/ObjectLibrary/Exhibition/无人机/旋翼无人机',
        location: item.coordinates[0], //位置坐标
        coordinateType: 0, // 坐标系类型
        rotation: [0, 0, 0], // 世界坐标系旋转
        localRotation: [0, 0, 0], //模型自身旋转
        scale: [20, 20, 20], //模型缩放
        isEffectRotation: true, //是否开启旋转效果
        smoothMotion: 0, //1: 平滑移动，0: 跳跃移动
        supportAttach: false, //不支持贴画贴合
        visible: true, //模型加载后默认是否显示
      };
      coArr.push(co)
      coIdArr.push({ id: co.id, alarm: item.userData.alarm });
    })
    
    let coIds = coIdArr.map(co => co.id)
    await __xapi.customObject.delete(coIds)
    await __xapi.customObject.add(coArr, () => {
      changeColor(coIdArr)
    });

    for (let i = 0; i < ptr.length; i++) {
      let item = ptr[0]
      let pathPointArr = initFlyStartMove(item.insertedPoints, 1000, 0, 30)
      //开始移动   
      __xapi.customObject.startMove(coId, 0, pathPointArr)
      __xapi.customObject.focus(coId, -1)
      console.log('飞行计划移动', coId, pathPointArr, item, coArr);
    }

  } catch (err) {
    console.log("异常:", err);
  };

}

/**
 * 按飞行线路进行模拟飞行(通过customObject setLocation来实现移动)
 * @param ptr 飞行线路数组
 * @returns
 */
const intervalIdSet = new Set<any>(); //全局保存定时
export async function startFlyByLocation(ptr: any) {
  // export async function startFlyByPath(ptr: any) {
  try {
    //co 数组（飞机)，撤点
    let coArr: any = [];
    if (ptr == undefined || ptr == null || ptr.length == 0) {
      console.log("飞行计划数据为空,无法模拟飞行")
      return
    }
    let maxPointCount = 0;
    let coIdArr = new Array();
    ptr.forEach((item: any) => {
      let co = {
        id: "coFlyObj_" + item.id.split("_")[1], //自定义对象唯一id
        groupId: "gp_flightplan_co",
        userData: JSON.stringify(item.userData),
        pakFilePath: '@path:DTS_Library.pak', //资源库pak文件路径,推荐使用cloud内置的文件资源管理器加载pak并使用@path方式传入参数
        //assetPath: '/JC_CustomAssets/ObjectLibrary/Exhibition/交通工具/其他/无人机_1', //资源目录，自定义对象在pak文件资源包里的相对路径
        assetPath: '/JC_CustomAssets/ObjectLibrary/Exhibition/无人机/旋翼无人机',
        location: item.coordinates[0], //位置坐标
        coordinateType: 0, // 坐标系类型
        rotation: [0, 0, 0], // 世界坐标系旋转
        localRotation: [0, 0, 0], //模型自身旋转
        scale: [20, 20, 20], //模型缩放
        isEffectRotation: true, //是否开启旋转效果
        smoothMotion: 1, //1: 平滑移动，0: 跳跃移动
        supportAttach: false, //不支持贴画贴合
        visible: true, //模型加载后默认是否显示
      };
      coArr.push(co)
      coIdArr.push({ id: co.id, alarm: item.userData.alarm });

      if (!item.hasOwnProperty("insertedPoints")
        || item.insertedPoints == null
        || item.insertedPoints == undefined) {
        //需初始化生成插值点
        const intervalDistance = 2000; //间隔距离 
        let maxCount = 30;//插值后最多点数
        item.insertedPoints = initInterpolatePoints(item.coordinates, intervalDistance, maxCount);
        if (maxPointCount < item.insertedPoints.length) {
          maxPointCount = item.insertedPoints.length;
        }
      }
    })
    console.log("maxPointCount: " + maxPointCount);
    let coIds = coIdArr.map(co => co.id)
    await __xapi.customObject.delete(coIds)
    await __xapi.customObject.add(coArr, () => {
      changeColor(coIdArr)
    });

    console.log('飞行计划移动CO对象', coArr);

    //更新飞行胶囊位置
    let pointIndex = 0;
    let intervalId = setInterval(async () => {
      // console.log("pointIndex: " + pointIndex);
      let isHasNext = false;
      __xapi.customObject.updateBegin();
      for (let i = 0; i < ptr.length; i++) {
        let item = ptr[i];
        let coId = "coFlyObj_" + item.id.split("_")[1];

        if (pointIndex < item.insertedPoints.length) {
          __xapi.customObject.setLocation(coId, item.insertedPoints[pointIndex])
        }
        if (pointIndex < item.insertedPoints.length - 1) {
          isHasNext = true
        }

      }
      __xapi.customObject.updateEnd();

      if (isHasNext == false) {
        //所有路线的点已更新完,需要终止定时器
        console.log("clearInterval:" + intervalId + " max pointIndex:" + pointIndex)
        clearInterval(intervalId);
        intervalIdSet.delete(intervalId);
        return;
      }

      pointIndex++;
    }, 1000);

    intervalIdSet.add(intervalId);

    console.log("intervalId: " + intervalId);


  } catch (err) {
    console.log("异常:", err);
  };

}
//清除还在运行中的定时器
export function clearTimes() {
  for (let interalId of intervalIdSet) {
    console.log("clearTimes:" + interalId);
    clearInterval(interalId);
  }
  intervalIdSet.clear();
}

export async function clearAllFlyPath() {
  clearTimes();
  if(__xapi && __xapi.isReady) {
    await __xapi.infoTree.deleteByGroupId("gp_flightplan_co")
    await __xapi.infoTree.deleteByGroupId("gp_flightplan_line")  
  }
}
function drawLines(linePointList: any, options: any) {
  __xapi.infoTree.deleteByGroupId(['fly_qi_jiang_dian'])
  let pArr: any = []
  linePointList?.forEach((item: any, index: any) => {
    let p1 = {
      id: index,//折线唯一标识id
      groupId: 'fly_qi_jiang_dian',
      coordinates: item,//构成折线的坐标点数组
      coordinateType: 0,//坐标系类型，取值范围：0为Projection类型，1为WGS84类型，2为火星坐标系(GCJ02)，3为百度坐标系(BD09)，默认值：0
      range: [1, 10000000000],//可视范围：[近裁距离, 远裁距离]，取值范围: [任意负值, 任意正值]
      color: Color.Red,
      thickness: 100,//折线宽度
      intensity: 1,//亮度
      flowRate: 5,//流速
      shape: 1, //折线类型 0：直线， 1：曲线
      depthTest: false,//是否做深度检测 开启后会被地形高度遮挡
      style: PolylineStyle.Normal,//折线样式 参考样式枚举：PolylineStyle
      tiling: 0,//材质贴图平铺比例
      userData: JSON.stringify(item),//用户自定义数据
    };
    if (options && options.setting) {
      Object.assign(p1, options.setting);
    }

    pArr.push(p1);
  })
  __xapi.polyline.add(pArr)
}

//改变颜色操作
function changeColor(coIdArr: any[]) {
  //有飞行冲突时的颜色
  const collisionColor = [1, 0, 0, 1];
  
  //更新颜色
  let arrobj: any = []
  coIdArr.forEach(coId => {
    // console.log("true == coId.alarm: " + (true == coId.alarm))
    //更新胶囊默认颜色    
    let updateObj: any = {
      id: coId.id,
      functionName: '颜色',
      parameters: [
        { "paramType": 6, "paramValue": [6 / 255, 130 / 255, 142 / 255] } //默认颜色[0.309469, 0.955974, 1, 1]
      ]
    }
    arrobj.push(updateObj)
    let updateObj2: any = {
      id: coId.id,
      functionName: '亮度',
      parameters: [
        { "paramType": 3, "paramValue": 0.1 } //默认1
      ]
    }
    arrobj.push(updateObj2)
    let updateObj3: any = {
      id: coId.id,
      functionName: '透明度',
      parameters: [
        { "paramType": 3, "paramValue": 0.5 } //默认颜色0.1
      ]
    }
    arrobj.push(updateObj3)
  })
  //console.log("changeColor", coIdArr, arrobj);
  __xapi.customObject.callBatchBPFunction(arrobj)
}







// 具名导出：unplugin-auto-import 21 按类名自动导入（import { FlyPlanFacade }）
export { FlyPlanFacade }
