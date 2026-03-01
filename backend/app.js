const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

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
        // Fallback para local
        else if (!mongoURI) {
            mongoURI = 'mongodb://localhost:27017/ecoroute-dev';
            console.log('💻 Modo: MongoDB Local (desenvolvimento)');
        }

        // Mostrar URI (escondendo senha)
        const safeURI = mongoURI.replace(/:([^@]+)@/, ':****@');
        console.log(`📍 Conectando a: ${safeURI}`);
        
        // Opções de conexão otimizadas
        const mongooseOptions = {
            // Pool de conexões
            maxPoolSize: isProduction ? 50 : 10,
            minPoolSize: isProduction ? 10 : 2,
            
            // Timeouts
            connectTimeoutMS: isProduction ? 10000 : 5000,
            socketTimeoutMS: isProduction ? 45000 : 30000,
            serverSelectionTimeoutMS: isProduction ? 10000 : 5000,
            
            // Retry
            retryWrites: true,
            retryReads: true,
            
            // Write concern para produção
            ...(isProduction && {
                w: 'majority',
                wtimeoutMS: 5000,
            }),
            
            // TLS apenas para Atlas
            ...(mongoURI.includes('mongodb+srv') && {
                tls: true,
                tlsAllowInvalidCertificates: !isProduction,
            }),
        };

        // CONEXÃO COM OPÇÕES OTIMIZADAS
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
        
        // Diagnóstico detalhado
        console.log('🔍 DIAGNÓSTICO:');
        
        if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
            console.log('   ⚠️  Erro de autenticação:');
            console.log('      • Verifique usuário e senha no .env');
            console.log('      • No Atlas, confirme se o usuário tem permissão');
            console.log('      • Para MongoDB local, desabilite autenticação');
        }
        else if (error.message.includes('getaddrinfo ENOTFOUND')) {
            console.log('   ⚠️  Host não encontrado:');
            console.log('      • Verifique se o nome do host está correto');
            console.log('      • Se for Atlas, verifique sua string de conexão');
        }
        else if (error.message.includes('timed out')) {
            console.log('   ⚠️  Timeout de conexão:');
            console.log('      • Verifique se o MongoDB está rodando');
            console.log('      • No Atlas, adicione seu IP à whitelist');
        }
        
        // Em produção, não continuamos sem banco
        if (isProduction) {
            console.error('\n❌ PRODUÇÃO: Encerrando aplicação sem banco de dados');
            process.exit(1);
        } else {
            console.log('\n⚠️  Desenvolvimento: Continuando sem banco de dados...');
        }
        console.log('=================================\n');
    }
};

// Executar conexão
connectDB();

// ========== SCHEMAS ==========
// Schema do Usuário
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
        select: false // Não retornar por padrão
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
    lastLogin: Date
}, { 
    timestamps: true,
    toJSON: {
        transform: (doc, ret) => {
            delete ret.password;
            delete ret.__v;
            return ret;
        }
    }
});

// Índices
userSchema.index({ email: 1 });
userSchema.index({ city: 1, state: 1 });

// Schema do Ponto de Coleta
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual para porcentagem de ocupação
collectionPointSchema.virtual('occupancyPercentage').get(function() {
    if (this.capacity === 0) return 0;
    return Math.round((this.currentVolume / this.capacity) * 100);
});

// Índices
collectionPointSchema.index({ location: '2dsphere' });
collectionPointSchema.index({ userId: 1, status: 1 });
collectionPointSchema.index({ city: 1, state: 1 });

// Schema da Rota
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

// Índices
routeSchema.index({ userId: 1, date: -1 });
routeSchema.index({ status: 1 });

// Schema da Coleta
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

// Índices
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
        
        // Buscar usuário para garantir que ainda existe e está ativo
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

// Middleware de autorização por role
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

