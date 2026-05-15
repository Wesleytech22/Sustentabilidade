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

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// ========== MIDDLEWARES ==========
app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));
app.use(compression());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Muitas requisições deste IP, tente novamente após 15 minutos' }
});

if (isProduction) app.use('/api', limiter);

const allowedOrigins = [
    'https://frontend-sustentabilidade.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || origin.match(/https:\/\/.*\.vercel\.app$/)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== SERVIDOR HTTP E SOCKET ==========
const server = http.createServer(app);
const io = socketService.initSocket(server);
app.set('io', io);

// ========== CONEXÃO MONGODB ==========
const connectDB = async () => {
    try {
        console.log('\n=================================');
        console.log('🔌 INICIANDO CONEXÃO COM MONGODB');
        console.log('=================================');

        let mongoURI = process.env.MONGODB_URI;

        if (!mongoURI && !isProduction) {
            mongoURI = 'mongodb://localhost:27017/ecoroute-dev';
            console.log('💻 Modo: MongoDB Local (desenvolvimento)');
        } else if (mongoURI && mongoURI.includes('mongodb+srv')) {
            console.log('🌍 Modo: MongoDB Atlas (nuvem)');
        }

        await mongoose.connect(mongoURI, {
            maxPoolSize: isProduction ? 50 : 10,
            serverSelectionTimeoutMS: 10000
        });

        console.log('✅ MongoDB Conectado com sucesso!');
        console.log(`📊 Database: ${mongoose.connection.name}`);
        console.log('=================================\n');

    } catch (error) {
        console.error('❌ ERRO AO CONECTAR MONGODB:', error.message);
        if (!isProduction) {
            console.log('⚠️ Desenvolvimento: Continuando sem banco de dados...');
        }
    }
};

connectDB();

// ========== MODELOS ==========

// Modelo de CollectionPoint (Pontos de Coleta)
const collectionPointSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    neighborhood: String,
    city: String,
    state: String,
    zipCode: String,
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: false,
            index: '2dsphere'
        }
    },
    wasteTypes: [{
        type: String,
        enum: ['plastico', 'papel', 'vidro', 'metal', 'organico', 'eletronico']
    }],
    capacity: { type: Number, required: true },
    currentVolume: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE', 'FULL', 'MAINTENANCE'],
        default: 'ACTIVE'
    },
    schedule: {
        monday: { open: String, close: String },
        tuesday: { open: String, close: String },
        wednesday: { open: String, close: String },
        thursday: { open: String, close: String },
        friday: { open: String, close: String },
        saturday: { open: String, close: String },
        sunday: { open: String, close: String }
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

collectionPointSchema.index({ location: '2dsphere' });
const CollectionPoint = mongoose.model('CollectionPoint', collectionPointSchema);

// Modelo de Route (Rotas)
const routeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    date: { type: Date, default: Date.now },
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
    source: { type: String, enum: ['points', 'events', 'manual'], default: 'manual' },
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
const Route = mongoose.model('Route', routeSchema);

// Modelo de Collection (Coletas realizadas)
const collectionSchema = new mongoose.Schema({
    collectionPointId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionPoint', required: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
    date: { type: Date, default: Date.now },
    wasteVolume: { type: Number, required: true },
    wasteType: { type: String, enum: ['plastico', 'papel', 'vidro', 'metal', 'organico', 'eletronico', 'outros'] },
    notes: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
const Collection = mongoose.model('Collection', collectionSchema);

// ========== MIDDLEWARE DE AUTENTICAÇÃO ==========
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token não fornecido' });
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
        return res.status(500).json({ error: 'Erro na autenticação' });
    }
};

// ========== FUNÇÕES AUXILIARES ==========
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Agora mesmo';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Há ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    const days = Math.floor(hours / 24);
    return `Há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

// Função para calcular distância entre dois pontos (Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Função para otimizar rota usando Nearest Neighbor
async function calculateOptimizedRoute(points) {
    if (points.length === 0) return { orderedPoints: [], totalDistance: 0, totalWaste: 0 };

    const unvisited = [...points];
    const orderedPoints = [];
    let current = unvisited.shift();
    orderedPoints.push(current);
    let totalDistance = 0;

    while (unvisited.length > 0) {
        let nearestIndex = 0;
        let minDistance = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
            const dist = calculateDistance(
                current.location.coordinates[1], current.location.coordinates[0],
                unvisited[i].location.coordinates[1], unvisited[i].location.coordinates[0]
            );
            if (dist < minDistance) {
                minDistance = dist;
                nearestIndex = i;
            }
        }

        totalDistance += minDistance;
        current = unvisited[nearestIndex];
        orderedPoints.push(current);
        unvisited.splice(nearestIndex, 1);
    }

    const totalWaste = orderedPoints.reduce((sum, p) => sum + (p.currentVolume || 0), 0);

    return { orderedPoints, totalDistance, totalWaste };
}

// Função para calcular a próxima data de coleta (próxima segunda-feira 08:00)
function getNextCollectionDate() {
    const now = new Date();
    const nextMonday = new Date(now);
    const daysUntilMonday = (8 - now.getDay()) % 7;
    if (daysUntilMonday === 0) {
        nextMonday.setDate(now.getDate() + 7);
    } else {
        nextMonday.setDate(now.getDate() + daysUntilMonday);
    }
    nextMonday.setHours(8, 0, 0, 0);
    return nextMonday;
}

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

        emailService.sendWelcomeEmail(user.email, user.name).catch(err => console.error('Erro email:', err.message));

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({ success: true, user: userResponse, token, message: 'Usuário criado com sucesso!' });
    } catch (error) {
        console.error('❌ Erro no registro:', error);
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
        if (!user || !user.active) {
            return res.status(401).json({ error: 'Email ou senha inválidos' });
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

        res.json({ success: true, user: userResponse, token, message: 'Login realizado com sucesso' });
    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    res.json(req.user);
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
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
});

// ========== ROTAS DE PONTOS DE COLETA ==========
app.post('/api/points', authenticateToken, async (req, res) => {
    try {
        const { name, address, city, state, capacity, latitude, longitude, wasteTypes, currentVolume } = req.body;

        if (!name || !address || !capacity) {
            return res.status(400).json({ error: 'Campos obrigatórios: name, address, capacity' });
        }

        const pointData = {
            name,
            address,
            city: city || '',
            state: state ? state.toUpperCase() : '',
            capacity: Number(capacity),
            currentVolume: currentVolume || 0,
            wasteTypes: wasteTypes || [],
            userId: req.userId,
            status: 'ACTIVE'
        };

        if (latitude && longitude) {
            pointData.location = {
                type: 'Point',
                coordinates: [Number(longitude), Number(latitude)]
            };
        }

        const point = new CollectionPoint(pointData);
        await point.save();

        console.log(`✅ Ponto criado: ${point.name}`);

        // Buscar todos os pontos do usuário com coordenadas
        const allPoints = await CollectionPoint.find({
            userId: req.userId,
            location: { $exists: true, $ne: null }
        });

        let createdRoute = null;

        // Gerar rota automaticamente se tiver pelo menos 2 pontos
        if (allPoints.length >= 2) {
            const optimized = await calculateOptimizedRoute(allPoints);

            // Calcular data da próxima coleta (próxima segunda-feira 08:00)
            const nextCollectionDate = getNextCollectionDate();

            const route = new Route({
                name: `Rota dos Pontos de Coleta - ${new Date().toLocaleDateString('pt-BR')}`,
                description: `Rota otimizada com ${allPoints.length} pontos de coleta. Tempo estimado: ${allPoints.length} hora(s).`,
                date: nextCollectionDate,
                points: optimized.orderedPoints.map((p, idx) => ({
                    pointId: p._id,
                    order: idx + 1,
                    estimatedVolume: p.currentVolume || 500,
                    actualVolume: 0,
                    collectedAt: null
                })),
                totalDistance: optimized.totalDistance,
                totalWaste: optimized.totalWaste,
                fuelConsumption: optimized.totalDistance * 0.35,
                carbonFootprint: optimized.totalWaste * 0.13,
                status: 'PLANNED',
                source: 'points',
                userId: req.userId
            });

            await route.save();
            createdRoute = route;
            console.log(`✅ Rota automática criada com ${allPoints.length} pontos para ${nextCollectionDate.toLocaleDateString('pt-BR')} às 08:00`);
        }

        const responsePoint = point.toObject();
        if (point.location && point.location.coordinates) {
            responsePoint.latitude = point.location.coordinates[1];
            responsePoint.longitude = point.location.coordinates[0];
        }

        res.status(201).json({
            point: responsePoint,
            route: createdRoute ? { id: createdRoute._id, name: createdRoute.name, date: createdRoute.date } : null,
            message: createdRoute ? 'Ponto criado e rota gerada automaticamente!' : 'Ponto criado com sucesso!'
        });

    } catch (error) {
        console.error('❌ Erro ao criar ponto:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/points', authenticateToken, async (req, res) => {
    try {
        const points = await CollectionPoint.find({ userId: req.userId }).sort({ createdAt: -1 });

        const formattedPoints = points.map(point => {
            const obj = point.toObject();
            if (point.location && point.location.coordinates) {
                obj.latitude = point.location.coordinates[1];
                obj.longitude = point.location.coordinates[0];
            }
            return obj;
        });

        res.json(formattedPoints);
    } catch (error) {
        console.error('❌ Erro ao listar pontos:', error);
        res.status(500).json({ error: 'Erro ao listar pontos' });
    }
});

app.get('/api/points/:id', authenticateToken, async (req, res) => {
    try {
        const point = await CollectionPoint.findOne({ _id: req.params.id, userId: req.userId });
        if (!point) return res.status(404).json({ error: 'Ponto não encontrado' });

        const responsePoint = point.toObject();
        if (point.location && point.location.coordinates) {
            responsePoint.latitude = point.location.coordinates[1];
            responsePoint.longitude = point.location.coordinates[0];
        }

        res.json(responsePoint);
    } catch (error) {
        console.error('❌ Erro ao buscar ponto:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/points/:id', authenticateToken, async (req, res) => {
    try {
        const point = await CollectionPoint.findOne({ _id: req.params.id, userId: req.userId });
        if (!point) return res.status(404).json({ error: 'Ponto não encontrado' });

        const { name, address, city, state, capacity, latitude, longitude, wasteTypes, status } = req.body;

        if (name) point.name = name;
        if (address) point.address = address;
        if (city) point.city = city;
        if (state) point.state = state?.toUpperCase();
        if (capacity) point.capacity = Number(capacity);
        if (wasteTypes) point.wasteTypes = wasteTypes;
        if (status) point.status = status;

        if (latitude && longitude) {
            point.location = {
                type: 'Point',
                coordinates: [Number(longitude), Number(latitude)]
            };
        }

        await point.save();

        const responsePoint = point.toObject();
        if (point.location && point.location.coordinates) {
            responsePoint.latitude = point.location.coordinates[1];
            responsePoint.longitude = point.location.coordinates[0];
        }

        res.json({ point: responsePoint, message: 'Ponto atualizado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/points/:id', authenticateToken, async (req, res) => {
    try {
        const point = await CollectionPoint.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!point) return res.status(404).json({ error: 'Ponto não encontrado' });
        res.json({ message: 'Ponto deletado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar ponto' });
    }
});

// ========== ROTAS DE ROTAS ==========
app.post('/api/routes', authenticateToken, async (req, res) => {
    try {
        const routeData = { ...req.body, userId: req.userId };
        const route = new Route(routeData);
        await route.save();
        res.status(201).json(route);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/routes', authenticateToken, async (req, res) => {
    try {
        const routes = await Route.find({ userId: req.userId }).sort({ date: 1 });

        // Adicionar status calculado baseado na data
        const routesWithStatus = routes.map(route => {
            const routeObj = route.toObject();
            const now = new Date();
            const routeDate = new Date(route.date);
            const timeDiff = routeDate - now;
            const hoursDiff = timeDiff / (1000 * 60 * 60);

            let calculatedStatus = route.status;
            if (route.status !== 'COMPLETED' && route.status !== 'CANCELLED') {
                if (hoursDiff <= 0 && hoursDiff > -24) {
                    calculatedStatus = 'IN_PROGRESS';
                } else if (hoursDiff < -24) {
                    calculatedStatus = 'DELAYED';
                }
            }

            return { ...routeObj, calculatedStatus };
        });

        res.json(routesWithStatus);
    } catch (error) {
        console.error('❌ Erro ao listar rotas:', error);
        res.status(500).json({ error: 'Erro ao listar rotas' });
    }
});

app.put('/api/routes/:id', authenticateToken, async (req, res) => {
    try {
        const { name, status } = req.body;
        const route = await Route.findById(req.params.id);
        if (!route) return res.status(404).json({ error: 'Rota não encontrada' });
        if (route.userId.toString() !== req.userId) return res.status(403).json({ error: 'Acesso não autorizado' });

        if (name) route.name = name;
        if (status) {
            route.status = status;
            if (status === 'COMPLETED') {
                route.completedAt = new Date();
            }
        }

        await route.save();

        // Notificar via socket
        io.emit('route-updated', { routeId: route._id, status: route.status });

        res.json(route);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/routes/:id', authenticateToken, async (req, res) => {
    try {
        const route = await Route.findById(req.params.id);
        if (!route) return res.status(404).json({ error: 'Rota não encontrada' });
        if (route.userId.toString() !== req.userId) return res.status(403).json({ error: 'Acesso não autorizado' });
        await route.deleteOne();
        res.json({ message: 'Rota removida com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar rota' });
    }
});

// ========== ROTA PARA GERAR ROTA MANUALMENTE A PARTIR DOS PONTOS ==========
app.post('/api/routes/generate-from-points', authenticateToken, async (req, res) => {
    try {
        const allPoints = await CollectionPoint.find({
            userId: req.userId,
            location: { $exists: true, $ne: null }
        });

        if (allPoints.length < 2) {
            return res.status(400).json({ error: 'Adicione pelo menos 2 pontos de coleta com coordenadas' });
        }

        const optimized = await calculateOptimizedRoute(allPoints);
        const nextCollectionDate = getNextCollectionDate();

        const route = new Route({
            name: `Rota dos Pontos de Coleta - ${new Date().toLocaleDateString('pt-BR')}`,
            description: `Rota gerada com ${allPoints.length} pontos de coleta. Tempo estimado: ${allPoints.length} hora(s).`,
            date: nextCollectionDate,
            points: optimized.orderedPoints.map((p, idx) => ({
                pointId: p._id,
                order: idx + 1,
                estimatedVolume: p.currentVolume || 500,
                actualVolume: 0,
                collectedAt: null
            })),
            totalDistance: optimized.totalDistance,
            totalWaste: optimized.totalWaste,
            fuelConsumption: optimized.totalDistance * 0.35,
            carbonFootprint: optimized.totalWaste * 0.13,
            status: 'PLANNED',
            source: 'points',
            userId: req.userId
        });

        await route.save();
        res.status(201).json(route);

    } catch (error) {
        console.error('❌ Erro ao gerar rota:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ENDPOINT - GERAR ROTA A PARTIR DE EVENTOS FINALIZADOS ==========
app.post('/api/routes/generate-from-events', authenticateToken, async (req, res) => {
    try {
        console.log('🔍 Buscando eventos finalizados para o usuário:', req.userId);
        const Event = require('./src/models/Events');
        const finishedEvents = await Event.find({ userId: req.userId, status: 'finalizado' });

        if (finishedEvents.length === 0) {
            return res.status(404).json({ error: 'Nenhum evento finalizado encontrado' });
        }

        const totalWaste = finishedEvents.reduce((sum, e) => sum + (e.estimatedWaste || 0), 0);
        const nextCollectionDate = getNextCollectionDate();

        const newRoute = new Route({
            name: `Coleta Pós-Eventos - ${new Date().toLocaleDateString('pt-BR')}`,
            description: `Rota para ${finishedEvents.length} evento(s). Tempo estimado: ${finishedEvents.length} hora(s).`,
            date: nextCollectionDate,
            points: finishedEvents.map((event, index) => ({
                pointId: event._id,
                order: index + 1,
                estimatedVolume: event.estimatedWaste || 500,
                actualVolume: 0,
                collectedAt: null
            })),
            totalWaste: totalWaste,
            carbonFootprint: totalWaste * 0.13,
            status: 'PLANNED',
            source: 'events',
            userId: req.userId,
            eventsSummary: finishedEvents.map(event => ({
                eventId: event._id,
                eventName: event.name,
                eventDate: event.startDate,
                wasteCollected: event.estimatedWaste || 0
            }))
        });

        await newRoute.save();
        res.status(201).json(newRoute);
    } catch (error) {
        console.error('❌ Erro ao gerar rota:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS DE COLETAS ==========
app.post('/api/collections', authenticateToken, async (req, res) => {
    try {
        const { collectionPointId, wasteVolume, wasteType, notes, routeId } = req.body;

        const point = await CollectionPoint.findOne({ _id: collectionPointId, userId: req.userId });
        if (!point) return res.status(404).json({ error: 'Ponto de coleta não encontrado' });

        const collection = new Collection({
            collectionPointId,
            routeId: routeId || null,
            wasteVolume: Number(wasteVolume),
            wasteType: wasteType || 'outros',
            notes: notes || '',
            userId: req.userId,
            date: new Date()
        });

        await collection.save();

        // Atualizar volume do ponto
        point.currentVolume = (point.currentVolume || 0) + Number(wasteVolume);
        await point.save();

        // Se tiver rota associada, atualizar o volume coletado
        if (routeId) {
            const route = await Route.findById(routeId);
            if (route) {
                const pointInRoute = route.points.find(p => p.pointId.toString() === collectionPointId);
                if (pointInRoute) {
                    pointInRoute.actualVolume = (pointInRoute.actualVolume || 0) + Number(wasteVolume);
                    pointInRoute.collectedAt = new Date();
                    await route.save();
                }
            }
        }

        res.status(201).json({
            success: true,
            collection,
            message: 'Coleta registrada com sucesso!'
        });
    } catch (error) {
        console.error('❌ Erro ao registrar coleta:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/collections', authenticateToken, async (req, res) => {
    try {
        const collections = await Collection.find({ userId: req.userId })
            .populate('collectionPointId')
            .sort({ date: -1 });
        res.json(collections);
    } catch (error) {
        console.error('❌ Erro ao listar coletas:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS DE DASHBOARD ==========
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const pointsCount = await CollectionPoint.countDocuments({ userId: req.userId });

        const routesCount = await Route.countDocuments({
            userId: req.userId,
            status: { $in: ['PLANNED', 'IN_PROGRESS'] }
        });

        // Calcular total de resíduos coletados
        const collections = await Collection.aggregate([
            { $lookup: { from: 'collectionpoints', localField: 'collectionPointId', foreignField: '_id', as: 'point' } },
            { $unwind: { path: '$point', preserveNullAndEmptyArrays: true } },
            { $match: { 'point.userId': req.user._id } },
            { $group: { _id: null, totalWaste: { $sum: '$wasteVolume' } } }
        ]);

        const totalWaste = collections[0]?.totalWaste || 0;
        const totalCarbon = Math.floor(totalWaste * 0.13);

        res.json({
            pointsCount,
            routesCount,
            totalWaste,
            totalCarbon
        });
    } catch (error) {
        console.error('❌ Erro ao carregar stats:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/dashboard/waste-by-type', authenticateToken, async (req, res) => {
    try {
        const wasteByType = await Collection.aggregate([
            { $lookup: { from: 'collectionpoints', localField: 'collectionPointId', foreignField: '_id', as: 'point' } },
            { $unwind: { path: '$point', preserveNullAndEmptyArrays: true } },
            { $match: { 'point.userId': req.user._id } },
            {
                $group: {
                    _id: { $ifNull: ['$wasteType', 'outros'] },
                    total: { $sum: '$wasteVolume' }
                }
            }
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

        if (labels.length === 0) {
            res.json({
                labels: ['Plástico', 'Papel', 'Vidro', 'Metal', 'Orgânico'],
                data: [0, 0, 0, 0, 0]
            });
        } else {
            res.json({ labels, data });
        }
    } catch (error) {
        console.error('❌ Erro ao carregar resíduos por tipo:', error);
        res.json({ labels: ['Plástico', 'Papel', 'Vidro', 'Metal', 'Orgânico'], data: [0, 0, 0, 0, 0] });
    }
});

app.get('/api/dashboard/monthly-impact', authenticateToken, async (req, res) => {
    try {
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

        let labels = [];
        let data = [];

        if (monthlyImpact.length > 0) {
            labels = monthlyImpact.map(item => {
                const month = parseInt(item._id.split('-')[1]) - 1;
                return monthNames[month];
            });
            data = monthlyImpact.map(item => Math.round(item.carbon));
        } else {
            const currentDate = new Date();
            for (let i = 5; i >= 0; i--) {
                const monthIndex = (currentDate.getMonth() - i + 12) % 12;
                labels.push(monthNames[monthIndex]);
                data.push(0);
            }
        }

        res.json({ labels, data });
    } catch (error) {
        console.error('❌ Erro ao carregar impacto mensal:', error);
        res.json({ labels: [], data: [] });
    }
});

app.get('/api/dashboard/recent-activities', authenticateToken, async (req, res) => {
    try {
        const activities = [];

        // Coletas recentes
        const recentCollections = await Collection.find()
            .populate('collectionPointId')
            .sort({ createdAt: -1 })
            .limit(5);

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

        // Rotas recentes
        const recentRoutes = await Route.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .limit(5);

        for (const route of recentRoutes) {
            const statusText = {
                'PLANNED': 'planejada',
                'IN_PROGRESS': 'iniciada',
                'COMPLETED': 'concluída',
                'CANCELLED': 'cancelada'
            }[route.status] || 'criada';

            activities.push({
                id: route._id,
                type: 'route',
                icon: 'fa-route',
                title: `Rota "${route.name}" ${statusText}`,
                date: route.createdAt,
                timeAgo: getTimeAgo(route.createdAt)
            });
        }

        // Pontos recentes
        const recentPoints = await CollectionPoint.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .limit(5);

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

        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json({ activities: activities.slice(0, 10) });
    } catch (error) {
        console.error('❌ Erro ao carregar atividades recentes:', error);
        res.json({ activities: [] });
    }
});

// ========== ROTAS DE EVENTOS EXTERNOS (TICKETMASTER) ==========
app.get('/api/events/external/search', authenticateToken, async (req, res) => {
    try {
        const { keyword, city, countryCode = 'BR', classification } = req.query;

        console.log('🔍 Buscando eventos na Ticketmaster:', { keyword, city, countryCode, classification });

        const apiKey = process.env.TICKETMASTER_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                success: false,
                error: 'API Key do Ticketmaster não configurada'
            });
        }

        const axios = require('axios');

        const params = new URLSearchParams({
            apikey: apiKey,
            countryCode: countryCode,
            size: 20,
            sort: 'date,asc'
        });

        if (keyword) params.append('keyword', keyword);
        if (city) params.append('city', city);
        if (classification) params.append('classificationName', classification);

        const response = await axios.get(`https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`, {
            timeout: 15000
        });

        if (!response.data._embedded?.events) {
            return res.json({ success: true, events: [], total: 0 });
        }

        const events = response.data._embedded.events.map(event => {
            const venue = event._embedded?.venues?.[0];
            const classificationData = event.classifications?.[0];

            return {
                id: event.id,
                name: event.name,
                city: venue?.city?.name || city || '',
                state: venue?.state?.stateCode || '',
                country: venue?.country?.countryCode || countryCode,
                startDate: event.dates?.start?.localDate || event.dates?.start?.dateTime,
                endDate: event.dates?.end?.localDate || event.dates?.end?.dateTime,
                description: event.description || event.info || event.name,
                classification: classificationData?.segment?.name?.toLowerCase() || 'evento',
                imageUrl: event.images?.[0]?.url || '',
                venueName: venue?.name || '',
                url: event.url || ''
            };
        });

        console.log(`✅ Encontrados ${events.length} eventos`);

        res.json({ success: true, events: events, total: events.length });

    } catch (error) {
        console.error('❌ Erro ao buscar eventos:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/events/external/classification/:name', authenticateToken, async (req, res) => {
    try {
        const { name } = req.params;
        const { countryCode = 'BR' } = req.query;

        console.log(`🔍 Buscando eventos por classificação: ${name}`);

        const apiKey = process.env.TICKETMASTER_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                success: false,
                error: 'API Key do Ticketmaster não configurada'
            });
        }

        const axios = require('axios');

        const params = new URLSearchParams({
            apikey: apiKey,
            classificationName: name,
            countryCode: countryCode,
            size: 20,
            sort: 'date,asc'
        });

        const response = await axios.get(`https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`);

        if (!response.data._embedded?.events) {
            return res.json({
                success: true,
                events: [],
                total: 0,
                classification: name
            });
        }

        const events = response.data._embedded.events.map(event => {
            const venue = event._embedded?.venues?.[0];

            return {
                id: event.id,
                name: event.name,
                city: venue?.city?.name || '',
                state: venue?.state?.stateCode || '',
                startDate: event.dates?.start?.localDate,
                classification: name,
                description: event.description || event.info || event.name
            };
        });

        console.log(`✅ Encontrados ${events.length} eventos para classificação ${name}`);

        res.json({
            success: true,
            events: events,
            classification: name,
            total: events.length,
            source: 'ticketmaster'
        });

    } catch (error) {
        console.error('❌ Erro ao buscar por classificação:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar eventos por classificação',
            message: error.message
        });
    }
});

app.post('/api/events/external/import/:eventId', authenticateToken, async (req, res) => {
    try {
        const { eventId } = req.params;

        console.log(`📥 Importando evento da Ticketmaster: ${eventId} para usuário ${req.userId}`);

        const apiKey = process.env.TICKETMASTER_API_KEY;

        if (!apiKey) {
            console.error('❌ API Key não configurada');
            return res.status(500).json({
                success: false,
                error: 'API Key do Ticketmaster não configurada'
            });
        }

        const axios = require('axios');

        let response;
        try {
            response = await axios.get(`https://app.ticketmaster.com/discovery/v2/events/${eventId}.json?apikey=${apiKey}`, {
                timeout: 15000
            });
        } catch (apiError) {
            console.error('❌ Erro ao buscar evento na Ticketmaster:', apiError.response?.status, apiError.message);

            if (apiError.response?.status === 404) {
                return res.status(404).json({
                    success: false,
                    error: 'Evento não encontrado na Ticketmaster',
                    message: `ID ${eventId} não existe ou não está disponível`
                });
            }

            return res.status(500).json({
                success: false,
                error: 'Erro ao buscar evento na Ticketmaster',
                message: apiError.message
            });
        }

        const eventData = response.data;
        const venue = eventData._embedded?.venues?.[0];
        const classification = eventData.classifications?.[0];
        const segment = classification?.segment?.name?.toLowerCase() || '';

        let eventType = 'outro';
        if (segment === 'music') eventType = 'show';
        else if (segment === 'sports') eventType = 'evento_esportivo';
        else if (segment === 'festival') eventType = 'festa';
        else if (segment === 'arts & theatre') eventType = 'show';

        let expectedAttendees = 5000;
        if (segment === 'music') expectedAttendees = 30000;
        else if (segment === 'sports') expectedAttendees = 25000;
        else if (segment === 'festival') expectedAttendees = 50000;

        const startDate = eventData.dates?.start?.localDate || eventData.dates?.start?.dateTime;
        const endDate = eventData.dates?.end?.localDate || eventData.dates?.end?.dateTime || startDate;

        if (!startDate) {
            return res.status(400).json({
                success: false,
                error: 'Evento sem data válida',
                message: 'O evento não possui uma data definida'
            });
        }

        const Event = require('./src/models/Events');

        const existingEvent = await Event.findOne({
            externalId: eventId,
            source: 'ticketmaster',
            userId: req.userId
        });

        if (existingEvent) {
            return res.status(400).json({
                success: false,
                error: 'Evento já foi importado anteriormente',
                message: `O evento "${existingEvent.name}" já está na sua lista`
            });
        }

        const event = new Event({
            name: eventData.name || 'Evento sem nome',
            description: eventData.description || eventData.info || `Evento importado da Ticketmaster: ${eventData.name}`,
            type: eventType,
            address: venue?.address?.line1 || venue?.name || 'Endereço não informado',
            city: venue?.city?.name || '',
            state: venue?.state?.stateCode || '',
            latitude: venue?.location?.latitude ? parseFloat(venue.location.latitude) : null,
            longitude: venue?.location?.longitude ? parseFloat(venue.location.longitude) : null,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            expectedAttendees: expectedAttendees,
            estimatedWaste: Math.floor(expectedAttendees * 0.5),
            wasteCollected: 0,
            userId: req.userId,
            status: 'agendado',
            externalId: eventId,
            source: 'ticketmaster',
            venueName: venue?.name || '',
            imageUrl: eventData.images?.[0]?.url || '',
            eventUrl: eventData.url || '',
            categories: classification?.segment?.name ? [classification.segment.name] : [],
            externalData: {
                id: eventData.id,
                url: eventData.url,
                images: eventData.images,
                classifications: eventData.classifications,
                dates: eventData.dates,
                embedded: eventData._embedded
            },
            importedAt: new Date()
        });

        await event.save();

        console.log(`✅ Evento importado com sucesso: ${event.name} (ID: ${event._id})`);

        res.status(201).json({
            success: true,
            event: {
                id: event._id,
                _id: event._id,
                name: event.name,
                city: event.city,
                state: event.state,
                startDate: event.startDate,
                endDate: event.endDate,
                expectedAttendees: event.expectedAttendees,
                estimatedWaste: event.estimatedWaste,
                status: event.status,
                description: event.description,
                type: event.type,
                address: event.address,
                venueName: event.venueName,
                imageUrl: event.imageUrl
            },
            message: `Evento "${event.name}" importado com sucesso da Ticketmaster!`
        });

    } catch (error) {
        console.error('❌ Erro ao importar evento:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao importar evento',
            message: error.message
        });
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
        io.emit('new-message', { ...message.toJSON(), timestamp: new Date() });
        res.status(201).json({ message: 'Mensagem enviada com sucesso', data: message });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

