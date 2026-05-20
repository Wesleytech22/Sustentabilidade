// test-email-simple.js
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
    console.log('📧 Testando envio de email...');
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Configurada' : '❌ Faltando');
    
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        debug: true
    });
    
    try {
        // Verificar conexão
        await transporter.verify();
        console.log('✅ Conexão com Gmail estabelecida com sucesso!');
        
        // Tentar enviar email
        const info = await transporter.sendMail({
            from: `"EcoRoute" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, // Envia para si mesmo
            subject: 'Teste EcoRoute - Email Funcionando!',
            text: 'Se você recebeu este email, a configuração está correta!',
            html: '<h1>✅ Teste bem-sucedido!</h1><p>Seu sistema de email está funcionando.</p>'
        });
        
        console.log('✅ Email enviado!');
        console.log('Message ID:', info.messageId);
        console.log('Resposta:', info.response);
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
        console.error('Código:', error.code);
        
        if (error.code === 'EAUTH') {
            console.log('\n🔧 SOLUÇÃO:');
            console.log('Sua senha de app está inválida. Siga os passos:');
            console.log('1. Acesse: https://myaccount.google.com/security');
            console.log('2. Ative verificação em 2 etapas');
            console.log('3. Vá em "Senhas de app"');
            console.log('4. Gere nova senha para "Mail" e "Windows Computer"');
            console.log('5. Copie a senha de 16 caracteres');
            console.log('6. Atualize o .env com a NOVA senha');
        }
    }
}

testEmail();