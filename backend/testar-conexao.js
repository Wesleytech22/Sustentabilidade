const { MongoClient } = require('mongodb');

async function testar() {
    const uri = 'mongodb+srv://wesleyMD:Wesley5803@sustentabilidade.cn2gymg.mongodb.net/ecoroute?retryWrites=true&w=majority&authSource=admin';
    
    console.log('🔍 Testando com senha Wesley5803...');
    
    const client = new MongoClient(uri, {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000
    });
    
    try {
        await client.connect();
        console.log('✅✅✅ CONEXÃO BEM-SUCEDIDA!');
        console.log('🎉 A senha Wesley5803 funcionou!');
        await client.close();
    } catch (err) {
        console.log('❌ Erro:', err.message);
        console.log('⏱️ Aguarde mais 1-2 minutos e tente novamente');
    }
}

testar();