const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Importar modelos e serviços
const Message = require('./models/Message');
const Notification = require('./models/Notification');
const emailService = require('./services/emailService');

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// ========== MIDDLEWARES DE SEGURANÇA E PERFORMANCE ==========
// Helmet para headers de segurança
app.use(helmet({
    contentSecurityPolicy: isProduction ? undefined : false,
}));

// Compressão Gzip
app.use(compression());

// Rate limiting - Prevenir brute force
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // limite por IP
    message: { error: 'Muitas requisições deste IP, tente novamente após 15 minutos' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Aplicar rate limiting apenas em produção
if (isProduction) {
    app.use('/api', limiter);
}

// CORS configurado
app.use(cors({
    origin: isProduction 
        ? process.env.CORS_ORIGIN || 'https://seudominio.com' 
        : '*',
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== CONFIGURAÇÃO DE CONEXÃO MULTI-AMBIENTE ==========
const connectDB = async () => {
    try {
        console.log('\n=================================');
        console.log('🔌 INICIANDO CONEXÃO COM MONGODB');
        console.log('=================================');
        
        // Mostrar configuração atual
        const isProduction = process.env.NODE_ENV === 'production';
        console.log(`📋 NODE_ENV: ${process.env.NODE_ENV || 'não definido'}`);
        
        let mongoURI = process.env.MONGODB_URI;
        
        // Se estiver no Docker, constrói a URI a partir das variáveis individuais
        if (!mongoURI && process.env.MONGO_ROOT_USER) {
            mongoURI = `mongodb://${process.env.MONGO_ROOT_USER}:${process.env.MONGO_ROOT_PASSWORD}@mongodb:27017/${process.env.MONGO_DATABASE}?authSource=admin`;
            console.log('📦 Modo: MongoDB no Docker');
        }
        // Se tiver URI do Atlas
        else if (mongoURI && mongoURI.includes('mongodb+srv')) {
            console.log('🌍 Modo: MongoDB Atlas (nuvem)');
        }
        // Fallback para local - APENAS EM DESENVOLVIMENTO
        else if (!mongoURI && !isProduction) {
            mongoURI = 'mongodb://localhost:27017/ecoroute-dev';
            console.log('💻 Modo: MongoDB Local (desenvolvimento)');
        }
        else if (!mongoURI && isProduction) {
            throw new Error('MONGODB_URI não definida nas variáveis de ambiente em produção');
        }

        // Mostrar URI (escondendo senha)
        const safeURI = mongoURI.replace(/:([^@]+)@/, ':****@');
        console.log(`📍 Conectando a: ${safeURI}`);
        
        // Opções de conexão otimizadas
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
            }),
            keepAlive: true,
            keepAliveInitialDelay: 300000,
        };

        console.log(`⚙️ Opções: Pool=${mongooseOptions.maxPoolSize}, Timeout=${mongooseOptions.serverSelectionTimeoutMS}ms`);
        
        await mongoose.connect(mongoURI, mongooseOptions);
        
        console.log('✅ MongoDB Conectado com sucesso!');
        console.log(`📊 Database: ${mongoose.connection.name}`);
        console.log(`🌐 Host: ${mongoose.connection.host}`);
        console.log(`🔗 Pool: ${mongooseOptions.maxPoolSize} conexões`);
        console.log('=================================\n');
        
        // Eventos de conexão
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

// Executar conexão
connectDB();

// ========== SCHEMAS ==========
const userSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: [true, 'Email é obrigatório'], 
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
    },
    password: { 
        type: String, 
        required: [true, 'Senha é obrigatória'],
        minlength: [6, 'Senha deve ter no mínimo 6 caracteres'],
        select: false
    },
    name: { 
        type: String, 
        required: [true, 'Nome é obrigatório'],
        trim: true,
        maxlength: [100, 'Nome muito longo']
    },
    role: { 
        type: String, 
        default: 'COOPERATIVE',
        enum: ['COOPERATIVE', 'ADMIN', 'DRIVER']
    },
    phone: { 
        type: String,
        trim: true
    },
    city: String,
    state: {
        type: String,
        uppercase: true,
        maxlength: 2
    },
    active: {
        type: Boolean,
        default: true
    },
    lastLogin: Date,
    emailVerified: { 
        type: Boolean, 
        default: false 
    },
    verificationCode: String,
    verificationCodeExpires: Date
}, { 
    timestamps: true,
    toJSON: {
        transform: (doc, ret) => {
            delete ret.password;
            delete ret.__v;
            delete ret.verificationCode;
            delete ret.verificationCodeExpires;
            return ret;
        }
    }
});

