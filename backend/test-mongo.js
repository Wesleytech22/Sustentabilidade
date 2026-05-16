const { MongoClient } = require('mongodb');

const uri = "mongodb://wesleyMD:Wesley5803@ac-rcux2iu-shard-00-00.cn2gymg.mongodb.net:27017,ac-rcux2iu-shard-00-01.cn2gymg.mongodb.net:27017,ac-rcux2iu-shard-00-02.cn2gymg.mongodb.net:27017/ecoroute-dev?ssl=true&replicaSet=atlas-rcux2iu-shard-0&authSource=admin&retryWrites=true&w=majority";

async function test() {
    try {
        console.log('🔄 Testando conexão...');
        const client = new MongoClient(uri);
        await client.connect();
        console.log('✅ Conectado com sucesso!');
        await client.close();
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

test();