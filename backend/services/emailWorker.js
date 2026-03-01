// services/emailWorker.js
const nodemailer = require('nodemailer');
const { Worker } = require('bullmq');
const IORedis = require('ioredis');

// Configuração do Redis
const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null
});

// Configuração do transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Templates de email
const templates = {
  welcome: (name) => ({
    subject: 'Bem-vindo ao EcoRoute! 🌱',
    html: `
      <h1>Olá ${name}!</h1>
      <p>Seja bem-vindo ao EcoRoute!</p>
      <p>Sua conta foi criada com sucesso.</p>
    `
  }),
  
  verification: (name, code) => ({
    subject: 'Código de Verificação - EcoRoute',
    html: `
      <h1>Olá ${name}!</h1>
      <p>Seu código de verificação é:</p>
      <h2 style="color: #4CAF50; font-size: 32px;">${code}</h2>
      <p>Este código é válido por 10 minutos.</p>
    `
  }),
  
  collection: (name, pointName, volume) => ({
    subject: 'Nova Coleta Registrada 📦',
    html: `
      <h1>Olá ${name}!</h1>
      <p>Uma nova coleta foi registrada:</p>
      <ul>
        <li>Ponto: ${pointName}</li>
        <li>Volume: ${volume}kg</li>
      </ul>
    `
  }),
  
  route: (name, routeName) => ({
    subject: 'Nova Rota Criada 🗺️',
    html: `
      <h1>Olá ${name}!</h1>
      <p>A rota "${routeName}" foi criada com sucesso.</p>
    `
  })
};

// Criar worker
const emailWorker = new Worker('email', async job => {
  const { type, to, name, data } = job.data;
  
  console.log(`📧 Processando email ${type} para ${to}`);
  
  try {
    const template = templates[type](name, data?.code, data?.pointName, data?.volume);
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"EcoRoute" <noreply@ecoroute.com>',
      to,
      subject: template.subject,
      html: template.html
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Email enviado: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error(`❌ Erro ao enviar email:`, error);
    throw error;
  }
}, { connection });

emailWorker.on('completed', job => {
  console.log(`📧 Job ${job.id} concluído`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`📧 Job ${job.id} falhou:`, err.message);
});

emailWorker.on('error', err => {
  console.error('❌ Erro no worker de email:', err);
});

// Funções auxiliares para adicionar jobs
const emailQueue = {
  async sendWelcome(to, name) {
    return emailWorker.queue.add('welcome', {
      type: 'welcome',
      to,
      name
    }, {
      attempts: 3,
      backoff: 2000
    });
  },
  
  async sendVerification(to, name, code) {
    return emailWorker.queue.add('verification', {
      type: 'verification',
      to,
      name,
      data: { code }
    }, {
      attempts: 3,
      backoff: 2000
    });
  },
  
  async sendCollection(to, name, pointName, volume) {
    return emailWorker.queue.add('collection', {
      type: 'collection',
      to,
      name,
      data: { pointName, volume }
    });
  },
  
  async sendRoute(to, name, routeName) {
    return emailWorker.queue.add('route', {
      type: 'route',
      to,
      name,
      data: { routeName }
    });
  }
};

module.exports = {
  emailWorker,
  emailQueue
};