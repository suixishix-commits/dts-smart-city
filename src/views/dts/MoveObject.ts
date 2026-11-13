/**
 * 移动对象类
 */
export default class MoveObject {
  /**
 * 获取uuid字符串
 * @param { Number } len uuid长度
 * @return { String } uuid
 */
  static async getUUID() {
    if (__xapi?.isReady) {
      await __xapi.polyline.add();
    }
  }
}
// 具名导出：unplugin-auto-import 21 按类名自动导入（import { MoveObject }）
export { MoveObject }
