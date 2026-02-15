import axios from 'axios';

export const apiClient = axios.create({
  baseURL: 'http://localhost:8081/api/v1',
});

// Automatically attach the JWT token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('radio_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 Unauthorized globally (e.g., token expired)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('radio_token');
      localStorage.removeItem('radio_user');
      window.location.href = '/login'; // Force them to log back in
    }
    return Promise.reject(error);
  }
);