// ========== ROTAS DE AUTENTICAÇÃO ==========
// ROTA DE REGISTRO - POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, phone, city, state } = req.body;

        // Validações
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

        // Verificar se usuário já existe
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        // Hash da senha
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Criar usuário
        const user = new User({
            email: email.toLowerCase(),
            password: hashedPassword,
            name: name.trim(),
            phone,
            city,
            state: state?.toUpperCase(),
            role: 'COOPERATIVE'
        });

        await user.save();

        // Gerar token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Atualizar último login
        user.lastLogin = new Date();
        await user.save();

        res.status(201).json({ 
            user,
            token,
            message: 'Usuário criado com sucesso'
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

// ROTA DE LOGIN - POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        // Buscar usuário com a senha
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        
        if (!user) {
            return res.status(401).json({ error: 'Email ou senha inválidos' });
        }

        if (!user.active) {
            return res.status(401).json({ error: 'Usuário inativo' });
        }

        // Verificar senha
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Email ou senha inválidos' });
        }

        // Gerar token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Atualizar último login
        user.lastLogin = new Date();
        await user.save();

        // Remover senha da resposta
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

// ROTA DE PERFIL - GET /api/auth/profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        res.json(req.user);
    } catch (error) {
        console.error('❌ Erro no perfil:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ROTA PARA ATUALIZAR PERFIL - PUT /api/auth/profile
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
// Criar ponto de coleta
app.post('/api/points', authenticateToken, async (req, res) => {
    try {
        const pointData = {
            ...req.body,
            userId: req.userId
        };

        // Validações
        if (!pointData.name || !pointData.address || !pointData.city || !pointData.state || !pointData.capacity) {
            return res.status(400).json({ 
                error: 'Campos obrigatórios: name, address, city, state, capacity' 
            });
        }

        // Converter tipos
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

// Listar pontos de coleta do usuário
app.get('/api/points', authenticateToken, async (req, res) => {
    try {
        const { status, city, wasteType } = req.query;
        
        // Construir filtro
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

// Buscar ponto por ID
app.get('/api/points/:id', authenticateToken, async (req, res) => {
    try {
        const point = await CollectionPoint.findOne({ 
            _id: req.params.id, 
            userId: req.userId 
        });
        
        if (!point) {
            return res.status(404).json({ error: 'Ponto não encontrado' });
        }
        
        res.json(point);
    } catch (error) {
        console.error('❌ Erro ao buscar ponto:', error);
        
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ error: 'ID inválido' });
        }
        
        res.status(500).json({ error: 'Erro ao buscar ponto de coleta' });
    }
});

// Atualizar ponto
app.put('/api/points/:id', authenticateToken, async (req, res) => {
    try {
        const point = await CollectionPoint.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!point) {
            return res.status(404).json({ error: 'Ponto não encontrado' });
        }
        
        res.json({ point, message: 'Ponto atualizado com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao atualizar ponto:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Erro ao atualizar ponto de coleta' });
    }
});

// Deletar ponto
app.delete('/api/points/:id', authenticateToken, async (req, res) => {
    try {
        // Verificar se há coletas associadas
        const hasCollections = await Collection.exists({ collectionPointId: req.params.id });
        
        if (hasCollections) {
            return res.status(400).json({ 
                error: 'Não é possível deletar ponto com coletas registradas' 
            });
        }

        const point = await CollectionPoint.findOneAndDelete({ 
            _id: req.params.id, 
            userId: req.userId 
        });
        
        if (!point) {
            return res.status(404).json({ error: 'Ponto não encontrado' });
        }
        
        res.json({ message: 'Ponto deletado com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao deletar ponto:', error);
        res.status(500).json({ error: 'Erro ao deletar ponto de coleta' });
    }
});

// ========== ROTAS DE ROTAS ==========
// Criar rota
app.post('/api/routes', authenticateToken, async (req, res) => {
    try {
        const routeData = {
            ...req.body,
            userId: req.userId
        };

        const route = new Route(routeData);
        await route.save();

        res.status(201).json({ 
            route, 
            message: 'Rota criada com sucesso' 
        });
    } catch (error) {
        console.error('❌ Erro ao criar rota:', error);
        res.status(500).json({ error: 'Erro ao criar rota' });
    }
});

// Listar rotas do usuário
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

// Iniciar rota
app.patch('/api/routes/:id/start', authenticateToken, async (req, res) => {
    try {
        const route = await Route.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId, status: 'PLANNED' },
            { status: 'IN_PROGRESS' },
            { new: true }
        );
        
        if (!route) {
            return res.status(404).json({ error: 'Rota não encontrada ou já iniciada' });
        }
        
        res.json({ route, message: 'Rota iniciada com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao iniciar rota:', error);
        res.status(500).json({ error: 'Erro ao iniciar rota' });
    }
});

// Completar rota
app.patch('/api/routes/:id/complete', authenticateToken, async (req, res) => {
    try {
        const route = await Route.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId, status: 'IN_PROGRESS' },
            { 
                status: 'COMPLETED',
                completedAt: new Date()
            },
            { new: true }
        );
        
        if (!route) {
            return res.status(404).json({ error: 'Rota não encontrada ou não iniciada' });
        }
        
        res.json({ route, message: 'Rota completada com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao completar rota:', error);
        res.status(500).json({ error: 'Erro ao completar rota' });
    }
});

// ========== ROTAS DE COLETAS ==========
// Registrar coleta
app.post('/api/collections', authenticateToken, async (req, res) => {
    try {
        const collectionData = {
            ...req.body,
            userId: req.userId
        };

        // Verificar se ponto de coleta existe e pertence ao usuário
        const point = await CollectionPoint.findOne({
            _id: collectionData.collectionPointId,
            userId: req.userId
        });
        
        if (!point) {
            return res.status(404).json({ error: 'Ponto de coleta não encontrado' });
        }

        const collection = new Collection(collectionData);
        await collection.save();

        // Atualizar volume atual do ponto de coleta
        point.currentVolume += collectionData.wasteVolume;
        await point.save();

        // Atualizar rota se fornecida
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

// Listar coletas
app.get('/api/collections', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate, pointId } = req.query;
        
        const filter = {};
        
        if (pointId) {
            filter.collectionPointId = pointId;
        }
        
        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate);
            if (endDate) filter.date.$lte = new Date(endDate);
        }

        const collections = await Collection.find(filter)
            .populate('collectionPointId')
            .populate('routeId')
            .sort({ date: -1 });
            
        // Filtrar apenas pontos do usuário
        const filteredCollections = collections.filter(c => 
            c.collectionPointId?.userId?.toString() === req.userId.toString()
        );
            
        res.json(filteredCollections);
    } catch (error) {
        console.error('❌ Erro ao listar coletas:', error);
        res.status(500).json({ error: 'Erro ao listar coletas' });
    }
});

// ========== ROTAS DE DASHBOARD ==========
// Estatísticas do dashboard
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const [points, routes, collections, impact] = await Promise.all([
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
            ])
        ]);

        const totalWaste = impact[0]?.totalWaste || 0;
        const avgCollection = impact[0]?.avgCollection || 0;
        const totalCollections = impact[0]?.totalCollections || 0;

        // Cálculos de impacto
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

