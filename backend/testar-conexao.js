const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Carregar variáveis de ambiente
dotenv.config();

async function testarTodasConexoes() {
    console.log('\n🔍 TESTE COMPLETO DE CONEXÕES MONGODB');
    console.log('=====================================\n');
    
    // Lista de URIs para testar
    const conexoes = [
        {
            nome: 'Atlas (string do .env)',
            uri: process.env.MONGODB_URI,
            tipo: 'atlas'
        },
        {
            nome: 'Atlas (fixa)',
            uri: 'mongodb+srv://wesleyMD:hmfDrXCB3jJO1Zqg@sustentabilidade.cn2gymg.mongodb.net/ecoroute?retryWrites=true&w=majority',
            tipo: 'atlas'
        },
        {
            nome: 'Local (desenvolvimento)',
            uri: 'mongodb://localhost:27017/ecoroute-dev',
            tipo: 'local'
        },
        {
            nome: 'Docker (com autenticação)',
            uri: 'mongodb://admin:admin123@localhost:27017/ecoroute?authSource=admin',
            tipo: 'docker'
        },
        {
            nome: 'Docker (sem autenticação)',
            uri: 'mongodb://localhost:27017/ecoroute',
            tipo: 'docker'
        }
    ];

    let algumaConexaoFuncionou = false;

    for (const conn of conexoes) {
        if (!conn.uri) {
            console.log(`❌ ${conn.nome}: URI não definida`);
            continue;
        }

        console.log(`\n📡 Testando: ${conn.nome}`);
        const safeURI = conn.uri.replace(/:([^@]+)@/, ':****@');
        console.log(`   URI: ${safeURI}`);

        // Teste com MongoClient direto
        const client = new MongoClient(conn.uri, {
            connectTimeoutMS: 5000,
            serverSelectionTimeoutMS: 5000
        });

        try {
            await client.connect();
            console.log(`   ✅ MongoClient: CONECTADO!`);
            
            // Listar databases
            const admin = client.db().admin();
            const dbs = await admin.listDatabases();
            console.log(`   📊 Databases: ${dbs.databases.map(db => db.name).join(', ')}`);
            
            algumaConexaoFuncionou = true;
            await client.close();
        } catch (err) {
            console.log(`   ❌ MongoClient: ${err.message}`);
        }

        // Teste com Mongoose
        try {
            await mongoose.connect(conn.uri);
            console.log(`   ✅ Mongoose: CONECTADO!`);
            await mongoose.disconnect();
        } catch (err) {
            console.log(`   ❌ Mongoose: ${err.message}`);
        }
    }

    console.log('\n=====================================');
    if (algumaConexaoFuncionou) {
        console.log('✅ PELO MENOS UMA CONEXÃO FUNCIONOU!');
        console.log('   Use uma das URIs que funcionaram no seu .env');
    } else {
        console.log('❌ NENHUMA CONEXÃO FUNCIONOU!');
        console.log('\n🔧 SOLUÇÕES:');
        console.log('   1. Para MongoDB LOCAL:');
        console.log('      • Instale o MongoDB: https://www.mongodb.com/try/download/community');
        console.log('      • Execute: mongod');
        console.log('');
        console.log('   2. Para MongoDB DOCKER:');
        console.log('      • docker run -d -p 27017:27017 --name mongodb mongo:6');
        console.log('');
        console.log('   3. Para MongoDB ATLAS:');
        console.log('      • Acesse https://cloud.mongodb.com');
        console.log('      • Vá em Network Access e adicione seu IP');
        console.log('      • Verifique se o usuário/senha estão corretos');
    }
    console.log('=====================================\n');
}

// Executar testes
testarTodasConexoes();