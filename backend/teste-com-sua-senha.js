const { MongoClient } = require('mongodb');

async function testar() {
    // SUA SENHA: Wesley5803
    const uri = 'mongodb+srv://wesleyMD:Wesley5803@sustentabilidade.cn2gymg.mongodb.net/ecoroute?retryWrites=true&w=majority';
    
    console.log('🔍 Testando conexão com sua senha: Wesley5803');
    console.log('URI: mongodb+srv://wesleyMD:****@sustentabilidade.cn2gymg.mongodb.net/ecoroute');
    
    const client = new MongoClient(uri, {
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000
    });
    
    try {
        await client.connect();
        console.log('✅ CONEXÃO BEM-SUCEDIDA!');
        console.log('🎉 A senha Wesley5803 está correta!');
        
        // Listar databases
        const dbs = await client.db().admin().listDatabases();
        console.log('📊 Databases encontrados:');
        dbs.databases.forEach(db => console.log(`   - ${db.name}`));
        
        await client.close();
    } catch (err) {
        console.log('❌ Erro:', err.message);
        
        if (err.message.includes('Authentication failed')) {
            console.log('\n🔑 A senha Wesley5803 NÃO funcionou.');
            console.log('   Isso pode acontecer por dois motivos:');
            console.log('   1. A senha no Atlas é diferente (pode ter sido alterada)');
            console.log('   2. Caracteres especiais precisam de codificação');
        }
        if (err.message.includes('timed out')) {
            console.log('\n⏱️ TIMEOUT - IP NÃO LIBERADO!');
            console.log('   Acesse: https://cloud.mongodb.com');
            console.log('   Vá em Network Access → Add IP Address → 0.0.0.0/0');
        }
    }
}

testar();