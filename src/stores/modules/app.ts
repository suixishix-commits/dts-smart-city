import { defineStore } from 'pinia'
import cache from '@/utils/cache'

export const appStore = defineStore('appStore', {
  state: () => ({
    // 国际化
    language: cache.getLanguage(),
    // 组件大小
    componentSize: 'default',
    // 地址白名单,如'/instance/free'
    whiteList: [],
    // 大华配置
    jingTou_show: true
  }),
  persist: {
    storage: localStorage,
    pick: ['language', 'componentSize'],
    debug: false
  },
  getters: {},
  actions: {}
})

export default appStore
