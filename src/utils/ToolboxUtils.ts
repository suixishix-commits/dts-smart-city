export default class ToolboxUtils {
  /**
 * 处理三维坐标相同的对象，自动进行偏移，最多支持9个对象
 * @param {Array} objects - 包含三维坐标的对象数组，每个对象应包含x、y和z属性
 * @param {number} offset - 偏移量，决定对象之间的距离
 * @returns {Array} 处理后的对象数组，坐标已适当偏移
 */
  public static handleCoordinateOffsets(objects, offset = 0.1) {
    // 首先创建三维坐标到对象的映射，用于分组
    const coordinateMap = {};

    // 遍历所有对象，按三维坐标分组
    objects.forEach(obj => {
      // 使用x、y和z组合作为唯一键
      const key = `${obj.coordinate[0]},${obj.coordinate[1]},${obj.coordinate[2]}`;
      if (!coordinateMap[key]) {
        coordinateMap[key] = [];
      }
      coordinateMap[key].push(obj);
    });

    // 定义三维偏移模式，最多9个位置，围绕原始点分布
    // 采用3x3x3立方体的部分位置，确保分布均匀
    const offsetPatterns = [
      { dx: 0, dy: 0, dz: 0 },    // 原始位置
      { dx: -1, dy: -1, dz: 0 },  // 左上前
      { dx: 0, dy: -1, dz: 0 },   // 中上
      { dx: 1, dy: -1, dz: 0 },   // 右上前
      { dx: -1, dy: 0, dz: 0 },   // 左中
      { dx: 1, dy: 0, dz: 0 },    // 右中
      { dx: -1, dy: 1, dz: 0 },   // 左下前
      { dx: 0, dy: 1, dz: 0 },    // 中下
      { dx: 1, dy: 1, dz: 0 },    // 右下前
      // 如需利用z轴更多空间，可添加以下模式
      // {dx: 0, dy: 0, dz: 1},   // 正后方
      // {dx: 0, dy: 0, dz: -1},  // 正前方
    ];

    // 处理每个坐标组
    Object.values(coordinateMap).forEach((group: any) => {
      // 如果只有一个对象，不需要偏移
      if (group.length <= 1) return;

      // 获取原始三维坐标
      const originalX = group[0].coordinate[0];
      const originalY = group[0].coordinate[1];
      const originalZ = group[0].coordinate[2];

      // 对每个对象应用偏移，最多处理9个
      group.forEach((obj, index) => {
        if (index >= offsetPatterns.length) return; // 超过9个不处理
        obj.coordinate = [...obj.coordinate]
        const pattern = offsetPatterns[index];
        obj.coordinate[0] = originalX + pattern.dx * offset;
        obj.coordinate[1] = originalY + pattern.dy * offset;
        obj.coordinate[2] = originalZ + pattern.dz * offset;
      });
    });

    return objects;

  }
}
// 具名导出：unplugin-auto-import 21 按类名自动导入（import { ToolboxUtils }）
export { ToolboxUtils }
