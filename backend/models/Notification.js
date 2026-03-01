const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Usuário que recebe a notificação
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Tipo de notificação
  type: {
    type: String,
    required: true,
    enum: [
      'welcome',           // Boas-vindas
      'collection',        // Nova coleta
      'route',             // Nova rota
      'point',             // Ponto de coleta atualizado
      'message',           // Nova mensagem no chat
      'achievement',       // Conquista desbloqueada
      'alert',             // Alerta importante
      'reminder',          // Lembrete
      'system'             // Notificação do sistema
    ],
    default: 'system'
  },

  // Título da notificação
  title: {
    type: String,
    required: [true, 'Título é obrigatório'],
    trim: true,
    maxlength: [200, 'Título muito longo']
  },

  // Mensagem da notificação
  message: {
    type: String,
    required: [true, 'Mensagem é obrigatória'],
    trim: true,
    maxlength: [500, 'Mensagem muito longa']
  },

  // Dados adicionais (JSON flexível)
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Link relacionado (para onde levar o usuário ao clicar)
  link: {
    type: String,
    default: null
  },

  // Ícone da notificação
  icon: {
    type: String,
    default: 'fas fa-bell'
  },

  // Cor da notificação (para estilização)
  color: {
    type: String,
    enum: ['primary', 'success', 'warning', 'danger', 'info'],
    default: 'primary'
  },

  // Status da notificação
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date
  },

  // Prioridade
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Expiração
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compostos para buscas eficientes
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1, createdAt: -1 });
notificationSchema.index({ user: 1, priority: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL automático

// Virtual para formato amigável de tempo
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = Math.floor((now - this.createdAt) / 1000); // em segundos

  if (diff < 60) return `${diff} segundos atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutos atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} horas atrás`;
  return `${Math.floor(diff / 86400)} dias atrás`;
});

// Virtual para verificar se é recente (< 1 hora)
notificationSchema.virtual('isRecent').get(function() {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return this.createdAt > hourAgo;
});

// Middleware para atualizar updatedAt
notificationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Middleware para atualizar readAt quando marcar como lida
notificationSchema.pre('save', function(next) {
  if (this.isModified('read') && this.read && !this.readAt) {
    this.readAt = new Date();
  }
  next();
});

// Métodos estáticos
notificationSchema.statics.createWelcomeNotification = async function(userId) {
  return this.create({
    user: userId,
    type: 'welcome',
    title: 'Bem-vindo ao EcoRoute! 🌱',
    message: 'Sua conta foi criada com sucesso. Explore todas as funcionalidades e comece a fazer a diferença!',
    icon: 'fas fa-hand-peace',
    color: 'success',
    priority: 'high',
    link: '/dashboard',
    data: { userId }
  });
};

notificationSchema.statics.createCollectionNotification = async function(userId, pointName, volume) {
  return this.create({
    user: userId,
    type: 'collection',
    title: 'Nova Coleta Registrada 📦',
    message: `Coleta de ${volume}kg registrada no ponto "${pointName}"`,
    icon: 'fas fa-truck',
    color: 'primary',
    priority: 'medium',
    link: '/dashboard/points',
    data: { pointName, volume }
  });
};

notificationSchema.statics.createMessageNotification = async function(userId, senderName, message) {
  return this.create({
    user: userId,
    type: 'message',
    title: 'Nova mensagem 💬',
    message: `${senderName}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
    icon: 'fas fa-envelope',
    color: 'info',
    priority: 'medium',
    link: '/dashboard/chat',
    data: { senderName }
  });
};

notificationSchema.statics.createRouteNotification = async function(userId, routeName) {
  return this.create({
    user: userId,
    type: 'route',
    title: 'Rota Planejada 🗺️',
    message: `A rota "${routeName}" foi criada e está pronta para execução.`,
    icon: 'fas fa-map-marked-alt',
    color: 'success',
    priority: 'medium',
    link: '/dashboard/routes',
    data: { routeName }
  });
};

notificationSchema.statics.createAlertNotification = async function(userId, alertMessage) {
  return this.create({
    user: userId,
    type: 'alert',
    title: '⚠️ Alerta Importante',
    message: alertMessage,
    icon: 'fas fa-exclamation-triangle',
    color: 'danger',
    priority: 'urgent',
    link: '/dashboard'
  });
};

// Métodos de instância
notificationSchema.methods.markAsRead = async function() {
  this.read = true;
  return this.save();
};

notificationSchema.methods.markAsUnread = async function() {
  this.read = false;
  this.readAt = null;
  return this.save();
};

// Query helpers para consultas comuns
notificationSchema.query.unread = function() {
  return this.where({ read: false });
};

notificationSchema.query.recent = function(hours = 24) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.where({ createdAt: { $gte: cutoff } });
};

notificationSchema.query.byPriority = function(priority) {
  return this.where({ priority }).sort({ createdAt: -1 });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;