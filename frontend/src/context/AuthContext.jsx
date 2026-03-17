import { createContext, useContext, useMemo, useState } from "react";

import axiosClient, { getApiErrorMessage } from "../api/axiosClient";

const TOKEN_KEY = "scraper_auth_token";
const USER_KEY = "scraper_auth_user";

const AuthContext = createContext(null);

const getStoredUser = () => {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => getStoredUser());

  const persistAuth = (payload) => {
    setToken(payload.access_token);
    setUser(payload.user);
    sessionStorage.setItem(TOKEN_KEY, payload.access_token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  };

  const clearAuth = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  };

  const register = async (formData) => {
    try {
      const response = await axiosClient.post("/api/v1/auth/register", formData);
      persistAuth(response.data);
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Registration failed"));
    }
  };

  const login = async (formData) => {
    try {
      const response = await axiosClient.post("/api/v1/auth/login", formData);
      persistAuth(response.data);
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Login failed"));
    }
  };

  const logout = () => {
    clearAuth();
  };

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      register,
      login,
      logout,
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
