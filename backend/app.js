const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');

// Importar modelos e serviços
const User = require('./src/models/User');
const Message = require('./models/Message');
const Notification = require('./models/Notification');
const emailService = require('./services/emailService');
const socketService = require('./services/socketService');

// Importar rota de IA
const aiRoutes = require('./src/routes/ai.routes');

// Importar rota de Eventos
const eventsRoutes = require('./src/routes/events.routes');

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// ========== MIDDLEWARES DE SEGURANÇA E PERFORMANCE ==========
app.use(helmet({
    contentSecurityPolicy: isProduction ? undefined : false,
}));

app.use(compression());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Muitas requisições deste IP, tente novamente após 15 minutos' },
    standardHeaders: true,
    legacyHeaders: false,
});

if (isProduction) {
    app.use('/api', limiter);
}

const allowedOrigins = [
    'https://frontend-sustentabilidade.vercel.app',
    'https://frontend-sustentabilidade-kqv4le4pi-wesleys-projects-899c5b81.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://localhost'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else if (origin.match(/https:\/\/.*\.vercel\.app$/)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== CRIAR SERVIDOR HTTP ==========
const server = http.createServer(app);

// ========== INICIALIZAR SOCKET.IO ==========
const io = socketService.initSocket(server);
app.set('io', io);

// ========== CONFIGURAÇÃO DE CONEXÃO MULTI-AMBIENTE ==========
const connectDB = async () => {
    try {
        console.log('\n=================================');
        console.log('🔌 INICIANDO CONEXÃO COM MONGODB');
        console.log('=================================');

        console.log(`📋 NODE_ENV: ${process.env.NODE_ENV || 'não definido'}`);

        let mongoURI = process.env.MONGODB_URI;

        if (!mongoURI && process.env.MONGO_ROOT_USER) {
            mongoURI = `mongodb://${process.env.MONGO_ROOT_USER}:${process.env.MONGO_ROOT_PASSWORD}@mongodb:27017/${process.env.MONGO_DATABASE}?authSource=admin`;
            console.log('📦 Modo: MongoDB no Docker');
        }
        else if (mongoURI && mongoURI.includes('mongodb+srv')) {
            console.log('🌍 Modo: MongoDB Atlas (nuvem)');
        }
        else if (!mongoURI && !isProduction) {
            mongoURI = 'mongodb://localhost:27017/ecoroute-dev';
            console.log('💻 Modo: MongoDB Local (desenvolvimento)');
        }
        else if (!mongoURI && isProduction) {
            throw new Error('MONGODB_URI não definida nas variáveis de ambiente em produção');
        }

        const safeURI = mongoURI.replace(/:([^@]+)@/, ':****@');
        console.log(`📍 Conectando a: ${safeURI}`);

        const mongooseOptions = {
            maxPoolSize: isProduction ? 50 : 10,
            minPoolSize: isProduction ? 10 : 2,
            connectTimeoutMS: isProduction ? 30000 : 10000,
            socketTimeoutMS: isProduction ? 60000 : 45000,
            serverSelectionTimeoutMS: isProduction ? 30000 : 10000,
            retryWrites: true,
            retryReads: true,
            family: 4,
            ...(isProduction && {
                w: 'majority',
                wtimeoutMS: 5000,
            }),
            ...(mongoURI && mongoURI.includes('mongodb+srv') && {
                tls: true,
                tlsAllowInvalidCertificates: false,
                tlsCAFile: undefined,
            })
        };

        console.log(`⚙️ Opções: Pool=${mongooseOptions.maxPoolSize}, Timeout=${mongooseOptions.serverSelectionTimeoutMS}ms`);

        await mongoose.connect(mongoURI, mongooseOptions);

        console.log('✅ MongoDB Conectado com sucesso!');
        console.log(`📊 Database: ${mongoose.connection.name}`);
        console.log(`🌐 Host: ${mongoose.connection.host}`);
        console.log(`🔗 Pool: ${mongooseOptions.maxPoolSize} conexões`);
        console.log('=================================\n');

        mongoose.connection.on('error', (err) => {
            console.error('❌ Erro no MongoDB:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB desconectado');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconectado');
        });

        return mongoose.connection;

    } catch (error) {
        console.error('\n❌ ERRO AO CONECTAR MONGODB:');
        console.error(`   ${error.message}\n`);

        console.log('🔍 DIAGNÓSTICO:');

        if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
            console.log('   ⚠️  Erro de autenticação:');
            console.log('      • Verifique usuário e senha no .env');
            console.log('      • Confirme se o usuário tem permissão no banco correto');
        }
        else if (error.message.includes('getaddrinfo ENOTFOUND')) {
            console.log('   ⚠️  Host não encontrado:');
            console.log('      • Verifique se o nome do cluster está correto');
        }
        else if (error.message.includes('timed out') || error.message.includes('timeout')) {
            console.log('   ⚠️  Timeout de conexão:');
            console.log('      • No Atlas, adicione 0.0.0.0/0 à whitelist');
        }
        else if (error.message.includes('Could not connect to any servers')) {
            console.log('   ⚠️  Não foi possível conectar ao cluster:');
            console.log('      • Verifique a whitelist de IPs no Atlas');
        }
        else if (error.message.includes('ECONNREFUSED')) {
            console.log('   ⚠️  Conexão recusada:');
            console.log('      • Tentando conectar ao MongoDB local');
        }

        console.log('\n💡 SOLUÇÕES:');
        console.log('   1. No MongoDB Atlas:');
        console.log('      • Acesse: https://cloud.mongodb.com');
        console.log('      • Vá em "Network Access" → "Add IP Address"');
        console.log('      • Adicione 0.0.0.0/0');
        console.log('');
        console.log('   2. No Render:');
        console.log('      • Confirme a variável MONGODB_URI');
        console.log('      • Faça novo deploy com "Clear build cache"');
        console.log('=================================\n');

        if (process.env.NODE_ENV === 'production') {
            console.error('\n❌ PRODUÇÃO: Encerrando aplicação. O Render vai reiniciar automaticamente.');
            process.exit(1);
        } else {
            console.log('\n⚠️  Desenvolvimento: Continuando sem banco de dados...');
        }
    }
};

connectDB();

// ========== MODELOS ==========
const collectionPointSchema = new mongoose.Schema({
    name: { type: String, required: [true, 'Nome é obrigatório'] },
    address: { type: String, required: [true, 'Endereço é obrigatório'] },
    neighborhood: String,
    city: { type: String, required: [true, 'Cidade é obrigatória'] },
    state: { type: String, required: [true, 'Estado é obrigatório'], uppercase: true },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    wasteTypes: [{
        type: String,
        enum: ['plastico', 'papel', 'vidro', 'metal', 'organico', 'eletronico']
    }],
    capacity: { type: Number, required: [true, 'Capacidade é obrigatória'], min: [0, 'Capacidade deve ser positiva'] },
    currentVolume: { type: Number, default: 0, min: 0 },
    status: { type: String, default: 'ACTIVE', enum: ['ACTIVE', 'INACTIVE', 'FULL'] },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }
}, { timestamps: true, toJSON: { virtuals: true } });

