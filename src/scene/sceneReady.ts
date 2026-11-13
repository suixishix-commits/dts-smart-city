import store from '@/stores'
import emitter from '@/utils/emitter'

/** 场景就绪后 resolve(true)；连接失败时 resolve(false)。 */
export function whenSceneReady(): Promise<boolean> {
  const state = store.dtsStore.sceneState
  if (state === 'ready') return Promise.resolve(true)
  if (state === 'failed') return Promise.resolve(false)
  return new Promise(resolve => {
    const onReady = () => {
      emitter.off('SceneOnReady', onReady)
      resolve(true)
    }
    emitter.on('SceneOnReady', onReady)
  })
}
