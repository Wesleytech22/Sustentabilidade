import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [messages, setMessages] = useState({});
  const { user, token } = useAuth();
  
  const socketRef = useRef(null);

  useEffect(() => {
    // Só conectar se tiver usuário e token
    if (!user || !token) return;

    // URL do socket (com fallback)
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';
    
    console.log('🔌 Conectando ao socket:', socketUrl);

    // Criar conexão
    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    socketRef.current = newSocket;

    // Eventos de conexão
    newSocket.on('connect', () => {
      console.log('✅ Conectado ao socket');
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Desconectado do socket:', reason);
      setIsConnected(false);
      
      // Tentar reconectar se não foi intencional
      if (reason === 'io server disconnect') {
        // Reconexão manual se necessário
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Erro na conexão do socket:', error.message);
      setIsConnected(false);
    });

    // Eventos personalizados
    newSocket.on('online-users', (users) => {
      console.log('👥 Usuários online:', users.length);
      setOnlineUsers(users);
    });

    newSocket.on('notification', (notification) => {
      console.log('🔔 Nova notificação:', notification);
      setNotifications(prev => {
        // Evitar duplicatas
        if (prev.some(n => n.id === notification.id)) return prev;
        return [notification, ...prev];
      });
    });

    newSocket.on('new-message', (message) => {
      console.log('💬 Nova mensagem:', message);
      setMessages(prev => {
        const roomMessages = prev[message.room] || [];
        // Evitar duplicatas
        if (roomMessages.some(m => m._id === message._id)) return prev;
        return {
          ...prev,
          [message.room]: [...roomMessages, message]
        };
      });
    });

    newSocket.on('message-history', ({ room, history }) => {
      console.log(`📜 Histórico da sala ${room}:`, history.length);
      setMessages(prev => ({
        ...prev,
        [room]: history
      }));
    });

    newSocket.on('user-typing', ({ userId, name, isTyping }) => {
      // Implementar lógica de "digitando" se necessário
    });

    setSocket(newSocket);

    // Cleanup na desconexão
    return () => {
      console.log('🧹 Limpando conexão do socket');
      if (newSocket.connected) {
        newSocket.disconnect();
      }
    };
  }, [user, token]); // Dependências corretas

  // Funções do socket (memorizadas para evitar recriação)
  const sendMessage = useCallback((room, message) => {
    if (!socketRef.current?.connected) {
      console.warn('⚠️ Socket não conectado');
      return false;
    }
    
    socketRef.current.emit('send-message', { 
      room, 
      message,
      timestamp: new Date().toISOString()
    });
    return true;
  }, []);

  const joinRoom = useCallback((room) => {
    if (!socketRef.current?.connected) {
      console.warn('⚠️ Socket não conectado');
      return false;
    }
    
    console.log(`👥 Entrando na sala: ${room}`);
    socketRef.current.emit('join-room', room);
    return true;
  }, []);

  const leaveRoom = useCallback((room) => {
    if (!socketRef.current?.connected) return false;
    
    console.log(`👋 Saindo da sala: ${room}`);
    socketRef.current.emit('leave-room', room);
    return true;
  }, []);

  const sendNotification = useCallback((userId, notification) => {
    if (!socketRef.current?.connected) return false;
    
    socketRef.current.emit('send-notification', { userId, notification });
    return true;
  }, []);

  const markNotificationAsRead = useCallback((notificationId) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Valor do contexto
  const value = {
    socket: socketRef.current,
    isConnected,
    onlineUsers,
    notifications,
    messages,
    sendMessage,
    joinRoom,
    leaveRoom,
    sendNotification,
    markNotificationAsRead,
    clearNotifications,
    unreadCount: notifications.filter(n => !n.read).length
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};