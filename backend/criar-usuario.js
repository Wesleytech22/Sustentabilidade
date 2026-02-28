const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: 'COOPERATIVE' },
    phone: String,
    city: String,
    state: String
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function criarUsuario() {
    try {
        console.log('🔌 Conectando ao MongoDB Atlas...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado!\n');

        const usuarioExistente = await User.findOne({ email: 'wealeyr537@gmail.com' });

        if (usuarioExistente) {
            console.log('📝 Usuário já existe!');
            usuarioExistente.role = 'ADMIN';
            await usuarioExistente.save();
            console.log('✅ Atualizado para ADMIN!\n');
        } else {
            console.log('📝 Criando novo usuário...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('123456', salt);

            const novoUsuario = new User({
                email: 'wealeyr537@gmail.com',
                password: hashedPassword,
                name: 'Wesley',
                phone: '11999999999',
                city: 'São Paulo',
                state: 'SP',
                role: 'ADMIN'
            });

            await novoUsuario.save();
            console.log('✅ Usuário criado!\n');
        }

        const usuario = await User.findOne({ email: 'wealeyr537@gmail.com' }).select('-password');
        console.log('👤 Usuário:', usuario);

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Desconectado');
    }
}

criarUsuario();