app.get('/api/messages/:room', authenticateToken, async (req, res) => {
    try {
        const { room } = req.params;
        const { limit = 50 } = req.query;
        const messages = await Message.find({ room }).sort({ createdAt: -1 }).limit(parseInt(limit));
        res.json(messages.reverse());
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar mensagens' });
    }
});

// ========== ROTAS DE NOTIFICAÇÕES ==========
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.userId }).sort({ createdAt: -1 }).limit(50);
        const unreadCount = await Notification.countDocuments({ user: req.userId, read: false });
        res.json({ notifications, unreadCount });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar notificações' });
    }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { read: true, readAt: new Date() });
        res.json({ message: 'Notificação marcada como lida' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao marcar notificação' });
    }
});

app.patch('/api/notifications/read-all', authenticateToken, async (req, res) => {
    try {
        await Notification.updateMany({ user: req.userId, read: false }, { read: true, readAt: new Date() });
        res.json({ message: 'Todas notificações marcadas como lidas' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao marcar notificações' });
    }
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
    try {
        await Notification.findOneAndDelete({ _id: req.params.id, user: req.userId });
        res.json({ message: 'Notificação removida' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao remover notificação' });
    }
});

// ========== ROTAS PÚBLICAS ==========
app.get('/', (req, res) => {
    res.json({ nome: 'EcoRoute API', versao: '2.0.0', status: 'online' });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', database: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado' });
});

// ========== TRATAMENTO DE ERROS ==========
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada', path: req.originalUrl });
});

app.use((err, req, res, next) => {
    console.error('❌ Erro global:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

// ========== INICIAR SERVIDOR ==========
server.listen(PORT, () => {
    console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📌 POST /api/points - Criar ponto e gerar rota automática`);
    console.log(`📌 POST /api/collections - Registrar coleta`);
    console.log(`📌 POST /api/routes/generate-from-points - Gerar rota dos pontos`);
    console.log(`📌 POST /api/routes/generate-from-events - Gerar rota de eventos`);
    console.log(`📌 GET /api/events/external/search - Buscar eventos externos`);
    console.log(`📌 GET /api/events/external/classification/:name - Buscar por classificação`);
    console.log(`📌 POST /api/events/external/import/:eventId - Importar evento`);
});

module.exports = app;