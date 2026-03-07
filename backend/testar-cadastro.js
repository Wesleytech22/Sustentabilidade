const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
require('dotenv').config();

async function testarCadastro() {
    try {
        console.log('\n🔍 TESTANDO CADASTRO DIRETAMENTE\n');
        
        console.log('📦 Conectando ao MongoDB...');
        console.log('URI:', process.env.MONGODB_URI.replace(/:([^@]+)@/, ':****@'));
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB\n');

        // Gerar email único para teste
        const emailTeste = `teste_${Date.now()}@teste.com`;
        
        console.log('📝 Criando usuário de teste:');
        console.log(`   Email: ${emailTeste}`);
        console.log(`   Senha: 123456`);
        console.log(`   Nome: Usuário Teste`);

        // Criar hash da senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('123456', salt);

        // Criar usuário
        const user = new User({
            email: emailTeste,
            password: hashedPassword,
            name: 'Usuário Teste',
            role: 'COOPERATIVE',
            phone: '11999999999',
            city: 'São Paulo',
            state: 'SP',
            active: true
        });

        await user.save();
        console.log('✅ Usuário salvo com sucesso!');

        // Verificar se foi salvo
        const verificado = await User.findOne({ email: emailTeste });
        if (verificado) {
            console.log('✅ Usuário encontrado no banco!');
            console.log('   ID:', verificado._id);
            console.log('   Email:', verificado.email);
            console.log('   Role:', verificado.role);
        } else {
            console.log('❌ Usuário NÃO encontrado após salvar!');
        }

        // Listar todos os usuários
        const todos = await User.find({});
        console.log(`\n📊 Total de usuários no banco: ${todos.length}`);
        todos.forEach(u => {
            console.log(`   - ${u.email} (${u.role})`);
        });

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Desconectado');
    }
}

testarCadastro();