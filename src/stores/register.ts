import appStoreDefine from '@/stores/modules/app'
import dtsStoreDefine from '@/stores/modules/dts'
import userStoreDefine from '@/stores/modules/user'
import alarmStoreDefine from '@/stores/modules/alarm'

const store: any = {}
export const registerStore = () => {
  store.userStore = userStoreDefine()
  store.appStore = appStoreDefine()
  store.dtsStore = dtsStoreDefine()
  store.alarmStore = alarmStoreDefine()
}

export default store
