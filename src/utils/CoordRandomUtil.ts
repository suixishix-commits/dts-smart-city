/**
 * 随机数、字符工具类
 */
export default class CoordRandomUtil {
  // 单线
  static singleLine: any[] = [[491496.90, 2492731.17, 10.26], [492477.33, 2492724.5, 10.36], [493523.43, 2492724.16, -5.07625], [494441.63, 2492727.67, 1.78], [493766.22, 2492032.96, -0.36], [492676.54, 2491054.55, 4.88], [491811.91, 2490475.28, 7.80], [493201.38, 2490462.62, -0.01], [494630.43, 2490462.45, -0.46]]
  // 多线
  static multiLine: any[] = [[[491496.90, 2492731.17, 10.26], [492477.33, 2492724.5, 10.36], [493523.43, 2492724.16, -5.07625], [494441.63, 2492727.67, 1.78], [493766.22, 2492032.96, -0.36], [492676.54, 2491054.55, 4.88], [491811.91, 2490475.28, 7.80], [493201.38, 2490462.62, -0.01], [494630.43, 2490462.45, -0.46]]]
  /**
   * 获取uuid字符串
   * @param { Number } len uuid长度
   * @return { String } uuid
   */
  static getUUID(len = 32): string {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('')
    const uuid: any = []
    let cLen = chars.length
    for (let i = 0; i < len; i++) {
      let r = this.getRandomSeed(0, cLen - 1)
      uuid.push(chars[i == 19 ? (r & 0x3) | 0x8 : r])
    }
    let uLen = uuid.length
    let timeStr = String(new Date().getTime())
    for (let i = 0; i < timeStr.length; i++) {
      let r = this.getRandomSeed(0, uLen - 1)
      uuid[r] = timeStr[i]
    }
    return uuid.join('')
  }

  /**
   *获取某个范围内的随机数
   *
   * @param min 最小值
   * @param max 最大值
   * @returns
   */
  static getRandomSeed(min: number, max: number): number {
    return Math.round(Math.random() * (max - min) + min)
  }

  /**
   * 获取单个随机点坐标
   * @returns 随机点
   */
  static getPoint(): any[] {
    const x = this.getRandomSeed(488192.7625, 497855.5146875)
    const y = this.getRandomSeed(2489259.36, 2494060)
    const z = this.getRandomSeed(2, 26)
    return [x, y, z]
  }

  /**
   * 获取多个随机点坐标
   * @param max 最大点数
   * @returns 
   */
  static getMultiPoint(max: any): any[] {
    let result: any[] = []
    if (max > this.singleLine.length) {
      result = [...this.singleLine]
      for (let i = 0, len = max - this.singleLine.length; i < len; i++) {
        result.push(this.getPoint())
      }
    } else {
      result = this.singleLine.slice(0, max)
    }
    return result
  }

  /**
   * 获取最大线数
   * @param max 最大线数
   * @returns 
   */
  static getMultiLine(max: any): any[] {
    let result: any[] = []
    if (max > this.multiLine.length) {
      result = [...this.multiLine]
      for (let i = 0, len = max - 1; i < len; i++) {
        let line: any = []
        let lineMaxPoint = Math.ceil(this.getRandomSeed(3, 10))
        for (let j = 0; j < lineMaxPoint; j++) {
          line.push(this.getPoint())
        }
        result.push(line)
      }
    }
    return result
  }
}

// 具名导出：unplugin-auto-import 21 按类名自动导入（import { CoordRandomUtil }）
export { CoordRandomUtil }
