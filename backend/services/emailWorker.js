// services/emailWorker.js
const { Resend } = require('resend');
const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');

// Configuração do Redis
const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null
});

// Instância do Resend (HTTP API — funciona no Render Free)
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.EMAIL_FROM || 'EcoRoute <onboarding@resend.dev>';

// Templates de email
const templates = {
  welcome: (name) => ({
    subject: 'Bem-vindo ao EcoRoute! 🌱',
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0;">🌱 EcoRoute</h1>
          <p style="margin: 5px 0 0;">Logística Reversa Sustentável</p>
        </div>
        <div style="padding: 30px;">
          <h2>Olá ${name || 'Usuário'}! 👋</h2>
          <p>Seja muito bem-vindo ao <strong>EcoRoute</strong>!</p>
          <p>Sua conta foi criada com sucesso. Agora você pode:</p>
          <ul>
            <li>✅ Gerenciar pontos de coleta</li>
            <li>✅ Criar rotas otimizadas</li>
            <li>✅ Calcular impacto ambiental</li>
            <li>✅ Conectar-se com outras cooperativas</li>
          </ul>
          <div style="text-align: center; margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard"
               style="display: inline-block; padding: 12px 30px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Acessar Dashboard
            </a>
          </div>
        </div>
        <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #999;">
          <p>© ${new Date().getFullYear()} EcoRoute. Todos os direitos reservados.</p>
          <p>Este é um email automático, por favor não responda.</p>
        </div>
      </div>
    `
  }),

  verification: (name, code) => ({
    subject: 'Código de Verificação - EcoRoute 🔐',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 10px;">
        <h2>Olá ${name || 'Usuário'}!</h2>
        <p>Seu código de verificação é:</p>
        <div style="font-size: 42px; font-weight: bold; color: #4CAF50; text-align: center; padding: 20px;
                    background: white; border-radius: 10px; margin: 20px 0; letter-spacing: 8px;
                    border: 2px solid #4CAF50; font-family: monospace;">
          ${code}
        </div>
        <p>Este código é válido por <strong>10 minutos</strong>.</p>
        <p style="color: #ff9800;">⚠️ Se você não solicitou este código, ignore este email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999;">EcoRoute - Logística Reversa Sustentável</p>
      </div>
    `
  }),

  collection: (name, pointName, volume) => ({
    subject: 'Nova Coleta Registrada 📦',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2>Olá ${name || 'Usuário'}!</h2>
        <p>Uma nova coleta foi registrada com sucesso:</p>
        <ul>
          <li><strong>Ponto:</strong> ${pointName}</li>
          <li><strong>Volume:</strong> ${volume}kg</li>
        </ul>
        <p>Acesse o dashboard para mais detalhes.</p>
        <p style="font-size: 12px; color: #999;">🌱 EcoRoute - Logística Reversa Sustentável</p>
      </div>
    `
  }),

  route: (name, routeName) => ({
    subject: 'Nova Rota Criada 🗺️',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2>Olá ${name || 'Usuário'}!</h2>
        <p>A rota <strong>"${routeName}"</strong> foi criada com sucesso.</p>
        <p>Acesse o dashboard para visualizar e gerenciar sua rota.</p>
        <p style="font-size: 12px; color: #999;">🌱 EcoRoute - Logística Reversa Sustentável</p>
      </div>
    `
  })
};

// Fila de emails (para adicionar jobs)
const emailQueue = new Queue('email', { connection });

// Worker que processa os jobs
const emailWorker = new Worker('email', async job => {
  const { type, to, name, data } = job.data;

  console.log(`📧 Processando email "${type}" para ${to}`);

  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY não configurada nas variáveis de ambiente');
  }

  const templateFn = templates[type];
  if (!templateFn) {
    throw new Error(`Template desconhecido: ${type}`);
  }

  // Chama o template com os parâmetros corretos conforme o tipo
  let template;
  switch (type) {
    case 'welcome':
      template = templateFn(name);
      break;
    case 'verification':
      template = templateFn(name, data?.code);
      break;
    case 'collection':
      template = templateFn(name, data?.pointName, data?.volume);
      break;
    case 'route':
      template = templateFn(name, data?.routeName);
      break;
    default:
      template = templateFn(name);
  }

  const { data: result, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: template.subject,
    html: template.html
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  console.log(`✅ Email "${type}" enviado para ${to} — ID: ${result?.id}`);
  return { success: true, messageId: result?.id };

}, { connection });

// Eventos do worker
emailWorker.on('completed', (job) => {
  console.log(`📧 Job ${job.id} concluído com sucesso`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`📧 Job ${job?.id} falhou: ${err.message}`);
});

emailWorker.on('error', (err) => {
  console.error('❌ Erro no worker de email:', err);
});

// Funções auxiliares para enfileirar emails
const emailQueueHelpers = {
  async sendWelcome(to, name) {
    return emailQueue.add('welcome', { type: 'welcome', to, name }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
  },

  async sendVerification(to, name, code) {
    return emailQueue.add('verification', {
      type: 'verification', to, name, data: { code }
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
  },

  async sendCollection(to, name, pointName, volume) {
    return emailQueue.add('collection', {
      type: 'collection', to, name, data: { pointName, volume }
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
  },

  async sendRoute(to, name, routeName) {
    return emailQueue.add('route', {
      type: 'route', to, name, data: { routeName }
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
  }
};

console.log('📧 emailWorker carregado — usando Resend (HTTP API)');

module.exports = {
  emailWorker,
  emailQueue: emailQueueHelpers
};