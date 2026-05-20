const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Modelos com caminhos corrigidos
const User = require('../src/models/User');
const Message = require('../models/Message');

let io;
const onlineUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // socketId -> userId
const pendingSupportRequests = new Map(); // requestId -> request data
const activeSupportChats = new Map(); // room -> { supportId, userId }
const supportChatsBySupport = new Map(); // supportId -> [rooms] // 👈 NOVO: mapa de chats por suporte
const REQUEST_TIMEOUT = 5 * 60 * 1000; // 5 minutos

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:3000', 
        'http://localhost:3002', 
        'http://localhost:3001',
        'https://ecoroutes-eta.vercel.app',
        'https://*.vercel.app'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    path: '/socket.io/'
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

  // Inicializar lista de chats do suporte
  if (!supportChatsBySupport.has(user._id.toString())) {
    supportChatsBySupport.set(user._id.toString(), []);
  }

  broadcastOnlineUsers();

  // ========== EVENTOS DE SALA ==========
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`👥 ${user.name} entrou na sala: ${room}`);

    Message.getRoomHistory(room, 50)
      .then(messages => socket.emit('message-history', { room, messages }))
      .catch(() => socket.emit('message-history', { room, messages: [] }));
  });

  socket.on('leave-room', (room) => {
    socket.leave(room);
    console.log(`👋 ${user.name} saiu da sala: ${room}`);
  });

  // ========== EVENTOS DE MENSAGENS ==========
  socket.on('send-message', async (data) => {
    try {
      const { room, content, recipient } = data;

      console.log(`💬 Mensagem de ${user.name} em ${room}: ${content.substring(0, 30)}...`);

      const newMessage = new Message({
        content,
        room,
        sender: user._id,
        senderName: user.name,
        senderRole: user.role,
        recipient
      });

      await newMessage.save();

      const messageData = {
        _id: newMessage._id,
        content,
        sender: user._id,
        senderName: user.name,
        senderRole: user.role,
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

  socket.on('request-history', async (room) => {
    try {
      const messages = await Message.getRoomHistory(room, 50);
      socket.emit('message-history', { room, messages });
    } catch (error) {
      console.error('❌ Erro ao buscar histórico:', error);
    }
  });

  // ========== EVENTOS DE DIGITAÇÃO ==========
  socket.on('typing', ({ room, isTyping }) => {
    socket.to(room).emit('user-typing', {
      userId: user._id,
      name: user.name,
      isTyping
    });
  });

  // ========== EVENTOS DE SUPORTE ==========
  socket.on('request-support', (data) => {
    console.log(`🎯 Solicitação de suporte de ${user.name} (${user._id})`);

    const requestId = `req_${Date.now()}_${user._id}`;

    const supportRequest = {
      id: requestId,
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      department: data.department || 'general',
      timestamp: new Date(),
      status: 'pending'
    };

    pendingSupportRequests.set(requestId, supportRequest);

    console.log(`📋 Solicitação ${requestId} criada`);

    // Emitir para todos os suportes online
    const supportSockets = [];
    for (const [socketId, socket] of io.sockets.sockets) {
      if (socket.user?.role === 'SUPPORT' || socket.user?.role === 'ADMIN') {
        supportSockets.push(socketId);
      }
    }

    if (supportSockets.length > 0) {
      console.log(`📢 Notificando ${supportSockets.length} suportes`);

      io.to(supportSockets).emit('support-request', supportRequest);

      io.to(supportSockets).emit('notification', {
        id: `notif_${Date.now()}`,
        type: 'support_request',
        title: '🆘 Nova solicitação de suporte',
        message: `${user.name} precisa de ajuda (${data.department || 'Geral'})`,
        data: supportRequest,
        timestamp: new Date(),
        read: false,
        sound: true
      });

      setTimeout(() => {
        if (pendingSupportRequests.has(requestId)) {
          pendingSupportRequests.delete(requestId);
          console.log(`⏰ Solicitação ${requestId} expirou`);

          io.to(supportSockets).emit('support-request-expired', {
            requestId,
            message: 'Solicitação expirou por falta de atendimento'
          });
        }
      }, REQUEST_TIMEOUT);

    } else {
      console.log('⚠️ Nenhum suporte online no momento');

      socket.emit('notification', {
        id: `notif_${Date.now()}`,
        type: 'warning',
        title: '⚠️ Sem suportes online',
        message: 'Não há suportes disponíveis no momento. Tente novamente mais tarde.',
        timestamp: new Date(),
        read: false
      });
    }
  });

  socket.on('accept-support', (data) => {
    console.log(`✅ Suporte ${user.name} aceitou solicitação de ${data.userName}`);

    const { requestId, userId, supportId, supportName, room } = data;

    // Remover solicitação pendente
    pendingSupportRequests.delete(requestId);

    // Registrar chat ativo
    activeSupportChats.set(room, { supportId: user._id, userId });

    // 👇 ADICIONAR À LISTA DE CHATS DO SUPORTE
    const supportIdStr = user._id.toString();
    const supportChats = supportChatsBySupport.get(supportIdStr) || [];
    if (!supportChats.includes(room)) {
      supportChats.push(room);
      supportChatsBySupport.set(supportIdStr, supportChats);
    }

    console.log(`📋 Suporte ${user.name} agora tem ${supportChats.length} chats ativos`);

    const userSocketId = onlineUsers.get(userId);

    const supportData = {
      id: supportId,
      name: supportName,
      role: user.role
    };

    const systemMessage = {
      _id: `system_${Date.now()}`,
      content: `🔹 Suporte ${supportName} entrou no chat`,
      sender: 'system',
      senderName: 'Sistema',
      room,
      timestamp: new Date(),
      isSystem: true
    };

    if (userSocketId) {
      console.log(`📨 Notificando usuário ${userId} sobre suporte aceito`);

      io.to(userSocketId).emit('support-assigned', {
        room,
        support: supportData,
        message: systemMessage
      });

      io.to(userSocketId).emit('notification', {
        id: `notif_${Date.now()}`,
        type: 'success',
        title: '✅ Solicitação aceita',
        message: `${supportName} está pronto para ajudar`,
        data: { supportId, supportName, room },
        timestamp: new Date(),
        read: false
      });
    }

    // Suporte entra na sala
    socket.join(room);

    // Enviar mensagem de sistema para o suporte
    socket.emit('new-message', systemMessage);

    // Notificar suporte que ação foi bem-sucedida
    socket.emit('support-accepted', { success: true, room });

    // Notificar todos os outros suportes que a solicitação foi aceita
    const supportSockets = [];
    for (const [socketId, socket] of io.sockets.sockets) {
      if ((socket.user?.role === 'SUPPORT' || socket.user?.role === 'ADMIN') &&
        socket.user?._id.toString() !== user._id.toString()) {
        supportSockets.push(socketId);
      }
    }

    if (supportSockets.length > 0) {
      console.log(`📢 Notificando ${supportSockets.length} suportes que a solicitação foi aceita`);

      io.to(supportSockets).emit('support-request-accepted', {
        requestId,
        acceptedBy: user.name,
        acceptedByUserId: user._id
      });

      io.to(supportSockets).emit('notification', {
        id: `notif_${Date.now()}`,
        type: 'info',
        title: '📞 Solicitação atendida',
        message: `${user.name} aceitou a solicitação de ${data.userName}`,
        timestamp: new Date(),
        read: false
      });
    }
  });

  // ========== EVENTOS DE TRANSFERÊNCIA ==========
  socket.on('get-available-supports', async () => {
    try {
      const supports = [];

      for (const [userId, socketId] of onlineUsers) {
        if (userId !== user._id.toString()) {
          const supportUser = await User.findById(userId).select('name email role department isAvailable');
          if (supportUser && (supportUser.role === 'SUPPORT' || supportUser.role === 'ADMIN')) {
            const supportChats = supportChatsBySupport.get(userId) || [];
            supports.push({
              id: supportUser._id,
              name: supportUser.name,
              email: supportUser.email,
              role: supportUser.role,
              department: supportUser.department || 'general',
              isAvailable: supportUser.isAvailable !== false,
              online: true,
              activeChats: supportChats.length // Número de chats ativos deste suporte
            });
          }
        }
      }

      socket.emit('available-supports', supports);
    } catch (error) {
      console.error('❌ Erro ao listar suportes:', error);
      socket.emit('available-supports', []);
    }
  });

  socket.on('transfer-support', async (data) => {
    console.log(`🔄 Transferindo chamado ${data.room} de ${user.name} para ${data.targetSupportId}`);

    const { room, targetSupportId, originalUserId, originalUserName } = data;

    try {
      const targetSupport = await User.findById(targetSupportId).select('name email role');

      if (!targetSupport) {
        socket.emit('transfer-error', { error: 'Suporte destino não encontrado' });
        return;
      }

      // Remover da lista de chats do suporte atual
      const currentSupportId = user._id.toString();
      const currentSupportChats = supportChatsBySupport.get(currentSupportId) || [];
      const updatedChats = currentSupportChats.filter(r => r !== room);
      supportChatsBySupport.set(currentSupportId, updatedChats);

      // Adicionar à lista de chats do suporte destino
      const targetSupportIdStr = targetSupportId.toString();
      const targetSupportChats = supportChatsBySupport.get(targetSupportIdStr) || [];
      if (!targetSupportChats.includes(room)) {
        targetSupportChats.push(room);
        supportChatsBySupport.set(targetSupportIdStr, targetSupportChats);
      }

      // Atualizar registro do chat ativo
      activeSupportChats.set(room, { supportId: targetSupportId, userId: originalUserId });

      console.log(`🎯 Transferindo para: ${targetSupport.name}`);
      console.log(`📊 Chats do suporte origem: ${updatedChats.length}`);
      console.log(`📊 Chats do suporte destino: ${targetSupportChats.length}`);

      // Notificar suporte atual que transferência iniciou
      socket.emit('transfer-started', {
        room,
        targetSupportId,
        targetSupportName: targetSupport.name
      });

      // Suporte atual sai da sala
      socket.leave(room);

      // Notificar usuário sobre transferência
      const userSocketId = onlineUsers.get(originalUserId);
      if (userSocketId) {
        const transferMessage = {
          _id: `system_${Date.now()}`,
          content: `🔄 Seu chamado está sendo transferido para ${targetSupport.name}`,
          sender: 'system',
          senderName: 'Sistema',
          room,
          timestamp: new Date(),
          isSystem: true
        };

        io.to(userSocketId).emit('new-message', transferMessage);

        io.to(userSocketId).emit('support-transfer', {
          message: `Seu chamado está sendo transferido para ${targetSupport.name}`,
          room,
          newSupport: {
            id: targetSupportId,
            name: targetSupport.name
          }
        });

        io.to(userSocketId).emit('notification', {
          id: `notif_${Date.now()}`,
          type: 'info',
          title: '🔄 Chamado sendo transferido',
          message: `Seu atendimento será continuado por ${targetSupport.name}`,
          timestamp: new Date(),
          read: false
        });
      }

      // Notificar suporte destino
      const targetSocketId = onlineUsers.get(targetSupportId);
      if (targetSocketId) {
        const systemMessage = {
          _id: `system_${Date.now()}`,
          content: `🔹 Chamado transferido de ${user.name} para você`,
          sender: 'system',
          senderName: 'Sistema',
          room,
          timestamp: new Date(),
          isSystem: true
        };

        io.to(targetSocketId).emit('support-transferred', {
          room,
          originalUserId,
          originalUserName,
          fromSupport: {
            id: user._id,
            name: user.name
          },
          message: systemMessage
        });

        io.to(targetSocketId).emit('new-message', systemMessage);

        io.to(targetSocketId).emit('notification', {
          id: `notif_${Date.now()}`,
          type: 'info',
          title: '🔄 Chamado transferido para você',
          message: `${user.name} transferiu um chamado de ${originalUserName}`,
          data: { room, userId: originalUserId },
          timestamp: new Date(),
          read: false,
          sound: true
        });

        // Suporte destino entra na sala
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.join(room);
        }
      }

      // Notificar suporte atual que transferência foi concluída
      socket.emit('transfer-complete', {
        success: true,
        room,
        message: `Chamado transferido para ${targetSupport.name}`
      });

    } catch (error) {
      console.error('❌ Erro na transferência:', error);
      socket.emit('transfer-error', { error: 'Erro ao transferir chamado' });
    }
  });

  // ========== FINALIZAR CHAT ==========
  socket.on('end-support', ({ room, userId }) => {
    console.log(`🔚 Chat de suporte encerrado: ${room}`);

    // Remover dos chats ativos
    activeSupportChats.delete(room);

    // 👇 REMOVER DA LISTA DE CHATS DO SUPORTE
    const supportIdStr = user._id.toString();
    const supportChats = supportChatsBySupport.get(supportIdStr) || [];
    const updatedChats = supportChats.filter(r => r !== room);
    supportChatsBySupport.set(supportIdStr, updatedChats);

    console.log(`📋 Suporte ${user.name} agora tem ${updatedChats.length} chats ativos`);

    const systemMessage = {
      _id: `system_${Date.now()}`,
      content: '🔸 Chat de suporte encerrado',
      sender: 'system',
      senderName: 'Sistema',
      room,
      timestamp: new Date(),
      isSystem: true
    };

    io.to(room).emit('chat-ended', { room });
    io.to(room).emit('new-message', systemMessage);

    // Todos saem da sala
    const roomSockets = io.sockets.adapter.rooms.get(room);
    if (roomSockets) {
      roomSockets.forEach(socketId => {
        const clientSocket = io.sockets.sockets.get(socketId);
        if (clientSocket) {
          clientSocket.leave(room);
        }
      });
    }
  });

  // ========== EVENTO DE DESCONEXÃO ==========
  socket.on('disconnect', () => {
    console.log(`🔌 Desconectado: ${socket.id} - ${user.name}`);

    const userId = userSockets.get(socket.id);
    if (userId) {
      onlineUsers.delete(userId);
      userSockets.delete(socket.id);

      // Remover solicitações pendentes deste usuário
      for (const [reqId, req] of pendingSupportRequests) {
        if (req.userId === userId) {
          pendingSupportRequests.delete(reqId);
          console.log(`🗑️ Solicitação ${reqId} removida (usuário desconectou)`);
        }
      }

      // Remover da lista de chats do suporte
      if (user.role === 'SUPPORT' || user.role === 'ADMIN') {
        const supportIdStr = user._id.toString();
        const supportChats = supportChatsBySupport.get(supportIdStr) || [];

        // Notificar usuários que o suporte desconectou
        for (const room of supportChats) {
          const chatData = activeSupportChats.get(room);
          if (chatData) {
            const userSocketId = onlineUsers.get(chatData.userId);
            if (userSocketId) {
              io.to(userSocketId).emit('notification', {
                id: `notif_${Date.now()}`,
                type: 'warning',
                title: '⚠️ Suporte desconectado',
                message: 'O suporte se desconectou. Sua solicitação será reaberta.',
                timestamp: new Date(),
                read: false
              });
            }
            activeSupportChats.delete(room);
          }
        }

        supportChatsBySupport.delete(supportIdStr);
      }
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
  console.log(`📊 Usuários online: ${users.length}`);
};

module.exports = {
  initSocket,
  onlineUsers,
  userSockets,
  supportChatsBySupport // Exportar para uso em outros lugares
};