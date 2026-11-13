/**
 * window.localStorage 浏览器永久缓存
 */
export default class LocalStorage {

  public static setItem(key: string, value: any) {
    if (value === undefined) {
      return
    }
    window.localStorage.setItem(key, JSON.stringify(value))
  }

  public static getItem(key: string) {
    let json: any = window.localStorage.getItem(key)
    if (json) {
      return JSON.parse(json)
    }
  }

  public static removeItem(key: string) {
    window.localStorage.removeItem(key)
  }

  public static clear() {
    window.localStorage.clear()
  }
}
// 具名导出：unplugin-auto-import 21 按类名自动导入（import { LocalStorage }）
export { LocalStorage }
