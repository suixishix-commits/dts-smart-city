/**
 * 渲染端断开（实例被重启、被管理员踢出、网络中断）后，场景接口一律抛 "Not connected!"。
 * 图层开关、时间轴、线宽缩放这些调用散在各处，断开后它们的失败都不影响面板本身，
 * 所以统一在这里接住：只记一条警告（每次断开记一次），不作为未处理的错误抛到界面上。其余错误照常处理。
 */
let warned = false

/** 是否是渲染端断开导致的错误 */
export function isDisconnected(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error)
  return text.includes('Not connected')
}

/** 记一条断开警告；同一次断开只记一次，重新连上后（resetDisconnectWarning）再记 */
export function warnDisconnected(): void {
  if (warned) return
  warned = true
  console.warn('[scene] 渲染端已断开，场景操作暂停；面板仍可使用')
}

export function resetDisconnectWarning(): void {
  warned = false
}

/** 安装全局处理：未处理的 Promise 拒绝和 Vue 组件里的断开错误都降级为一条警告 */
export function installSceneErrorHandling(app: { config: { errorHandler?: unknown } }): void {
  window.addEventListener('unhandledrejection', e => {
    if (!isDisconnected(e.reason)) return
    e.preventDefault()
    warnDisconnected()
  })
  const previous = app.config.errorHandler as ((err: unknown, instance: unknown, info: string) => void) | undefined
  app.config.errorHandler = (err: unknown, instance: unknown, info: string) => {
    if (isDisconnected(err)) {
      warnDisconnected()
      return
    }
    if (previous) previous(err, instance, info)
    else console.error(err)
  }
}