userSchema.index({ email: 1 });
userSchema.index({ city: 1, state: 1 });

const collectionPointSchema = new mongoose.Schema({
    name: { type: String, required: [true, 'Nome é obrigatório'] },
    address: { type: String, required: [true, 'Endereço é obrigatório'] },
    neighborhood: String,
    city: { type: String, required: [true, 'Cidade é obrigatória'] },
    state: { type: String, required: [true, 'Estado é obrigatório'], uppercase: true },
    latitude: {
        type: Number,
        min: -90,
        max: 90
    },
    longitude: {
        type: Number,
        min: -180,
        max: 180
    },
    wasteTypes: [{
        type: String,
        enum: ['Plástico', 'Papel', 'Vidro', 'Metal', 'Orgânico', 'Eletrônico']
    }],
    capacity: { 
        type: Number, 
        required: [true, 'Capacidade é obrigatória'],
        min: [0, 'Capacidade deve ser positiva']
    },
    currentVolume: { 
        type: Number, 
        default: 0,
        min: 0,
        validate: {
            validator: function(v) {
                return v <= this.capacity;
            },
            message: 'Volume atual não pode exceder a capacidade'
        }
    },
    status: { 
        type: String, 
        default: 'ACTIVE',
        enum: ['ACTIVE', 'INACTIVE', 'FULL']
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true }
});

collectionPointSchema.virtual('occupancyPercentage').get(function() {
    if (this.capacity === 0) return 0;
    return Math.round((this.currentVolume / this.capacity) * 100);
});

collectionPointSchema.index({ location: '2dsphere' });
collectionPointSchema.index({ userId: 1, status: 1 });
collectionPointSchema.index({ city: 1, state: 1 });

const routeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    date: { type: Date, default: Date.now, index: true },
    status: { 
        type: String, 
        default: 'PLANNED',
        enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
    },
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
    completedAt: Date
}, { timestamps: true });

routeSchema.index({ userId: 1, date: -1 });
routeSchema.index({ status: 1 });

const collectionSchema = new mongoose.Schema({
    collectionPointId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'CollectionPoint', 
        required: true 
    },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
    date: { type: Date, default: Date.now, index: true },
    wasteVolume: { 
        type: Number, 
        required: true,
        min: [0, 'Volume deve ser positivo']
    },
    wasteType: String,
    notes: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

collectionSchema.index({ collectionPointId: 1, date: -1 });

// Criar modelos
const User = mongoose.model('User', userSchema);
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
        
        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }

        if (!user.active) {
            return res.status(401).json({ error: 'Usuário inativo' });
        }

        req.user = user;
        req.userId = user._id;
        req.userRole = user.role;
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token inválido' });
        }
        
        console.error('❌ Erro na autenticação:', error);
        return res.status(500).json({ error: 'Erro na autenticação' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.userRole) {
            return res.status(401).json({ error: 'Não autorizado' });
        }
        
        if (!roles.includes(req.userRole)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        
        next();
    };
};

// ========== FUNÇÕES AUXILIARES ==========
const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
};

