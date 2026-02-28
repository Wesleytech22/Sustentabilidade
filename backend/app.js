const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conectar ao MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Conectado!'))
    .catch(err => console.error('❌ Erro MongoDB:', err));

// Schema do Usuário
const userSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    role: { 
        type: String, 
        default: 'COOPERATIVE' 
    },
    phone: String,
    city: String,
    state: String
}, { 
    timestamps: true 
});

const User = mongoose.model('User', userSchema);

// ========== ROTAS DE AUTENTICAÇÃO ==========

// ROTA DE LOGIN - POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validar se email e senha foram fornecidos
        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        // Buscar usuário
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Email ou senha inválidos' });
        }

        // Verificar senha
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Email ou senha inválidos' });
        }

        // Gerar token JWT
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        // Retornar usuário (sem a senha) e token
        const userWithoutPassword = await User.findById(user._id).select('-password');
        res.json({ 
            user: userWithoutPassword, 
            token,
            message: 'Login realizado com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ROTA DE REGISTRO - POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, phone, city, state } = req.body;

        // Validar campos obrigatórios
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
        }

        // Verificar se usuário já existe
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        // Hash da senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Criar usuário
        const user = new User({
            email,
            password: hashedPassword,
            name,
            phone,
            city,
            state
        });

        await user.save();

        // Gerar token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        const userWithoutPassword = await User.findById(user._id).select('-password');
        res.status(201).json({ 
            user: userWithoutPassword, 
            token,
            message: 'Usuário criado com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro no registro:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ROTA DE PERFIL - GET /api/auth/profile (protegida)
app.get('/api/auth/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json(user);

    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
});

// ========== ROTAS PÚBLICAS ==========

// Rota raiz - documentação da API
app.get('/', (req, res) => {
    res.json({
        nome: 'EcoRoute API - Logística Reversa',
        versao: '1.0.0',
        status: 'online',
        database: 'MongoDB Atlas',
        endpoints: {
            login: {
                metodo: 'POST',
                url: '/api/auth/login',
                descricao: 'Fazer login na aplicação',
                body: { email: 'string', password: 'string' }
            },
            registro: {
                metodo: 'POST',
                url: '/api/auth/register',
                descricao: 'Registrar novo usuário',
                body: { email: 'string', password: 'string', name: 'string', phone: 'string', city: 'string', state: 'string' }
            },
            perfil: {
                metodo: 'GET',
                url: '/api/auth/profile',
                descricao: 'Buscar dados do usuário logado',
                auth: 'Bearer Token'
            },
            health: {
                metodo: 'GET',
                url: '/api/health',
                descricao: 'Verificar status da API'
            }
        },
        timestamp: new Date().toISOString()
    });
});

// Rota de saúde da API
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        database: 'MongoDB Atlas',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// ========== TRATAMENTO DE ERROS ==========

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Rota não encontrada',
        path: req.originalUrl,
        method: req.method
    });
});

// Middleware de tratamento de erros global
app.use((err, req, res, next) => {
    console.error('❌ Erro global:', err.stack);
    res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: err.message 
    });
});

// ========== INICIAR SERVIDOR ==========

app.listen(PORT, () => {
    console.log('=================================');
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📝 Ambiente: ${process.env.NODE_ENV || 'desenvolvimento'}`);
    console.log(`🍃 Banco: MongoDB Atlas`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log('=================================');
});

module.exports = app;