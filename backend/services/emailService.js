// services/emailService.js
const nodemailer = require('nodemailer');

let transporter = null;
let connectionError = null;

/**
 * Verifica se o email é válido
 */
const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Obtém ou cria o transporter
 */
const getTransporter = () => {
    // Se já temos um transporter funcionando, retorna ele
    if (transporter) return transporter;

    // Se houve erro de conexão anterior, não tenta novamente
    if (connectionError) {
        console.error('❌ Transporter já falhou anteriormente:', connectionError);
        return null;
    }

    // Verifica credenciais
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
        connectionError = 'Credenciais de email não configuradas no .env';
        console.error('❌', connectionError);
        return null;
    }

    if (!isValidEmail(emailUser)) {
        connectionError = `Email inválido: ${emailUser}`;
        console.error('❌', connectionError);
        return null;
    }

    console.log('📧 Configurando serviço de email...');
    console.log(`  📧 Servidor: ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}`);
    console.log(`  📧 Usuário: ${emailUser}`);
    console.log(`  📧 Senha: ${'*'.repeat(emailPass.length)}`);

    try {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: process.env.EMAIL_SECURE === 'true' || false,
            auth: {
                user: emailUser,
                pass: emailPass
            },
            family: 4,
            tls: {
                rejectUnauthorized: false,
                ciphers: 'SSLv3'
            },
            connectionTimeout: 30000,
            greetingTimeout: 30000,
            socketTimeout: 30000,
            debug: false
        });

        transporter.verify((error, success) => {
            if (error) {
                console.error('❌ Falha na verificação do transporter:', error.message);
                connectionError = error.message;
                transporter = null;

                if (error.code === 'EAUTH') {
                    console.error('\n🔧 SOLUÇÃO PARA ERRO EAUTH:');
                    console.error('   1. Acesse: https://myaccount.google.com/apppasswords');
                    console.error('   2. Gere uma NOVA senha de app');
                    console.error('   3. Atualize o EMAIL_PASS no arquivo .env');
                    console.error('   4. Reinicie a aplicação\n');
                } else if (error.code === 'ENETUNREACH') {
                    console.error('\n🔧 SOLUÇÃO PARA ERRO ENETUNREACH:');
                    console.error('   A opção family: 4 foi adicionada para forçar IPv4');
                    console.error('   Se o problema persistir, tente a porta 465 com SSL\n');
                }
            } else {
                console.log('✅ Serviço de email configurado com sucesso!');
                connectionError = null;
            }
        });

        return transporter;

    } catch (error) {
        console.error('❌ Erro ao criar transporter:', error.message);
        connectionError = error.message;
        transporter = null;
        return null;
    }
};

/**
 * Envia email de boas-vindas
 */
const sendWelcomeEmail = async (to, name) => {
    try {
        console.log(`\n📧 [WELCOME] Enviando email para: ${to}`);

        // Validações
        if (!isValidEmail(to)) {
            throw new Error(`Email inválido: ${to}`);
        }

        console.log('📧 Obtendo transporter...');
        const transporterInstance = getTransporter();
        if (!transporterInstance) {
            throw new Error(connectionError || 'Serviço de email indisponível');
        }

        console.log('📧 Transporter obtido, preparando email...');

        const mailOptions = {
            from: process.env.EMAIL_FROM || `"EcoRoute" <${process.env.EMAIL_USER}>`,
            to: to.trim().toLowerCase(),
            subject: '🎉 Bem-vindo ao EcoRoute - Sua conta foi criada!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            margin: 0;
                            padding: 0;
                            background-color: #f4f4f4;
                        }
                        .container {
                            max-width: 600px;
                            margin: 20px auto;
                            background-color: #ffffff;
                            border-radius: 10px;
                            overflow: hidden;
                            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        }
                        .header {
                            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                            color: white;
                            padding: 30px;
                            text-align: center;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 28px;
                        }
                        .content {
                            padding: 30px;
                        }
                        .button {
                            display: inline-block;
                            padding: 12px 30px;
                            background-color: #4CAF50;
                            color: white;
                            text-decoration: none;
                            border-radius: 5px;
                            margin: 20px 0;
                            font-weight: bold;
                        }
                        .footer {
                            background-color: #f9f9f9;
                            padding: 20px;
                            text-align: center;
                            font-size: 12px;
                            color: #999;
                        }
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
                            <p style="margin-top: 20px;">Estamos felizes em ter você conosco nesta jornada sustentável!</p>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} EcoRoute. Todos os direitos reservados.</p>
                            <p>Este é um email automático, por favor não responda.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `Olá ${name || 'Usuário'}!\n\nBem-vindo ao EcoRoute! Sua conta foi criada com sucesso.\n\nAcesse o dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard\n\n🌱 EcoRoute - Logística Reversa Sustentável`
        };

        console.log('📧 Enviando email... (pode levar alguns segundos)');
        const info = await transporterInstance.sendMail(mailOptions);
        console.log('✅ Email de boas-vindas enviado com sucesso!');
        console.log(`  📧 Message ID: ${info.messageId}`);
        console.log(`  📧 Response: ${info.response}`);

        return {
            success: true,
            messageId: info.messageId,
            response: info.response
        };

    } catch (error) {
        console.error('❌ ERRO DETALHADO AO ENVIAR EMAIL:');
        console.error(`  Mensagem: ${error.message}`);
        console.error(`  Código: ${error.code || 'UNKNOWN'}`);
        if (error.response) console.error(`  Resposta: ${error.response}`);
        if (error.stack) console.error(`  Stack: ${error.stack}`);

        return {
            success: false,
            error: error.message,
            code: error.code || 'UNKNOWN'
        };
    }
};

