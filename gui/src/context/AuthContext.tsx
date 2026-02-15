import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../services/client';

interface User {
  id: number;
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('radio_token');
    const savedUser = localStorage.getItem('radio_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = async (username: string, password: string) => {
    const res = await apiClient.post('/auth/login', { username, password });
    const { token, user } = res.data;

    setToken(token);
    setUser(user);
    localStorage.setItem('radio_token', token);
    localStorage.setItem('radio_user', JSON.stringify(user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('radio_token');
    localStorage.removeItem('radio_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
