
function toRadians(degree) {
  return degree * (Math.PI / 180)
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // 地球平均半径，单位为公里
  const deltaLatByRad = toRadians(lat2 - lat1)
  const deltaLonByRad = toRadians(lon2 - lon1)

  const lat1ByRad = toRadians(lat1)
  const lat2ByRad = toRadians(lat2)

  const a =
    Math.sin(deltaLatByRad / 2) * Math.sin(deltaLatByRad / 2) +
    Math.cos(lat1ByRad) * Math.cos(lat2ByRad) * Math.sin(deltaLonByRad / 2) * Math.sin(deltaLonByRad / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return distance
}

export function calculateDistance3D(startPoint, endPoint) {
  //console.log('calculateDistance3D----', startPoint, endPoint)
  const x1 = startPoint[0]
  const y1 = startPoint[1]
  const z1 = startPoint[2]
  const x2 = endPoint[0]
  const y2 = endPoint[1]
  const z2 = endPoint[2]
  return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) + (z2 - z1) * (z2 - z1))
}

export function interpolateWgs84(point1, point2, totalDistance, distance) {
  const radius = 6371000 // 地球半径，单位米
  const lat1 = point1[0] * (Math.PI / 180)
  const lon1 = point1[1] * (Math.PI / 180)
  const lat2 = point2[0] * (Math.PI / 180)
  const lon2 = point2[1] * (Math.PI / 180)

  const dLat = lat2 - lat1
  const dLon = lon2 - lon1

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const d = totalDistance / radius

  const interpolatedLat = lat1 + (dLat * distance) / (c * radius)
  const interpolatedLon = lon1 + (dLon * distance) / (c * radius)

  return [interpolatedLat * (180 / Math.PI), interpolatedLon * (180 / Math.PI)]
}


/**
 * 在两个坐标点插入指定个数的点(每点之间的距离均分)
 * @param {*} startCoordinate 起点
 * @param {*} endCoordinate 终点
 * @param {*} count 点数
 * @returns
 */
export function interpolatePoints(startCoordinate, endCoordinate, count) {
  const coords = []
  //取头不取尾
  coords.push(startCoordinate)
  for (let index = 1; index <= count; index++) {
    const fraction = index / (count + 1)
    const x = startCoordinate[0] + (endCoordinate[0] - startCoordinate[0]) * fraction
    const y = startCoordinate[1] + (endCoordinate[1] - startCoordinate[1]) * fraction
    const z = startCoordinate[2] + (endCoordinate[2] - startCoordinate[2]) * fraction
    coords.push([x, y, z])
  }
  return coords
}

/**
 * 生成dts customObject 飞行移动轨迹所需的数据
 * @param coordinates 拆线坐标数组,投影坐标
 * @param intervalDistance 插值间隔距离
 * @param maxPoint 插值保留最大的点数，超过则不进行插值 小于等于0--表示不限制
 * @param maxTime 整个飞行轨迹总的最大移动时间(秒) 小于等于0--表示不限制最大时间
 * @returns customObject startMove 需要的数组
 */
export  function initFlyStartMove(coordinates, intervalDistance = 2000, maxPointCount = 30, maxTime = 30) {
  //生成插值点
  let insertedPoints = initInterpolatePoints(coordinates, intervalDistance, maxPointCount);

  console.log("coordinates len:", coordinates.length)
  console.log("After insertedPoints len:", insertedPoints.length)

  let pointCount = insertedPoints.length;
  let distance = 0;
  let lastTime = 0;

  //时间系数
  let K = 0.0004;
  //每个间隔距离所需时间（秒）
  let deltaTime = K * intervalDistance;
  console.log("default deltaTime: " + deltaTime)
  //预估整个拆线飞行完总时间
  let estimateTotalTime = (pointCount - 1) * deltaTime;
  console.log("estimateTotalTime: " + estimateTotalTime);
  //需要进行总体时间控制
  if (maxTime > 0 && estimateTotalTime > maxTime) {
    console.log("需控制在 " + maxTime + " 秒走完")
    K = (maxTime / estimateTotalTime) * K;
    // console.log("新的 deltaTime: " + deltaTime + " and default delataTime:" + (0.0004 * distance));
    // console.log("新的总时间:" + ((pointCount - 1) * (K * intervalDistance)));
    // console.log("新的K: " + K)
  }

  //存放返回结果（符合startMove格式）
  let pathPointArr = []
  for (let i = 0; i < pointCount; i++) {
    if (i > 0) {
      // console.log("i:"+i, insertedPoints[i - 1], insertedPoints[i])
      distance = calculateDistance3D(insertedPoints[i - 1], insertedPoints[i]);
      lastTime = lastTime + (K * distance)
    }
    pathPointArr.push({
      time: lastTime,
      coordinate: insertedPoints[i],
      rotation: [0, 0, 0]
    })
  }

  return pathPointArr;
}


  /**
   * 对坐标数组进行插值生成
   * @param coordinates 拆线坐标数组,投影坐标
   * @param intervalDistance 插值间隔距离
   * @param maxPoint 插值保留最大的点数，超过则不进行插值 小于等于0--表示不限制
   * @returns 插值后的数组
   */
  export function initInterpolatePoints(coordinates, intervalDistance = 2000, maxPointCount = 30) {
    //存放返回结果
    let insertedPoints = new Array();
    //已是投影坐标
    if (maxPointCount > 0 && coordinates?.length > maxPointCount) {//当超过30个点，不在插值，尽可能30秒内完成
      return coordinates;
    } else {
      // 剩余点数
      let remainingPoints = maxPointCount > 0 ? maxPointCount - coordinates.length : Number.NaN;
      for (let i = 1; i < coordinates.length; i++) {
        let distance = calculateDistance3D(coordinates[i - 1], coordinates[i]);
        if (distance > intervalDistance) {//只有大于间隔距离时才插值
          // 计算本段能插几个点
          let pointCount = 0
          if (distance % intervalDistance == 0) {//刚好整除
            pointCount = (distance / intervalDistance) - 1
          } else {
            //同下取整
            pointCount = Math.floor(distance / intervalDistance) - 1
          }
          //有最大插入点限制时
          if (maxPointCount > 0) {
            if (remainingPoints > pointCount && pointCount > 0) {
              remainingPoints = remainingPoints - pointCount;
            } else {//如果剩余点数小于本段点数，则取剩余点数
              pointCount = remainingPoints
            }
            if (pointCount > 1) {//大于1个点，则插值
              //插值函数取头不取尾。如果取了尾，在下一轮中是头，又会取一次。
              let tmp = interpolatePoints(coordinates[i - 1], coordinates[i], pointCount)
              insertedPoints.push(...tmp)
              remainingPoints = remainingPoints - pointCount
            } else {
              insertedPoints.push(coordinates[i - 1])
            }
          }
          else {
            //按实际间隔距离计算，该是多少就是多少，无总点数限制
            if (pointCount > 1) {//大于1个点，则插值
              //插值函数取头不取尾。如果取了尾，在下一轮中是头，又会取一次。
              let tmp = interpolatePoints(coordinates[i - 1], coordinates[i], distance / pointCount, pointCount)
              insertedPoints.push(...tmp)
            }
            else {
              insertedPoints.push(coordinates[i - 1])
            }

          }
        } else {
          insertedPoints.push(coordinates[i - 1])
        }
      }
      //把线的最后一个点加上
      insertedPoints.push(coordinates[coordinates.length - 1])
      return insertedPoints;
    }
  }


