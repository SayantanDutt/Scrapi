import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://scrapi-cjd3.onrender.com";

const axiosClient = axios.create({
  baseURL:  API_BASE_URL,
  timeout: 3000,
});

axiosClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("scraper_auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getApiErrorMessage = (error, fallback = "Request failed") => {
  if (error?.response?.data?.detail) {
    if (typeof error.response.data.detail === "string") {
      return error.response.data.detail;
    }
    return JSON.stringify(error.response.data.detail);
  }

  if (error?.message) {
    return error.message;
  }

  return fallback;
};

export default axiosClient;