// ========== ROTAS DE AUTENTICAÇÃO ==========
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, phone, city, state } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ 
                error: 'Email, senha e nome são obrigatórios' 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'Senha deve ter no mínimo 6 caracteres' 
            });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Gerar código de verificação
        const verificationCode = generateVerificationCode();

        const user = new User({
            email: email.toLowerCase(),
            password: hashedPassword,
            name: name.trim(),
            phone,
            city,
            state: state?.toUpperCase(),
            role: 'COOPERATIVE',
            verificationCode,
            verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutos
        });

        await user.save();

        // ENVIAR EMAIL DE BOAS-VINDAS
        emailService.sendWelcomeEmail(user.email, user.name)
            .then(result => {
                if (result.success) {
                    console.log(`✅ Email de boas-vindas enviado para ${user.email}`);
                } else {
                    console.error(`❌ Falha ao enviar email para ${user.email}:`, result.error);
                }
            })
            .catch(err => console.error('❌ Erro no serviço de email:', err));

        // CRIAR NOTIFICAÇÃO DE BOAS-VINDAS
        await Notification.createWelcomeNotification(user._id);

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        user.lastLogin = new Date();
        await user.save();

        res.status(201).json({ 
            user,
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

        user.password = undefined;

        res.json({ 
            user, 
            token,
            message: 'Login realizado com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ROTA DE VERIFICAÇÃO DE EMAIL
app.post('/api/auth/verify-email', async (req, res) => {
    try {
        const { email, code } = req.body;
        
        const user = await User.findOne({
            email: email.toLowerCase(),
            verificationCode: code,
            verificationCodeExpires: { $gt: new Date() }
        });
        
        if (!user) {
            return res.status(400).json({ 
                error: 'Código inválido ou expirado' 
            });
        }
        
        user.emailVerified = true;
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        await user.save();
        
        res.json({ 
            message: 'Email verificado com sucesso! Agora você pode fazer login.' 
        });
    } catch (error) {
        console.error('❌ Erro na verificação:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// REENVIAR CÓDIGO DE VERIFICAÇÃO
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
        
        // Enviar novo código por email
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

        res.json({ 
            user, 
            message: 'Perfil atualizado com sucesso' 
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar perfil:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ========== ROTAS DE PONTOS DE COLETA ==========
app.post('/api/points', authenticateToken, async (req, res) => {
    try {
        const pointData = {
            ...req.body,
            userId: req.userId
        };

        if (!pointData.name || !pointData.address || !pointData.city || !pointData.state || !pointData.capacity) {
            return res.status(400).json({ 
                error: 'Campos obrigatórios: name, address, city, state, capacity' 
            });
        }

        if (pointData.capacity) pointData.capacity = Number(pointData.capacity);
        if (pointData.latitude) pointData.latitude = Number(pointData.latitude);
        if (pointData.longitude) pointData.longitude = Number(pointData.longitude);
        if (pointData.currentVolume) pointData.currentVolume = Number(pointData.currentVolume);

        const point = new CollectionPoint(pointData);
        await point.save();

        res.status(201).json({ 
            point, 
            message: 'Ponto de coleta criado com sucesso' 
        });
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
        
        // Notificar destinatário se for mensagem privada
        if (recipient) {
            await Notification.createMessageNotification(
                recipient,
                req.user.name,
                content
            );
        }
        
        res.status(201).json({ 
            message: 'Mensagem enviada com sucesso',
            data: message
        });
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
        
        if (!message) {
            return res.status(404).json({ error: 'Mensagem não encontrada' });
        }
        
        await message.markAsRead();
        
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
        
        if (read !== undefined) {
            query.read = read === 'true';
        }
        
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));
        
        const unreadCount = await Notification.countDocuments({
            user: req.userId,
            read: false
        });
        
        res.json({
            notifications,
            unreadCount,
            total: notifications.length
        });
    } catch (error) {
        console.error('❌ Erro ao buscar notificações:', error);
        res.status(500).json({ error: 'Erro ao buscar notificações' });
    }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            user: req.userId
        });
        
        if (!notification) {
            return res.status(404).json({ error: 'Notificação não encontrada' });
        }
        
        await notification.markAsRead();
        
        res.json({ message: 'Notificação marcada como lida' });
    } catch (error) {
        console.error('❌ Erro ao marcar notificação:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.patch('/api/notifications/read-all', authenticateToken, async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.userId, read: false },
            { read: true, readAt: new Date() }
        );
        
        res.json({ message: 'Todas as notificações foram marcadas como lidas' });
    } catch (error) {
        console.error('❌ Erro ao marcar todas notificações:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            user: req.userId
        });
        
        if (!notification) {
            return res.status(404).json({ error: 'Notificação não encontrada' });
        }
        
        res.json({ message: 'Notificação removida com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao remover notificação:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ========== ROTAS DE ROTAS ==========
app.post('/api/routes', authenticateToken, async (req, res) => {
    try {
        const routeData = {
            ...req.body,
            userId: req.userId
        };

        const route = new Route(routeData);
        await route.save();
        
        // Criar notificação
        await Notification.createRouteNotification(req.userId, route.name);

        res.status(201).json({ 
            route, 
            message: 'Rota criada com sucesso' 
        });
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
        
        const routes = await Route.find(filter)
            .populate('points.pointId')
            .sort({ date: -1 });
            
        res.json(routes);
    } catch (error) {
        console.error('❌ Erro ao listar rotas:', error);
        res.status(500).json({ error: 'Erro ao listar rotas' });
    }
});

// ========== ROTAS DE COLETAS ==========
app.post('/api/collections', authenticateToken, async (req, res) => {
    try {
        const collectionData = {
            ...req.body,
            userId: req.userId
        };

        const point = await CollectionPoint.findOne({
            _id: collectionData.collectionPointId,
            userId: req.userId
        });
        
        if (!point) {
            return res.status(404).json({ error: 'Ponto de coleta não encontrado' });
        }

        const collection = new Collection(collectionData);
        await collection.save();

        point.currentVolume += collectionData.wasteVolume;
        await point.save();
        
        // Criar notificação
        await Notification.createCollectionNotification(
            req.userId,
            point.name,
            collectionData.wasteVolume
        );

        if (collectionData.routeId) {
            await Route.updateOne(
                { _id: collectionData.routeId, 'points.pointId': collectionData.collectionPointId },
                { 
                    $set: { 
                        'points.$.actualVolume': collectionData.wasteVolume,
                        'points.$.collectedAt': new Date()
                    }
                }
            );
        }

        res.status(201).json({ 
            collection, 
            message: 'Coleta registrada com sucesso' 
        });
    } catch (error) {
        console.error('❌ Erro ao registrar coleta:', error);
        res.status(500).json({ error: 'Erro ao registrar coleta' });
    }
});

// ========== ROTAS DE DASHBOARD ==========
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const [points, routes, collections, impact, unreadNotifications] = await Promise.all([
            CollectionPoint.countDocuments({ userId: req.userId }),
            Route.countDocuments({ userId: req.userId, status: 'COMPLETED' }),
            Collection.find()
                .populate({
                    path: 'collectionPointId',
                    match: { userId: req.userId }
                }),
            Collection.aggregate([
                {
                    $lookup: {
                        from: 'collectionpoints',
                        localField: 'collectionPointId',
                        foreignField: '_id',
                        as: 'point'
                    }
                },
                { $unwind: '$point' },
                { $match: { 'point.userId': req.user._id } },
                {
                    $group: {
                        _id: null,
                        totalWaste: { $sum: '$wasteVolume' },
                        avgCollection: { $avg: '$wasteVolume' },
                        totalCollections: { $sum: 1 }
                    }
                }
            ]),
            Notification.countDocuments({ user: req.userId, read: false })
        ]);

        const totalWaste = impact[0]?.totalWaste || 0;
        const avgCollection = impact[0]?.avgCollection || 0;
        const totalCollections = impact[0]?.totalCollections || 0;

        const treesSaved = Math.floor(totalWaste * 0.02);
        const waterSaved = totalWaste * 5;
        const energySaved = totalWaste * 0.35;
        const carbonSaved = totalWaste * 0.13;

        res.json({
            points,
            routes,
            totalWaste,
            avgCollection,
            totalCollections,
            unreadNotifications,
            impact: {
                treesSaved,
                waterSaved: Math.floor(waterSaved),
                energySaved: Math.floor(energySaved),
                carbonSaved: Math.floor(carbonSaved)
            }
        });
    } catch (error) {
        console.error('❌ Erro ao carregar stats:', error);
        res.status(500).json({ error: 'Erro ao carregar estatísticas' });
    }
});

// ========== ROTAS DE IMPACTO AMBIENTAL ==========
app.get('/api/impact', authenticateToken, async (req, res) => {
    try {
        const result = await Collection.aggregate([
            {
                $lookup: {
                    from: 'collectionpoints',
                    localField: 'collectionPointId',
                    foreignField: '_id',
                    as: 'point'
                }
            },
            { $unwind: '$point' },
            { $match: { 'point.userId': req.user._id } },
            {
                $group: {
                    _id: null,
                    totalWaste: { $sum: '$wasteVolume' }
                }
            }
        ]);

        const totalWaste = result[0]?.totalWaste || 0;
        
        const treesSaved = Math.floor(totalWaste * 0.02);
        const waterSaved = totalWaste * 5;
        const energySaved = totalWaste * 0.35;
        const carbonSaved = totalWaste * 0.13;

        const history = await Collection.aggregate([
            {
                $lookup: {
                    from: 'collectionpoints',
                    localField: 'collectionPointId',
                    foreignField: '_id',
                    as: 'point'
                }
            },
            { $unwind: '$point' },
            { $match: { 'point.userId': req.user._id } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
                    waste: { $sum: '$wasteVolume' },
                    carbon: { $sum: { $multiply: ['$wasteVolume', 0.13] } }
                }
            },
            { $sort: { _id: 1 } },
            { $limit: 12 }
        ]);

        res.json({
            current: {
                treesSaved,
                waterSaved: Math.floor(waterSaved),
                energySaved: Math.floor(energySaved),
                carbonSaved: Math.floor(carbonSaved),
                totalWaste
            },
            history
        });
    } catch (error) {
        console.error('❌ Erro ao calcular impacto:', error);
        res.status(500).json({ error: 'Erro ao calcular impacto ambiental' });
    }
});

// ========== ROTAS PÚBLICAS ==========
app.get('/', (req, res) => {
    res.json({
        nome: 'EcoRoute API - Logística Reversa',
        versao: '1.0.0',
        status: 'online',
        ambiente: process.env.NODE_ENV || 'desenvolvimento',
        database: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado',
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
                buscar: 'GET /api/points/:id (auth)',
                atualizar: 'PUT /api/points/:id (auth)',
                deletar: 'DELETE /api/points/:id (auth)'
            },
            rotas: {
                listar: 'GET /api/routes (auth)',
                criar: 'POST /api/routes (auth)',
                iniciar: 'PATCH /api/routes/:id/start (auth)',
                completar: 'PATCH /api/routes/:id/complete (auth)'
            },
            coletas: {
                listar: 'GET /api/collections (auth)',
                registrar: 'POST /api/collections (auth)'
            },
            mensagens: {
                enviar: 'POST /api/messages (auth)',
                listar: 'GET /api/messages/:room (auth)',
                marcarLida: 'PATCH /api/messages/:id/read (auth)'
            },
            notificacoes: {
                listar: 'GET /api/notifications (auth)',
                marcarLida: 'PATCH /api/notifications/:id/read (auth)',
                marcarTodas: 'PATCH /api/notifications/read-all (auth)',
                deletar: 'DELETE /api/notifications/:id (auth)'
            },
            dashboard: {
                stats: 'GET /api/dashboard/stats (auth)',
                charts: 'GET /api/dashboard/charts (auth)'
            },
            impacto: 'GET /api/impact (auth)'
        },
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        ambiente: process.env.NODE_ENV || 'desenvolvimento',
        database: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado',
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
                    body: {
                        name: 'string (obrigatório)',
                        email: 'string (obrigatório)',
                        password: 'string (obrigatório, min 6 caracteres)',
                        phone: 'string (opcional)',
                        city: 'string (opcional)',
                        state: 'string (opcional)'
                    }
                },
                'POST /api/auth/login': {
                    descricao: 'Fazer login',
                    body: {
                        email: 'string (obrigatório)',
                        password: 'string (obrigatório)'
                    }
                },
                'POST /api/auth/verify-email': {
                    descricao: 'Verificar email com código',
                    body: {
                        email: 'string (obrigatório)',
                        code: 'string (obrigatório, 6 dígitos)'
                    }
                }
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
            }
        },
        exemplos: {
            registrar: {
                url: '/api/auth/register',
                metodo: 'POST',
                body: {
                    name: 'Cooperativa Recicla',
                    email: 'contato@recicla.com',
                    password: '123456',
                    city: 'São Paulo',
                    state: 'SP'
                }
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
    const message = isProduction 
        ? 'Ocorreu um erro interno no servidor' 
        : err.message;
    
    res.status(statusCode).json({ 
        error: message,
        ...(isProduction ? {} : { stack: err.stack })
    });
});

// ========== INICIAR SERVIDOR ==========
const server = app.listen(PORT, () => {
    console.log('\n=================================');
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📝 Ambiente: ${process.env.NODE_ENV || 'desenvolvimento'}`);
    console.log(`🍃 Banco: ${mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado'}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📚 Documentação: http://localhost:${PORT}/api/docs`);
    console.log('=================================\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM recebido, encerrando servidor...');
    server.close(() => {
        console.log('💤 Servidor encerrado');
        mongoose.connection.close(false, () => {
            console.log('💤 Conexão MongoDB encerrada');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('👋 SIGINT recebido, encerrando servidor...');
    server.close(() => {
        console.log('💤 Servidor encerrado');
        mongoose.connection.close(false, () => {
            console.log('💤 Conexão MongoDB encerrada');
            process.exit(0);
        });
    });
});

module.exports = app;