/**
 * Envia código de verificação
 */
const sendVerificationCode = async (to, name, code) => {
    try {
        console.log(`\n📧 [VERIFY] Enviando código para: ${to}`);

        if (!isValidEmail(to)) {
            throw new Error(`Email inválido: ${to}`);
        }

        if (!code || code.length < 4) {
            throw new Error('Código inválido');
        }

        const transporterInstance = getTransporter();
        if (!transporterInstance) {
            throw new Error(connectionError || 'Serviço de email indisponível');
        }

        const mailOptions = {
            from: process.env.EMAIL_FROM || `"EcoRoute" <${process.env.EMAIL_USER}>`,
            to: to.trim().toLowerCase(),
            subject: '🔐 Código de Verificação - EcoRoute',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            font-family: 'Segoe UI', Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                        }
                        .container {
                            max-width: 500px;
                            margin: 0 auto;
                            padding: 20px;
                            background: #f9f9f9;
                            border-radius: 10px;
                        }
                        .code {
                            font-size: 42px;
                            font-weight: bold;
                            color: #4CAF50;
                            text-align: center;
                            padding: 20px;
                            background: white;
                            border-radius: 10px;
                            margin: 20px 0;
                            letter-spacing: 8px;
                            border: 2px solid #4CAF50;
                            font-family: monospace;
                        }
                        .warning {
                            color: #ff9800;
                            font-size: 14px;
                            text-align: center;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Olá ${name || 'Usuário'}!</h2>
                        <p>Você solicitou um código de verificação para sua conta no <strong>EcoRoute</strong>.</p>
                        <div class="code">${code}</div>
                        <p>Este código é válido por <strong>10 minutos</strong>.</p>
                        <p class="warning">⚠️ Se você não solicitou este código, ignore este email.</p>
                        <hr>
                        <p style="font-size: 12px; color: #999;">EcoRoute - Logística Reversa Sustentável</p>
                    </div>
                </body>
                </html>
            `,
            text: `Olá ${name || 'Usuário'}!\n\nSeu código de verificação é: ${code}\n\nEste código é válido por 10 minutos.\n\nSe você não solicitou este código, ignore este email.\n\n🌱 EcoRoute`
        };

        const info = await transporterInstance.sendMail(mailOptions);
        console.log('✅ Código de verificação enviado com sucesso!');
        console.log(`  📧 Message ID: ${info.messageId}`);

        return {
            success: true,
            messageId: info.messageId,
            code: code
        };

    } catch (error) {
        console.error('❌ Erro ao enviar código de verificação:', error.message);
        return {
            success: false,
            error: error.message,
            code: error.code || 'UNKNOWN'
        };
    }
};

/**
 * Testa a conexão de email
 */
const testEmailConnection = async () => {
    console.log('\n🧪 Testando conexão de email...');
    const transporter = getTransporter();

    if (!transporter) {
        console.error('❌ Falha ao criar transporter');
        return false;
    }

    try {
        await transporter.verify();
        console.log('✅ Conexão com servidor de email OK');
        return true;
    } catch (error) {
        console.error('❌ Falha na conexão:', error.message);
        return false;
    }
};

console.log('📧 Serviço de email carregado e pronto para uso');

module.exports = {
    sendWelcomeEmail,
    sendVerificationCode,
    testEmailConnection,
    isValidEmail
};