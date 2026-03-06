const { MongoClient } = require('mongodb');

async function testarConexao() {
    // !!! ATENÇÃO: Altere a senha 'Teste123' para a senha que você acabou de definir no passo a passo acima !!!
    const senhaDoBanco = 'Teste123'; 
    
    // URI com authSource=admin para forçar a autenticação no banco correto
    const uri = `mongodb+srv://wesleymd:${senhaDoBanco}@sustentabilidade.cn2gymg.mongodb.net/ecoroute?retryWrites=true&w=majority&authSource=admin`;

    console.log('🔍 Testando Conexão com a Senha Recém-Definida:');
    console.log(`   Usuário: wesleymd`);
    console.log(`   Senha: ${senhaDoBanco} (substitua se for diferente)`);
    console.log(`   URI: mongodb+srv://wesleymd:****@sustentabilidade.cn2gymg.mongodb.net/ecoroute?authSource=admin`);

    const client = new MongoClient(uri, {
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000
    });

    try {
        await client.connect();
        console.log('✅✅✅ CONEXÃO BEM-SUCEDIDA!');
        console.log('🎉 O problema era a senha ou a falta do authSource!');
        
        const admin = client.db().admin();
        const dbs = await admin.listDatabases();
        console.log('📊 Databases encontrados:');
        dbs.databases.forEach(db => console.log(`   - ${db.name}`));
        
        await client.close();

        console.log('\n📝 Agora ATUALIZE seu arquivo .env com a senha que funcionou:');
        console.log(`MONGODB_URI="mongodb+srv://wesleymd:${senhaDoBanco}@sustentabilidade.cn2gymg.mongodb.net/ecoroute?retryWrites=true&w=majority&authSource=admin"`);

    } catch (err) {
        console.log('❌ Erro:', err.message);
        
        if (err.message.includes('Authentication failed')) {
            console.log('\n🔑 AUTENTICAÇÃO FALHOU. Siga rigorosamente o passo a passo abaixo:');
            console.log('   1. Acesse https://cloud.mongodb.com (email: wealeyr537@gmail.com)');
            console.log('   2. Vá em "Database Access" (menu esquerdo)');
            console.log('   3. Clique em "EDIT" no usuário "wesleymd"');
            console.log('   4. Em "Password", escolha "Edit Password"');
            console.log('   5. DIGITE A SENHA: abc123 (exatamente assim)');
            console.log('   6. Clique em "Update User" no final da página');
            console.log('   7. Aguarde 2 MINUTOS e execute este teste NOVAMENTE.');
        }
    }
}

testarConexao();