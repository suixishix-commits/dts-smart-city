// 定义八叉树节点类
export default class OctreeNode {
  // 构造函数，用于创建八叉树节点
  constructor(bounds, features, eps, maxPoints, level = 0, parent = null) {
    // 节点的边界框，格式为 [xMin, xMax, yMin, yMax, zMin, zMax]
    // 表示节点在三维空间中的范围
    this.bounds = bounds
    // 节点包含的 GeoJSON 点 Feature 对象
    // 每个 Feature 对象代表一个三维空间中的点
    this.features = features
    // 聚类距离（也是八叉树细分的判断依据）
    // 用于判断节点是否需要进一步细分
    this.eps = eps
    // 节点允许的最大点数
    // 当节点内点数超过该值且对角距离满足条件时，节点会细分
    this.maxPoints = maxPoints
    // 当前节点所在的层级，默认从 0 开始
    // 根节点层级为 0，子节点层级依次递增
    this.level = level
    // 父节点引用
    // 用于构建八叉树的层级结构
    this.parent = parent
    // 子节点数组
    // 存储当前节点细分后得到的子节点
    this.children = []
    // 生成节点的唯一 id
    // 如果是根节点，id 为 '0'
    if (parent === null) {
      this.id = '0'
    } else {
      // 非根节点的 id 由父节点 id 和自身在父节点子节点数组中的索引组成
      const parentIndex = parent.children.length
      this.id = `${parent.id}-${parentIndex}`
    }
    // 计算节点的对角距离并作为属性保存
    // 对角距离用于判断节点是否需要细分
    this.diagonalDistance = Math.sqrt(Math.pow(bounds[1] - bounds[0], 2) + Math.pow(bounds[3] - bounds[2], 2) + Math.pow(bounds[5] - bounds[4], 2))

    // 结合对角距离和最大点数判断是否细分
    // 当对角距离大于 eps 且节点内点数超过 maxPoints 时，进行细分
    if (this.diagonalDistance > eps && features.length > maxPoints) {
      this.subdivide()
    }
  }

  // 细分节点的方法
  subdivide() {
    try {
      // 从节点边界框中提取最小和最大坐标
      const [xMin, xMax, yMin, yMax, zMin, zMax] = this.bounds
      // 计算 x 轴方向的中点
      const xMid = (xMin + xMax) / 2
      // 计算 y 轴方向的中点
      const yMid = (yMin + yMax) / 2
      // 计算 z 轴方向的中点
      const zMid = (zMin + zMax) / 2

      // 定义 8 个子节点的边界框
      const subBounds = [
        [xMin, xMid, yMin, yMid, zMin, zMid],
        [xMid, xMax, yMin, yMid, zMin, zMid],
        [xMin, xMid, yMid, yMax, zMin, zMid],
        [xMid, xMax, yMid, yMax, zMin, zMid],
        [xMin, xMid, yMin, yMid, zMid, zMax],
        [xMid, xMax, yMin, yMid, zMid, zMax],
        [xMin, xMid, yMid, yMax, zMid, zMax],
        [xMid, xMax, yMid, yMax, zMid, zMax]
      ]

      // 初始化一个数组，用于存储每个子节点的点要素
      const subFeaturesArray = Array.from({ length: 8 }, () => [])

      // 遍历当前节点的所有点要素
      for (const feature of this.features) {
        // 提取点要素的三维坐标
        const [x, y, z] = feature.geometry.coordinates
        // 根据 x 坐标判断点在 x 轴方向上属于左半部分还是右半部分
        const xIndex = x < xMid ? 0 : 1
        // 根据 y 坐标判断点在 y 轴方向上属于下半部分还是上半部分
        const yIndex = y < yMid ? 0 : 1
        // 根据 z 坐标判断点在 z 轴方向上属于前半部分还是后半部分
        const zIndex = z < zMid ? 0 : 1
        // 计算点所属子节点的索引
        const index = zIndex * 4 + yIndex * 2 + xIndex
        // 将点要素添加到对应的子节点要素数组中
        subFeaturesArray[index].push(feature)
      }

      // 遍历每个子节点的边界框
      for (let i = 0; i < subBounds.length; i++) {
        const subBound = subBounds[i]
        // 获取该子节点对应的点要素数组
        const subFeatures = subFeaturesArray[i]
        // 创建子节点，注意传递正确的层级和父节点信息
        const childNode = new OctreeNode(subBound, subFeatures, this.eps, this.maxPoints, this.level + 1, this)
        // 将子节点添加到当前节点的子节点数组中
        this.children.push(childNode)
      }
    } catch (error) {
      // 捕获细分过程中可能出现的异常并输出详细信息
      console.error('细分节点时出现异常:', {
        error: error.message,
        bounds: this.bounds,
        featureCount: this.features.length,
        id: this.id,
        diagonalDistance: this.diagonalDistance,
        level: this.level
      })
    }
  }

  // 查询指定点 Feature 周围半径范围内的点 Feature 的方法
  queryPointsInRange(feature, eps) {
    // 用于存储查询到的范围内的点要素
    const featuresInRange = []
    // 先判断当前节点的边界框是否与查询范围相交
    if (this.intersectsRange(feature, eps)) {
      // 如果当前节点有子节点
      if (this.children.length > 0) {
        // 递归查询每个子节点中在范围内的点要素
        for (const child of this.children) {
          featuresInRange.push(...child.queryPointsInRange(feature, eps))
        }
      } else {
        // 当前节点没有子节点，直接遍历当前节点的点要素
        for (const f of this.features) {
          // 计算当前点与查询点之间的欧几里得距离
          const distance = Math.sqrt(Math.pow(f.geometry.coordinates[0] - feature.geometry.coordinates[0], 2) + Math.pow(f.geometry.coordinates[1] - feature.geometry.coordinates[1], 2) + Math.pow(f.geometry.coordinates[2] - feature.geometry.coordinates[2], 2))
          // 如果距离小于等于查询半径，则将该点添加到结果数组中
          if (distance <= eps) {
            featuresInRange.push(f)
          }
        }
      }
    }
    // 返回查询到的范围内的点要素数组
    return featuresInRange
  }

  // 判断节点是否与查询范围相交的方法
  intersectsRange(feature, eps) {
    // 提取查询点的三维坐标
    const [x, y, z] = feature.geometry.coordinates
    // 提取当前节点的边界框坐标
    const [xMin, xMax, yMin, yMax, zMin, zMax] = this.bounds
    // 计算点在 x 轴方向上到边界框的最短距离
    const dx = Math.max(0, xMin - x, x - xMax)
    // 计算点在 y 轴方向上到边界框的最短距离
    const dy = Math.max(0, yMin - y, y - yMax)
    // 计算点在 z 轴方向上到边界框的最短距离
    const dz = Math.max(0, zMin - z, z - zMax)
    // 判断点到边界框的最短距离的平方是否小于等于查询半径的平方
    // 如果是，则表示相交，返回 true，否则返回 false
    return dx * dx + dy * dy + dz * dz <= eps * eps
  }

  // 判断是否为根节点的方法
  isRoot() {
    // 如果父节点为 null，则表示当前节点是根节点
    return this.parent === null
  }
}
