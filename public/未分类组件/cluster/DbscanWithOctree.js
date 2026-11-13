import OctreeNode from './OctreeNode'

export default class DbscanWithOctree {
  /**
   * 结合八叉树和 DBSCAN 进行聚类函数
   *
   * @param {*} features
   * @param {*} eps
   * @param {*} minNeighbors
   * @param {*} maxPoints
   * @returns
   */
  static dbscanWithOctree(features, eps, minNeighbors, maxPoints) {
    // 初始化所有点的标签为 -1，表示未分类
    const labels = new Array(features.length).fill(-1)
    // 聚类编号，从 1 开始
    let clusterId = 0

    // 计算所有点的边界框
    let xMin = Infinity,
      xMax = -Infinity
    let yMin = Infinity,
      yMax = -Infinity
    let zMin = Infinity,
      zMax = -Infinity
    // 遍历所有点要素，更新边界框的最小和最大坐标
    for (const feature of features) {
      const [x, y, z] = feature.geometry.coordinates
      xMin = Math.min(xMin, x)
      xMax = Math.max(xMax, x)
      yMin = Math.min(yMin, y)
      yMax = Math.max(yMax, y)
      zMin = Math.min(zMin, z)
      zMax = Math.max(zMax, z)
    }
    // 构建边界框数组
    const bounds = [xMin, xMax, yMin, yMax, zMin, zMax]

    // 构建八叉树，根节点的层级为 0，父节点为 null
    const octree = new OctreeNode(bounds, features, eps, maxPoints)

    // 遍历所有点要素
    for (let i = 0; i < features.length; i++) {
      // 如果该点已经被分类，则跳过
      if (labels[i] !== -1) continue

      // 使用八叉树查询该点周围 eps 范围内的邻居点
      const neighbors = octree.queryPointsInRange(features[i], eps)
      // 如果邻居点数量小于最小邻居数
      if (neighbors.length < minNeighbors) {
        // 将该点标记为噪声点
        labels[i] = -1
        // 跳过当前循环，继续处理下一个点
        continue
      }

      // 开始一个新的聚类，聚类编号加 1
      clusterId++
      // 将当前点标记为新聚类的编号
      labels[i] = clusterId

      // 初始化种子集，包含除当前点之外的邻居点
      const seedSet = neighbors.filter((neighbor) => neighbor !== features[i])
      // 当种子集不为空时
      while (seedSet.length > 0) {
        // 从种子集中取出一个邻居点
        const neighborFeature = seedSet.pop()
        // 查找该邻居点在原始点要素数组中的索引
        const neighborIndex = features.findIndex((feature) => feature === neighborFeature)
        // 如果该邻居点还未分类
        if (labels[neighborIndex] === -1) {
          // 将该邻居点标记为当前聚类的编号
          labels[neighborIndex] = clusterId
          // 查询该邻居点周围 eps 范围内的新邻居点
          const newNeighbors = octree.queryPointsInRange(neighborFeature, eps)
          // 如果新邻居点数量大于等于最小邻居数
          if (newNeighbors.length >= minNeighbors) {
            // 将新邻居点中不在种子集的点添加到种子集中
            for (const newNeighbor of newNeighbors) {
              if (!seedSet.includes(newNeighbor)) {
                seedSet.push(newNeighbor)
              }
            }
          }
        }
      }
    }

    // 返回所有点的聚类标签数组
    return labels
  }
}
