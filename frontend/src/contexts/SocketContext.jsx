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
  const [onlineSupports, setOnlineSupports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [messages, setMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [supportRequests, setSupportRequests] = useState([]);
  const [activeSupportChat, setActiveSupportChat] = useState(null);
  
  const { user, token } = useAuth();
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef({});

  useEffect(() => {
    // Só conectar se tiver usuário e token
    if (!user || !token) {
      console.log('⏳ Aguardando usuário e token...');
      return;
    }

    // URL do socket (com fallback)
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';
    
    console.log('🔌 Conectando ao socket:', socketUrl);
    console.log('🔑 Token presente:', !!token);
    console.log('👤 Usuário:', user?.email);
    console.log('👤 Role:', user?.role);

    // Criar conexão
    const newSocket = io(socketUrl, {
      auth: { 
        token,
        userId: user._id,
        role: user.role,
        name: user.name
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true
    });

    socketRef.current = newSocket;

    // ========== EVENTOS DE CONEXÃO ==========
    newSocket.on('connect', () => {
      console.log('✅ Conectado ao socket! ID:', newSocket.id);
      setIsConnected(true);
      
      // Registrar usuário no servidor
      newSocket.emit('user-connected', {
        userId: user._id,
        name: user.name,
        role: user.role
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Desconectado do socket:', reason);
      setIsConnected(false);
      
      // Tentar reconectar se não foi intencional
      if (reason === 'io server disconnect' || reason === 'transport close') {
        console.log('🔄 Tentando reconectar...');
        setTimeout(() => {
          newSocket.connect();
        }, 1000);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Erro na conexão do socket:', error.message);
      setIsConnected(false);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconectado após', attemptNumber, 'tentativas');
      setIsConnected(true);
      
      // Re-registrar usuário
      newSocket.emit('user-connected', {
        userId: user._id,
        name: user.name,
        role: user.role
      });
    });

    // ========== EVENTOS DE USUÁRIOS ONLINE ==========
    newSocket.on('online-users', (users) => {
      // ✅ VERIFICAÇÃO: garantir que users é um array
      if (Array.isArray(users)) {
        console.log('👥 Usuários online:', users.length);
        setOnlineUsers(users);
        
        // Filtrar suportes online
        const supports = users.filter(u => u.role === 'SUPPORT' || u.role === 'ADMIN');
        setOnlineSupports(supports);
      } else {
        console.log('⚠️ online-users não é um array:', users);
        setOnlineUsers([]);
        setOnlineSupports([]);
      }
    });

    newSocket.on('user-joined', (userData) => {
      console.log('➕ Usuário entrou:', userData.name);
      setOnlineUsers(prev => {
        if (!Array.isArray(prev)) return [userData];
        if (prev.some(u => u.userId === userData.userId)) return prev;
        return [...prev, userData];
      });
    });

    newSocket.on('user-left', (userId) => {
      console.log('➖ Usuário saiu:', userId);
      setOnlineUsers(prev => {
        if (!Array.isArray(prev)) return [];
        return prev.filter(u => u.userId !== userId);
      });
    });

    // ========== EVENTOS DE MENSAGENS ==========
    newSocket.on('new-message', (message) => {
      console.log('💬 Nova mensagem:', message);
      setMessages(prev => {
        const current = prev || {};
        const room = message?.room || 'geral';
        const roomMessages = Array.isArray(current[room]) ? current[room] : [];
        
        // Evitar duplicatas
        if (roomMessages.some(m => m?._id === message?._id)) return current;
        
        return {
          ...current,
          [room]: [...roomMessages, message]
        };
      });

      // Notificação de nova mensagem (se não for do usuário atual)
      if (message.sender !== user?._id) {
        const notification = {
          id: `msg_${message._id}`,
          type: 'message',
          title: `Nova mensagem de ${message.senderName}`,
          message: message.content?.length > 50 
            ? message.content.substring(0, 50) + '...' 
            : message.content,
          room: message.room,
          timestamp: new Date(),
          read: false
        };
        
        setNotifications(prev => {
          const current = Array.isArray(prev) ? prev : [];
          return [notification, ...current];
        });
      }
    });

    newSocket.on('message-history', ({ room, history }) => {
      console.log(`📜 Histórico da sala ${room}:`, history?.length || 0);
      setMessages(prev => ({
        ...(prev || {}),
        [room]: Array.isArray(history) ? history : []
      }));
    });

    newSocket.on('message-read', ({ messageId, room, userId }) => {
      setMessages(prev => {
        const current = prev || {};
        const roomMessages = Array.isArray(current[room]) ? current[room] : [];
        
        return {
          ...current,
          [room]: roomMessages.map(msg => 
            msg._id === messageId 
              ? { ...msg, status: 'read', readBy: [...(msg.readBy || []), userId] }
              : msg
          )
        };
      });
    });

    // ========== EVENTOS DE DIGITAÇÃO ==========
    newSocket.on('user-typing', ({ userId, name, room, isTyping }) => {
      setTypingUsers(prev => ({
        ...(prev || {}),
        [room]: {
          ...(prev[room] || {}),
          [userId]: { name, isTyping }
        }
      }));

      // Limpar status de digitação após 3 segundos
      if (isTyping) {
        if (typingTimeoutRef.current[userId]) {
          clearTimeout(typingTimeoutRef.current[userId]);
        }
        
        typingTimeoutRef.current[userId] = setTimeout(() => {
          setTypingUsers(prev => ({
            ...(prev || {}),
            [room]: {
              ...(prev[room] || {}),
              [userId]: { name, isTyping: false }
            }
          }));
        }, 3000);
      }
    });

    // ========== EVENTOS DE NOTIFICAÇÕES ==========
    newSocket.on('notification', (notification) => {
      console.log('🔔 Nova notificação:', notification);
      setNotifications(prev => {
        const current = Array.isArray(prev) ? prev : [];
        // Evitar duplicatas
        if (current.some(n => n.id === notification?.id)) return current;
        return [notification, ...current];
      });
    });

    // ========== EVENTOS DE SUPORTE ==========
    newSocket.on('support-request', (request) => {
      console.log('🎯 Nova solicitação de suporte:', request);
      if (user?.role === 'SUPPORT' || user?.role === 'ADMIN') {
        setSupportRequests(prev => {
          const current = Array.isArray(prev) ? prev : [];
          return [request, ...current];
        });
        
        // Notificação para suporte
        const notification = {
          id: `support_${request.userId}_${Date.now()}`,
          type: 'support_request',
          title: 'Nova solicitação de suporte',
          message: `${request.userName} precisa de ajuda`,
          request,
          timestamp: new Date(),
          read: false,
          sound: true
        };
        
        setNotifications(prev => {
          const current = Array.isArray(prev) ? prev : [];
          return [notification, ...current];
        });
      }
    });

    newSocket.on('support-assigned', ({ room, support, message }) => {
      console.log('🎯 Suporte atribuído:', support);
      setActiveSupportChat({ room, support });
      
      // Adicionar mensagem de sistema
      setMessages(prev => {
        const current = prev || {};
        const roomMessages = Array.isArray(current[room]) ? current[room] : [];
        return {
          ...current,
          [room]: [...roomMessages, message]
        };
      });
    });

    newSocket.on('chat-ended', ({ room }) => {
      console.log('🔚 Chat encerrado:', room);
      
      // Adicionar mensagem de sistema
      const systemMessage = {
        _id: `system_${Date.now()}`,
        content: 'Chat encerrado',
        senderName: 'Sistema',
        sender: 'system',
        room,
        createdAt: new Date(),
        isSystem: true
      };
      
      setMessages(prev => {
        const current = prev || {};
        const roomMessages = Array.isArray(current[room]) ? current[room] : [];
        return {
          ...current,
          [room]: [...roomMessages, systemMessage]
        };
      });
      
      setActiveSupportChat(null);
    });

    newSocket.on('support-typing', ({ userId, name, isTyping }) => {
      if (activeSupportChat) {
        setTypingUsers(prev => ({
          ...(prev || {}),
          [activeSupportChat.room]: {
            ...(prev[activeSupportChat.room] || {}),
            [userId]: { name, isTyping }
          }
        }));
      }
    });

    setSocket(newSocket);

    // Cleanup na desconexão
    return () => {
      console.log('🧹 Limpando conexão do socket');
      
      // Limpar todos os timeouts de digitação
      Object.keys(typingTimeoutRef.current).forEach(key => {
        clearTimeout(typingTimeoutRef.current[key]);
      });
      
      if (newSocket.connected) {
        newSocket.emit('user-disconnected', user._id);
        newSocket.disconnect();
      }
      newSocket.removeAllListeners();
    };
  }, [user, token]);

  // ========== FUNÇÕES DO SOCKET ==========

  // Enviar mensagem
  const sendMessage = useCallback((room, content, recipient = null) => {
    if (!socketRef.current?.connected) {
      console.warn('⚠️ Socket não conectado');
      return false;
    }
    
    const messageData = {
      room,
      content,
      recipient,
      sender: user?._id,
      senderName: user?.name,
      senderRole: user?.role,
      timestamp: new Date().toISOString()
    };
    
    socketRef.current.emit('send-message', messageData);
    return true;
  }, [user]);

  // Entrar em uma sala
  const joinRoom = useCallback((room) => {
    if (!socketRef.current?.connected) {
      console.warn('⚠️ Socket não conectado');
      return false;
    }
    
    console.log(`👥 Entrando na sala: ${room}`);
    socketRef.current.emit('join-room', room);
    
    // Solicitar histórico da sala
    socketRef.current.emit('request-history', room);
    
    return true;
  }, [user]);

  // Sair de uma sala
  const leaveRoom = useCallback((room) => {
    if (!socketRef.current?.connected) return false;
    
    console.log(`👋 Saindo da sala: ${room}`);
    socketRef.current.emit('leave-room', room);
    return true;
  }, [user]);

  // Indicar que está digitando
  const sendTyping = useCallback((room, isTyping) => {
    if (!socketRef.current?.connected) return false;
    
    socketRef.current.emit('typing', {
      room,
      userId: user?._id,
      name: user?.name,
      isTyping
    });
    
    return true;
  }, [user]);

  // Obter usuários digitando em uma sala
  const getTypingUsers = useCallback((room) => {
    const roomData = typingUsers[room] || {};
    return Object.values(roomData)
      .filter(data => data.isTyping)
      .map(data => data.name);
  }, [typingUsers]);

  // Marcar mensagem como lida
  const markMessageAsRead = useCallback((messageId, room) => {
    if (!socketRef.current?.connected) return false;
    
    socketRef.current.emit('message-read', {
      messageId,
      room,
      userId: user?._id
    });
    
    return true;
  }, [user]);

  // Enviar notificação
  const sendNotification = useCallback((recipientId, notification) => {
    if (!socketRef.current?.connected) return false;
    
    socketRef.current.emit('send-notification', {
      recipient: recipientId,
      notification: {
        ...notification,
        senderId: user?._id,
        senderName: user?.name,
        timestamp: new Date().toISOString()
      }
    });
    return true;
  }, [user]);

  // ========== FUNÇÕES DE SUPORTE ==========

  // Solicitar suporte
  const requestSupport = useCallback((department = 'general') => {
    if (!socketRef.current?.connected) return false;
    
    console.log('🎯 Solicitando suporte...');
    socketRef.current.emit('request-support', {
      userId: user?._id,
      userName: user?.name,
      department,
      timestamp: new Date().toISOString()
    });
    
    return true;
  }, [user]);

  // Aceitar solicitação de suporte (para suportes)
  const acceptSupportRequest = useCallback((requestId, userId) => {
    if (!socketRef.current?.connected) return false;
    if (user?.role !== 'SUPPORT' && user?.role !== 'ADMIN') return false;
    
    console.log('✅ Aceitando solicitação de suporte:', requestId);
    
    // Criar sala única para o chat
    const room = `support_${userId}_${user?._id}`;
    
    socketRef.current.emit('accept-support', {
      requestId,
      userId,
      supportId: user?._id,
      supportName: user?.name,
      room
    });
    
    // Remover da lista de solicitações
    setSupportRequests(prev => {
      const current = Array.isArray(prev) ? prev : [];
      return current.filter(r => r.id !== requestId);
    });
    
    return room;
  }, [user]);

  // Finalizar chat de suporte
  const endSupportChat = useCallback((room, userId) => {
    if (!socketRef.current?.connected) return false;
    
    console.log('🔚 Finalizando chat de suporte:', room);
    socketRef.current.emit('end-support', {
      room,
      userId,
      supportId: user?._id
    });
    
    setActiveSupportChat(null);
    return true;
  }, [user]);

  // ========== FUNÇÕES DE NOTIFICAÇÃO ==========

  // Marcar notificação como lida
  const markNotificationAsRead = useCallback((notificationId) => {
    setNotifications(prev => {
      const current = Array.isArray(prev) ? prev : [];
      return current.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
    });
  }, []);

  // Marcar todas notificações como lidas
  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications(prev => {
      const current = Array.isArray(prev) ? prev : [];
      return current.map(n => ({ ...n, read: true }));
    });
  }, []);

  // Limpar notificações
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Remover notificação específica
  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev => {
      const current = Array.isArray(prev) ? prev : [];
      return current.filter(n => n.id !== notificationId);
    });
  }, []);

  // Obter mensagens não lidas em uma sala
  const getUnreadCount = useCallback((room) => {
    const roomMessages = (messages[room] || []);
    return roomMessages.filter(msg => 
      msg.sender !== user?._id && 
      (!msg.readBy || !msg.readBy.includes(user?._id))
    ).length;
  }, [messages, user]);

  // Obter última mensagem de uma sala
  const getLastMessage = useCallback((room) => {
    const roomMessages = messages[room] || [];
    return roomMessages[roomMessages.length - 1];
  }, [messages]);

  // Valor do contexto
  const value = {
    // Estado
    socket: socketRef.current,
    isConnected,
    onlineUsers: Array.isArray(onlineUsers) ? onlineUsers : [],
    onlineSupports: Array.isArray(onlineSupports) ? onlineSupports : [],
    notifications: Array.isArray(notifications) ? notifications : [],
    messages: messages || {},
    typingUsers: typingUsers || {},
    supportRequests: Array.isArray(supportRequests) ? supportRequests : [],
    activeSupportChat,
    
    // Funções gerais
    sendMessage,
    joinRoom,
    leaveRoom,
    sendTyping,
    markMessageAsRead,
    getTypingUsers,
    getUnreadCount,
    getLastMessage,
    
    // Funções de notificação
    sendNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotifications,
    removeNotification,
    
    // Funções de suporte
    requestSupport,
    acceptSupportRequest,
    endSupportChat,
    
    // Contadores
    unreadCount: Array.isArray(notifications) 
      ? notifications.filter(n => !n?.read).length 
      : 0,
    pendingSupportRequests: Array.isArray(supportRequests) 
      ? supportRequests.length 
      : 0
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};