import LocalStorage from '@/utils/LocalStorage'
import axios from 'axios'
import service from '@/utils/request'

/**
 * 获取Token
 * @param userName 
 * @param pwd 
 * @returns 
 */
export const getDtsToken = (userName: any, pwd: any) => {
  const rootPath: string = gVar?.api?.contextPath || '';
  let url = rootPath + '/login'
  let data = {
    username: userName,
    password: pwd,
    captcha: ''
  }
  return axios.post(url, data)
}


/**
 * 后台封装类请求，自动注入token至请求头
 * 
 * @param pid 
 * @returns 
 */
export const getFreeInstance = (pid: any) => {
  const rootPath: string = gVar?.api?.contextPath || '';
  let url = rootPath + '/instance/free?pid=' + pid
  return service.get(url)
}

/**
 * 获取DTS 实例
 * @returns 
 */
export const getInstanceList = () => {
  const rootPath: string = gVar?.api?.contextPath || '';
  let url = rootPath + `/instance?details=true&connections=true}`
  return service.get(url)
}

/**
 * Axios原生请求
 * 
 * @param pid 
 * @returns 
 */
export const getFreeInstance2 = (pid: any) => {
  let url = 'http://' + gVar.dtsCloud.player + '/manage/instance/free?pid=' + pid

  return axios.get(url, {
    headers: {
      Authorization: LocalStorage.getItem('ManageAuthorization')
    }
  })
}

