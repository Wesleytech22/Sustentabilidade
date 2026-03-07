import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Configurar axios com a URL base
  const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Interceptor para adicionar token
  api.interceptors.request.use(
    (config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Carregar usuário se houver token
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const response = await api.get('/auth/profile');
          setUser(response.data);
        } catch (error) {
          console.error('Erro ao carregar usuário:', error);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    loadUser();
  }, [token]);

  // ===== FUNÇÃO DE LOGIN CORRIGIDA =====
  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      
      // Verificar se a resposta tem o formato esperado
      if (response.data.success && response.data.token) {
        const { token, user } = response.data;
        localStorage.setItem('token', token);
        setToken(token);
        setUser(user);
        return { success: true, user };
      } else if (response.data.token) {
        // Formato alternativo (sem campo success)
        const { token, user } = response.data;
        localStorage.setItem('token', token);
        setToken(token);
        setUser(user);
        return { success: true, user };
      } else {
        return { 
          success: false, 
          error: response.data.error || 'Resposta inválida do servidor' 
        };
      }
    } catch (error) {
      console.error('Erro no login:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erro ao conectar ao servidor' 
      };
    }
  };

  // ===== FUNÇÃO DE REGISTRO CORRIGIDA =====
  const register = async (userData) => {
    try {
      console.log('📝 Enviando registro:', userData); // Debug
      
      const response = await api.post('/auth/register', userData);
      
      console.log('✅ Resposta do registro:', response.data); // Debug
      
      // Verificar se o registro foi bem-sucedido
      if (response.data.success || response.data.user) {
        // Se o servidor retornar token (login automático)
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          setToken(response.data.token);
          setUser(response.data.user);
        }
        
        return { 
          success: true, 
          message: response.data.message || 'Cadastro realizado com sucesso!',
          data: response.data 
        };
      } else {
        return { 
          success: false, 
          error: response.data.error || 'Erro ao cadastrar' 
        };
      }
    } catch (error) {
      console.error('❌ Erro no registro:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erro ao conectar ao servidor' 
      };
    }
  };

  // ===== FUNÇÃO DE LOGOUT =====
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    api,
    isAuthenticated: !!user,
    token
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};