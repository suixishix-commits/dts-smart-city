import appStoreDefine from '@/stores/modules/app'
import dtsStoreDefine from '@/stores/modules/dts'
import userStoreDefine from '@/stores/modules/user'

const store: any = {}
export const registerStore = () => {
  store.userStore = userStoreDefine()
  store.appStore = appStoreDefine()
  store.dtsStore = dtsStoreDefine()
}

export default store
