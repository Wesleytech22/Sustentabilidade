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
    'https://ecoroute.vercel.app',
    'https://ecoroute-git-master.vercel.app',  // Seu preview URL
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
];

app.use(cors({
    origin: function (origin, callback) {
        // Permite requisições sem origin (ex: mobile apps)
        if (!origin) return callback(null, true);
        
        // Verifica se é uma origem permitida ou se é do Vercel
        if (allowedOrigins.indexOf(origin) !== -1 || 
            origin.match(/https:\/\/.*\.vercel\.app$/) ||      // Qualquer preview do Vercel
            origin === 'https://ecoroute.vercel.app') {        // Seu domínio principal
            callback(null, true);
        } else {
            console.log(`❌ CORS bloqueou origem: ${origin}`);
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

// ========== MODELO DE EVENTO (ATUALIZADO COM NOVOS CAMPOS) ==========
const eventSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    type: {
        type: String,
        enum: ['show', 'festa', 'feira', 'evento_esportivo', 'restaurante', 'empresa', 'residencia', 'outro'],
        default: 'outro'
    },
    address: { type: String, required: true },
    neighborhood: String,
    city: { type: String, required: true },
    state: { type: String, required: true, uppercase: true },
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
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    expectedAttendees: { type: Number, required: true, default: 0 },
    estimatedWaste: { type: Number, default: 0 },
    wasteCollected: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['agendado', 'planejado', 'em_andamento', 'finalizado', 'cancelado', 'coleta_agendada'],
        default: 'agendado'
    },
    scheduledCollectionDate: Date,
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    externalId: { type: String, index: true, sparse: true },
    source: {
        type: String,
        enum: ['manual', 'ticketmaster', 'sympla', 'eventbrite'],
        default: 'manual'
    },
    venueName: String,
    imageUrl: String,
    eventUrl: String,
    importedAt: Date,

    // ========== NOVOS CAMPOS ==========
    responsible: { type: String, default: '' },        // Nome do responsável
    contact: { type: String, default: '' },            // Telefone/WhatsApp
    scheduleTime: { type: String, default: '08:00' },  // Horário da coleta
    observations: { type: String, default: '' }        // Observações gerais

}, { timestamps: true });

// Método para definir coordenadas
eventSchema.methods.setCoordinates = function (latitude, longitude) {
    if (latitude && longitude) {
        this.location = {
            type: 'Point',
            coordinates: [Number(longitude), Number(latitude)]
        };
    }
    return this;
};

// Método para calcular impacto ambiental
eventSchema.methods.calculateEnvironmentalImpact = function () {
    const carbonPerKg = 0.13;
    const totalWaste = this.wasteCollected || this.estimatedWaste || 0;

    return {
        totalWaste: totalWaste,
        carbonSaved: Math.round(totalWaste * carbonPerKg),
        treesEquivalent: Math.floor(totalWaste * 0.02),
        recyclingRate: this.wasteCollected ? Math.round((this.wasteCollected / this.estimatedWaste) * 100) : 0
    };
};

// Método para adicionar resíduos coletados
eventSchema.methods.addWasteCollected = async function (amount) {
    this.wasteCollected = (this.wasteCollected || 0) + amount;

    if (this.wasteCollected >= this.estimatedWaste) {
        this.status = 'finalizado';
    }

    return this.save();
};

const Event = mongoose.model('Event', eventSchema);

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
    console.log('🔍 INICIANDO CÁLCULO DA ROTA');
    console.log(`📦 Pontos recebidos: ${points.length}`);

    if (points.length === 0) {
        console.log('⚠️ Nenhum ponto recebido');
        return { orderedPoints: [], totalDistance: 0, totalWaste: 0 };
    }

    const validPoints = points.filter(p =>
        p.location &&
        p.location.coordinates &&
        p.location.coordinates.length === 2 &&
        p.location.coordinates[0] !== null &&
        p.location.coordinates[1] !== null
    );

    console.log(`📍 Pontos com coordenadas válidas: ${validPoints.length}`);

    if (validPoints.length < 2) {
        console.log('⚠️ Menos de 2 pontos com coordenadas, não é possível calcular distância');
        return { orderedPoints: points, totalDistance: 0, totalWaste: 0 };
    }

    const unvisited = [...validPoints];
    const orderedPoints = [];
    let current = unvisited.shift();
    orderedPoints.push(current);
    let totalDistance = 0;

    while (unvisited.length > 0) {
        let nearestIndex = 0;
        let minDistance = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
            const dist = calculateDistance(
                current.location.coordinates[1],
                current.location.coordinates[0],
                unvisited[i].location.coordinates[1],
                unvisited[i].location.coordinates[0]
            );
            console.log(`  Distância para ${unvisited[i].name}: ${dist.toFixed(2)} km`);

            if (dist < minDistance) {
                minDistance = dist;
                nearestIndex = i;
            }
        }

        if (minDistance !== Infinity) {
            totalDistance += minDistance;
            console.log(`  ✅ Menor distância: ${minDistance.toFixed(2)} km`);
        }

        current = unvisited[nearestIndex];
        orderedPoints.push(current);
        unvisited.splice(nearestIndex, 1);
    }

    const totalWaste = orderedPoints.reduce((sum, p) => sum + (p.currentVolume || 0), 0);
    const fuelConsumption = totalDistance * 0.35;
    const carbonFootprint = totalWaste * 0.13;

    console.log(`📊 RESULTADO FINAL:`);
    console.log(`  - Distância total: ${totalDistance.toFixed(2)} km`);
    console.log(`  - Combustível: ${fuelConsumption.toFixed(2)} L`);
    console.log(`  - CO2: ${carbonFootprint.toFixed(2)} kg`);
    console.log(`  - Resíduos: ${totalWaste} kg`);

    return {
        orderedPoints,
        totalDistance: parseFloat(totalDistance.toFixed(2)),
        totalWaste,
        fuelConsumption: parseFloat(fuelConsumption.toFixed(2)),
        carbonFootprint: parseFloat(carbonFootprint.toFixed(2))
    };
}

// Função para calcular a data de coleta (hoje + 2 dias, com horário comercial 08:00-17:00)
function getNextCollectionDate() {
    const now = new Date();
    const slaDate = new Date(now);
    slaDate.setDate(now.getDate() + 2);
    const adjustedDate = adjustToBusinessHours(slaDate);
    return adjustedDate;
}

function isWithinBusinessHours(date) {
    const hour = date.getHours();
    const day = date.getDay();
    if (day === 6 || day === 0) return false;
    return hour >= 8 && hour < 17;
}

