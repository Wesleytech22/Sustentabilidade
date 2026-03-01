// services/emailService.js
const nodemailer = require('nodemailer');

let transporter = null;

// Função para criar transporter apenas quando necessário
const getTransporter = () => {
    if (transporter) return transporter;
    
    // Verificar se as credenciais existem
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ Credenciais de email não configuradas no .env');
        return null;
    }
    
    console.log('📧 Configurando serviço de email...');
    console.log('  📧 EMAIL_USER:', process.env.EMAIL_USER);
    console.log('  📧 EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ configurada' : '❌ não configurada');
    
    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false, // true para 465, false para 587
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        tls: {
            rejectUnauthorized: false // apenas para desenvolvimento
        },
        debug: false // Coloque true para ver logs detalhados
    });
    
    return transporter;
};

/**
 * Enviar email de boas-vindas
 */
const sendWelcomeEmail = async (to, name) => {
    try {
        console.log(`📧 Tentando enviar email de boas-vindas para: ${to}`);
        
        const transporter = getTransporter();
        if (!transporter) {
            console.log('⚠️ Email não enviado: credenciais não configuradas');
            return { success: false, error: 'Email não configurado' };
        }
        
        // Verificar se o email é válido
        if (!to || !to.includes('@')) {
            console.error('❌ Email inválido:', to);
            return { success: false, error: 'Email inválido' };
        }
        
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"EcoRoute" <noreply@ecoroute.com>',
            to: to,
            subject: 'Bem-vindo ao EcoRoute! 🌱',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
                        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 40px 20px; text-align: center; }
                        .header h1 { margin: 0; font-size: 32px; }
                        .content { padding: 40px 30px; }
                        .btn { display: inline-block; padding: 12px 30px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: 500; }
                        .footer { text-align: center; padding: 20px; background: #f9f9f9; color: #999; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🌱 EcoRoute</h1>
                            <p>Logística Reversa Sustentável</p>
                        </div>
                        <div class="content">
                            <h2>Olá ${name}!</h2>
                            <p>Seja muito bem-vindo ao EcoRoute! 🎉</p>
                            <p>Sua conta foi criada com sucesso. Agora você pode:</p>
                            <ul>
                                <li>✅ Gerenciar pontos de coleta</li>
                                <li>✅ Criar rotas otimizadas</li>
                                <li>✅ Calcular impacto ambiental</li>
                                <li>✅ Conectar-se com outras cooperativas</li>
                            </ul>
                            <p style="text-align: center; margin-top: 30px;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="btn">Acessar Dashboard</a>
                            </p>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} EcoRoute. Todos os direitos reservados.</p>
                            <p>Este é um email automático, por favor não responda.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `Olá ${name}! Seja bem-vindo ao EcoRoute. Sua conta foi criada com sucesso. Acesse o dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email de boas-vindas enviado com sucesso!');
        console.log('  📧 Para:', to);
        console.log('  📧 Message ID:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Erro ao enviar email de boas-vindas:');
        console.error('  📧 Erro:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Enviar código de verificação
 */
const sendVerificationCode = async (to, name, code) => {
    try {
        console.log(`📧 Tentando enviar código de verificação para: ${to}`);
        
        const transporter = getTransporter();
        if (!transporter) {
            console.log('⚠️ Código não enviado: credenciais não configuradas');
            return { success: false, error: 'Email não configurado' };
        }
        
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"EcoRoute" <noreply@ecoroute.com>',
            to: to,
            subject: 'Código de Verificação - EcoRoute',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 10px; }
                        .code { font-size: 48px; font-weight: bold; color: #4CAF50; text-align: center; padding: 20px; background: white; border-radius: 10px; margin: 20px 0; letter-spacing: 5px; border: 2px solid #4CAF50; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Olá ${name}!</h2>
                        <p>Você solicitou um código de verificação para sua conta no EcoRoute.</p>
                        <div class="code">${code}</div>
                        <p>Este código é válido por <strong>10 minutos</strong>.</p>
                        <p>Se você não solicitou este código, ignore este email.</p>
                    </div>
                </body>
                </html>
            `,
            text: `Olá ${name}! Seu código de verificação é: ${code}. Válido por 10 minutos.`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Código de verificação enviado com sucesso!');
        console.log('  📧 Para:', to);
        console.log('  📧 Message ID:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Erro ao enviar código de verificação:');
        console.error('  📧 Erro:', error.message);
        return { success: false, error: error.message };
    }
};

console.log('📧 Serviço de email carregado (aguardando uso)');

module.exports = {
    sendWelcomeEmail,
    sendVerificationCode
};