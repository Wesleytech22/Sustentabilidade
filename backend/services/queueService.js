// services/queueService.js
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const emailService = require('./emailService');
const Notification = require('../models/Notification');

// Configuração da conexão Redis
const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// ========== FILAS ==========

// Fila de Emails
const emailQueue = new Queue('email', { connection });

// Fila de Notificações
const notificationQueue = new Queue('notification', { connection });

// Fila de Processamento de Dados
const processingQueue = new Queue('processing', { connection });

// ========== WORKERS ==========

// Worker de Emails
const emailWorker = new Worker('email', async job => {
  const { type, data } = job.data;
  
  console.log(`📧 Processando email: ${type}`, job.id);
  
  try {
    switch(type) {
      case 'welcome':
        await emailService.sendWelcomeEmail(data.to, data.name);
        break;
      case 'verification':
        await emailService.sendVerificationCode(data.to, data.name, data.code);
        break;
      case 'custom':
        await emailService.sendCustomEmail(data.to, data.subject, data.html);
        break;
      default:
        console.log('Tipo de email desconhecido:', type);
    }
    
    console.log(`✅ Email ${type} enviado com sucesso`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Erro ao enviar email ${type}:`, error);
    throw error;
  }
}, { connection });

// Worker de Notificações
const notificationWorker = new Worker('notification', async job => {
  const { userId, type, title, message, data } = job.data;
  
  console.log(`🔔 Processando notificação: ${type}`, job.id);
  
  try {
    const notification = new Notification({
      user: userId,
      type,
      title,
      message,
      data,
      read: false
    });
    
    await notification.save();
    
    console.log(`✅ Notificação ${type} salva para usuário ${userId}`);
    return { success: true, notificationId: notification._id };
  } catch (error) {
    console.error(`❌ Erro ao criar notificação:`, error);
    throw error;
  }
}, { connection });

// Worker de Processamento
const processingWorker = new Worker('processing', async job => {
  const { type, data } = job.data;
  
  console.log(`⚙️ Processando tarefa: ${type}`, job.id);
  
  switch(type) {
    case 'calculate-impact':
      // Lógica para calcular impacto ambiental
      console.log('Calculando impacto...', data);
      break;
    case 'generate-report':
      // Lógica para gerar relatórios
      console.log('Gerando relatório...', data);
      break;
    case 'optimize-routes':
      // Lógica para otimizar rotas
      console.log('Otimizando rotas...', data);
      break;
    default:
      console.log('Tipo de processamento desconhecido:', type);
  }
  
  return { success: true };
}, { connection });

// ========== EVENTOS DOS WORKERS ==========

emailWorker.on('completed', job => {
  console.log(`📧 Job ${job.id} concluído com sucesso`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`📧 Job ${job.id} falhou:`, err.message);
});

notificationWorker.on('completed', job => {
  console.log(`🔔 Job ${job.id} concluído com sucesso`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`🔔 Job ${job.id} falhou:`, err.message);
});

processingWorker.on('completed', job => {
  console.log(`⚙️ Job ${job.id} concluído com sucesso`);
});

processingWorker.on('failed', (job, err) => {
  console.error(`⚙️ Job ${job.id} falhou:`, err.message);
});

// ========== FUNÇÕES PARA ADICIONAR À FILA ==========

const queueService = {
  // Email
  async sendWelcomeEmail(to, name) {
    return emailQueue.add('welcome-email', {
      type: 'welcome',
      data: { to, name }
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  },

  async sendVerificationEmail(to, name, code) {
    return emailQueue.add('verification-email', {
      type: 'verification',
      data: { to, name, code }
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  },

  // Notificações
  async createNotification(userId, type, title, message, data = {}) {
    return notificationQueue.add('create-notification', {
      userId,
      type,
      title,
      message,
      data
    }, {
      attempts: 2,
      delay: 1000 // Pequeno atraso para não sobrecarregar
    });
  },

  // Processamento
  async calculateImpact(userId, data) {
    return processingQueue.add('calculate-impact', {
      type: 'calculate-impact',
      data: { userId, ...data }
    });
  },

  async optimizeRoutes(userId, points) {
    return processingQueue.add('optimize-routes', {
      type: 'optimize-routes',
      data: { userId, points }
    });
  },

  // Utilitários
  async getQueueStatus() {
    const [emailCount, notificationCount, processingCount] = await Promise.all([
      emailQueue.getJobCounts(),
      notificationQueue.getJobCounts(),
      processingQueue.getJobCounts()
    ]);

    return {
      email: emailCount,
      notification: notificationCount,
      processing: processingCount
    };
  },

  async closeAll() {
    await Promise.all([
      emailWorker.close(),
      notificationWorker.close(),
      processingWorker.close(),
      emailQueue.close(),
      notificationQueue.close(),
      processingQueue.close(),
      connection.quit()
    ]);
  }
};

// Tratamento de erros da conexão Redis
connection.on('error', (error) => {
  console.error('❌ Erro na conexão Redis:', error);
});

connection.on('connect', () => {
  console.log('✅ Conectado ao Redis');
});

module.exports = queueService;