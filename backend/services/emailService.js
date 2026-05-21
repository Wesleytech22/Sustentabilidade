// services/emailService.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const FROM_ADDRESS = process.env.EMAIL_FROM || 'EcoRoute <onboarding@resend.dev>';

const sendWelcomeEmail = async (to, name) => {
    try {
        console.log(`\n📧 [WELCOME] Enviando email para: ${to}`);

        if (!isValidEmail(to)) throw new Error(`Email inválido: ${to}`);
        if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY não configurada');

        const { data, error } = await resend.emails.send({
            from: FROM_ADDRESS,
            to: to.trim().toLowerCase(),
            subject: '🎉 Bem-vindo ao EcoRoute - Sua conta foi criada!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: 'Segoe UI', sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 30px; text-align: center; }
                        .header h1 { margin: 0; font-size: 28px; }
                        .content { padding: 30px; }
                        .button { display: inline-block; padding: 12px 30px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
                        .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #999; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🌱 EcoRoute</h1>
                            <p>Logística Reversa Sustentável</p>
                        </div>
                        <div class="content">
                            <h2>Olá ${name || 'Usuário'}! 👋</h2>
                            <p>Seja muito bem-vindo ao <strong>EcoRoute</strong>!</p>
                            <p>Sua conta foi criada com sucesso. Agora você pode:</p>
                            <ul>
                                <li>✅ Gerenciar pontos de coleta</li>
                                <li>✅ Criar rotas otimizadas</li>
                                <li>✅ Calcular impacto ambiental</li>
                                <li>✅ Conectar-se com outras cooperativas</li>
                            </ul>
                            <div style="text-align: center;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="button">
                                    Acessar Dashboard
                                </a>
                            </div>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} EcoRoute. Todos os direitos reservados.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        });

        if (error) throw new Error(error.message);

        console.log('✅ Email de boas-vindas enviado!', data?.id);
        return { success: true, messageId: data?.id };

    } catch (error) {
        console.error('❌ Erro ao enviar email de boas-vindas:', error.message);
        return { success: false, error: error.message };
    }
};

const sendVerificationCode = async (to, name, code) => {
    try {
        console.log(`\n📧 [VERIFY] Enviando código para: ${to}`);

        if (!isValidEmail(to)) throw new Error(`Email inválido: ${to}`);
        if (!code || code.length < 4) throw new Error('Código inválido');

        const { data, error } = await resend.emails.send({
            from: FROM_ADDRESS,
            to: to.trim().toLowerCase(),
            subject: '🔐 Código de Verificação - EcoRoute',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 10px;">
                    <h2>Olá ${name || 'Usuário'}!</h2>
                    <p>Seu código de verificação é:</p>
                    <div style="font-size: 42px; font-weight: bold; color: #4CAF50; text-align: center; padding: 20px; background: white; border-radius: 10px; margin: 20px 0; letter-spacing: 8px; border: 2px solid #4CAF50; font-family: monospace;">
                        ${code}
                    </div>
                    <p>Este código é válido por <strong>10 minutos</strong>.</p>
                    <p style="color: #ff9800;">⚠️ Se você não solicitou este código, ignore este email.</p>
                </div>
            `,
        });

        if (error) throw new Error(error.message);

        console.log('✅ Código de verificação enviado!', data?.id);
        return { success: true, messageId: data?.id, code };

    } catch (error) {
        console.error('❌ Erro ao enviar código:', error.message);
        return { success: false, error: error.message };
    }
};

const testEmailConnection = async () => {
    if (!process.env.RESEND_API_KEY) {
        console.error('❌ RESEND_API_KEY não configurada');
        return false;
    }
    console.log('✅ Resend configurado (sem necessidade de verificação de conexão)');
    return true;
};

console.log('📧 Serviço de email (Resend) carregado');

module.exports = { sendWelcomeEmail, sendVerificationCode, testEmailConnection, isValidEmail };