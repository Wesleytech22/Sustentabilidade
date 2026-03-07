const mongoose = require('mongoose');
require('dotenv').config();

async function verificarOutroBanco() {
    try {
        console.log('\n🔍 VERIFICANDO BANCO "ecoroute-prod"\n');
        
        // Conectar ao banco "ecoroute-prod"
        const uri = process.env.MONGODB_URI.replace('ecoroute', 'ecoroute-prod');
        console.log('📦 Conectando a:', uri.replace(/:([^@]+)@/, ':****@'));
        
        await mongoose.connect(uri);
        console.log('✅ Conectado ao MongoDB\n');

        const db = mongoose.connection.db;
        
        // Listar coleções
        console.log('📚 COLEÇÕES:');
        const collections = await db.listCollections().toArray();
        collections.forEach(col => console.log(`   - ${col.name}`));
        console.log();

        // Buscar usuários
        const emailBuscado = 'wealeyr537@gmail.com';
        
        for (const col of collections) {
            const collection = db.collection(col.name);
            const doc = await collection.findOne({ email: emailBuscado });
            
            if (doc) {
                console.log(`✅ USUÁRIO ENCONTRADO na coleção "${col.name}"!`);
                console.log('   Dados:', {
                    id: doc._id,
                    nome: doc.name,
                    email: doc.email,
                    role: doc.role
                });
                return;
            }
        }
        
        console.log('❌ Usuário não encontrado em nenhuma coleção');

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Desconectado');
    }
}

verificarOutroBanco();