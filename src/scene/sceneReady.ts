import store from '@/stores'
import { watch } from 'vue'

/**
 * 场景就绪后 resolve(true)；连接失败时 resolve(false)。
 * 以 store 里的 sceneState 为准（而不是只听一次就绪事件），所以等待期间变成 failed 也能结束。
 * 传入 signal 可以取消等待（页面卸载时）：取消后 resolve(false)。
 */
export function whenSceneReady(signal?: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    if (signal?.aborted) return resolve(false)

    let settled = false
    let stop: (() => void) | undefined
    const settle = (ready: boolean) => {
      if (settled) return
      settled = true
      stop?.()
      signal?.removeEventListener('abort', onAbort)
      resolve(ready)
    }
    const onAbort = () => settle(false)

    stop = watch(
      () => store.dtsStore.sceneState,
      state => {
        if (state === 'ready') settle(true)
        else if (state === 'failed') settle(false)
      },
      { immediate: true, flush: 'sync' }
    )
    // immediate 回调在 watch() 返回前执行，那时还拿不到 stop
    if (settled) stop()
    else signal?.addEventListener('abort', onAbort)
  })
}
