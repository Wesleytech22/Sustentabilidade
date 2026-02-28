const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Carregar variáveis de ambiente
dotenv.config();

// Mostrar as variáveis (sem a senha completa por segurança)
console.log('📋 Verificando configurações:');
console.log('MONGODB_USER:', process.env.MONGODB_USER || 'não definido');
console.log('MONGODB_CLUSTER:', process.env.MONGODB_CLUSTER || 'não definido');
console.log('MONGODB_DATABASE:', process.env.MONGODB_DATABASE || 'não definido');
console.log('MONGODB_PASSWORD:', process.env.MONGODB_PASSWORD ? '******' : 'não definido');

async function testarConexao() {
    try {
        // Construir a URI
        const user = process.env.MONGODB_USER || 'wesleyMD';
        const password = process.env.MONGODB_PASSWORD;
        const cluster = process.env.MONGODB_CLUSTER || 'sustentabilidade.cn2gymg.mongodb.net';
        const database = process.env.MONGODB_DATABASE || 'ecoroute';
        
        if (!password) {
            console.error('❌ ERRO: MONGODB_PASSWORD não está definida no arquivo .env');
            console.log('💡 Adicione no arquivo .env: MONGODB_PASSWORD=sua_senha_aqui');
            return;
        }
        
        const uri = `mongodb+srv://${user}:${password}@${cluster}/${database}?retryWrites=true&w=majority`;
        
        // Mostrar URI (escondendo a senha)
        const uriLog = uri.replace(password, '******');
        console.log('\n🔌 Tentando conectar com:', uriLog);
        
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ CONEXÃO BEM SUCEDIDA!');
        
        // Listar databases disponíveis
        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();
        console.log('\n📊 Bancos de dados disponíveis:');
        dbs.databases.forEach(db => {
            console.log(`   - ${db.name}`);
        });
        
    } catch (error) {
        console.error('\n❌ ERRO DETALHADO:');
        console.error('Mensagem:', error.message);
        
        if (error.message.includes('bad auth')) {
            console.log('\n🔍 POSSÍVEIS CAUSAS:');
            console.log('1. Senha incorreta no arquivo .env');
            console.log('2. Usuário incorreto (deve ser wesleyMD)');
            console.log('3. IP não liberado no MongoDB Atlas');
            console.log('\n📝 SOLUÇÕES:');
            console.log('1. Verifique a senha no MongoDB Atlas');
            console.log('2. Acesse https://cloud.mongodb.com > Network Access > Add IP Address');
            console.log('3. Adicione 0.0.0.0/0 para liberar todos os IPs (apenas para teste)');
        }
    } finally {
        await mongoose.disconnect();
    }
}

testarConexao();