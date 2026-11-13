interface StringIndexedObject {
  [key: string]: string
}

/**
 * 日期时间计算工具类
 */
export default class TimeUtil {
  /**
   *解析时间字符串，变为时间类型
   *
   * @param strDateTime 格式:2022-01-01 00:00:00
   * @returns
   */
  public static parse(strDateTime: string): Date {
    if (!strDateTime && strDateTime.length != 19) {
      throw new Error('输入的时间格式有误！')
    }
    let arrDateTime = strDateTime.split(' ')
    let arrDate = arrDateTime[0].split('-')
    let arrTime = arrDateTime[1].split(':')
    return new Date(Number(arrDate[0]), Number(arrDate[1]) - 1, Number(arrDate[2]), Number(arrTime[0]), Number(arrTime[1]), Number(arrTime[2]))
  }

  /**
   * 返回两个时间之间的持续时间(秒)
   * @param strBeginTime 开始时间
   * @param strEndTime 结束时间
   * @returns
   */
  public static getDuration(strBeginTime: string, strEndTime: string): number {
    let beginTime: Date = this.parse(strBeginTime)
    let endTime: Date = this.parse(strEndTime)
    let timeTemp: Date
    if (beginTime > endTime) {
      timeTemp = beginTime
      beginTime = endTime
      endTime = timeTemp
    }
    let duration: number = endTime.getTime() - beginTime.getTime()
    duration = duration / 1000
    return duration
  }

  /**
   * 返回两个时间之间的持续时间(秒)
   * @param beginTime 开始时间
   * @param endTime 结束时间
   * @returns
   */
  public static getDurationByDate(beginTime: Date, endTime: Date): number {
    let timeTemp: Date
    if (beginTime > endTime) {
      timeTemp = beginTime
      beginTime = endTime
      endTime = timeTemp
    }
    let duration: number = endTime.getTime() - beginTime.getTime()
    duration = duration / 1000
    return duration
  }

  /**返回增加*秒后的时间 */
  public static addDateTime(strBeginTime: string, addSecond: number) {
    let beginTime: Date = this.parse(strBeginTime)
    let endTime = new Date(beginTime.getTime() + addSecond * 1000)
    return this.parseDateTime(endTime)
  }

  /**
   *将时间类型转换为字符串
   * @param date
   * @param format yyyy-MM-dd hh:mm:ss qq
   * @returns
   */
  public static parseDateTime(date: Date = new Date(), format: string = 'yyyy-MM-dd hh:mm:ss.S') {
    let curDate = date
    const o: StringIndexedObject = {
      'M+': String(curDate.getMonth() + 1), // 月份
      'd+': String(curDate.getDate()), // 日
      'h+': String(curDate.getHours() >= 10 ? curDate.getHours() : '0' + curDate.getHours()), // 小时
      'm+': String(curDate.getMinutes() >= 10 ? curDate.getMinutes() : '0' + curDate.getMinutes()), // 分
      's+': String(curDate.getSeconds() >= 10 ? curDate.getSeconds() : '0' + curDate.getSeconds()), // 秒
      'q+': String(Math.floor((curDate.getMonth() + 3) / 3)), // 季度
      S: String(curDate.getMilliseconds()) // 毫秒
    }
    let regExp: any = /(y+)/.exec(format)
    if (regExp && regExp[1]) {
      format = format.replace(regExp[1], (curDate.getFullYear() + '').substring(4 - regExp[1].length))
    }
    for (let k in o) {
      let regExp: any = new RegExp('(' + k + ')').exec(format)
      if (regExp && regExp[1]) {
        format = format.replace(regExp[1], regExp[1].length === 1 ? o[k] : ('00' + o[k]).substring(('' + o[k]).length))
      }
    }
    return format
  }

  /**
   * 获取当前日期之后或之前N天的日期
   *
   * @param date 当前日期
   * @param days 第N天，N可以为过去
   * @returns
   */
  public static getDate(date: Date = new Date(), days: number = -1): Date {
    let result = new Date(date.getTime())
    result.setDate(result.getDate() + days)
    return result
  }

  /**
   *将时间类型转换为字符串
   * @param milliseconds  1970年之后的毫秒数
   * @param format yyyy-MM-dd hh:mm:ss qq
   * @returns
   */
  public static parseTime(milliseconds: any, format: string = 'yyyy-MM-dd hh:mm:ss') {
    let dt = new Date(milliseconds)
    return this.parseDateTime(dt, format)
  }

  /**
   * 转成1h2min3s
   * @param second 秒数
   */
  public static getHMS(seconds: any) {
    let hours = Math.floor(seconds / 3600)
    let minutes = Math.floor((seconds % 3600) / 60)
    let secs = seconds % 60
    return `${hours}h${minutes}min${secs}s`
  }

  /**
   * 将年月型字符转换成日期对
   * @param dateStr,年月字符串,如 2024-7
   * @returns 
   */
  public static parseYearMonth(dateStr: any) {
    const [year, month] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, 1); // 注意月份是从0开始的，所以需要减1
  }

}

// 具名导出：unplugin-auto-import 21 按类名自动导入（import { TimeUtil }）
export { TimeUtil }
