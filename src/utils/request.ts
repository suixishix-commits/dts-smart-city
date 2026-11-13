import axios from 'axios'
import qs from 'qs'
import { ElMessage } from 'element-plus'
import store from '@/stores'
import cache from '@/utils/cache'

// axios实例
const service = axios.create({
  baseURL: import.meta.env.VITE_API_URL as any,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json;charset=UTF-8' }
})

// 请求拦截器
service.interceptors.request.use(
  async (config: any) => {
    const userInfo = SessionStorage.getItem('userInfo')
    const strToken = userInfo?.token
    if (strToken) {
      // 白名单地址不加token
      if (!isWhiteList(config.url)) {
        config.headers.Authorization = strToken
      }
    }
    config.headers['Accept-Language'] = cache.getLanguage()

    // 追加时间戳，防止GET请求缓存
    if (config.method?.toUpperCase() === 'GET') {
      config.params = { ...config.params, t: new Date().getTime() }
    }
    if (Object.values(config.headers).includes('application/x-www-form-urlencoded')) {
      config.data = qs.stringify(config.data)
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  response => {
    if (response.status !== 200) {
      return Promise.reject(new Error(response.statusText || 'Error'))
    }

    const res = response.data
    // 响应成功
    if (res.code === 0 || res.errno === 0) {
      return res
    }
    if (res) {
      return res
    }
    // 错误提示
    ElMessage({
      showClose: true,
      type: 'error',
      duration: 3000,
      message: res.msg
    })

    return Promise.reject(new Error(res.msg || 'Error'))
  },
  error => {
    if (error?.response?.status == 424) {
      //如果token有误或过期
      // console.log('请求带的token是？', store.userStore.token)
      store.userStore?.setToken('')
      window.location.href = store.appStore.config.loginUrl
    } else {
      ElMessage.error(error.message)
      return Promise.reject(error)
    }
  }
)

// 白名单不加token
const isWhiteList = (url: any) => {
  let wl = store.appStore?.whiteList || []
  for (let index = 0; index < wl?.length; index++) {
    const str = wl[index]
    if (url.indexOf(str) >= 0) {
      return true
    }
  }
  return false
}

// 导出 axios 实例
export default service