function adjustToBusinessHours(date) {
    const adjusted = new Date(date);
    if (adjusted.getDay() === 6) {
        adjusted.setDate(adjusted.getDate() + 2);
        adjusted.setHours(8, 0, 0, 0);
    } else if (adjusted.getDay() === 0) {
        adjusted.setDate(adjusted.getDate() + 1);
        adjusted.setHours(8, 0, 0, 0);
    }
    if (adjusted.getHours() < 8) adjusted.setHours(8, 0, 0, 0);
    if (adjusted.getHours() >= 17) {
        adjusted.setDate(adjusted.getDate() + 1);
        adjusted.setHours(8, 0, 0, 0);
        if (adjusted.getDay() === 6) adjusted.setDate(adjusted.getDate() + 2);
        else if (adjusted.getDay() === 0) adjusted.setDate(adjusted.getDate() + 1);
    }
    return adjusted;
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

        try {
            const brasilApiResponse = await axios.get(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`, { timeout: 5000 });
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
                    if (latitude && longitude) console.log(`📍 BrasilAPI: Coordenadas encontradas: ${latitude}, ${longitude}`);
                }
            }
        } catch (error) {
            console.log(`⚠️ BrasilAPI falhou:`, error.message);
        }

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

        if (addressData && (!latitude || !longitude)) {
            console.log(`🔍 Buscando coordenadas para o endereço: ${addressData.fullAddress}`);
            try {
                const nominatimResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
                    params: { q: addressData.fullAddress, format: 'json', limit: 1, addressdetails: 1, countrycodes: 'br' },
                    headers: { 'User-Agent': 'EcoRoute/1.0' },
                    timeout: 5000
                });
                if (nominatimResponse.data && nominatimResponse.data.length > 0) {
                    const location = nominatimResponse.data[0];
                    latitude = parseFloat(location.lat);
                    longitude = parseFloat(location.lon);
                    source = 'nominatim';
                    console.log(`📍 Nominatim: Coordenadas encontradas: ${latitude}, ${longitude}`);
                }
            } catch (nominatimError) {
                console.log(`⚠️ Nominatim falhou:`, nominatimError.message);
            }
        }

        if (addressData && (!latitude || !longitude)) {
            console.log(`🔍 Buscando coordenadas da cidade: ${addressData.city}, ${addressData.state}`);
            try {
                const cityResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
                    params: { q: `${addressData.city}, ${addressData.state}, Brasil`, format: 'json', limit: 1, countrycodes: 'br' },
                    headers: { 'User-Agent': 'EcoRoute/1.0' },
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
app.get('/api/geocode/zipcode/:zipcode', authenticateToken, async (req, res) => {
    try {
        const { zipcode } = req.params;
        const cleanZip = zipcode.replace(/\D/g, '');
        if (cleanZip.length !== 8) {
            return res.status(400).json({ error: 'CEP inválido. Digite 8 dígitos.' });
        }
        const result = await getCoordinatesByZipCode(cleanZip);
        if (result.error) return res.status(404).json({ error: result.error });
        res.json({ success: true, data: { zipCode: result.zipCode, address: result.address || '', neighborhood: result.neighborhood || '', city: result.city || '', state: result.state || '', latitude: result.latitude, longitude: result.longitude, hasCoordinates: result.hasCoordinates || false, source: result.source || 'brasilapi' } });
    } catch (error) {
        console.error('❌ Erro ao buscar CEP:', error.message);
        res.status(500).json({ error: 'Erro ao buscar CEP', message: error.message });
    }
});

// ========== ROTAS DE AUTENTICAÇÃO ==========
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, phone, city, state, role } = req.body;
        if (!email || !password || !name) return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
        if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) return res.status(400).json({ error: 'Email já cadastrado' });
        const validRoles = ['COOPERATIVE', 'COMPANY', 'LOGISTICS', 'SUPPORT', 'ADMIN'];
        const userRole = validRoles.includes(role) ? role : 'COOPERATIVE';
        const user = new User({ email: email.toLowerCase(), password: password, name: name.trim(), phone: phone || '', city: city || '', state: state?.toUpperCase() || '', role: userRole });
        await user.save();
        emailService.sendWelcomeEmail(user.email, user.name).catch(err => console.error('Erro email:', err.message));
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
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
        if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user || !user.active) return res.status(401).json({ error: 'Email ou senha inválidos' });
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ error: 'Email ou senha inválidos' });
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
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
        const user = await User.findByIdAndUpdate(req.userId, { name, phone, city, state: state?.toUpperCase() }, { new: true, runValidators: true });
        res.json({ user, message: 'Perfil atualizado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
});

// ========== ROTAS DE PONTOS DE COLETA ==========
app.post('/api/points', authenticateToken, async (req, res) => {
    try {
        const { name, address, city, state, zipCode, capacity, wasteTypes, currentVolume } = req.body;
        if (!name || !address || !capacity) return res.status(400).json({ error: 'Campos obrigatórios: name, address, capacity' });
        let latitude = null, longitude = null, coordSource = 'nenhum';
        if (zipCode) {
            const geoResult = await getCoordinatesByZipCode(zipCode);
            if (geoResult.success && geoResult.latitude && geoResult.longitude) {
                latitude = geoResult.latitude; longitude = geoResult.longitude; coordSource = 'cep';
                console.log(`📍 Coordenadas obtidas via CEP: ${latitude}, ${longitude}`);
            }
        }
        if (!latitude || !longitude) {
            try {
                const fullAddress = `${address}, ${city || 'Cotia'}, ${state || 'SP'}, Brasil`;
                const nominatimResponse = await axios.get('https://nominatim.openstreetmap.org/search', { params: { q: fullAddress, format: 'json', limit: 1, countrycodes: 'br' }, headers: { 'User-Agent': 'EcoRoute/1.0' }, timeout: 8000 });
                if (nominatimResponse.data && nominatimResponse.data.length > 0) {
                    latitude = parseFloat(nominatimResponse.data[0].lat); longitude = parseFloat(nominatimResponse.data[0].lon); coordSource = 'nominatim';
                    console.log(`📍 Coordenadas obtidas via Nominatim: ${latitude}, ${longitude}`);
                }
            } catch (error) { console.log(`⚠️ Erro na busca por endereço: ${error.message}`); }
        }
        if (!latitude || !longitude) { latitude = -23.6022; longitude = -46.9194; coordSource = 'default'; console.log(`⚠️ Usando coordenadas padrão (Cotia): ${latitude}, ${longitude}`); }
        const pointData = { name, address, city: city || 'Cotia', state: state ? state.toUpperCase() : 'SP', zipCode: zipCode || '', capacity: Number(capacity), currentVolume: currentVolume ? Number(currentVolume) : 0, wasteTypes: wasteTypes || [], userId: req.userId, status: 'ACTIVE', location: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] } };
        const point = new CollectionPoint(pointData);
        await point.save();
        if (currentVolume && currentVolume > 0) {
            const wasteType = (wasteTypes && wasteTypes.length > 0) ? wasteTypes[0] : 'outros';
            const collection = new Collection({ collectionPointId: point._id, wasteVolume: Number(currentVolume), wasteType: wasteType, notes: `Coleta inicial ao cadastrar ponto: ${point.name}`, userId: req.userId, date: new Date() });
            await collection.save();
            console.log(`✅ Coleta inicial registrada: ${currentVolume} kg de ${wasteType}`);
        }
        const nextCollectionDate = getNextCollectionDate();
        const dateStr = new Date().toLocaleDateString('pt-BR');
        const routeName = `${point.name} - ${dateStr}`;
        const existingRouteForPoint = await Route.findOne({ userId: req.userId, source: 'points', 'points.pointId': point._id, status: 'PLANNED', date: { $gte: new Date().setHours(0, 0, 0, 0), $lt: new Date().setHours(23, 59, 59, 999) } });
        let createdRoute = null;
        if (!existingRouteForPoint) {
            const newRoute = new Route({ name: routeName, description: `Rota individual para coleta no ponto ${point.name}.`, date: nextCollectionDate, points: [{ pointId: point._id, order: 1, estimatedVolume: point.currentVolume || 500, actualVolume: 0, collectedAt: null }], totalDistance: 0, totalWaste: point.currentVolume || 0, fuelConsumption: 0, carbonFootprint: (point.currentVolume || 0) * 0.13, status: 'PLANNED', source: 'points', userId: req.userId });
            await newRoute.save();
            createdRoute = newRoute;
            console.log(`✅ Rota individual criada: ${routeName}`);
        } else { console.log(`⚠️ Rota individual já existe para ${point.name} hoje`); createdRoute = existingRouteForPoint; }
        const responsePoint = point.toObject();
        responsePoint.latitude = latitude; responsePoint.longitude = longitude;
        res.status(201).json({ point: responsePoint, route: createdRoute ? { id: createdRoute._id, name: createdRoute.name, date: createdRoute.date, points: createdRoute.points.length } : null, message: createdRoute ? `Ponto "${point.name}" criado com sua rota individual!` : 'Ponto criado com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao criar ponto:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/points', authenticateToken, async (req, res) => {
    try { const points = await CollectionPoint.find({ userId: req.userId }).sort({ createdAt: -1 }); res.json(points); }
    catch (error) { console.error('❌ Erro ao listar pontos:', error); res.status(500).json({ error: 'Erro ao listar pontos' }); }
});

app.get('/api/points/:id', authenticateToken, async (req, res) => {
    try { const point = await CollectionPoint.findOne({ _id: req.params.id, userId: req.userId }); if (!point) return res.status(404).json({ error: 'Ponto não encontrado' }); res.json(point); }
    catch (error) { console.error('❌ Erro ao buscar ponto:', error); res.status(500).json({ error: error.message }); }
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
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/points/:id', authenticateToken, async (req, res) => {
    try { const point = await CollectionPoint.findOneAndDelete({ _id: req.params.id, userId: req.userId }); if (!point) return res.status(404).json({ error: 'Ponto não encontrado' }); res.json({ message: 'Ponto deletado com sucesso' }); }
    catch (error) { res.status(500).json({ error: 'Erro ao deletar ponto' }); }
});

// ========== ROTAS DE ROTAS ==========
app.post('/api/routes', authenticateToken, async (req, res) => {
    try { const routeData = { ...req.body, userId: req.userId }; const route = new Route(routeData); await route.save(); res.status(201).json(route); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/routes', authenticateToken, async (req, res) => {
    try { const routes = await Route.find({ userId: req.userId }).sort({ date: 1 }); res.json(routes); }
    catch (error) { console.error('❌ Erro ao listar rotas:', error); res.status(500).json({ error: 'Erro ao listar rotas' }); }
});

app.put('/api/routes/:id', authenticateToken, async (req, res) => {
    try {
        const { name, status } = req.body;
        const route = await Route.findById(req.params.id);

        if (!route) {
            return res.status(404).json({ error: 'Rota não encontrada' });
        }

        if (route.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'Acesso não autorizado' });
        }

        if (name) route.name = name;

        if (status) {
            const oldStatus = route.status;

            // Se for iniciar coleta (IN_PROGRESS)
            if (status === 'IN_PROGRESS') {
                const today = new Date();
                today.setHours(8, 0, 0, 0); // Horário comercial padrão

                // Se a data da rota for maior que hoje (coleta adiantada)
                if (route.date > today) {
                    const oldDate = route.date;
                    route.date = today;
                    console.log(`📅 Coleta adiantada: "${route.name}" - data alterada de ${oldDate.toLocaleDateString('pt-BR')} para ${today.toLocaleDateString('pt-BR')}`);

                    // Atualizar a data no evento associado
                    if (route.eventInfo && route.eventInfo.eventId) {
                        await Event.findByIdAndUpdate(route.eventInfo.eventId, {
                            scheduledCollectionDate: today
                        });
                        console.log(`✅ Evento ${route.eventInfo.eventName} atualizado com nova data de coleta`);
                    }
                }
                route.status = status;

            } else if (status === 'COMPLETED') {
                route.status = status;
                route.completedAt = new Date();

                // Atualizar status do evento para finalizado
                if (route.eventInfo && route.eventInfo.eventId) {
                    await Event.findByIdAndUpdate(route.eventInfo.eventId, {
                        status: 'finalizado'
                    });
                    console.log(`✅ Evento ${route.eventInfo.eventName} atualizado para FINALIZADO`);
                }

                // MARCAR TODOS OS PONTOS COMO COLETADOS
                for (const point of route.points) {
                    if (point.pointId) {
                        const collectionPoint = await CollectionPoint.findById(point.pointId);
                        if (collectionPoint) {
                            if (!point.collectedAt) {
                                point.collectedAt = new Date();
                                point.actualVolume = point.estimatedVolume || 0;

                                const collection = new Collection({
                                    collectionPointId: point.pointId,
                                    routeId: route._id,
                                    wasteVolume: point.estimatedVolume || 0,
                                    wasteType: collectionPoint.wasteTypes?.[0] || 'outros',
                                    notes: `Coleta automática ao finalizar rota: ${route.name}`,
                                    userId: req.userId,
                                    date: new Date()
                                });
                                await collection.save();

                                collectionPoint.currentVolume = (collectionPoint.currentVolume || 0) + (point.estimatedVolume || 0);
                                await collectionPoint.save();
                                console.log(`✅ Ponto ${collectionPoint.name} marcado como coletado automaticamente`);
                            }
                        }
                    }
                }

            } else if (status === 'CANCELLED') {
                route.status = status;

                // Atualizar status do evento para cancelado
                if (route.eventInfo && route.eventInfo.eventId) {
                    await Event.findByIdAndUpdate(route.eventInfo.eventId, {
                        status: 'cancelado'
                    });
                    console.log(`✅ Evento ${route.eventInfo.eventName} atualizado para CANCELADO`);
                }
            } else {
                route.status = status;
            }
        }

        await route.save();

        // Emitir evento via socket
        io.emit('route-updated', { routeId: route._id, status: route.status });

        // Buscar a rota atualizada com os pontos populados
        const updatedRoute = await Route.findById(route._id).populate('points.pointId');

        res.json(updatedRoute);
    } catch (error) {
        console.error('❌ Erro ao atualizar rota:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/routes/:id', authenticateToken, async (req, res) => {
    try {
        const route = await Route.findById(req.params.id).populate('points.pointId');
        if (!route) return res.status(404).json({ error: 'Rota não encontrada' });
        if (route.userId.toString() !== req.userId.toString()) return res.status(403).json({ error: 'Acesso não autorizado' });
        const routeWithDetails = route.toObject();
        routeWithDetails.points = routeWithDetails.points.map(point => ({ ...point, collected: !!point.collectedAt, collectedAt: point.collectedAt, actualVolume: point.actualVolume || 0, pointName: point.pointId?.name || 'Ponto não encontrado', pointAddress: point.pointId?.address || 'Endereço não informado' }));
        res.json(routeWithDetails);
    } catch (error) { console.error('❌ Erro ao buscar rota:', error); res.status(500).json({ error: error.message }); }
});

app.delete('/api/routes/:id', authenticateToken, async (req, res) => {
    try { const route = await Route.findById(req.params.id); if (!route) return res.status(404).json({ error: 'Rota não encontrada' }); if (route.userId.toString() !== req.userId.toString()) return res.status(403).json({ error: 'Acesso não autorizado' }); await route.deleteOne(); res.json({ message: 'Rota removida com sucesso' }); }
    catch (error) { res.status(500).json({ error: 'Erro ao deletar rota' }); }
});

app.post('/api/routes/link-points', authenticateToken, async (req, res) => {
    try {
        const { pointIds, routeName } = req.body;
        if (!pointIds || pointIds.length < 2) return res.status(400).json({ error: 'Selecione pelo menos 2 pontos de coleta' });
        const selectedPoints = await CollectionPoint.find({ _id: { $in: pointIds }, userId: req.userId, location: { $exists: true, $ne: null } });
        if (selectedPoints.length < 2) return res.status(400).json({ error: 'Pontos selecionados não possuem coordenadas' });
        const optimized = await calculateOptimizedRoute(selectedPoints);
        const nextCollectionDate = getNextCollectionDate();
        const mainPointName = selectedPoints[0]?.name || 'Pontos de Coleta';
        const routeNameFinal = routeName || `${mainPointName} e mais ${selectedPoints.length - 1} pontos`;
        let existingRoute = await Route.findOne({ userId: req.userId, source: 'points', status: 'PLANNED' });
        let route;
        const routeData = { name: routeNameFinal, description: `Rota otimizada com ${selectedPoints.length} pontos de coleta. Distância total: ${optimized.totalDistance} km.`, date: nextCollectionDate, points: optimized.orderedPoints.map((p, idx) => ({ pointId: p._id, order: idx + 1, estimatedVolume: p.currentVolume || 500, actualVolume: 0, collectedAt: null })), totalDistance: optimized.totalDistance, totalWaste: optimized.totalWaste, fuelConsumption: optimized.fuelConsumption, carbonFootprint: optimized.carbonFootprint, status: 'PLANNED', source: 'points', userId: req.userId };
        if (existingRoute) { Object.assign(existingRoute, routeData); await existingRoute.save(); route = existingRoute; console.log(`✅ Rota atualizada: ${routeNameFinal}`); }
        else { route = new Route(routeData); await route.save(); console.log(`✅ Rota criada: ${routeNameFinal}`); }
        res.json({ success: true, route: { id: route._id, name: route.name, points: route.points.length, totalDistance: route.totalDistance, totalWaste: route.totalWaste, fuelConsumption: route.fuelConsumption, date: route.date }, message: `Rota "${route.name}" criada/atualizada com ${selectedPoints.length} pontos! Distância: ${optimized.totalDistance} km` });
    } catch (error) { console.error('❌ Erro ao vincular pontos:', error); res.status(500).json({ error: error.message }); }
});

app.post('/api/routes/generate-from-points', authenticateToken, async (req, res) => {
    try {
        const allPoints = await CollectionPoint.find({ userId: req.userId, location: { $exists: true, $ne: null } });
        if (allPoints.length < 2) return res.status(400).json({ error: 'Adicione pelo menos 2 pontos de coleta com coordenadas' });
        const optimized = await calculateOptimizedRoute(allPoints);
        const nextCollectionDate = getNextCollectionDate();
        const mainPointName = allPoints[0]?.name || 'Ponto Principal';
        const routeName = `${mainPointName} + ${allPoints.length - 1} ${allPoints.length - 1 === 1 ? 'ponto' : 'pontos'}`;
        const route = new Route({ name: routeName, description: `Rota gerada com ${allPoints.length} pontos de coleta. Tempo estimado: ${allPoints.length} hora(s).`, date: nextCollectionDate, points: optimized.orderedPoints.map((p, idx) => ({ pointId: p._id, order: idx + 1, estimatedVolume: p.currentVolume || 500, actualVolume: 0, collectedAt: null })), totalDistance: optimized.totalDistance, totalWaste: optimized.totalWaste, fuelConsumption: optimized.totalDistance * 0.35, carbonFootprint: optimized.totalWaste * 0.13, status: 'PLANNED', source: 'points', userId: req.userId });
        await route.save();
        res.status(201).json(route);
    } catch (error) { console.error('❌ Erro ao gerar rota:', error); res.status(500).json({ error: error.message }); }
});

app.post('/api/routes/generate-from-events', authenticateToken, async (req, res) => {
    try {
        const EventsModel = require('./src/models/Events');
        const finishedEvents = await EventsModel.find({ userId: req.userId, status: 'finalizado' });
        if (finishedEvents.length === 0) return res.status(404).json({ error: 'Nenhum evento finalizado encontrado' });
        const totalWaste = finishedEvents.reduce((sum, e) => sum + (e.estimatedWaste || 0), 0);
        const nextCollectionDate = getNextCollectionDate();
        const mainEventName = finishedEvents[0]?.name || 'Evento Principal';
        const routeName = `${mainEventName} + ${finishedEvents.length - 1} ${finishedEvents.length - 1 === 1 ? 'evento' : 'eventos'}`;
        const newRoute = new Route({ name: routeName, description: `Rota para ${finishedEvents.length} evento(s). Tempo estimado: ${finishedEvents.length} hora(s).`, date: nextCollectionDate, points: finishedEvents.map((event, index) => ({ pointId: event._id, order: index + 1, estimatedVolume: event.estimatedWaste || 500, actualVolume: 0, collectedAt: null })), totalWaste: totalWaste, carbonFootprint: totalWaste * 0.13, status: 'PLANNED', source: 'events', userId: req.userId, eventsSummary: finishedEvents.map(event => ({ eventId: event._id, eventName: event.name, eventDate: event.startDate, wasteCollected: event.estimatedWaste || 0 })) });
        await newRoute.save();
        res.status(201).json(newRoute);
    } catch (error) { console.error('❌ Erro ao gerar rota:', error); res.status(500).json({ error: error.message }); }
});

// ========== ROTAS DE COLETAS ==========
app.post('/api/collections', authenticateToken, async (req, res) => {
    try {
        const { collectionPointId, wasteVolume, wasteType, notes, routeId } = req.body;
        const point = await CollectionPoint.findOne({ _id: collectionPointId, userId: req.userId });
        if (!point) return res.status(404).json({ error: 'Ponto de coleta não encontrado' });
        const collection = new Collection({ collectionPointId, routeId: routeId || null, wasteVolume: Number(wasteVolume), wasteType: wasteType || 'outros', notes: notes || '', userId: req.userId, date: new Date() });
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
                    if (allCollected && route.status !== 'COMPLETED') { route.status = 'COMPLETED'; route.completedAt = new Date(); }
                    await route.save();
                }
            }
        }
        res.status(201).json({ success: true, collection, message: 'Coleta registrada com sucesso!' });
    } catch (error) { console.error('❌ Erro ao registrar coleta:', error); res.status(500).json({ error: error.message }); }
});

app.get('/api/collections', authenticateToken, async (req, res) => {
    try { const { pointId } = req.query; const filter = { userId: req.userId }; if (pointId) filter.collectionPointId = pointId; const collections = await Collection.find(filter).populate('collectionPointId').sort({ date: -1 }); res.json(collections); }
    catch (error) { console.error('❌ Erro ao listar coletas:', error); res.status(500).json({ error: error.message }); }
});

// ========== ROTAS DE DASHBOARD ==========
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const pointsCount = await CollectionPoint.countDocuments({ userId: req.userId });
        const routesCount = await Route.countDocuments({ userId: req.userId, status: { $in: ['PLANNED', 'IN_PROGRESS'] } });
        const collections = await Collection.aggregate([{ $lookup: { from: 'collectionpoints', localField: 'collectionPointId', foreignField: '_id', as: 'point' } }, { $unwind: { path: '$point', preserveNullAndEmptyArrays: true } }, { $match: { 'point.userId': req.user._id } }, { $group: { _id: null, totalWaste: { $sum: '$wasteVolume' } } }]);
        const totalWaste = collections[0]?.totalWaste || 0;
        const totalCarbon = Math.floor(totalWaste * 0.13);
        res.json({ pointsCount, routesCount, totalWaste, totalCarbon });
    } catch (error) { console.error('❌ Erro ao carregar stats:', error); res.status(500).json({ error: error.message }); }
});

app.get('/api/dashboard/waste-by-type', authenticateToken, async (req, res) => {
    try {
        const wasteByType = await Collection.aggregate([{ $lookup: { from: 'collectionpoints', localField: 'collectionPointId', foreignField: '_id', as: 'point' } }, { $unwind: { path: '$point', preserveNullAndEmptyArrays: true } }, { $match: { 'point.userId': req.user._id } }, { $group: { _id: { $ifNull: ['$wasteType', 'outros'] }, total: { $sum: '$wasteVolume' } } }, { $sort: { total: -1 } }]);
        const typeLabels = { 'plastico': 'Plástico', 'papel': 'Papel', 'vidro': 'Vidro', 'metal': 'Metal', 'organico': 'Orgânico', 'eletronico': 'Eletrônico', 'outros': 'Outros' };
        const labels = wasteByType.map(item => typeLabels[item._id] || item._id);
        const data = wasteByType.map(item => item.total);
        if (labels.length === 0) res.json({ labels: ['Plástico', 'Papel', 'Vidro', 'Metal', 'Orgânico'], data: [0, 0, 0, 0, 0] });
        else res.json({ labels, data });
    } catch (error) { res.json({ labels: ['Plástico', 'Papel', 'Vidro', 'Metal', 'Orgânico'], data: [0, 0, 0, 0, 0] }); }
});

app.get('/api/dashboard/monthly-impact', authenticateToken, async (req, res) => {
    try {
        const monthlyImpact = await Collection.aggregate([{ $lookup: { from: 'collectionpoints', localField: 'collectionPointId', foreignField: '_id', as: 'point' } }, { $unwind: { path: '$point', preserveNullAndEmptyArrays: true } }, { $match: { 'point.userId': req.user._id } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, carbon: { $sum: { $multiply: ['$wasteVolume', 0.13] } } } }, { $sort: { _id: 1 } }, { $limit: 12 }]);
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const labels = monthlyImpact.map(item => monthNames[parseInt(item._id.split('-')[1]) - 1]);
        const data = monthlyImpact.map(item => Math.round(item.carbon));
        res.json({ labels, data });
    } catch (error) { res.json({ labels: [], data: [] }); }
});

app.get('/api/dashboard/recent-activities', authenticateToken, async (req, res) => {
    try {
        const activities = [];
        const recentPoints = await CollectionPoint.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(5);
        for (const point of recentPoints) activities.push({ id: point._id, type: 'point', icon: 'fa-map-marker-alt', title: `Ponto "${point.name}" criado`, date: point.createdAt, timeAgo: getTimeAgo(point.createdAt) });
        const recentRoutes = await Route.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(5);
        for (const route of recentRoutes) activities.push({ id: route._id, type: 'route', icon: 'fa-route', title: `Rota "${route.name}" criada`, date: route.createdAt, timeAgo: getTimeAgo(route.createdAt) });
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json({ activities: activities.slice(0, 10) });
    } catch (error) { res.json({ activities: [] }); }
});

// ========== ROTAS DE IMPACTO AMBIENTAL ==========
app.get('/api/impact/summary', authenticateToken, async (req, res) => {
    try {
        const { pointId, date } = req.query;
        let filter = { userId: req.user._id };
        if (date) {
            const [year, month, day] = date.split('-');
            const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
            const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
            filter.date = { $gte: startDate, $lte: endDate };
        }
        if (pointId) filter.collectionPointId = new mongoose.Types.ObjectId(pointId);
        const collections = await Collection.find(filter);
        let totalWaste = 0;
        collections.forEach(c => totalWaste += c.wasteVolume || 0);
        const treesSaved = Math.floor(totalWaste * 0.02);
        const waterSaved = totalWaste * 5;
        const energySaved = totalWaste * 0.35;
        const carbonSaved = totalWaste * 0.13;
        res.json({ treesSaved, waterSaved: Math.floor(waterSaved), energySaved: Math.floor(energySaved), carbonSaved: Math.floor(carbonSaved), recyclingRate: totalWaste > 0 ? Math.min(95, Math.floor((totalWaste / (totalWaste + 1000)) * 100)) : 0, co2Reduction: Math.floor(carbonSaved), fuelSaved: Math.floor(totalWaste * 0.15), wasteDiverted: Math.floor(totalWaste) });
    } catch (error) { console.error('❌ Erro ao carregar resumo de impacto:', error); res.status(500).json({ error: error.message }); }
});

app.get('/api/impact/evolution', authenticateToken, async (req, res) => {
    try {
        const { pointId, date } = req.query;
        let collections = await Collection.find({ userId: req.user._id }).lean();
        if (pointId && pointId !== 'all' && pointId !== 'null' && pointId !== 'undefined' && pointId !== '') collections = collections.filter(c => c.collectionPointId && c.collectionPointId.toString() === pointId);
        if (collections.length === 0) return res.json({ labels: [], actual: [], goal: [] });
        const monthlyData = {};
        collections.forEach(collection => {
            const collectionDate = new Date(collection.date);
            const monthKey = `${collectionDate.getFullYear()}-${String(collectionDate.getMonth() + 1).padStart(2, '0')}`;
            const carbonSaved = (collection.wasteVolume || 0) * 0.13;
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + carbonSaved;
        });
        let baseDate = new Date();
        if (date) baseDate = new Date(date);
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const labels = [];
        const actual = [];
        for (let i = 11; i >= 0; i--) {
            const currentDate = new Date(baseDate);
            currentDate.setMonth(baseDate.getMonth() - i);
            const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            labels.push(monthNames[currentDate.getMonth()]);
            actual.push(Math.round(monthlyData[monthKey] || 0));
        }
        const goal = actual.map(value => Math.round(value * 1.2));
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json({ labels, actual, goal });
    } catch (error) { console.error('❌ Erro:', error); res.setHeader('Cache-Control', 'no-cache'); res.status(500).json({ error: error.message, labels: [], actual: [], goal: [] }); }
});

app.get('/api/impact/waste-distribution', authenticateToken, async (req, res) => {
    try {
        const { pointId, date } = req.query;
        let filter = { userId: req.user._id };
        if (date) {
            const [year, month, day] = date.split('-');
            const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
            const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
            filter.date = { $gte: startDate, $lte: endDate };
        }
        if (pointId) filter.collectionPointId = new mongoose.Types.ObjectId(pointId);
        const distribution = await Collection.aggregate([{ $match: filter }, { $group: { _id: '$wasteType', total: { $sum: '$wasteVolume' } } }, { $sort: { total: -1 } }]);
        const typeLabels = { 'plastico': 'Plástico', 'papel': 'Papel', 'vidro': 'Vidro', 'metal': 'Metal', 'organico': 'Orgânico', 'eletronico': 'Eletrônico', 'outros': 'Outros' };
        const labels = distribution.map(d => typeLabels[d._id] || d._id);
        const data = distribution.map(d => d.total);
        res.json({ labels, data });
    } catch (error) { console.error('❌ Erro ao carregar distribuição de resíduos:', error); res.json({ labels: [], data: [] }); }
});

app.get('/api/impact/benefits', authenticateToken, async (req, res) => {
    try {
        const { pointId, date } = req.query;
        let filter = { userId: req.user._id };
        if (date) {
            const [year, month, day] = date.split('-');
            const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
            const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
            filter.date = { $gte: startDate, $lte: endDate };
        }
        if (pointId) filter.collectionPointId = new mongoose.Types.ObjectId(pointId);
        const collections = await Collection.find(filter);
        const totalWaste = collections.reduce((sum, c) => sum + (c.wasteVolume || 0), 0);
        const treesSaved = Math.floor(totalWaste * 0.02);
        const waterSaved = totalWaste * 5;
        const energySaved = totalWaste * 0.35;
        const carbonSaved = totalWaste * 0.13;
        const benefits = [
            { id: 'forests', icon: 'tree', title: 'Florestas Preservadas', description: `Com ${treesSaved.toLocaleString()} árvores preservadas, equivalentes a ${Math.floor(treesSaved / 100)} hectares de floresta.`, stats: [{ label: 'O₂ Gerado', value: `${(treesSaved * 118).toLocaleString()} kg/ano` }, { label: 'Habitat Preservado', value: `${Math.floor(treesSaved * 0.5)} espécies` }] },
            { id: 'water', icon: 'water', title: 'Recursos Hídricos', description: `Economia de ${Math.floor(waterSaved).toLocaleString()} litros de água, suficiente para abastecer ${Math.floor(waterSaved / 150)} famílias por mês.`, stats: [{ label: 'Piscinas Olímpicas', value: `${Math.floor(waterSaved / 2500000)} unidades` }, { label: 'Dias de consumo', value: `${Math.floor(waterSaved / 150)} dias` }] },
            { id: 'energy', icon: 'bolt', title: 'Energia Renovável', description: `${Math.floor(energySaved).toLocaleString()} kWh economizados, equivalente a ${Math.floor(energySaved / 150)} meses de consumo residencial.`, stats: [{ label: 'Casas abastecidas', value: `${Math.floor(energySaved / 150)} meses` }, { label: 'Carvão evitado', value: `${Math.floor(energySaved * 0.5)} kg` }] },
            { id: 'air', icon: 'leaf', title: 'Qualidade do Ar', description: `${Math.floor(carbonSaved).toLocaleString()} kg de CO₂ deixaram de ser emitidos, equivalente a ${Math.floor(carbonSaved / 20)} carros populares.`, stats: [{ label: 'Árvores necessárias', value: `${Math.floor(carbonSaved / 22)} unidades` }, { label: 'Voos SP-Rio', value: `${Math.floor(carbonSaved / 100)} viagens` }] }
        ];
        res.json({ benefits });
    } catch (error) { console.error('❌ Erro ao carregar benefícios:', error); res.json({ benefits: [] }); }
});

// ========== ROTAS DE EVENTOS EXTERNOS (CORRIGIDAS) ==========
app.get('/api/events/external/search', authenticateToken, async (req, res) => {
    try {
        const { keyword, city, size = 20 } = req.query;
        console.log('🔍 Buscando eventos:', { keyword, city });

        const ticketmasterApiKey = process.env.TICKETMASTER_API_KEY;

        if (!ticketmasterApiKey) {
            console.error('❌ TICKETMASTER_API_KEY não configurada');
            return res.status(500).json({
                success: false,
                error: 'API do Ticketmaster não configurada',
                events: [],
                total: 0
            });
        }

        let url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${ticketmasterApiKey}&countryCode=BR&size=${size}&sort=date,asc`;
        if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
        if (city) url += `&city=${encodeURIComponent(city)}`;

        const response = await axios.get(url, { timeout: 15000 });

        if (response.data._embedded && response.data._embedded.events) {
            const events = response.data._embedded.events.map(event => {
                const venue = event._embedded?.venues?.[0];
                const classification = event.classifications?.[0]?.segment?.name || '';
                let expectedAttendees = 5000, estimatedWaste = 2500;

                if (classification === 'Sports') {
                    expectedAttendees = 20000;
                    estimatedWaste = 10000;
                } else if (classification === 'Music') {
                    expectedAttendees = 8000;
                    estimatedWaste = 4000;
                } else if (classification === 'Arts & Theatre') {
                    expectedAttendees = 2000;
                    estimatedWaste = 1000;
                }

                return {
                    externalId: event.id,
                    name: event.name,
                    description: event.info || event.description || '',
                    startDate: event.dates?.start?.localDate || new Date().toISOString().split('T')[0],
                    endDate: event.dates?.end?.localDate || event.dates?.start?.localDate || new Date().toISOString().split('T')[0],
                    venueName: venue?.name || '',
                    address: venue?.address?.line1 || '',
                    city: venue?.city?.name || '',
                    state: venue?.state?.stateCode || '',
                    zipCode: venue?.postalCode || '',
                    imageUrl: event.images?.[0]?.url || '',
                    eventUrl: event.url || '',
                    classification: classification,
                    expectedAttendees: expectedAttendees,
                    estimatedWaste: estimatedWaste
                };
            });

            console.log(`✅ Encontrados ${events.length} eventos`);

            // CORREÇÃO: Adicionado success: true
            res.json({
                success: true,
                events: events,
                total: events.length
            });
        } else {
            res.json({
                success: true,
                events: [],
                total: 0
            });
        }
    } catch (error) {
        console.error('❌ Erro ao buscar eventos:', error.message);
        res.status(500).json({
            success: false,
            error: `Erro ao buscar eventos: ${error.message}`,
            events: [],
            total: 0
        });
    }
});

