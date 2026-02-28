const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Carregar .env
dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('=== TESTE DE CONEXÃO MONGODB ===\n');

// Verificar se a URI está configurada
if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI não está configurada no arquivo .env');
    process.exit(1);
}

// Mostrar URI escondendo a senha
const uri = process.env.MONGODB_URI;
const uriEscondida = uri.replace(/:[^:@]*@/, ':******@');
console.log('📡 URI:', uriEscondida);
console.log('📊 Database:', uri.split('/').pop().split('?')[0]);
console.log('');

async function testarConexao() {
    try {
        console.log('🔌 Conectando ao MongoDB Atlas...');
        
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('✅ CONECTADO COM SUCESSO!\n');
        
        // Listar bancos de dados
        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();
        
        console.log('📊 Bancos de dados disponíveis:');
        dbs.databases.forEach(db => {
            console.log(`   - ${db.name}`);
        });
        
        // Listar coleções do banco atual
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`\n📁 Coleções no banco '${mongoose.connection.name}':`);
        if (collections.length === 0) {
            console.log('   Nenhuma coleção encontrada');
        } else {
            collections.forEach(col => {
                console.log(`   - ${col.name}`);
            });
        }
        
    } catch (error) {
        console.error('❌ ERRO DE CONEXÃO:');
        console.error('Mensagem:', error.message);
        
        if (error.message.includes('bad auth')) {
            console.log('\n🔍 A senha pode estar incorreta!');
            console.log('💡 Verifique no MongoDB Atlas:');
            console.log('1. Acesse https://cloud.mongodb.com');
            console.log('2. Vá em "Database Access"');
            console.log('3. Verifique a senha do usuário wesleyMD');
        }
        
        if (error.message.includes('ENOTFOUND')) {
            console.log('\n🔍 O cluster não foi encontrado!');
            console.log('💡 Verifique se o cluster está correto no .env');
        }
        
        if (error.message.includes('Authentication failed')) {
            console.log('\n🔍 Falha de autenticação!');
            console.log('💡 Verifique usuário e senha');
        }
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Desconectado');
    }
}

testarConexao();