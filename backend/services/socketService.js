const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Modelos com caminhos corrigidos
const User = require('../src/models/User');
const Message = require('../models/Message');

let io;
const onlineUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // socketId -> userId

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:3001'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

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
    
    console.log(`🔌 Socket conectado: ${socket.id} - ${user.name} (${user.role})`);
    
    onlineUsers.set(user._id.toString(), socket.id);
    userSockets.set(socket.id, user._id.toString());
    
    broadcastOnlineUsers();

    socket.on('join-room', (room) => {
      socket.join(room);
      console.log(`👥 ${user.name} entrou em: ${room}`);
      
      Message.getRoomHistory(room, 50)
        .then(messages => socket.emit('message-history', { room, messages }))
        .catch(() => socket.emit('message-history', { room, messages: [] }));
    });

    socket.on('leave-room', (room) => {
      socket.leave(room);
    });

    socket.on('send-message', async (data) => {
      try {
        const { room, message, recipient } = data;
        
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
          createdAt: newMessage.createdAt
        };

        if (recipient) {
          const recipientSocketId = onlineUsers.get(recipient.toString());
          if (recipientSocketId) {
            io.to(recipientSocketId).emit('new-message', messageData);
          }
        } else {
          io.to(room).emit('new-message', messageData);
        }

        socket.emit('message-sent', { success: true, message: messageData });
        
      } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error);
        socket.emit('message-error', { error: 'Erro ao enviar mensagem' });
      }
    });

    socket.on('typing', ({ room, isTyping }) => {
      socket.to(room).emit('user-typing', {
        userId: user._id,
        name: user.name,
        isTyping
      });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Desconectado: ${socket.id}`);
      
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

const broadcastOnlineUsers = async () => {
  const users = [];
  
  for (const [userId] of onlineUsers) {
    const user = await User.findById(userId).select('name email role');
    if (user) {
      users.push({
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      });
    }
  }
  
  io.emit('online-users', users);
};

module.exports = {
  initSocket,
  onlineUsers,
  userSockets
};