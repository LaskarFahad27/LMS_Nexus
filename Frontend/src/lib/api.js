import axios from 'axios';
import { appBasename } from './base';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      const path = window.location.pathname.replace(appBasename, '') || '/';
      if (!['/login', '/register', '/'].includes(path) && path.startsWith('/')) {
        // soft fail — pages handle errors
      }
    }
    return Promise.reject(err);
  }
);

export default api;
