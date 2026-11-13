import axios, { all, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
// 手动导入所有 mock 文件
import otherMock from '@routes/railway-digital-twin-system/mockData/otherMock';
import subsytem from '@routes/railway-digital-twin-system/mockData/subsytem';
import aiMaintenance from '@routes/railway-digital-twin-system/mockData/aiMaintenance';

// 合并所有 Mock 数据
const allMocks = [...subsytem, ...aiMaintenance, ...otherMock];
console.log("---所有Mock请求：", allMocks)

// 解析 URL 查询参数的函数
const parseQueryString = (queryString: string): Record<string, any> => {
  const params: Record<string, any> = {};
  const pairs = queryString.split('&');
  pairs.forEach((pair) => {
    const [key, value] = pair.split('=');
    if (key) {
      params[key] = decodeURIComponent(value || '');
    }
  });
  return params;
};

const service = axios.create();

// 请求拦截器，匹配 Mock 规则并返回 Mock 数据
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const mock = allMocks.find(
      (m) => {
        // 获取请求地址中?号之前的部分
        const baseUrl = config.url.split('?')[0];
        const mockUrl = m.url.split('?')[0];
        const urlMatch = mockUrl == baseUrl ? true : false;
        const methodMatch = m.method === config.method?.toLowerCase();
        return urlMatch && methodMatch;
      }
    );

    console.log("---拦截http请求啦,", mock, config, allMocks);
    if (mock) {
      // 解析 URL 后缀中的查询参数
      const urlParts = config.url?.split('?');
      const queryString = urlParts && urlParts.length > 1 ? urlParts[1] : '';
      const parsedParams = parseQueryString(queryString);
      // 合并解析后的参数和原有的 config.params
      config.params = { ...config.params, ...parsedParams };

      const queryParams = config.params || {};
      const requestData = config.data || {};
      let mockData;
      if (typeof mock.response === 'function') {
        const requestParams = { query: queryParams, requestData: requestData };
        console.log("请求参数：", requestParams);
        mockData = mock.response(requestParams);
      } else {
        mockData = mock.response;
      }
      // 自定义 adapter 直接返回 mock 响应
      config.adapter = () => {
        return Promise.resolve({
          data: mockData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {} as any
        } as AxiosResponse);
      };
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


export default service;