collectionPointSchema.virtual('occupancyPercentage').get(function () {
    if (this.capacity === 0) return 0;
    return Math.round((this.currentVolume / this.capacity) * 100);
});

const routeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    date: { type: Date, default: Date.now, index: true },
    status: { type: String, default: 'PLANNED', enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
    points: [{
        pointId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionPoint' },
        order: Number,
        estimatedVolume: Number,
        actualVolume: Number,
        collectedAt: Date
    }],
    totalDistance: { type: Number, default: 0 },
    totalWaste: { type: Number, default: 0 },
    fuelConsumption: { type: Number, default: 0 },
    carbonFootprint: { type: Number, default: 0 },
    vehicleType: { type: String, default: 'truck' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: Date,
    eventsSummary: [{
        eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
        eventName: String,
        eventDate: Date,
        wasteCollected: Number
    }],
    eventInfo: {
        eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
        eventName: String,
        eventDate: Date,
        eventLocation: String
    }
}, { timestamps: true });

const collectionSchema = new mongoose.Schema({
    collectionPointId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionPoint', required: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
    date: { type: Date, default: Date.now, index: true },
    wasteVolume: { type: Number, required: true, min: [0, 'Volume deve ser positivo'] },
    wasteType: String,
    notes: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const CollectionPoint = mongoose.model('CollectionPoint', collectionPointSchema);
const Route = mongoose.model('Route', routeSchema);
const Collection = mongoose.model('Collection', collectionSchema);

// ========== MIDDLEWARE DE AUTENTICAÇÃO ==========
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token não fornecido ou formato inválido' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
        if (!user.active) return res.status(401).json({ error: 'Usuário inativo' });

        req.user = user;
        req.userId = user._id;
        req.userRole = user.role;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expirado' });
        if (error.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Token inválido' });
        console.error('❌ Erro na autenticação:', error);
        return res.status(500).json({ error: 'Erro na autenticação' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.userRole) return res.status(401).json({ error: 'Não autorizado' });
        if (!roles.includes(req.userRole)) return res.status(403).json({ error: 'Acesso negado' });
        next();
    };
};

// ========== FUNÇÕES AUXILIARES ==========
const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// ========== ROTAS DE AUTENTICAÇÃO ==========
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, phone, city, state, role } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        const validRoles = ['COOPERATIVE', 'COMPANY', 'LOGISTICS', 'SUPPORT', 'ADMIN'];
        const userRole = validRoles.includes(role) ? role : 'COOPERATIVE';

        const user = new User({
            email: email.toLowerCase(),
            password: password,
            name: name.trim(),
            phone: phone || '',
            city: city || '',
            state: state?.toUpperCase() || '',
            role: userRole
        });

        await user.save();

        emailService.sendWelcomeEmail(user.email, user.name)
            .then(result => {
                if (result.success) {
                    console.log(`✅ Email de boas-vindas enviado para: ${user.email}`);
                } else {
                    console.error(`❌ Falha ao enviar email para ${user.email}:`, result.error);
                }
            })
            .catch(err => {
                console.error(`❌ Erro inesperado ao enviar email para ${user.email}:`, err.message);
            });

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({
            success: true,
            user: userResponse,
            token,
            message: 'Usuário criado com sucesso! Um email de boas-vindas foi enviado.'
        });

    } catch (error) {
        console.error('❌ Erro no registro:', error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: Object.values(error.errors).map(e => e.message).join(', ')
            });
        }

        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        if (!user) {
            return res.status(401).json({ error: 'Email ou senha inválidos' });
        }

        if (!user.active) {
            return res.status(401).json({ error: 'Usuário inativo' });
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return res.status(401).json({ error: 'Email ou senha inválidos' });
        }

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        user.lastLogin = new Date();
        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({
            success: true,
            user: userResponse,
            token,
            message: 'Login realizado com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/auth/verify-email', async (req, res) => {
    try {
        const { email, code } = req.body;

        const user = await User.findOne({
            email: email.toLowerCase(),
            verificationCode: code,
            verificationCodeExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Código inválido ou expirado' });
        }

        user.emailVerified = true;
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        await user.save();

        res.json({ message: 'Email verificado com sucesso! Agora você pode fazer login.' });
    } catch (error) {
        console.error('❌ Erro na verificação:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/auth/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        if (user.emailVerified) {
            return res.status(400).json({ error: 'Email já verificado' });
        }

        const verificationCode = generateVerificationCode();
        user.verificationCode = verificationCode;
        user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        await emailService.sendVerificationCode(user.email, user.name, verificationCode);

        res.json({ message: 'Código reenviado com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao reenviar código:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        res.json(req.user);
    } catch (error) {
        console.error('❌ Erro no perfil:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const { name, phone, city, state } = req.body;

        const user = await User.findByIdAndUpdate(
            req.userId,
            { name, phone, city, state: state?.toUpperCase() },
            { new: true, runValidators: true }
        );

        res.json({ user, message: 'Perfil atualizado com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao atualizar perfil:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ========== ROTAS DE PONTOS DE COLETA ==========
app.post('/api/points', authenticateToken, async (req, res) => {
    try {
        const pointData = { ...req.body, userId: req.userId };

        if (!pointData.name || !pointData.address || !pointData.city || !pointData.state || !pointData.capacity) {
            return res.status(400).json({ error: 'Campos obrigatórios: name, address, city, state, capacity' });
        }

        if (pointData.capacity) pointData.capacity = Number(pointData.capacity);
        if (pointData.latitude) pointData.latitude = Number(pointData.latitude);
        if (pointData.longitude) pointData.longitude = Number(pointData.longitude);
        if (pointData.currentVolume) pointData.currentVolume = Number(pointData.currentVolume);

        const point = new CollectionPoint(pointData);
        await point.save();

        res.status(201).json({ point, message: 'Ponto de coleta criado com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao criar ponto:', error);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ error: errors.join(', ') });
        }

        res.status(500).json({ error: error.message || 'Erro ao criar ponto de coleta' });
    }
});

app.get('/api/points', authenticateToken, async (req, res) => {
    try {
        const { status, city, wasteType } = req.query;

        const filter = { userId: req.userId };
        if (status) filter.status = status;
        if (city) filter.city = city;
        if (wasteType) filter.wasteTypes = wasteType;

        const points = await CollectionPoint.find(filter).sort({ createdAt: -1 });
        res.json(points);
    } catch (error) {
        console.error('❌ Erro ao listar pontos:', error);
        res.status(500).json({ error: 'Erro ao listar pontos de coleta' });
    }
});

// PUT - Atualizar ponto de coleta
app.put('/api/points/:id', authenticateToken, async (req, res) => {
    try {
        console.log('✏️ Atualizando ponto ID:', req.params.id);
        console.log('📦 Dados recebidos:', req.body);

        const point = await CollectionPoint.findOne({ _id: req.params.id, userId: req.userId });

        if (!point) {
            return res.status(404).json({ error: 'Ponto de coleta não encontrado' });
        }

        // Atualizar campos permitidos
        const allowedFields = ['name', 'address', 'neighborhood', 'city', 'state', 'latitude', 'longitude', 'capacity', 'wasteTypes', 'status'];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                if (field === 'capacity') {
                    point[field] = Number(req.body[field]);
                } else if (field === 'latitude' || field === 'longitude') {
                    point[field] = req.body[field] ? Number(req.body[field]) : null;
                } else if (field === 'wasteTypes') {
                    point[field] = req.body[field];
                } else {
                    point[field] = req.body[field];
                }
            }
        }

        await point.save();
        console.log(`✅ Ponto atualizado: ${point.name}`);

        res.json({ point, message: 'Ponto de coleta atualizado com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao atualizar ponto:', error);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ error: errors.join(', ') });
        }

        res.status(500).json({ error: error.message || 'Erro ao atualizar ponto de coleta' });
    }
});

app.delete('/api/points/:id', authenticateToken, async (req, res) => {
    try {
        console.log('🗑️ Tentando deletar ponto ID:', req.params.id);

        const point = await CollectionPoint.findOneAndDelete({ _id: req.params.id, userId: req.userId });

        if (!point) {
            return res.status(404).json({ error: 'Ponto não encontrado' });
        }

        res.json({ message: 'Ponto deletado com sucesso', deletedPoint: point });
    } catch (error) {
        console.error('❌ Erro ao deletar ponto:', error);
        res.status(500).json({ error: 'Erro ao deletar ponto de coleta' });
    }
});

// ========== ROTAS DE MENSAGENS ==========
app.post('/api/messages', authenticateToken, async (req, res) => {
    try {
        const { content, room, recipient } = req.body;

        const message = new Message({
            content,
            room: room || 'geral',
            sender: req.userId,
            senderName: req.user.name,
            recipient
        });

        await message.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('new-message', { ...message.toJSON(), timestamp: new Date() });
        }

        if (recipient) {
            await Notification.createMessageNotification(recipient, req.user.name, content);
        }

        res.status(201).json({ message: 'Mensagem enviada com sucesso', data: message });
    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

app.get('/api/messages/:room', authenticateToken, async (req, res) => {
    try {
        const { room } = req.params;
        const { limit = 50, before } = req.query;

        const messages = await Message.getRoomHistory(room, parseInt(limit), before);
        res.json(messages);
    } catch (error) {
        console.error('❌ Erro ao buscar mensagens:', error);
        res.status(500).json({ error: 'Erro ao buscar mensagens' });
    }
});

app.patch('/api/messages/:id/read', authenticateToken, async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) return res.status(404).json({ error: 'Mensagem não encontrada' });
        await message.markAsRead(req.userId);
        res.json({ message: 'Mensagem marcada como lida' });
    } catch (error) {
        console.error('❌ Erro ao marcar mensagem:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ========== ROTAS DE NOTIFICAÇÕES ==========
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const { read, limit = 50 } = req.query;
        const query = { user: req.userId };
        if (read !== undefined) query.read = read === 'true';

        const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(parseInt(limit));
        const unreadCount = await Notification.countDocuments({ user: req.userId, read: false });

        res.json({ notifications, unreadCount, total: notifications.length });
    } catch (error) {
        console.error('❌ Erro ao buscar notificações:', error);
        res.status(500).json({ error: 'Erro ao buscar notificações' });
    }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        const notification = await Notification.findOne({ _id: req.params.id, user: req.userId });
        if (!notification) return res.status(404).json({ error: 'Notificação não encontrada' });
        await notification.markAsRead();
        res.json({ message: 'Notificação marcada como lida' });
    } catch (error) {
        console.error('❌ Erro ao marcar notificação:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.patch('/api/notifications/read-all', authenticateToken, async (req, res) => {
    try {
        await Notification.updateMany({ user: req.userId, read: false }, { read: true, readAt: new Date() });
        res.json({ message: 'Todas as notificações foram marcadas como lidas' });
    } catch (error) {
        console.error('❌ Erro ao marcar todas notificações:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.userId });
        if (!notification) return res.status(404).json({ error: 'Notificação não encontrada' });
        res.json({ message: 'Notificação removida com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao remover notificação:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ========== ROTAS DE ROTAS ==========
app.post('/api/routes', authenticateToken, async (req, res) => {
    try {
        const routeData = { ...req.body, userId: req.userId };
        const route = new Route(routeData);
        await route.save();

        await Notification.createRouteNotification(req.userId, route.name);

        const io = req.app.get('io');
        if (io) io.emit('route-changed', { type: 'new', route, timestamp: new Date() });

        res.status(201).json({ route, message: 'Rota criada com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao criar rota:', error);
        res.status(500).json({ error: 'Erro ao criar rota' });
    }
});

app.get('/api/routes', authenticateToken, async (req, res) => {
    try {
        const { status, startDate, endDate } = req.query;
        const filter = { userId: req.userId };
        if (status) filter.status = status;
        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate);
            if (endDate) filter.date.$lte = new Date(endDate);
        }

        const routes = await Route.find(filter).populate('points.pointId').sort({ date: -1 });
        res.json(routes);
    } catch (error) {
        console.error('❌ Erro ao listar rotas:', error);
        res.status(500).json({ error: 'Erro ao listar rotas' });
    }
});

// PUT - Atualizar rota
app.put('/api/routes/:id', authenticateToken, async (req, res) => {
    try {
        const { name, status } = req.body;
        const route = await Route.findById(req.params.id);

        if (!route) {
            return res.status(404).json({ error: 'Rota não encontrada' });
        }

        if (route.userId.toString() !== req.userId) {
            return res.status(403).json({ error: 'Acesso não autorizado' });
        }

        if (name) route.name = name;
        if (status) route.status = status;

        await route.save();
        console.log(`✅ Rota atualizada: ${route.name}`);
        res.json(route);
    } catch (error) {
        console.error('❌ Erro ao atualizar rota:', error);
        res.status(500).json({ error: 'Erro ao atualizar rota' });
    }
});

// DELETE - Remover rota
app.delete('/api/routes/:id', authenticateToken, async (req, res) => {
    try {
        const route = await Route.findById(req.params.id);

        if (!route) {
            return res.status(404).json({ error: 'Rota não encontrada' });
        }

        if (route.userId.toString() !== req.userId) {
            return res.status(403).json({ error: 'Acesso não autorizado' });
        }

        await route.deleteOne();
        console.log(`🗑️ Rota removida: ${route.name}`);
        res.json({ message: 'Rota removida com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao deletar rota:', error);
        res.status(500).json({ error: 'Erro ao deletar rota' });
    }
});

// ========== NOVO ENDPOINT - GERAR ROTA A PARTIR DE EVENTOS FINALIZADOS ==========
app.post('/api/routes/generate-from-events', authenticateToken, async (req, res) => {
    try {
        console.log('🔍 Buscando eventos finalizados para o usuário:', req.userId);

        const Event = require('./src/models/Events');

        const finishedEvents = await Event.find({
            userId: req.userId,
            status: 'finalizado'
        });

        console.log(`📊 Encontrados ${finishedEvents.length} eventos finalizados`);

        if (finishedEvents.length === 0) {
            return res.status(404).json({
                error: 'Nenhum evento finalizado encontrado para gerar rota',
                message: 'Finalize um evento primeiro antes de criar uma rota'
            });
        }

        const totalWaste = finishedEvents.reduce((sum, e) => sum + (e.estimatedWaste || e.wasteCollected || 0), 0);

        const newRoute = new Route({
            name: `Coleta Pós-Eventos - ${new Date().toLocaleDateString('pt-BR')}`,
            description: `Rota gerada automaticamente para coleta de resíduos de ${finishedEvents.length} evento(s)`,
            date: new Date(),
            points: finishedEvents.map((event, index) => ({
                pointId: event._id,
                order: index + 1,
                estimatedVolume: event.estimatedWaste || event.wasteCollected || 500,
                distance: 0,
                duration: 0
            })),
            totalDistance: 0,
            totalWaste: totalWaste,
            fuelConsumption: 0,
            carbonFootprint: 0,
            vehicleType: 'truck',
            status: 'PLANNED',
            userId: req.userId,
            eventsSummary: finishedEvents.map(event => ({
                eventId: event._id,
                eventName: event.name,
                eventDate: event.startDate || event.date,
                wasteCollected: event.estimatedWaste || event.wasteCollected || 0
            })),
            eventInfo: {
                eventId: finishedEvents[0]._id,
                eventName: finishedEvents[0].name,
                eventDate: finishedEvents[0].startDate || finishedEvents[0].date,
                eventLocation: finishedEvents[0].city || finishedEvents[0].location || 'Local não informado'
            }
        });

        await newRoute.save();
        console.log(`✅ Rota criada com sucesso! ID: ${newRoute._id}`);
        console.log(`📊 Total de resíduos: ${totalWaste} kg`);
        console.log(`📋 Eventos incluídos: ${finishedEvents.length}`);

        for (const event of finishedEvents) {
            event.status = 'coleta_agendada';
            event.scheduledCollectionDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            event.routeId = newRoute._id;
            await event.save();
            console.log(`✅ Evento atualizado: ${event.name} -> coleta_agendada`);
        }

        await Notification.createRouteNotification(req.userId, newRoute.name);

        const io = req.app.get('io');
        if (io) io.emit('route-changed', { type: 'new', route: newRoute, timestamp: new Date() });

        res.status(201).json(newRoute);

    } catch (error) {
        console.error('❌ Erro ao gerar rota a partir de eventos:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS DE COLETAS ==========
app.post('/api/collections', authenticateToken, async (req, res) => {
    try {
        const collectionData = { ...req.body, userId: req.userId };
        const point = await CollectionPoint.findOne({ _id: collectionData.collectionPointId, userId: req.userId });

        if (!point) return res.status(404).json({ error: 'Ponto de coleta não encontrado' });

        const collection = new Collection(collectionData);
        await collection.save();

        point.currentVolume += collectionData.wasteVolume;
        await point.save();

        await Notification.createCollectionNotification(req.userId, point.name, collectionData.wasteVolume);

        const io = req.app.get('io');
        if (io) io.emit('collection-update', { pointId: point._id, pointName: point.name, volume: collectionData.wasteVolume, timestamp: new Date() });

        if (collectionData.routeId) {
            await Route.updateOne(
                { _id: collectionData.routeId, 'points.pointId': collectionData.collectionPointId },
                { $set: { 'points.$.actualVolume': collectionData.wasteVolume, 'points.$.collectedAt': new Date() } }
            );
        }

        res.status(201).json({ collection, message: 'Coleta registrada com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao registrar coleta:', error);
        res.status(500).json({ error: 'Erro ao registrar coleta' });
    }
});

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        console.log(`📊 Buscando stats para usuário: ${req.user.name} (${req.userId})`);

        // Pontos de coleta do usuário
        const pointsCount = await CollectionPoint.countDocuments({ userId: req.userId });

        // Rotas ativas (PLANNED ou IN_PROGRESS)
        const routesCount = await Route.countDocuments({
            userId: req.userId,
            status: { $in: ['PLANNED', 'IN_PROGRESS'] }
        });

        // Total de resíduos coletados
        const collections = await Collection.aggregate([
            { $lookup: { from: 'collectionpoints', localField: 'collectionPointId', foreignField: '_id', as: 'point' } },
            { $unwind: { path: '$point', preserveNullAndEmptyArrays: true } },
            { $match: { 'point.userId': req.user._id } },
            { $group: { _id: null, totalWaste: { $sum: '$wasteVolume' } } }
        ]);

        const totalWaste = collections[0]?.totalWaste || 0;
        const totalCarbon = Math.floor(totalWaste * 0.13);

        console.log(`📊 Resultado:`, { pointsCount, routesCount, totalWaste, totalCarbon });

        res.json({
            pointsCount,
            routesCount,
            totalWaste,
            totalCarbon
        });
    } catch (error) {
        console.error('❌ Erro ao carregar stats do dashboard:', error);
        res.status(500).json({ error: 'Erro ao carregar estatísticas' });
    }
});

app.get('/api/dashboard/waste-by-type', authenticateToken, async (req, res) => {
    try {
        console.log(`📊 Buscando resíduos por tipo para usuário: ${req.user.name}`);

        const wasteByType = await Collection.aggregate([
            { $lookup: { from: 'collectionpoints', localField: 'collectionPointId', foreignField: '_id', as: 'point' } },
            { $unwind: { path: '$point', preserveNullAndEmptyArrays: true } },
            { $match: { 'point.userId': req.user._id } },
            {
                $group: {
                    _id: { $ifNull: ['$wasteType', 'outros'] },
                    total: { $sum: '$wasteVolume' }
                }
            },
            { $sort: { total: -1 } }
        ]);

        const typeLabels = {
            'plastico': 'Plástico',
            'papel': 'Papel',
            'vidro': 'Vidro',
            'metal': 'Metal',
            'organico': 'Orgânico',
            'eletronico': 'Eletrônico',
            'outros': 'Outros'
        };

        const labels = wasteByType.map(item => typeLabels[item._id] || item._id);
        const data = wasteByType.map(item => item.total);

        console.log(`📊 Tipos encontrados:`, labels);

        // Se não houver dados, retorna array vazio
        res.json({
            labels: labels.length ? labels : ['Plástico', 'Papel', 'Vidro', 'Metal', 'Orgânico'],
            data: data.length ? data : [0, 0, 0, 0, 0]
        });
    } catch (error) {
        console.error('❌ Erro ao carregar resíduos por tipo:', error);
        res.json({
            labels: ['Plástico', 'Papel', 'Vidro', 'Metal', 'Orgânico'],
            data: [0, 0, 0, 0, 0]
        });
    }
});

// ========== ROTAS DE IMPACTO AMBIENTAL ==========
app.get('/api/impact', authenticateToken, async (req, res) => {
    try {
        const result = await Collection.aggregate([
            { $lookup: { from: 'collectionpoints', localField: 'collectionPointId', foreignField: '_id', as: 'point' } },
            { $unwind: '$point' },
            { $match: { 'point.userId': req.user._id } },
            { $group: { _id: null, totalWaste: { $sum: '$wasteVolume' } } }
        ]);

        const totalWaste = result[0]?.totalWaste || 0;

        const treesSaved = Math.floor(totalWaste * 0.02);
        const waterSaved = totalWaste * 5;
        const energySaved = totalWaste * 0.35;
        const carbonSaved = totalWaste * 0.13;

        const history = await Collection.aggregate([
            { $lookup: { from: 'collectionpoints', localField: 'collectionPointId', foreignField: '_id', as: 'point' } },
            { $unwind: '$point' },
            { $match: { 'point.userId': req.user._id } },
            { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, waste: { $sum: '$wasteVolume' }, carbon: { $sum: { $multiply: ['$wasteVolume', 0.13] } } } },
            { $sort: { _id: 1 } },
            { $limit: 12 }
        ]);

        res.json({ current: { treesSaved, waterSaved: Math.floor(waterSaved), energySaved: Math.floor(energySaved), carbonSaved: Math.floor(carbonSaved), totalWaste }, history });
    } catch (error) {
        console.error('❌ Erro ao calcular impacto:', error);
        res.status(500).json({ error: 'Erro ao calcular impacto ambiental' });
    }
});

// GET /api/dashboard/monthly-impact - Impacto mensal
app.get('/api/dashboard/monthly-impact', authenticateToken, async (req, res) => {
    try {
        console.log(`📊 Buscando impacto mensal para usuário: ${req.user.name}`);

        const monthlyImpact = await Collection.aggregate([
            { $lookup: { from: 'collectionpoints', localField: 'collectionPointId', foreignField: '_id', as: 'point' } },
            { $unwind: { path: '$point', preserveNullAndEmptyArrays: true } },
            { $match: { 'point.userId': req.user._id } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
                    carbon: { $sum: { $multiply: ['$wasteVolume', 0.13] } }
                }
            },
            { $sort: { _id: 1 } },
            { $limit: 12 }
        ]);

        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        const labels = monthlyImpact.map(item => {
            const month = parseInt(item._id.split('-')[1]) - 1;
            return monthNames[month];
        });

        const data = monthlyImpact.map(item => Math.round(item.carbon));

        console.log(`📊 Impacto mensal:`, { labels, data });

        // Se não houver dados, retorna meses atuais com zeros
        if (labels.length === 0) {
            const currentMonth = new Date().getMonth();
            const last6Months = [];
            const zeros = [];
            for (let i = 5; i >= 0; i--) {
                const monthIndex = (currentMonth - i + 12) % 12;
                last6Months.push(monthNames[monthIndex]);
                zeros.push(0);
            }
            res.json({ labels: last6Months, data: zeros });
        } else {
            res.json({ labels, data });
        }
    } catch (error) {
        console.error('❌ Erro ao carregar impacto mensal:', error);
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const currentMonth = new Date().getMonth();
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
            const monthIndex = (currentMonth - i + 12) % 12;
            last6Months.push(monthNames[monthIndex]);
        }
        res.json({ labels: last6Months, data: [0, 0, 0, 0, 0, 0] });
    }
});

// GET /api/dashboard/recent-activities - Atividades recentes
app.get('/api/dashboard/recent-activities', authenticateToken, async (req, res) => {
    try {
        const limit = 10;
        const activities = [];

        // Buscar coletas recentes
        const recentCollections = await Collection.find()
            .populate({ path: 'collectionPointId', match: { userId: req.user._id } })
            .sort({ createdAt: -1 })
            .limit(limit);

        for (const collection of recentCollections) {
            if (collection.collectionPointId) {
                activities.push({
                    id: collection._id,
                    type: 'collection',
                    icon: 'fa-recycle',
                    title: `${collection.wasteVolume} kg coletados em ${collection.collectionPointId.name}`,
                    date: collection.createdAt,
                    timeAgo: getTimeAgo(collection.createdAt)
                });
            }
        }

        // Buscar rotas recentes
        const recentRoutes = await Route.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(limit);

        for (const route of recentRoutes) {
            const statusText = route.status === 'COMPLETED' ? 'concluída' :
                route.status === 'IN_PROGRESS' ? 'iniciada' : 'criada';
            activities.push({
                id: route._id,
                type: 'route',
                icon: 'fa-route',
                title: `Rota "${route.name}" ${statusText}`,
                date: route.createdAt,
                timeAgo: getTimeAgo(route.createdAt)
            });
        }

        // Buscar pontos criados recentemente
        const recentPoints = await CollectionPoint.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(limit);

        for (const point of recentPoints) {
            activities.push({
                id: point._id,
                type: 'point',
                icon: 'fa-map-marker-alt',
                title: `Ponto de coleta "${point.name}" criado`,
                date: point.createdAt,
                timeAgo: getTimeAgo(point.createdAt)
            });
        }

        // Ordenar por data (mais recente primeiro)
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));

        console.log(`📊 Atividades recentes: ${activities.length} encontradas`);

        res.json({ activities: activities.slice(0, limit) });
    } catch (error) {
        console.error('❌ Erro ao carregar atividades recentes:', error);
        res.json({ activities: [] });
    }
});

// Função auxiliar para calcular tempo relativo
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Agora mesmo';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Há ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Há ${days} ${days === 1 ? 'dia' : 'dias'}`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `Há ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
    const months = Math.floor(days / 30);
    return `Há ${months} ${months === 1 ? 'mês' : 'meses'}`;
}

// ========== ROTAS DE IA ==========
app.use('/api/ai', aiRoutes);

// ========== ROTAS DE EVENTOS ==========
app.use('/api/events', eventsRoutes);

// ========== ROTAS PÚBLICAS ==========
app.get('/', (req, res) => {
    res.json({
        nome: 'EcoRoute API - Logística Reversa',
        versao: '1.0.0',
        status: 'online',
        ambiente: process.env.NODE_ENV || 'desenvolvimento',
        database: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado',
        socket: 'disponível na mesma porta do servidor',
        documentacao: '/api/docs',
        endpoints: {
            auth: {
                registro: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                perfil: 'GET /api/auth/profile (auth)',
                verificar: 'POST /api/auth/verify-email'
            },
            pontos: {
                listar: 'GET /api/points (auth)',
                criar: 'POST /api/points (auth)',
                editar: 'PUT /api/points/:id (auth)',
                deletar: 'DELETE /api/points/:id (auth)'
            },
            rotas: {
                listar: 'GET /api/routes (auth)',
                criar: 'POST /api/routes (auth)',
                editar: 'PUT /api/routes/:id (auth)',
                deletar: 'DELETE /api/routes/:id (auth)',
                gerarRotas: 'POST /api/routes/generate-from-events (auth)'
            },
            coletas: { registrar: 'POST /api/collections (auth)' },
            dashboard: { stats: 'GET /api/dashboard/stats (auth)' },
            impacto: 'GET /api/impact (auth)',
            ai: { analise: 'POST /api/ai/analyze (upload image)' },
            eventos: {
                listar: 'GET /api/events (auth)',
                criar: 'POST /api/events (auth)',
                finalizar: 'POST /api/events/:id/finish (auth)',
                gerarRotas: 'POST /api/events/generate-routes (auth)'
            }
        },
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        ambiente: process.env.NODE_ENV || 'desenvolvimento',
        database: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado',
        socket: 'rodando na mesma porta',
        uptime: process.uptime(),
        memoria: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

app.get('/api/docs', (req, res) => {
    res.json({
        titulo: 'EcoRoute API - Documentação',
        versao: '1.0.0',
        autenticacao: {
            descricao: 'A API usa JWT para autenticação',
            token: 'Incluir no header: Authorization: Bearer <token>',
            obter_token: 'POST /api/auth/login'
        },
        endpoints: {
            auth: {
                'POST /api/auth/register': {
                    descricao: 'Registrar novo usuário',
                    body: { name: 'string (obrigatório)', email: 'string (obrigatório)', password: 'string (obrigatório, min 6 caracteres)', phone: 'string (opcional)', city: 'string (opcional)', state: 'string (opcional)' }
                },
                'POST /api/auth/login': { descricao: 'Fazer login', body: { email: 'string (obrigatório)', password: 'string (obrigatório)' } },
                'POST /api/auth/verify-email': { descricao: 'Verificar email com código', body: { email: 'string (obrigatório)', code: 'string (obrigatório, 6 dígitos)' } }
            },
            notificacoes: {
                'GET /api/notifications': 'Listar notificações do usuário',
                'PATCH /api/notifications/:id/read': 'Marcar notificação como lida',
                'PATCH /api/notifications/read-all': 'Marcar todas como lidas',
                'DELETE /api/notifications/:id': 'Remover notificação'
            },
            mensagens: {
                'POST /api/messages': 'Enviar mensagem',
                'GET /api/messages/:room': 'Buscar histórico da sala',
                'PATCH /api/messages/:id/read': 'Marcar mensagem como lida'
            },
            ai: { 'POST /api/ai/analyze': { descricao: 'Analisar imagem e detectar resíduos', auth: true, body: { image: 'file (multipart/form-data)' } } },
            eventos: {
                'POST /api/events': 'Criar evento',
                'GET /api/events': 'Listar eventos',
                'POST /api/events/:id/finish': 'Finalizar evento e agendar coleta',
                'POST /api/events/generate-routes': 'Gerar rotas de coleta para eventos finalizados'
            },
            pontos: {
                'GET /api/points': 'Listar pontos de coleta',
                'POST /api/points': 'Criar ponto de coleta',
                'PUT /api/points/:id': 'Atualizar ponto de coleta',
                'DELETE /api/points/:id': 'Remover ponto de coleta'
            },
            rotas: {
                'GET /api/routes': 'Listar rotas',
                'POST /api/routes': 'Criar rota manualmente',
                'PUT /api/routes/:id': 'Atualizar rota',
                'DELETE /api/routes/:id': 'Remover rota',
                'POST /api/routes/generate-from-events': 'Gerar rota a partir de eventos finalizados'
            }
        },
        exemplos: {
            registrar: {
                url: '/api/auth/register',
                metodo: 'POST',
                body: { name: 'Cooperativa Recicla', email: 'contato@recicla.com', password: '123456', city: 'São Paulo', state: 'SP' }
            },
            criarEvento: {
                url: '/api/events',
                metodo: 'POST',
                body: { name: 'Show de Rock', type: 'show', address: 'Estádio do Morumbi', city: 'São Paulo', state: 'SP', startDate: '2026-05-01', endDate: '2026-05-01', expectedAttendees: 50000 }
            },
            editarPonto: {
                url: '/api/points/:id',
                metodo: 'PUT',
                body: { name: 'Novo Nome', address: 'Novo Endereço', capacity: 3000 }
            },
            gerarRota: {
                url: '/api/routes/generate-from-events',
                metodo: 'POST',
                descricao: 'Gera uma rota automaticamente a partir de eventos finalizados'
            }
        }
    });
});

// ========== TRATAMENTO DE ERROS ==========
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Rota não encontrada',
        path: req.originalUrl,
        method: req.method,
        dica: 'Consulte /api/docs para ver as rotas disponíveis'
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Erro global:', err.stack);

    const statusCode = err.statusCode || 500;
    const message = isProduction ? 'Ocorreu um erro interno no servidor' : err.message;

    res.status(statusCode).json({ error: message, ...(isProduction ? {} : { stack: err.stack }) });
});

// ========== INICIAR SERVIDOR ==========
server.listen(PORT, () => {
    console.log('\n=================================');
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📝 Ambiente: ${process.env.NODE_ENV || 'desenvolvimento'}`);
    console.log(`🍃 Banco: ${mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado'}`);
    console.log(`🔌 Socket.IO disponível na mesma porta (${PORT})`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📚 Documentação: http://localhost:${PORT}/api/docs`);
    console.log(`🤖 IA Service: http://ai-service:5001`);
    console.log(`📌 Endpoints disponíveis:`);
    console.log(`   - PUT /api/points/:id - Editar ponto de coleta`);
    console.log(`   - PUT /api/routes/:id - Editar rota`);
    console.log(`   - POST /api/routes/generate-from-events - Gerar rota de eventos`);
    console.log('=================================\n');
});

// ========== GRACEFUL SHUTDOWN ==========
process.on('SIGTERM', async () => {
    console.log('\n👋 SIGTERM recebido, encerrando servidor...');
    server.close(() => console.log('💤 Servidor HTTP encerrado'));
    try {
        await mongoose.connection.close();
        console.log('💤 Conexão MongoDB encerrada');
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro ao encerrar MongoDB:', err);
        process.exit(1);
    }
});

process.on('SIGINT', async () => {
    console.log('\n👋 SIGINT recebido, encerrando servidor...');
    server.close(() => console.log('💤 Servidor HTTP encerrado'));
    try {
        await mongoose.connection.close();
        console.log('💤 Conexão MongoDB encerrada');
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro ao encerrar MongoDB:', err);
        process.exit(1);
    }
});

module.exports = app;