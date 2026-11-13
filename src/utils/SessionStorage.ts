/**
 * window.SessionStorage缓存
 */
export default class SessionStorage {

  public static setItem(key: string, value: any) {
    if (value === undefined) {
      return
    }
    window.sessionStorage.setItem(key, JSON.stringify(value))
  }

  public static getItem(key: string) {
    let json: any = window.sessionStorage.getItem(key)
    return JSON.parse(json)
  }

  public static removeItem(key: string) {
    window.sessionStorage.removeItem(key)
  }

  public static clear() {
    window.sessionStorage.clear()
  }
}
// 具名导出：unplugin-auto-import 21 按类名自动导入（import { SessionStorage }）
export { SessionStorage }