app.get('/api/events/external/classification/:name', authenticateToken, async (req, res) => {
    try {
        const { name } = req.params;
        const classifications = { 'futebol': { type: 'Sports', wastePerPerson: 0.5, avgAttendees: 20000 }, 'show': { type: 'Music', wastePerPerson: 0.5, avgAttendees: 8000 }, 'teatro': { type: 'Arts & Theatre', wastePerPerson: 0.3, avgAttendees: 1500 }, 'feira': { type: 'Festival', wastePerPerson: 0.4, avgAttendees: 5000 } };
        const result = classifications[name.toLowerCase()] || { type: 'Music', wastePerPerson: 0.5, avgAttendees: 5000 };
        res.json(result);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// POST /api/events - Criar evento manualmente (COM NOVOS CAMPOS)
app.post('/api/events', authenticateToken, async (req, res) => {
    try {
        const {
            name, description, type, address, city, state, zipCode,
            startDate, endDate, expectedAttendees, estimatedWaste,
            latitude, longitude,
            // ========== NOVOS CAMPOS ==========
            responsible, contact, scheduleTime, observations
        } = req.body;

        console.log('📌 Criando evento manual:', { name, address, city, zipCode });

        // Calcular resíduos estimados
        let finalEstimatedWaste = estimatedWaste;
        if ((!finalEstimatedWaste || finalEstimatedWaste === 0) && expectedAttendees) {
            finalEstimatedWaste = expectedAttendees * 0.5;
        }

        // Buscar coordenadas
        let finalLatitude = latitude;
        let finalLongitude = longitude;
        let finalAddress = address;
        let finalCity = city;
        let finalState = state;

        if ((!finalLatitude || !finalLongitude) && zipCode) {
            const geoResult = await getCoordinatesByZipCode(zipCode);
            if (geoResult.success && geoResult.latitude && geoResult.longitude) {
                finalLatitude = geoResult.latitude;
                finalLongitude = geoResult.longitude;
                finalAddress = geoResult.address || finalAddress;
                finalCity = geoResult.city || finalCity;
                finalState = geoResult.state || finalState;
            }
        }

        if (!finalLatitude || !finalLongitude) {
            finalLatitude = -23.6022;
            finalLongitude = -46.9194;
        }

        const locationObj = {
            type: 'Point',
            coordinates: [Number(finalLongitude), Number(finalLatitude)]
        };

        // 1. CRIAR EVENTO COM NOVOS CAMPOS
        const event = new Event({
            name, description: description || '',
            type: type || 'outro',
            address: finalAddress || '',
            city: finalCity || 'Cotia',
            state: finalState ? finalState.toUpperCase() : 'SP',
            zipCode: zipCode || '',
            location: locationObj,
            latitude: finalLatitude,
            longitude: finalLongitude,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : new Date(startDate),
            expectedAttendees: Number(expectedAttendees) || 0,
            estimatedWaste: Number(finalEstimatedWaste) || 0,
            wasteCollected: 0,
            status: 'agendado',
            source: 'manual',
            userId: req.userId,
            // ========== NOVOS CAMPOS ==========
            responsible: responsible || '',
            contact: contact || '',
            scheduleTime: scheduleTime || '08:00',
            observations: observations || ''
        });
        await event.save();
        console.log(`✅ Evento criado: ${event.name}`);

        // 2. CRIAR PONTO DE COLETA
        const point = new CollectionPoint({
            name: `${event.name} - Evento`,
            address: event.address,
            city: event.city,
            state: event.state,
            zipCode: event.zipCode,
            capacity: event.estimatedWaste * 2,
            currentVolume: 0,
            wasteTypes: ['plastico', 'papel', 'vidro', 'organico'],
            userId: req.userId,
            status: 'ACTIVE',
            location: locationObj
        });
        await point.save();
        console.log(`✅ Ponto de coleta criado: ${point.name}`);

        // 3. REGISTRAR COLETA INICIAL
        const collection = new Collection({
            collectionPointId: point._id,
            wasteVolume: event.estimatedWaste,
            wasteType: 'outros',
            notes: `Coleta inicial do evento: ${event.name}`,
            userId: req.userId,
            date: new Date()
        });
        await collection.save();
        console.log(`✅ Coleta registrada: ${event.estimatedWaste} kg`);

        // 4. CRIAR ROTA
        const routeDate = getNextCollectionDate();

        const route = new Route({
            name: `${event.name} - Rota de Coleta`,
            description: `Coleta de resíduos do evento ${event.name}. Resíduos estimados: ${event.estimatedWaste} kg.`,
            date: routeDate,
            points: [{
                pointId: point._id,
                order: 1,
                estimatedVolume: event.estimatedWaste,
                actualVolume: 0,
                collectedAt: null
            }],
            totalDistance: 0,
            totalWaste: event.estimatedWaste,
            fuelConsumption: 0,
            carbonFootprint: event.estimatedWaste * 0.13,
            status: 'PLANNED',
            source: 'events',
            userId: req.userId,
            eventInfo: {
                eventId: event._id,
                eventName: event.name,
                eventDate: event.startDate,
                eventLocation: event.address
            }
        });
        await route.save();
        console.log(`✅ Rota criada: ${route.name}`);

        // 5. ATUALIZAR EVENTO COM ROUTE_ID
        event.routeId = route._id;
        event.scheduledCollectionDate = routeDate;
        await event.save();

        res.status(201).json({
            success: true,
            message: `Evento "${event.name}" criado com sucesso! Ponto de coleta e rota criados.`,
            event: {
                id: event._id,
                name: event.name,
                date: event.startDate,
                estimatedWaste: event.estimatedWaste,
                address: event.address,
                city: event.city,
                coordinates: { latitude: finalLatitude, longitude: finalLongitude },
                responsible: event.responsible,
                contact: event.contact,
                scheduleTime: event.scheduleTime,
                observations: event.observations
            },
            point: {
                id: point._id,
                name: point.name,
                address: point.address
            },
            route: {
                id: route._id,
                name: route.name,
                date: route.date,
                totalWaste: route.totalWaste
            }
        });

    } catch (error) {
        console.error('❌ Erro ao criar evento:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS DE EVENTOS ==========

// GET /api/events - Listar todos os eventos do usuário
app.get('/api/events', authenticateToken, async (req, res) => {
    try {
        const events = await Event.find({ userId: req.userId }).sort({ startDate: -1 });
        console.log(`📊 Eventos encontrados: ${events.length}`);
        res.json(events);
    } catch (error) {
        console.error('❌ Erro ao listar eventos:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/events/:id - Buscar evento específico
app.get('/api/events/:id', authenticateToken, async (req, res) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, userId: req.userId });
        if (!event) return res.status(404).json({ error: 'Evento não encontrado' });
        res.json(event);
    } catch (error) {
        console.error('❌ Erro ao buscar evento:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/events - Criar evento manualmente (COM PONTO E ROTA)
app.post('/api/events', authenticateToken, async (req, res) => {
    try {
        const {
            name, description, type, address, city, state, zipCode,
            startDate, endDate, expectedAttendees, estimatedWaste,
            latitude, longitude
        } = req.body;

        console.log('📌 Criando evento manual:', { name, address, city, zipCode });

        // Calcular resíduos estimados se não informado
        let finalEstimatedWaste = estimatedWaste;
        if ((!finalEstimatedWaste || finalEstimatedWaste === 0) && expectedAttendees) {
            finalEstimatedWaste = expectedAttendees * 0.5;
        }

        // Buscar coordenadas se não foram fornecidas
        let finalLatitude = latitude;
        let finalLongitude = longitude;
        let finalAddress = address;
        let finalCity = city;
        let finalState = state;

        // Se não tem coordenadas mas tem CEP, buscar
        if ((!finalLatitude || !finalLongitude) && zipCode) {
            const geoResult = await getCoordinatesByZipCode(zipCode);
            if (geoResult.success && geoResult.latitude && geoResult.longitude) {
                finalLatitude = geoResult.latitude;
                finalLongitude = geoResult.longitude;
                finalAddress = geoResult.address || finalAddress;
                finalCity = geoResult.city || finalCity;
                finalState = geoResult.state || finalState;
                console.log(`📍 Coordenadas via CEP: ${finalLatitude}, ${finalLongitude}`);
            }
        }

        // Se ainda não tem coordenadas, tentar pelo endereço
        if ((!finalLatitude || !finalLongitude) && finalAddress && finalCity) {
            const searchAddress = `${finalAddress}, ${finalCity}, ${finalState || 'SP'}, Brasil`;
            try {
                const nominatimResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
                    params: { q: searchAddress, format: 'json', limit: 1, countrycodes: 'br' },
                    headers: { 'User-Agent': 'EcoRoute/1.0' },
                    timeout: 8000
                });
                if (nominatimResponse.data && nominatimResponse.data.length > 0) {
                    finalLatitude = parseFloat(nominatimResponse.data[0].lat);
                    finalLongitude = parseFloat(nominatimResponse.data[0].lon);
                    console.log(`📍 Coordenadas via Nominatim: ${finalLatitude}, ${finalLongitude}`);
                }
            } catch (error) {
                console.log(`⚠️ Erro Nominatim: ${error.message}`);
            }
        }

        // Se ainda não tem coordenadas, usar padrão Cotia/SP
        if (!finalLatitude || !finalLongitude) {
            finalLatitude = -23.6022;
            finalLongitude = -46.9194;
            console.log(`⚠️ Usando coordenadas padrão (Cotia): ${finalLatitude}, ${finalLongitude}`);
        }

        // ========== CRIAR LOCATION VÁLIDA ==========
        const locationObj = {
            type: 'Point',
            coordinates: [Number(finalLongitude), Number(finalLatitude)]
        };

        // ========== 1. CRIAR EVENTO ==========
        const eventData = {
            name,
            description: description || '',
            type: type || 'outro',
            address: finalAddress || '',
            city: finalCity || 'Cotia',
            state: finalState ? finalState.toUpperCase() : 'SP',
            zipCode: zipCode || '',
            location: locationObj,
            latitude: finalLatitude,
            longitude: finalLongitude,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : new Date(startDate),
            expectedAttendees: Number(expectedAttendees) || 0,
            estimatedWaste: Number(finalEstimatedWaste) || 0,
            wasteCollected: 0,
            status: 'agendado',
            source: 'manual',
            userId: req.userId
        };

        const event = new Event(eventData);
        await event.save();
        console.log(`✅ Evento criado: ${event.name}`);

        // ========== 2. CRIAR PONTO DE COLETA ==========
        const point = new CollectionPoint({
            name: `${event.name} - Evento`,
            address: event.address,
            city: event.city,
            state: event.state,
            zipCode: event.zipCode,
            capacity: event.estimatedWaste * 2,
            currentVolume: 0,
            wasteTypes: ['plastico', 'papel', 'vidro', 'organico'],
            userId: req.userId,
            status: 'ACTIVE',
            location: locationObj
        });
        await point.save();
        console.log(`✅ Ponto de coleta criado: ${point.name}`);

        // ========== 3. REGISTRAR COLETA INICIAL ==========
        const collection = new Collection({
            collectionPointId: point._id,
            wasteVolume: event.estimatedWaste,
            wasteType: 'outros',
            notes: `Coleta inicial do evento: ${event.name}`,
            userId: req.userId,
            date: new Date()
        });
        await collection.save();
        console.log(`✅ Coleta registrada: ${event.estimatedWaste} kg`);

        // ========== 4. CRIAR ROTA ==========
        const routeDate = getNextCollectionDate();

        const route = new Route({
            name: `${event.name} - Rota de Coleta`,
            description: `Rota para coleta de resíduos do evento ${event.name}. Resíduos estimados: ${event.estimatedWaste} kg.`,
            date: routeDate,
            points: [{
                pointId: point._id,
                order: 1,
                estimatedVolume: event.estimatedWaste,
                actualVolume: 0,
                collectedAt: null
            }],
            totalDistance: 0,
            totalWaste: event.estimatedWaste,
            fuelConsumption: 0,
            carbonFootprint: event.estimatedWaste * 0.13,
            status: 'PLANNED',
            source: 'events',
            userId: req.userId,
            eventInfo: {
                eventId: event._id,
                eventName: event.name,
                eventDate: event.startDate,
                eventLocation: event.address
            }
        });
        await route.save();
        console.log(`✅ Rota criada: ${route.name}`);

        // ========== 5. ATUALIZAR EVENTO COM ROUTE_ID ==========
        event.routeId = route._id;
        event.scheduledCollectionDate = routeDate;
        await event.save();

        res.status(201).json({
            success: true,
            message: `Evento "${event.name}" criado com sucesso! Ponto de coleta e rota criados.`,
            event: {
                id: event._id,
                name: event.name,
                date: event.startDate,
                estimatedWaste: event.estimatedWaste,
                address: event.address,
                city: event.city,
                coordinates: { latitude: finalLatitude, longitude: finalLongitude }
            },
            point: {
                id: point._id,
                name: point.name,
                address: point.address
            },
            route: {
                id: route._id,
                name: route.name,
                date: route.date,
                totalWaste: route.totalWaste
            }
        });

    } catch (error) {
        console.error('❌ Erro ao criar evento:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events/:id/finish', authenticateToken, async (req, res) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, userId: req.userId });
        if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

        // ========== INICIALIZAR VARIÁVEIS ==========
        let latitude = null;
        let longitude = null;

        // Verificar se o evento já tem coordenadas
        if (event.latitude && event.longitude) {
            latitude = event.latitude;
            longitude = event.longitude;
            console.log(`📍 Evento já possui coordenadas: ${latitude}, ${longitude}`);
        }

        // Se não tiver, tentar buscar pelo CEP
        if ((!latitude || !longitude) && event.zipCode) {
            const geoResult = await getCoordinatesByZipCode(event.zipCode);
            if (geoResult.success && geoResult.latitude && geoResult.longitude) {
                latitude = geoResult.latitude;
                longitude = geoResult.longitude;
                console.log(`📍 Coordenadas obtidas via CEP: ${latitude}, ${longitude}`);
            }
        }

        // Se ainda não tiver, tentar buscar pelo endereço
        if ((!latitude || !longitude) && event.address && event.city) {
            const searchAddress = `${event.address}, ${event.city}, ${event.state}, Brasil`;
            console.log(`🔍 Buscando coordenadas para: ${searchAddress}`);
            try {
                const nominatimResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
                    params: { q: searchAddress, format: 'json', limit: 1, countrycodes: 'br' },
                    headers: { 'User-Agent': 'EcoRoute/1.0' },
                    timeout: 8000
                });
                if (nominatimResponse.data && nominatimResponse.data.length > 0) {
                    latitude = parseFloat(nominatimResponse.data[0].lat);
                    longitude = parseFloat(nominatimResponse.data[0].lon);
                    console.log(`📍 Coordenadas obtidas via Nominatim: ${latitude}, ${longitude}`);
                }
            } catch (error) {
                console.log(`⚠️ Erro Nominatim: ${error.message}`);
            }
        }

        // Se não tem coordenadas, usar padrão
        if (!latitude || !longitude) {
            latitude = -23.6022;
            longitude = -46.9194;
            console.log(`⚠️ Usando coordenadas padrão (Cotia): ${latitude}, ${longitude}`);
        }

        // ========== DETERMINAR TIPOS DE RESÍDUOS BASEADO NO TIPO DO EVENTO ==========
        let wasteTypes = ['plastico', 'papel', 'organico'];

        switch (event.type) {
            case 'show':
            case 'festa':
                wasteTypes = ['plastico', 'papel', 'vidro', 'organico'];
                break;
            case 'feira':
                wasteTypes = ['papel', 'plastico', 'organico'];
                break;
            case 'evento_esportivo':
                wasteTypes = ['plastico', 'papel', 'vidro'];
                break;
            default:
                wasteTypes = ['plastico', 'papel', 'vidro', 'metal', 'organico'];
        }

        // ========== CRIAR/ATUALIZAR PONTO DE COLETA ==========
        let point = await CollectionPoint.findOne({
            name: `${event.name} - Evento`,
            userId: req.userId
        });

        if (!point && latitude && longitude) {
            point = new CollectionPoint({
                name: `${event.name} - Evento`,
                address: event.address || '',
                neighborhood: event.neighborhood || '',
                city: event.city || '',
                state: event.state || '',
                zipCode: event.zipCode || '',
                capacity: (event.estimatedWaste || 5000) * 2,
                currentVolume: 0,  // 👈 CORRIGIDO: COMEÇA COM 0 (NÃO COLETADO)
                wasteTypes: wasteTypes,
                userId: req.userId,
                status: 'ACTIVE',
                location: {
                    type: 'Point',
                    coordinates: [Number(longitude), Number(latitude)]
                }
            });
            await point.save();
            console.log(`✅ Ponto de coleta criado: ${point.name} (volume: 0 kg)`);
        } else if (point) {
            // Não atualiza volume aqui - só atualiza quando a rota for concluída
            console.log(`✅ Ponto já existe: ${point.name} (volume atual: ${point.currentVolume} kg)`);
        }

        // ========== REGISTRAR COLETA (PENDENTE) ==========
        if (point && event.estimatedWaste > 0) {
            const primaryWasteType = wasteTypes[0] || 'outros';

            const collection = new Collection({
                collectionPointId: point._id,
                wasteVolume: event.estimatedWaste,
                wasteType: primaryWasteType,
                notes: `Coleta programada para o evento: ${event.name}. Aguardando execução da rota.`,
                userId: req.userId,
                date: new Date()
            });
            await collection.save();
            console.log(`✅ Coleta registrada (pendente): ${event.estimatedWaste} kg de ${primaryWasteType}`);
        }

        // ========== ATUALIZAR EVENTO ==========
        if (latitude && longitude) {
            event.latitude = latitude;
            event.longitude = longitude;
            event.location = {
                type: 'Point',
                coordinates: [Number(longitude), Number(latitude)]
            };
        }

        event.status = 'coleta_agendada';
        await event.save();

        // ========== CRIAR ROTA DE COLETA ==========
        const nextCollectionDate = getNextCollectionDate();

        let route = null;
        if (point) {
            route = new Route({
                name: `${event.name} - Coleta Pós-Evento`,
                description: `Coleta de resíduos do evento ${event.name}. Resíduos estimados: ${event.estimatedWaste} kg. Tipos: ${wasteTypes.join(', ')}`,
                date: nextCollectionDate,
                points: [{
                    pointId: point._id,
                    order: 1,
                    estimatedVolume: event.estimatedWaste || 5000,
                    actualVolume: 0,        // 👈 CORRIGIDO: INICIA COM 0 (NÃO COLETADO)
                    collectedAt: null       // 👈 CORRIGIDO: INICIA COMO NULL (PENDENTE)
                }],
                totalDistance: 0,
                totalWaste: event.estimatedWaste || 5000,
                fuelConsumption: 0,
                carbonFootprint: (event.estimatedWaste || 5000) * 0.13,
                status: 'PLANNED',
                source: 'events',
                userId: req.userId,
                eventInfo: {
                    eventId: event._id,
                    eventName: event.name,
                    eventDate: event.startDate,
                    eventLocation: event.address
                }
            });
            await route.save();
            console.log(`✅ Rota criada: ${route.name} (status: PLANNED, pontos pendentes)`);

            event.routeId = route._id;
            event.scheduledCollectionDate = nextCollectionDate;
            await event.save();
        }

        res.json({
            success: true,
            message: point ? `Evento finalizado! Coleta de ${event.estimatedWaste} kg agendada.` : 'Evento finalizado, mas não foi possível criar ponto de coleta (sem coordenadas).',
            point: point ? {
                id: point._id,
                name: point.name,
                wasteTypes: point.wasteTypes,
                currentVolume: point.currentVolume
            } : null,
            collection: point ? { wasteVolume: event.estimatedWaste, wasteType: wasteTypes[0], status: 'pendente' } : null,
            route: route ? {
                id: route._id,
                name: route.name,
                date: route.date,
                totalWaste: route.totalWaste,
                status: route.status
            } : null
        });

    } catch (error) {
        console.error('❌ Erro ao finalizar evento:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/events/:id/status - Atualizar status do evento baseado na rota
app.put('/api/events/:id/status', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        const event = await Event.findOne({ _id: req.params.id, userId: req.userId });

        if (!event) {
            return res.status(404).json({ error: 'Evento não encontrado' });
        }

        // Mapear status da rota para status do evento
        let eventStatus = event.status;
        switch (status) {
            case 'IN_PROGRESS':
                eventStatus = 'em_andamento';
                break;
            case 'COMPLETED':
                eventStatus = 'finalizado';
                break;
            case 'CANCELLED':
                eventStatus = 'cancelado';
                break;
            case 'PLANNED':
                eventStatus = 'coleta_agendada';
                break;
            default:
                eventStatus = status;
        }

        event.status = eventStatus;
        await event.save();

        console.log(`📌 Evento "${event.name}" atualizado: ${event.status}`);

        res.json({ success: true, event: { id: event._id, name: event.name, status: event.status } });
    } catch (error) {
        console.error('❌ Erro ao atualizar status do evento:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/events/:id - Deletar evento
app.delete('/api/events/:id', authenticateToken, async (req, res) => {
    try {
        const event = await Event.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!event) return res.status(404).json({ error: 'Evento não encontrado' });
        res.json({ message: 'Evento deletado com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao deletar evento:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTA DE IMPORTAÇÃO DE EVENTOS EXTERNOS ==========
app.post('/api/events/external/import/:eventId', authenticateToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const eventData = req.body;

        console.log('=========================================');
        console.log('📌 IMPORTANDO EVENTO EXTERNO');
        console.log('📌 eventId:', eventId);
        console.log('📌 eventData:', JSON.stringify(eventData, null, 2));
        console.log('=========================================');

        // VALIDAÇÕES INICIAIS
        if (!eventId || eventId === 'undefined' || eventId === 'null') {
            console.error('❌ eventId inválido');
            return res.status(400).json({ error: 'ID do evento é obrigatório' });
        }

        if (!eventData.name) {
            console.error('❌ Nome do evento não informado');
            return res.status(400).json({ error: 'Nome do evento é obrigatório' });
        }

        if (!eventData.startDate) {
            console.error('❌ Data de início não informada');
            return res.status(400).json({ error: 'Data de início é obrigatória' });
        }

        // CONVERTER DATAS CORRETAMENTE
        let startDate, endDate;
        try {
            // Se a data vier no formato ISO (YYYY-MM-DD)
            if (eventData.startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                startDate = new Date(eventData.startDate + 'T00:00:00-03:00');
            } else {
                startDate = new Date(eventData.startDate);
            }

            const endDateStr = eventData.endDate || eventData.startDate;
            if (endDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                endDate = new Date(endDateStr + 'T23:59:59-03:00');
            } else {
                endDate = new Date(endDateStr);
            }

            if (isNaN(startDate.getTime())) {
                throw new Error(`Data de início inválida: ${eventData.startDate}`);
            }
            if (isNaN(endDate.getTime())) {
                throw new Error(`Data de fim inválida: ${endDateStr}`);
            }

            console.log('📅 Datas convertidas:', { startDate, endDate });
        } catch (dateError) {
            console.error('❌ Erro ao converter datas:', dateError.message);
            return res.status(400).json({ error: `Erro nas datas: ${dateError.message}` });
        }

        // Verificar se evento já foi importado
        const existingEvent = await Event.findOne({ externalId: eventId, userId: req.userId });
        if (existingEvent) {
            console.log('⚠️ Evento já importado anteriormente');
            return res.status(400).json({ error: 'Este evento já foi importado anteriormente' });
        }

        // Buscar coordenadas
        let latitude = null;
        let longitude = null;
        let address = eventData.address || '';
        let city = eventData.city || 'Cotia';
        let state = eventData.state || 'SP';
        let zipCode = eventData.zipCode || '';

        console.log('🔍 Buscando coordenadas para:', { address, city, state, zipCode });

        if (zipCode) {
            const geoResult = await getCoordinatesByZipCode(zipCode);
            if (geoResult.success && geoResult.latitude && geoResult.longitude) {
                latitude = geoResult.latitude;
                longitude = geoResult.longitude;
                address = geoResult.address || address;
                city = geoResult.city || city;
                state = geoResult.state || state;
                console.log(`📍 Coordenadas via CEP: ${latitude}, ${longitude}`);
            }
        }

        if (!latitude || !longitude) {
            const searchAddress = `${address}, ${city}, ${state}, Brasil`;
            try {
                const nominatimResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
                    params: { q: searchAddress, format: 'json', limit: 1, countrycodes: 'br' },
                    headers: { 'User-Agent': 'EcoRoute/1.0' },
                    timeout: 8000
                });
                if (nominatimResponse.data && nominatimResponse.data.length > 0) {
                    latitude = parseFloat(nominatimResponse.data[0].lat);
                    longitude = parseFloat(nominatimResponse.data[0].lon);
                    console.log(`📍 Coordenadas via Nominatim: ${latitude}, ${longitude}`);
                }
            } catch (error) {
                console.log(`⚠️ Erro Nominatim: ${error.message}`);
            }
        }

        if (!latitude || !longitude) {
            latitude = -23.6022;
            longitude = -46.9194;
            console.log(`⚠️ Usando coordenadas padrão (Cotia): ${latitude}, ${longitude}`);
        }

        const locationObj = {
            type: 'Point',
            coordinates: [Number(longitude), Number(latitude)]
        };

        // Determinar tipo do evento
        let eventType = 'outro';
        const classification = eventData.classification || '';
        if (classification === 'Music') eventType = 'show';
        else if (classification === 'Sports') eventType = 'evento_esportivo';

        console.log('📝 Criando evento com os dados:');
        console.log('  - name:', eventData.name);
        console.log('  - type:', eventType);
        console.log('  - address:', address);
        console.log('  - city:', city);
        console.log('  - state:', state);
        console.log('  - startDate:', startDate);
        console.log('  - endDate:', endDate);

        // Criar evento com NOVOS CAMPOS
        const event = new Event({
            name: eventData.name,
            description: eventData.description || `Evento importado: ${eventData.name}`,
            type: eventType,
            address: address,
            city: city,
            state: state,
            zipCode: zipCode,
            location: locationObj,
            latitude: latitude,
            longitude: longitude,
            startDate: startDate,
            endDate: endDate,
            expectedAttendees: Number(eventData.expectedAttendees) || 5000,
            estimatedWaste: Number(eventData.estimatedWaste) || 2500,
            wasteCollected: 0,
            status: 'planejado',
            venueName: eventData.venueName || '',
            imageUrl: eventData.imageUrl || '',
            eventUrl: eventData.eventUrl || '',
            externalId: eventId,
            source: 'ticketmaster',
            userId: req.userId,
            // ========== NOVOS CAMPOS ==========
            responsible: eventData.responsible || '',
            contact: eventData.contact || '',
            scheduleTime: eventData.scheduleTime || '08:00',
            observations: eventData.observations || `Evento importado do Ticketmaster. Local: ${eventData.venueName || 'Não informado'}`
        });

        await event.save();
        console.log(`✅ Evento criado: ${event.name} (ID: ${event._id})`);

        // Criar ponto de coleta
        const point = new CollectionPoint({
            name: `${event.name} - Evento`,
            address: address,
            city: city,
            state: state,
            zipCode: zipCode,
            capacity: event.estimatedWaste * 2,
            currentVolume: 0,
            wasteTypes: ['plastico', 'papel', 'vidro', 'organico'],
            userId: req.userId,
            status: 'ACTIVE',
            location: locationObj
        });
        await point.save();
        console.log(`✅ Ponto de coleta criado: ${point.name}`);

        // Registrar coleta pendente
        const collection = new Collection({
            collectionPointId: point._id,
            wasteVolume: event.estimatedWaste,
            wasteType: 'outros',
            notes: `Coleta programada para o evento: ${event.name}.`,
            userId: req.userId,
            date: new Date()
        });
        await collection.save();
        console.log(`✅ Coleta registrada (pendente): ${event.estimatedWaste} kg`);

        // Criar rota
        const routeDate = getNextCollectionDate();

        const route = new Route({
            name: `${event.name} - Rota de Coleta`,
            description: `Coleta de resíduos do evento ${event.name}. Resíduos estimados: ${event.estimatedWaste} kg.`,
            date: routeDate,
            points: [{
                pointId: point._id,
                order: 1,
                estimatedVolume: event.estimatedWaste,
                actualVolume: 0,
                collectedAt: null
            }],
            totalDistance: 0,
            totalWaste: event.estimatedWaste,
            fuelConsumption: 0,
            carbonFootprint: event.estimatedWaste * 0.13,
            status: 'PLANNED',
            source: 'events',
            userId: req.userId,
            eventInfo: {
                eventId: event._id,
                eventName: event.name,
                eventDate: event.startDate,
                eventLocation: address
            }
        });
        await route.save();
        console.log(`✅ Rota criada: ${route.name}`);

        event.routeId = route._id;
        event.scheduledCollectionDate = routeDate;
        await event.save();

        console.log('✅ IMPORTAÇÃO CONCLUÍDA COM SUCESSO!');
        console.log('=========================================');

        res.status(201).json({
            success: true,
            message: `Evento "${event.name}" importado com sucesso!`,
            event: {
                id: event._id,
                name: event.name,
                date: event.startDate,
                estimatedWaste: event.estimatedWaste,
                address: event.address,
                city: event.city,
                responsible: event.responsible,
                contact: event.contact,
                scheduleTime: event.scheduleTime,
                observations: event.observations
            },
            point: { id: point._id, name: point.name },
            route: { id: route._id, name: route.name, date: route.date }
        });

    } catch (error) {
        console.error('❌ Erro ao importar evento:', error);
        console.error('❌ Stack:', error.stack);

        // Enviar erro detalhado
        res.status(500).json({
            error: error.message,
            details: error.errors ? Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message
            })) : null
        });
    }
});

// ============================================
// ========== ROTAS DE DETECÇÃO (YOLO) ==========
// ============================================

// Configuração do serviço YOLO
const YOLO_SERVICE_URL = process.env.YOLO_SERVICE_URL || 'http://localhost:5001';
const FormData = require('form-data');

// Middleware para upload de arquivos (se não tiver)
const multer = require('multer');
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/**
 * POST /api/detect
 * Detecta resíduos em uma imagem enviada
 * 
 * @param {file} image - Arquivo de imagem (jpg, png)
 * @returns {Object} Lista de resíduos detectados + frases de conscientização
 */
app.post('/api/detect', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhuma imagem enviada' });
        }

        console.log(`🔍 Detectando resíduos na imagem: ${req.file.originalname} (${req.file.size} bytes)`);

        // Criar form-data para enviar ao serviço Python
        const formData = new FormData();
        formData.append('image', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        // Chamar serviço YOLO
        const response = await axios.post(`${YOLO_SERVICE_URL}/detect`, formData, {
            headers: {
                ...formData.getHeaders(),
                'Content-Type': 'multipart/form-data'
            },
            timeout: 30000 // 30 segundos
        });

        console.log(`✅ Detecção concluída: ${response.data.total_residuos} resíduos encontrados`);

        // Retornar resultado com frases de conscientização
        res.json({
            success: true,
            deteccoes: response.data.deteccoes,
            total_residuos: response.data.total_residuos,
            resumo_por_tipo: response.data.resumo_por_tipo,
            frases_conscientizacao: response.data.frases_conscientizacao,
            impacto_estimado: response.data.impacto_estimado,
            modo: response.data.modo
        });

    } catch (error) {
        console.error('❌ Erro na detecção:', error.message);
        
        // Fallback: simular detecção se o serviço Python estiver offline
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            console.log('⚠️ Serviço YOLO offline, usando simulação local');
            
            const simulacao = {
                success: true,
                deteccoes: [
                    { tipo: 'plastico', confianca: 0.87 },
                    { tipo: 'papel', confianca: 0.92 },
                    { tipo: 'vidro', confianca: 0.76 }
                ],
                total_residuos: 3,
                resumo_por_tipo: { plastico: 1, papel: 1, vidro: 1 },
                frases_conscientizacao: [
                    "💚 Uma garrafa PET leva mais de 400 anos para se decompor!",
                    "♻️ Reciclar 1 tonelada de plástico economiza 5.000 kWh de energia.",
                    "🌱 Pequenas atitudes mudam o mundo!"
                ],
                impacto_estimado: {
                    co2_evitado_kg: 2.8,
                    energia_economizada_kwh: 11,
                    agua_economizada_litros: 310,
                    arvores_preservadas: 0.05
                },
                modo: 'simulacao_fallback'
            };
            
            return res.json(simulacao);
        }
        
        res.status(500).json({ error: 'Erro ao processar imagem', details: error.message });
    }
});

/**
 * POST /api/detect/base64
 * Detecta resíduos em uma imagem em base64 (para mobile)
 */
app.post('/api/detect/base64', authenticateToken, async (req, res) => {
    try {
        const { image } = req.body;
        
        if (!image) {
            return res.status(400).json({ error: 'Nenhuma imagem em base64 fornecida' });
        }

        console.log(`🔍 Detectando resíduos via base64`);

        // Chamar serviço YOLO
        const response = await axios.post(`${YOLO_SERVICE_URL}/detect`, { image }, {
            timeout: 30000
        });

        res.json({
            success: true,
            deteccoes: response.data.deteccoes,
            total_residuos: response.data.total_residuos,
            resumo_por_tipo: response.data.resumo_por_tipo,
            frases_conscientizacao: response.data.frases_conscientizacao,
            impacto_estimado: response.data.impacto_estimado
        });

    } catch (error) {
        console.error('❌ Erro na detecção base64:', error.message);
        res.status(500).json({ error: 'Erro ao processar imagem' });
    }
});

/**
 * GET /api/detect/frases
 * Retorna frases de conscientização aleatórias
 */
app.get('/api/detect/frases', authenticateToken, async (req, res) => {
    try {
        const { tipo, quantidade = 1 } = req.query;
        
        let url = `${YOLO_SERVICE_URL}/frases`;
        if (tipo) url += `?tipo=${tipo}`;
        
        const response = await axios.get(url, { timeout: 5000 });
        
        // Pegar frases aleatórias
        let frases = [];
        if (tipo && response.data[tipo]) {
            frases = response.data[tipo];
        } else {
            // Misturar frases de todos os tipos
            const todasFrases = [];
            for (const key in response.data) {
                if (Array.isArray(response.data[key])) {
                    todasFrases.push(...response.data[key]);
                }
            }
            frases = todasFrases;
        }
        
        // Embaralhar e pegar a quantidade solicitada
        const shuffled = frases.sort(() => 0.5 - Math.random());
        const selecionadas = shuffled.slice(0, parseInt(quantidade));
        
        res.json({
            success: true,
            frases: selecionadas,
            total_disponiveis: frases.length
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar frases:', error.message);
        
        // Fallback local
        const frasesLocal = [
            "♻️ Reciclar é transformar o que seria lixo em novo recurso!",
            "🌍 Pequenas atitudes mudam o mundo! Recicle seus resíduos.",
            "💚 Uma garrafa PET leva mais de 400 anos para se decompor.",
            "🌱 O futuro do planeta depende das nossas escolhas hoje."
        ];
        
        res.json({
            success: true,
            frases: frasesLocal.slice(0, parseInt(quantidade)),
            modo: 'fallback'
        });
    }
});

/**
 * GET /api/detect/health
 * Verifica se o serviço YOLO está ativo
 */
app.get('/api/detect/health', authenticateToken, async (req, res) => {
    try {
        const response = await axios.get(`${YOLO_SERVICE_URL}/health`, { timeout: 3000 });
        res.json({
            yolo_service: 'online',
            modo: response.data.modo,
            versao: response.data.versao,
            frases_disponiveis: response.data.frases_disponiveis
        });
    } catch (error) {
        res.json({
            yolo_service: 'offline',
            modo: 'simulacao_local',
            fallback: true
        });
    }
});

// ========== ROTAS DE MENSAGENS ==========
app.post('/api/messages', authenticateToken, async (req, res) => {
    try { const { content, room, recipient } = req.body; const message = new Message({ content, room: room || 'geral', sender: req.userId, senderName: req.user.name, recipient }); await message.save(); io.emit('new-message', { ...message.toJSON(), timestamp: new Date() }); res.status(201).json({ message: 'Mensagem enviada com sucesso', data: message }); }
    catch (error) { res.status(500).json({ error: 'Erro ao enviar mensagem' }); }
});

app.get('/api/messages/:room', authenticateToken, async (req, res) => {
    try { const { room } = req.params; const { limit = 50 } = req.query; const messages = await Message.find({ room }).sort({ createdAt: -1 }).limit(parseInt(limit)); res.json(messages.reverse()); }
    catch (error) { res.status(500).json({ error: 'Erro ao buscar mensagens' }); }
});

// ========== ROTAS DE NOTIFICAÇÕES ==========
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try { const notifications = await Notification.find({ user: req.userId }).sort({ createdAt: -1 }).limit(50); const unreadCount = await Notification.countDocuments({ user: req.userId, read: false }); res.json({ notifications, unreadCount }); }
    catch (error) { res.status(500).json({ error: 'Erro ao buscar notificações' }); }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try { await Notification.findByIdAndUpdate(req.params.id, { read: true, readAt: new Date() }); res.json({ message: 'Notificação marcada como lida' }); }
    catch (error) { res.status(500).json({ error: 'Erro ao marcar notificação' }); }
});

app.patch('/api/notifications/read-all', authenticateToken, async (req, res) => {
    try { await Notification.updateMany({ user: req.userId, read: false }, { read: true, readAt: new Date() }); res.json({ message: 'Todas notificações marcadas como lidas' }); }
    catch (error) { res.status(500).json({ error: 'Erro ao marcar notificações' }); }
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
    try { await Notification.findOneAndDelete({ _id: req.params.id, user: req.userId }); res.json({ message: 'Notificação removida' }); }
    catch (error) { res.status(500).json({ error: 'Erro ao remover notificação' }); }
});

// ========== ROTAS PÚBLICAS ==========
app.get('/', (req, res) => { res.json({ nome: 'EcoRoute API', versao: '2.0.0', status: 'online' }); });
app.get('/api/health', (req, res) => { res.json({ status: 'OK', database: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado' }); });

// ========== TRATAMENTO DE ERROS ==========
app.use('*', (req, res) => { res.status(404).json({ error: 'Rota não encontrada', path: req.originalUrl }); });
app.use((err, req, res, next) => { console.error('❌ Erro global:', err.message); res.status(500).json({ error: 'Erro interno do servidor' }); });

// ========== INICIAR SERVIDOR ==========
server.listen(PORT, () => {
    console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📌 GET /api/geocode/zipcode/:zipcode - Buscar endereço por CEP`);
    console.log(`📌 POST /api/points - Criar ponto de coleta`);
    console.log(`📌 POST /api/collections - Registrar coleta`);
    console.log(`📌 POST /api/routes/generate-from-points - Gerar rota dos pontos`);
    console.log(`📌 POST /api/routes/generate-from-events - Gerar rota de eventos`);
    console.log(`📌 POST /api/routes/link-points - Vincular pontos`);
    console.log(`📌 GET /api/events/external/search - Buscar eventos externos`);
});

module.exports = app;