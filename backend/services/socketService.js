// services/socketService.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const queueService = require('./queueService');

let io;
const onlineUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // socketId -> userId

/**
 * Inicializar o servidor Socket.IO
 * @param {http.Server} server - Servidor HTTP
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Middleware de autenticação
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Token não fornecido'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('Usuário não encontrado'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    
    console.log(`🔌 Socket conectado: ${socket.id} - Usuário: ${user.name}`);
    
    // Registrar usuário online
    onlineUsers.set(user._id.toString(), socket.id);
    userSockets.set(socket.id, user._id.toString());
    
    // Emitir lista de usuários online atualizada
    broadcastOnlineUsers();

    // Entrar em uma sala
    socket.on('join-room', (room) => {
      socket.join(room);
      console.log(`👥 ${user.name} entrou na sala: ${room}`);
      
      // Buscar histórico da sala
      Message.getRoomHistory(room, 50).then(messages => {
        socket.emit('message-history', { room, messages });
      });
    });

    // Sair de uma sala
    socket.on('leave-room', (room) => {
      socket.leave(room);
      console.log(`👋 ${user.name} saiu da sala: ${room}`);
    });

    // Enviar mensagem
    socket.on('send-message', async (data) => {
      try {
        const { room, message, recipient } = data;
        
        // Criar mensagem no banco
        const newMessage = new Message({
          content: message,
          room,
          sender: user._id,
          senderName: user.name,
          recipient
        });
        
        await newMessage.save();

        const messageData = {
          _id: newMessage._id,
          content: message,
          sender: user._id,
          senderName: user.name,
          room,
          recipient,
          createdAt: newMessage.createdAt,
          formattedDate: newMessage.formattedDate
        };

        // Se for mensagem privada
        if (recipient) {
          const recipientSocketId = onlineUsers.get(recipient.toString());
          if (recipientSocketId) {
            io.to(recipientSocketId).emit('new-message', messageData);
            
            // Criar notificação para o destinatário
            await queueService.createNotification(
              recipient,
              'message',
              'Nova mensagem',
              `${user.name}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
              { senderId: user._id, room }
            );
          }
        } else {
          // Mensagem pública - enviar para todos na sala
          io.to(room).emit('new-message', messageData);
        }

        // Confirmação para o remetente
        socket.emit('message-sent', { success: true, message: messageData });
        
      } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error);
        socket.emit('message-error', { error: 'Erro ao enviar mensagem' });
      }
    });

    // Marcar mensagem como lida
    socket.on('mark-read', async (messageId) => {
      try {
        await Message.findByIdAndUpdate(messageId, { 
          status: 'read',
          readAt: new Date()
        });
      } catch (error) {
        console.error('❌ Erro ao marcar mensagem como lida:', error);
      }
    });

    // Usuário está digitando
    socket.on('typing', ({ room, isTyping }) => {
      socket.to(room).emit('user-typing', {
        userId: user._id,
        name: user.name,
        isTyping
      });
    });

    // Notificar todos (admin)
    socket.on('broadcast-notification', async (data) => {
      if (user.role === 'ADMIN') {
        const { title, message, type = 'info' } = data;
        
        // Emitir para todos os usuários online
        io.emit('notification', {
          type,
          title,
          message,
          timestamp: new Date()
        });

        // Criar notificações em lote via fila
        for (const [userId] of onlineUsers) {
          await queueService.createNotification(
            userId,
            'broadcast',
            title,
            message,
            { type }
          );
        }
      }
    });

    // Desconexão
    socket.on('disconnect', () => {
      console.log(`🔌 Socket desconectado: ${socket.id}`);
      
      const userId = userSockets.get(socket.id);
      if (userId) {
        onlineUsers.delete(userId);
        userSockets.delete(socket.id);
      }
      
      broadcastOnlineUsers();
    });
  });

  return io;
};

/**
 * Emitir lista de usuários online para todos
 */
const broadcastOnlineUsers = async () => {
  const users = [];
  
  for (const [userId, socketId] of onlineUsers) {
    const user = await User.findById(userId).select('name email role');
    if (user) {
      users.push({
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        socketId
      });
    }
  }
  
  io.emit('online-users', users);
};

/**
 * Enviar notificação para um usuário específico
 * @param {string} userId - ID do usuário
 * @param {object} notification - Dados da notificação
 */
const sendNotificationToUser = (userId, notification) => {
  const socketId = onlineUsers.get(userId.toString());
  if (socketId) {
    io.to(socketId).emit('notification', notification);
    return true;
  }
  return false;
};

/**
 * Enviar notificação para todos os usuários online
 * @param {object} notification - Dados da notificação
 */
const sendNotificationToAll = (notification) => {
  io.emit('notification', notification);
};

/**
 * Verificar se usuário está online
 * @param {string} userId - ID do usuário
 */
const isUserOnline = (userId) => {
  return onlineUsers.has(userId.toString());
};

/**
 * Obter número de usuários online
 */
const getOnlineCount = () => {
  return onlineUsers.size;
};

module.exports = {
  initSocket,
  sendNotificationToUser,
  sendNotificationToAll,
  isUserOnline,
  getOnlineCount,
  onlineUsers,
  userSockets
};