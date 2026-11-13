import { defineStore } from 'pinia'

export const userStore = defineStore('userStore', {
  state: () => ({
    // 用户信息
    userInfo: { token: 'Bear default' }
  }),
  // 不建议使用pinia持久化，直接用SessionStoragea或LocalStorage
  // 当手动从控制台中删除Storage时可能存在问题
  persist: {
    storage: sessionStorage,
    paths: ['userInfo'],
    debug: false
  },
  actions: {
    setUserInfo(userInfo: any) {
      this.userInfo = userInfo
    },
    getToken() {
      return this.userInfo.token
    },
    setToken(token: string) {
      this.userInfo.token = token
    }
  }
})

export default userStore