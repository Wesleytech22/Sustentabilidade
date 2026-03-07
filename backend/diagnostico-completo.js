const mongoose = require('mongoose');
require('dotenv').config();

async function diagnosticoCompleto() {
    try {
        console.log('\n🔍 ===== DIAGNÓSTICO COMPLETO DO MONGODB =====\n');
        
        console.log('📦 Conectando ao MongoDB...');
        console.log('URI:', process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/:([^@]+)@/, ':****@') : '❌ Não definida');
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB\n');

        // Obter o banco de dados atual
        const db = mongoose.connection.db;
        const adminDb = mongoose.connection.db.admin();
        
        // Listar todos os bancos de dados
        console.log('📚 LISTANDO TODOS OS BANCOS DE DADOS:');
        const dbs = await adminDb.listDatabases();
        dbs.databases.forEach(dbInfo => {
            console.log(`   - ${dbInfo.name} (${(dbInfo.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
        });
        console.log();

        // Banco atual
        const currentDbName = db.databaseName;
        console.log(`🎯 Banco atual: ${currentDbName}\n`);

        // Listar todas as coleções do banco atual
        console.log(`📚 COLEÇÕES NO BANCO "${currentDbName}":`);
        const collections = await db.listCollections().toArray();
        
        if (collections.length === 0) {
            console.log('   ❌ Nenhuma coleção encontrada!');
        } else {
            collections.forEach(col => {
                console.log(`   - ${col.name}`);
            });
        }
        console.log();

        // Para cada coleção, buscar o email específico
        const emailBuscado = 'wealeyr537@gmail.com';
        console.log(`🔍 BUSCANDO EMAIL "${emailBuscado}" EM TODAS AS COLEÇÕES:\n`);
        
        let encontrado = false;

        for (const col of collections) {
            const collection = db.collection(col.name);
            
            // Tentar encontrar documento com este email
            const doc = await collection.findOne({ 
                $or: [
                    { email: emailBuscado },
                    { email: emailBuscado.toLowerCase() },
                    { email: emailBuscado.toUpperCase() }
                ]
            });
            
            if (doc) {
                encontrado = true;
                console.log(`✅ ENCONTRADO na coleção "${col.name}"!`);
                console.log('   Dados do documento:');
                console.log(`   - ID: ${doc._id}`);
                console.log(`   - Nome: ${doc.name || 'N/A'}`);
                console.log(`   - Role: ${doc.role || 'N/A'}`);
                console.log(`   - Senha: ${doc.password ? '✅ presente' : '❌ ausente'}`);
                if (doc.password) {
                    console.log(`   - Hash: ${doc.password.substring(0, 30)}...`);
                }
                console.log();
            } else {
                // Verificar quantos documentos tem na coleção
                const count = await collection.countDocuments();
                console.log(`   📊 Coleção "${col.name}": ${count} documentos - email não encontrado`);
            }
        }

        if (!encontrado) {
            console.log(`\n❌❌❌ EMAIL "${emailBuscado}" NÃO ENCONTRADO EM NENHUMA COLEÇÃO!`);
            
            // Listar alguns documentos de cada coleção para debug
            console.log('\n📋 AMOSTRA DE DOCUMENTOS POR COLEÇÃO:');
            for (const col of collections) {
                const collection = db.collection(col.name);
                const sample = await collection.find({}).limit(2).toArray();
                
                if (sample.length > 0) {
                    console.log(`\nColeção "${col.name}" (amostra):`);
                    sample.forEach((doc, idx) => {
                        console.log(`   Documento ${idx + 1}:`);
                        console.log(`      ID: ${doc._id}`);
                        console.log(`      Campos: ${Object.keys(doc).join(', ')}`);
                        if (doc.email) console.log(`      Email: ${doc.email}`);
                        if (doc.name) console.log(`      Nome: ${doc.name}`);
                    });
                }
            }
        }

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Desconectado do MongoDB');
    }
}

diagnosticoCompleto();