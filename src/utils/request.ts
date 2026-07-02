import axios from 'axios';
import router from '../router';

const request = axios.create({
  baseURL: import.meta.env.DEV ? 'http://localhost:8080' : '',
  timeout: 20000,
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res && typeof res === 'object' && 'code' in res) {
      if (res.code !== 200) {
        if (res.code === 401 || res.code === 404) {
          localStorage.removeItem('token');
          if (router.currentRoute.value.path !== '/login') {
            router.push('/login');
          }
        }
        return Promise.reject(new Error(res.message || `业务请求失败：${res.code}`));
      }
      return res.data;
    }
    return res;
  },
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message;

    if (status === 401 || status === 404) {
      localStorage.removeItem('token');
      if (router.currentRoute.value.path !== '/login') {
        router.push('/login');
      }
    }

    if (status) {
      return Promise.reject(new Error(message || `HTTP ${status} 请求失败`));
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('请求超时，请稍后重试'));
    }

    return Promise.reject(new Error(error.message || '网络请求失败'));
  }
);

export default request;
