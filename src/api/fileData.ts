import axios from 'axios';

/**
 * 获取JSON数据
 * @param dataUrl JSON文件相对路径。基于src/public/data根路径，如popup/style1/gridDeep.json
 * @returns 
 */
export function getData(dataUrl: any) {
  return axios.get(`./data/${dataUrl}`);
}

/**
 * 获取组件数据
 * 
 * @param dataUrl 相对于/src/template/下的路径
 * @returns 
 */
export function getTemplateData(dataUrl: any) {
  return axios.get(`./src/template/${dataUrl}`);
}

/**
 * 调用远程服务地址
 * @param httpUrl 服务地址
 * @returns 
 */
export function getRemoteData(httpUrl: any) {
  return axios.get(`${httpUrl}`);
}