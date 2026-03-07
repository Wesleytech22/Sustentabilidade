const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: { 
    type: String, 
    required: true 
  },
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  senderName: { 
    type: String, 
    required: true 
  },
  senderRole: {
    type: String,
    enum: ['COOPERATIVE', 'COMPANY', 'LOGISTICS', 'SUPPORT', 'ADMIN'], // ✅ CORRIGIDO: adicionados COMPANY e LOGISTICS
    default: 'COOPERATIVE'
  },
  room: { 
    type: String, 
    default: 'geral' 
  },
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  status: { 
    type: String, 
    enum: ['sent', 'delivered', 'read'], 
    default: 'sent' 
  },
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],
  isSupportMessage: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true 
});

// Índices para performance
messageSchema.index({ room: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, createdAt: -1 });
messageSchema.index({ status: 1 });

// Buscar histórico da sala
messageSchema.statics.getRoomHistory = function(room, limit = 50, before = null) {
  const query = { room };
  if (before) {
    query.createdAt = { $lt: before };
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'name email role')
    .populate('recipient', 'name email role');
};

// Marcar mensagem como lida
messageSchema.methods.markAsRead = async function(userId) {
  if (!this.readBy.some(r => r.user.toString() === userId.toString())) {
    this.readBy.push({ user: userId });
    this.status = 'read';
    this.readAt = new Date();
    await this.save();
  }
  return this;
};

// Contar mensagens não lidas
messageSchema.statics.countUnreadForUser = async function(userId, room = null) {
  const query = {
    'readBy.user': { $ne: userId },
    sender: { $ne: userId }
  };
  
  if (room) {
    query.room = room;
  }
  
  return this.countDocuments(query);
};

// Criar sala de suporte (entre usuário e suporte)
messageSchema.statics.createSupportRoom = function(userId, supportId) {
  return `support_${userId}_${supportId}`;
};

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;