// Dados para gráficos
app.get('/api/dashboard/charts', authenticateToken, async (req, res) => {
    try {
        const { period = 'month' } = req.query;

        // Agregação por tipo de resíduo
        const wasteByType = await Collection.aggregate([
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
                    _id: '$wasteType',
                    volume: { $sum: '$wasteVolume' }
                }
            },
            { $sort: { volume: -1 } }
        ]);

        // Agregação por período
        const groupBy = period === 'month' 
            ? { $month: '$date' }
            : period === 'week'
            ? { $week: '$date' }
            : { $dayOfMonth: '$date' };

        const impactData = await Collection.aggregate([
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
                    _id: groupBy,
                    carbon: { $sum: { $multiply: ['$wasteVolume', 0.13] } },
                    waste: { $sum: '$wasteVolume' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Mapear meses
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        const formattedImpactData = impactData.map(item => ({
            month: period === 'month' ? monthNames[item._id - 1] : `Período ${item._id}`,
            carbon: Math.round(item.carbon),
            waste: item.waste
        }));

        res.json({ 
            wasteByType: wasteByType.map(w => ({
                type: w._id || 'Não categorizado',
                volume: w.volume
            })),
            impactData: formattedImpactData 
        });
    } catch (error) {
        console.error('❌ Erro ao carregar gráficos:', error);
        res.status(500).json({ error: 'Erro ao carregar dados dos gráficos' });
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
        
        // Cálculos de impacto
        const treesSaved = Math.floor(totalWaste * 0.02);
        const waterSaved = totalWaste * 5;
        const energySaved = totalWaste * 0.35;
        const carbonSaved = totalWaste * 0.13;

        // Adicionar histórico
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
// Rota raiz
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
                perfil: 'GET /api/auth/profile (auth)'
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
            dashboard: {
                stats: 'GET /api/dashboard/stats (auth)',
                charts: 'GET /api/dashboard/charts (auth)'
            },
            impacto: 'GET /api/impact (auth)'
        },
        timestamp: new Date().toISOString()
    });
});

// Rota de saúde
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

// Rota de documentação simples
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
                }
            },
            pontos: {
                'GET /api/points': 'Listar pontos de coleta (filtros: status, city, wasteType)',
                'POST /api/points': 'Criar ponto de coleta',
                'GET /api/points/:id': 'Buscar ponto por ID',
                'PUT /api/points/:id': 'Atualizar ponto',
                'DELETE /api/points/:id': 'Deletar ponto'
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
// 404
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Rota não encontrada',
        path: req.originalUrl,
        method: req.method,
        dica: 'Consulte /api/docs para ver as rotas disponíveis'
    });
});

// Middleware de erro global
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