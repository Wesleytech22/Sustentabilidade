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
const axios = require('axios');

// Importar modelos e serviços
const User = require('./src/models/User');
const Message = require('./models/Message');
const Notification = require('./models/Notification');
const emailService = require('./services/emailService');
const socketService = require('./services/socketService');
const { type } = require('os');

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
    number: { type: String, default: '' },
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

// ========== FUNÇÃO PARA BUSCAR COORDENADAS COM MÚLTIPLAS FONTES ==========
async function getCoordinatesByZipCode(cep) {
    try {
        const cleanCep = cep.replace(/\D/g, '');

        if (cleanCep.length !== 8) {
            return { error: 'CEP inválido', latitude: null, longitude: null };
        }

        console.log(`🔍 Buscando CEP ${cleanCep}...`);

        let addressData = null;
        let latitude = null;
        let longitude = null;
        let source = null;

        // Fonte 1: BrasilAPI (endereço + possíveis coordenadas)
        try {
            const brasilApiResponse = await axios.get(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`, {
                timeout: 5000
            });

            if (brasilApiResponse.data) {
                const data = brasilApiResponse.data;
                addressData = {
                    address: data.street || '',
                    neighborhood: data.neighborhood || '',
                    city: data.city || '',
                    state: data.state || '',
                    zipCode: cleanCep,
                    fullAddress: `${data.street}, ${data.neighborhood}, ${data.city} - ${data.state}`
                };
                source = 'brasilapi';

                if (data.location && data.location.coordinates) {
                    latitude = data.location.coordinates.latitude;
                    longitude = data.location.coordinates.longitude;
                    if (latitude && longitude) {
                        console.log(`📍 BrasilAPI: Coordenadas encontradas: ${latitude}, ${longitude}`);
                    }
                }
            }
        } catch (error) {
            console.log(`⚠️ BrasilAPI falhou:`, error.message);
        }

        // Fonte 2: ViaCEP (fallback para endereço)
        if (!addressData) {
            try {
                const viaCepResponse = await axios.get(`https://viacep.com.br/ws/${cleanCep}/json/`);

                if (!viaCepResponse.data.erro) {
                    const data = viaCepResponse.data;
                    addressData = {
                        address: data.logradouro || '',
                        neighborhood: data.bairro || '',
                        city: data.localidade || '',
                        state: data.uf || '',
                        zipCode: cleanCep,
                        fullAddress: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`
                    };
                    source = 'viacep';
                    console.log(`✅ ViaCEP: Endereço encontrado`);
                }
            } catch (viaCepError) {
                console.log(`⚠️ ViaCEP falhou`);
            }
        }

        // Se conseguiu endereço, tentar buscar coordenadas no Nominatim (OpenStreetMap)
        if (addressData && (!latitude || !longitude)) {
            console.log(`🔍 Buscando coordenadas para o endereço: ${addressData.fullAddress}`);

            try {
                const nominatimResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
                    params: {
                        q: addressData.fullAddress,
                        format: 'json',
                        limit: 1,
                        addressdetails: 1,
                        countrycodes: 'br'
                    },
                    headers: {
                        'User-Agent': 'EcoRoute/1.0'
                    },
                    timeout: 5000
                });

                if (nominatimResponse.data && nominatimResponse.data.length > 0) {
                    const location = nominatimResponse.data[0];
                    latitude = parseFloat(location.lat);
                    longitude = parseFloat(location.lon);
                    source = 'nominatim';
                    console.log(`📍 Nominatim: Coordenadas encontradas: ${latitude}, ${longitude}`);
                } else {
                    console.log(`⚠️ Nominatim: Não encontrou coordenadas para este endereço`);
                }
            } catch (nominatimError) {
                console.log(`⚠️ Nominatim falhou:`, nominatimError.message);
            }
        }

        // Se ainda não tem coordenadas, tentar coordenadas da cidade
        if (addressData && (!latitude || !longitude)) {
            console.log(`🔍 Buscando coordenadas da cidade: ${addressData.city}, ${addressData.state}`);

            try {
                const cityResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
                    params: {
                        q: `${addressData.city}, ${addressData.state}, Brasil`,
                        format: 'json',
                        limit: 1,
                        countrycodes: 'br'
                    },
                    headers: {
                        'User-Agent': 'EcoRoute/1.0'
                    },
                    timeout: 5000
                });

                if (cityResponse.data && cityResponse.data.length > 0) {
                    const location = cityResponse.data[0];
                    latitude = parseFloat(location.lat);
                    longitude = parseFloat(location.lon);
                    source = 'nominatim_city';
                    console.log(`📍 Nominatim (cidade): Coordenadas aproximadas: ${latitude}, ${longitude}`);
                }
            } catch (cityError) {
                console.log(`⚠️ Busca por cidade falhou`);
            }
        }

        // Retornar resultado (mesmo sem coordenadas)
        if (addressData) {
            return {
                success: true,
                latitude: latitude,
                longitude: longitude,
                address: addressData.address || '',
                neighborhood: addressData.neighborhood || '',
                city: addressData.city || '',
                state: addressData.state || '',
                zipCode: cleanCep,
                fullAddress: addressData.fullAddress,
                source: source,
                hasCoordinates: latitude !== null && longitude !== null
            };
        }

        return { error: 'CEP não encontrado', latitude: null, longitude: null };

    } catch (error) {
        console.error('❌ Erro ao buscar CEP:', error.message);
        return { error: error.message, latitude: null, longitude: null };
    }
}
// ========== ROTA DE BUSCA POR CEP ==========
// ========== ROTA DE BUSCA POR CEP ==========
app.get('/api/geocode/zipcode/:zipcode', authenticateToken, async (req, res) => {
    try {
        const { zipcode } = req.params;
        const cleanZip = zipcode.replace(/\D/g, '');

        console.log(`🔍 Buscando CEP: ${cleanZip}`);

        if (cleanZip.length !== 8) {
            return res.status(400).json({ error: 'CEP inválido. Digite 8 dígitos.' });
        }

        const result = await getCoordinatesByZipCode(cleanZip);

        if (result.error) {
            return res.status(404).json({ error: result.error });
        }

        res.json({
            success: true,
            data: {
                zipCode: result.zipCode,
                address: result.address || '',
                neighborhood: result.neighborhood || '',
                city: result.city || '',
                state: result.state || '',
                latitude: result.latitude,
                longitude: result.longitude,
                hasCoordinates: result.hasCoordinates || false,
                source: result.source || 'brasilapi'
            }
        });

    } catch (error) {
        console.error('❌ Erro ao buscar CEP:', error.message);
        res.status(500).json({ error: 'Erro ao buscar CEP', message: error.message });
    }
});

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
        const { name, address, city, state, zipCode, capacity, wasteTypes, currentVolume } = req.body;

        if (!name || !address || !capacity) {
            return res.status(400).json({ error: 'Campos obrigatórios: name, address, capacity' });
        }

        let latitude = null;
        let longitude = null;

        // Buscar coordenadas pelo CEP se disponível
        if (zipCode) {
            const geoResult = await getCoordinatesByZipCode(zipCode);
            if (geoResult.success && geoResult.latitude && geoResult.longitude) {
                latitude = geoResult.latitude;
                longitude = geoResult.longitude;
                console.log(`📍 Coordenadas obtidas: ${latitude}, ${longitude} (fonte: ${geoResult.source})`);
            } else {
                console.log(`⚠️ Coordenadas não disponíveis para o CEP ${zipCode}`);
                // Se o frontend enviou latitude/longitude, usar essas
                if (req.body.latitude && req.body.longitude) {
                    latitude = req.body.latitude;
                    longitude = req.body.longitude;
                    console.log(`📍 Usando coordenadas fornecidas pelo frontend: ${latitude}, ${longitude}`);
                }
            }
        } else if (req.body.latitude && req.body.longitude) {
            latitude = req.body.latitude;
            longitude = req.body.longitude;
            console.log(`📍 Usando coordenadas fornecidas pelo frontend: ${latitude}, ${longitude}`);
        }

        const pointData = {
            name,
            address,
            city: city || '',
            state: state ? state.toUpperCase() : '',
            zipCode: zipCode || '',
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
            const nextCollectionDate = getNextCollectionDate();

            const mainPointName = allPoints[0]?.name || 'Ponto Principal';
            const routeName = `${mainPointName} + ${allPoints.length - 1} ${allPoints.length - 1 === 1 ? 'ponto' : 'pontos'}`;

            const route = new Route({
                name: routeName,
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
            console.log(`✅ Rota automática criada: ${routeName}`);
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
        res.json(points);
    } catch (error) {
        console.error('❌ Erro ao listar pontos:', error);
        res.status(500).json({ error: 'Erro ao listar pontos' });
    }
});

app.get('/api/points/:id', authenticateToken, async (req, res) => {
    try {
        const point = await CollectionPoint.findOne({ _id: req.params.id, userId: req.userId });
        if (!point) return res.status(404).json({ error: 'Ponto não encontrado' });
        res.json(point);
    } catch (error) {
        console.error('❌ Erro ao buscar ponto:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/points/:id', authenticateToken, async (req, res) => {
    try {
        const point = await CollectionPoint.findOne({ _id: req.params.id, userId: req.userId });
        if (!point) return res.status(404).json({ error: 'Ponto não encontrado' });

        const { name, address, city, state, zipCode, capacity, wasteTypes, status } = req.body;

        if (name) point.name = name;
        if (address) point.address = address;
        if (city) point.city = city;
        if (state) point.state = state?.toUpperCase();
        if (zipCode) point.zipCode = zipCode;
        if (capacity) point.capacity = Number(capacity);
        if (wasteTypes) point.wasteTypes = wasteTypes;
        if (status) point.status = status;

        await point.save();
        res.json({ point, message: 'Ponto atualizado com sucesso' });
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

// ========== ROTA PARA GERAR ROTA MANUALMENTE ==========
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

        const mainPointName = allPoints[0]?.name || 'Ponto Principal';
        const routeName = `${mainPointName} + ${allPoints.length - 1} ${allPoints.length - 1 === 1 ? 'ponto' : 'pontos'}`;

        const route = new Route({
            name: routeName,
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

// ========== ENDPOINT - GERAR ROTA A PARTIR DE EVENTOS ==========
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

        const mainEventName = finishedEvents[0]?.name || 'Evento Principal';
        const routeName = `${mainEventName} + ${finishedEvents.length - 1} ${finishedEvents.length - 1 === 1 ? 'evento' : 'eventos'}`;

        const newRoute = new Route({
            name: routeName,
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

        point.currentVolume = (point.currentVolume || 0) + Number(wasteVolume);
        await point.save();

        if (routeId) {
            const route = await Route.findById(routeId);
            if (route) {
                const pointInRoute = route.points.find(p => p.pointId.toString() === collectionPointId);
                if (pointInRoute) {
                    pointInRoute.actualVolume = (pointInRoute.actualVolume || 0) + Number(wasteVolume);
                    pointInRoute.collectedAt = new Date();

                    const allCollected = route.points.every(p => p.collectedAt);
                    if (allCollected && route.status !== 'COMPLETED') {
                        route.status = 'COMPLETED';
                        route.completedAt = new Date();
                    }
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
        const { pointId } = req.query;
        const filter = { userId: req.userId };

        if (pointId) {
            filter.collectionPointId = pointId;
        }

        const collections = await Collection.find(filter)
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
        const routesCount = await Route.countDocuments({ userId: req.userId, status: { $in: ['PLANNED', 'IN_PROGRESS'] } });
        const totalWaste = 0;
        const totalCarbon = 0;
        res.json({ pointsCount, routesCount, totalWaste, totalCarbon });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/dashboard/waste-by-type', authenticateToken, async (req, res) => {
    res.json({ labels: ['Plástico', 'Papel', 'Vidro', 'Metal', 'Orgânico'], data: [0, 0, 0, 0, 0] });
});

app.get('/api/dashboard/monthly-impact', authenticateToken, async (req, res) => {
    res.json({ labels: [], data: [] });
});

app.get('/api/dashboard/recent-activities', authenticateToken, async (req, res) => {
    try {
        const activities = [];
        const recentPoints = await CollectionPoint.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(5);
        for (const point of recentPoints) {
            activities.push({ id: point._id, type: 'point', icon: 'fa-map-marker-alt', title: `Ponto "${point.name}" criado`, date: point.createdAt, timeAgo: getTimeAgo(point.createdAt) });
        }
        const recentRoutes = await Route.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(5);
        for (const route of recentRoutes) {
            activities.push({ id: route._id, type: 'route', icon: 'fa-route', title: `Rota "${route.name}" criada`, date: route.createdAt, timeAgo: getTimeAgo(route.createdAt) });
        }
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json({ activities: activities.slice(0, 10) });
    } catch (error) {
        res.json({ activities: [] });
    }
});

// ========== ROTAS DE EVENTOS EXTERNOS (TICKETMASTER) ==========
app.get('/api/events/external/search', authenticateToken, async (req, res) => {
    try {
        const { keyword, city, countryCode = 'BR', classification } = req.query;
        res.json({
            success: true,
            events: [
                { id: '1', name: 'Rock in Rio 2026', city: 'Rio de Janeiro', state: 'RJ', startDate: new Date().toISOString(), classification: 'music', expectedAttendees: 100000 },
                { id: '2', name: 'Lollapalooza', city: 'São Paulo', state: 'SP', startDate: new Date().toISOString(), classification: 'music', expectedAttendees: 80000 }
            ],
            total: 2
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/events/external/classification/:name', authenticateToken, async (req, res) => {
    res.json({ success: true, events: [], total: 0 });
});

app.post('/api/events/external/import/:eventId', authenticateToken, async (req, res) => {
    res.json({ success: true, message: 'Evento importado com sucesso (modo de teste)' });
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
    console.log(`📌 GET /api/geocode/zipcode/:zipcode - Buscar endereço por CEP (BrasilAPI)`);
    console.log(`📌 POST /api/points - Criar ponto de coleta`);
    console.log(`📌 POST /api/collections - Registrar coleta`);
    console.log(`📌 POST /api/routes/generate-from-points - Gerar rota dos pontos`);
    console.log(`📌 POST /api/routes/generate-from-events - Gerar rota de eventos`);
    console.log(`📌 GET /api/events/external/search - Buscar eventos externos`);
});

module.exports = app;