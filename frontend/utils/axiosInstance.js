import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(token) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}
function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb);
}

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    // notify other windows/contexts that a login occurred
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('auth:login', { detail: { token } }))
      }
    } catch (e) {
      // ignore
    }
  } else {
    delete api.defaults.headers.common['Authorization'];
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('auth:logout'))
      }
    } catch (e) {
      // ignore
    }
  }
}

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

// Attach CSRF header for state-changing requests using double-submit cookie
api.interceptors.request.use((config) => {
  try {
    const method = (config.method || '').toUpperCase();
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const csrf = readCookie('XSRF-TOKEN');
      if (csrf) config.headers['X-XSRF-TOKEN'] = csrf;
    }
  } catch (e) {
    // ignore
  }
  return config;
}, (err) => Promise.reject(err));

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config || {};
    const requestUrl = typeof originalRequest.url === 'string' ? originalRequest.url : '';
    const isAuthEndpoint = requestUrl.includes('/auth/refresh') || requestUrl.includes('/auth/login') || requestUrl.includes('/auth/logout');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          addRefreshSubscriber((newToken) => {
            if (newToken) {
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
              resolve(api(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      isRefreshing = true;
      try {
        // use the configured `api` instance so baseURL and defaults (withCredentials)
        // are applied consistently in browser and server environments
        const res = await api.post('/auth/refresh');
        const newToken = res.data?.token || res.data?.accessToken;
        if (!newToken) {
          setAuthToken(null);
          window.location.href = '/admin/login';
          return Promise.reject(error);
        }
        setAuthToken(newToken);
        onRefreshed(newToken);
        isRefreshing = false;

        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshed(null);
        setAuthToken(null);
        window.location.href = '/admin/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
