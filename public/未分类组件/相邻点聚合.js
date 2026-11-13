/**
 * 相邻点聚合分析
 *
 *
 * @param {*} locations 轨迹点数组，每个点中有坐标属性coord
 * @param {*} eps 聚合距离
 * @returns
 */
function aggregateLocation(locations, eps = 1) {
  // let list = personLocations
  let list = locations
  //console.log('聚合前数据', list)
  // 分组后的间隔距离
  let disArr = []
  // 合并原地不动点后的点
  let listFilter = []
  // 第一个点必要
  list[0].distanceToPrev = 99999999
  list[0].distToPrev = 99999999
  list[0].totalDistance = 0
  // 上一次原地不动的起点
  let lastFilterPoint = null
  // 计算点与下一个点、与上一个点的距离
  // 只针对当前节点进行children合并
  for (let index = 0, count = list.length; index < count - 1; index++) {
    const [x1, y1, z1] = list[index].coord
    const [x2, y2, z2] = list[index + 1].coord
    let dis = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2)
    dis = Number(dis.toFixed(2))
    list[index].distToNext = dis
    list[index + 1].distToPrev = dis
    if (index != 0) {
      list[index].totalDistance = list[index - 1].totalDistance + dis
    }
    // 如果当前节点与上一个节点的距离小于１米，作为上个节点的子节点
    if (list[index].distToPrev < eps) {
      if (lastFilterPoint?.children) {
        lastFilterPoint.children.push(list[index])
        //console.log(`第${index}节点作为子节点`)
      } else {
        //console.log('不应该不存在children属性：', lastFilterPoint)
      }
    } else {
      list[index].children = []
      // 设置跳过起点索引，便于校验数据
      list[index].skipFrom = index
      listFilter.push(list[index])
      lastFilterPoint = list[index]
      //console.log('lastFilterPoint添加了啥', list[index])
    }
  }
  // 最后一个点
  list[list.length - 1].totalDistance = list[list.length - 2].totalDistance + list[list.length - 1].distToPrev
  listFilter.push(list[list.length - 1])

  // 重新计算分组前后距
  for (let index = 0, count = listFilter.length; index < count - 1; index++) {
    const [x1, y1, z1] = listFilter[index].coord
    const [x2, y2, z2] = listFilter[index + 1].coord
    let dis = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2)
    dis = Number(dis.toFixed(2))
    listFilter[index].distanceToNext = dis
    listFilter[index + 1].distanceToPrev = dis
    // 计算跳过的距离长度
    let len
    if (listFilter[index]?.children?.length > 0) {
      len = listFilter[index].distToNext
      listFilter[index].children.forEach((item, index) => {
        len += item.distToNext
      })
    }
    listFilter[index].skipDistance = len
    disArr.push(dis + '-' + listFilter[index]?.children?.length + '-' + len + '-' + listFilter[index].skipFrom)
  }
  listFilter[listFilter.length - 1].totalDistance = listFilter[listFilter.length - 2].totalDistance + listFilter[listFilter.length - 1].distToPrev

  //console.log('历史轨迹间距', list, listFilter, disArr.join(','))
  return listFilter
}
