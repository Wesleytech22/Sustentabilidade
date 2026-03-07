const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
require('dotenv').config();

async function testarLogin() {
    try {
        console.log('🔌 Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado!\n');

        const email = 'wealeyr537@gmail.com';
        const senha = 'Wesley5803';

        console.log(`🔍 Buscando usuário: ${email}`);
        
        // Forçar busca direta na coleção para diagnóstico
        const db = mongoose.connection.db;
        const userRaw = await db.collection('users').findOne({ email });
        
        if (userRaw) {
            console.log('✅ Usuário encontrado na coleção "users"');
            console.log('📊 Dados brutos:', {
                id: userRaw._id,
                email: userRaw.email,
                name: userRaw.name,
                role: userRaw.role,
                hash: userRaw.password ? userRaw.password.substring(0, 30) + '...' : 'sem senha'
            });
        } else {
            console.log('❌ Usuário NÃO encontrado na coleção "users"');
        }

        // Testar com o modelo (após adicionar collection: 'users')
        console.log('\n🔍 Testando com o modelo User...');
        const user = await User.findOne({ email }).select('+password');
        
        if (!user) {
            console.log('❌ Modelo também não encontrou');
        } else {
            console.log('✅ Modelo encontrou o usuário!');
            
            // Testar a senha
            const isValid = await bcrypt.compare(senha, user.password);
            console.log(`\n🔐 Senha "${senha}": ${isValid ? '✅ CORRETA' : '❌ INCORRETA'}`);
        }

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Desconectado');
    }
}

testarLogin();