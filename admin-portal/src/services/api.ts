import axios from 'axios';

// Always same-origin. In production Vercel rewrites /api to the backend
// (see vercel.json); in development Vite proxies it (see vite.config.ts).
// Deliberately not configurable: a stale VITE_API_URL in the hosting
// dashboard silently overrides the rewrite and points the portal at a dead
// backend, which is exactly what happened with the old Render URL.
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('dubyx_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('dubyx_token');
      localStorage.removeItem('dubyx_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
