import appStoreDefine from '@/stores/modules/app'
import userStoreDefine from '@/stores/modules/user'
import dtsStoreDefine from '@/stores/modules/dts'
import weatherStoreDefine from '@/stores/modules/weather'

const store: any = {}
export const registerStore = () => {
  store.userStore = userStoreDefine()
  store.appStore = appStoreDefine()
  store.dtsStore = dtsStoreDefine()
  store.weatherStore = weatherStoreDefine()
}

export default store