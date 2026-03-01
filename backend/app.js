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

// ========== SCHEMAS ==========

// Schema do Usuário
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: 'COOPERATIVE' },
    phone: String,
    city: String,
    state: String
}, { timestamps: true });

// Schema do Ponto de Coleta
const collectionPointSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    neighborhood: String,
    city: String,
    state: String,
    latitude: Number,
    longitude: Number,
    wasteTypes: [String],
    capacity: { type: Number, required: true },
    currentVolume: { type: Number, default: 0 },
    status: { type: String, default: 'ACTIVE' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Schema da Rota
const routeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    date: { type: Date, default: Date.now },
    status: { type: String, default: 'PLANNED' },
    points: [{
        pointId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionPoint' },
        order: Number,
        estimatedVolume: Number
    }],
    totalDistance: { type: Number, default: 0 },
    totalWaste: { type: Number, default: 0 },
    fuelConsumption: { type: Number, default: 0 },
    carbonFootprint: { type: Number, default: 0 },
    vehicleType: { type: String, default: 'truck' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Schema da Coleta
const collectionSchema = new mongoose.Schema({
    collectionPointId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionPoint', required: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
    date: { type: Date, default: Date.now },
    wasteVolume: { type: Number, required: true },
    wasteType: String,
    notes: String
}, { timestamps: true });

// Criar modelos
const User = mongoose.model('User', userSchema);
const CollectionPoint = mongoose.model('CollectionPoint', collectionPointSchema);
const Route = mongoose.model('Route', routeSchema);
const Collection = mongoose.model('Collection', collectionSchema);

// ========== MIDDLEWARE DE AUTENTICAÇÃO ==========

const authenticateToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        req.userId = decoded.id;
        req.userRole = decoded.role;
        
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

// ========== ROTAS DE AUTENTICAÇÃO ==========

// ROTA DE REGISTRO - POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, phone, city, state } = req.body;

        // Validações
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
            state,
            role: 'COOPERATIVE'
        });

        await user.save();

        // Gerar token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        // Retornar usuário sem senha
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

// ROTA DE LOGIN - POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validações
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

        // Gerar token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        // Retornar usuário sem senha
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

// ROTA DE PERFIL - GET /api/auth/profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json(user);
    } catch (error) {
        console.error('❌ Erro no perfil:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ========== ROTAS DE PONTOS DE COLETA ==========

// Criar ponto de coleta
// Criar ponto de coleta - VERSÃO COM DEBUG
app.post('/api/points', authenticateToken, async (req, res) => {
    try {
        console.log('='.repeat(50));
        console.log('📥 REQUISIÇÃO RECEBIDA - Criar Ponto');
        console.log('📌 Headers:', req.headers.authorization ? 'Token presente' : 'Sem token');
        console.log('👤 userId:', req.userId);
        console.log('📦 Dados recebidos:', JSON.stringify(req.body, null, 2));
        
        const pointData = {
            ...req.body,
            userId: req.userId
        };

        // Validar dados obrigatórios
        if (!pointData.name || !pointData.address || !pointData.city || !pointData.state || !pointData.capacity) {
            console.log('❌ Erro de validação: campos obrigatórios faltando');
            return res.status(400).json({ 
                error: 'Campos obrigatórios: name, address, city, state, capacity' 
            });
        }

        // Converter tipos de dados
        if (pointData.capacity) pointData.capacity = Number(pointData.capacity);
        if (pointData.latitude) pointData.latitude = Number(pointData.latitude);
        if (pointData.longitude) pointData.longitude = Number(pointData.longitude);
        if (pointData.currentVolume) pointData.currentVolume = Number(pointData.currentVolume);

        console.log('📦 Dados processados:', JSON.stringify(pointData, null, 2));

        const point = new CollectionPoint(pointData);
        await point.save();

        console.log('✅ Ponto criado com sucesso! ID:', point._id);
        console.log('='.repeat(50));

        res.status(201).json({ 
            point, 
            message: 'Ponto de coleta criado com sucesso' 
        });
    } catch (error) {
        console.error('❌ Erro ao criar ponto:', error);
        
        // Erro de validação do mongoose
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ error: errors.join(', ') });
        }
        
        // Erro de duplicata
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Já existe um ponto com estes dados' });
        }
        
        res.status(500).json({ error: error.message || 'Erro ao criar ponto de coleta' });
    }
});

// Listar pontos de coleta do usuário
app.get('/api/points', authenticateToken, async (req, res) => {
    try {
        const points = await CollectionPoint.find({ userId: req.userId });
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
        res.status(500).json({ error: 'Erro ao buscar ponto de coleta' });
    }
});

// Atualizar ponto
app.put('/api/points/:id', authenticateToken, async (req, res) => {
    try {
        const point = await CollectionPoint.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            req.body,
            { new: true }
        );
        
        if (!point) {
            return res.status(404).json({ error: 'Ponto não encontrado' });
        }
        
        res.json({ point, message: 'Ponto atualizado com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao atualizar ponto:', error);
        res.status(500).json({ error: 'Erro ao atualizar ponto de coleta' });
    }
});

// Deletar ponto
app.delete('/api/points/:id', authenticateToken, async (req, res) => {
    try {
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
        const routes = await Route.find({ userId: req.userId })
            .populate('points.pointId');
        res.json(routes);
    } catch (error) {
        console.error('❌ Erro ao listar rotas:', error);
        res.status(500).json({ error: 'Erro ao listar rotas' });
    }
});

// Buscar rota por ID
app.get('/api/routes/:id', authenticateToken, async (req, res) => {
    try {
        const route = await Route.findOne({ 
            _id: req.params.id, 
            userId: req.userId 
        }).populate('points.pointId');
        
        if (!route) {
            return res.status(404).json({ error: 'Rota não encontrada' });
        }
        
        res.json(route);
    } catch (error) {
        console.error('❌ Erro ao buscar rota:', error);
        res.status(500).json({ error: 'Erro ao buscar rota' });
    }
});

// Atualizar rota
app.put('/api/routes/:id', authenticateToken, async (req, res) => {
    try {
        const route = await Route.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            req.body,
            { new: true }
        );
        
        if (!route) {
            return res.status(404).json({ error: 'Rota não encontrada' });
        }
        
        res.json({ route, message: 'Rota atualizada com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao atualizar rota:', error);
        res.status(500).json({ error: 'Erro ao atualizar rota' });
    }
});

// Deletar rota
app.delete('/api/routes/:id', authenticateToken, async (req, res) => {
    try {
        const route = await Route.findOneAndDelete({ 
            _id: req.params.id, 
            userId: req.userId 
        });
        
        if (!route) {
            return res.status(404).json({ error: 'Rota não encontrada' });
        }
        
        res.json({ message: 'Rota deletada com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao deletar rota:', error);
        res.status(500).json({ error: 'Erro ao deletar rota' });
    }
});

// ========== ROTAS DE COLETAS ==========

// Registrar coleta
app.post('/api/collections', authenticateToken, async (req, res) => {
    try {
        const collection = new Collection(req.body);
        await collection.save();

        // Atualizar volume atual do ponto de coleta
        await CollectionPoint.findByIdAndUpdate(
            req.body.collectionPointId,
            { $inc: { currentVolume: req.body.wasteVolume } }
        );

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
        const collections = await Collection.find()
            .populate('collectionPointId')
            .populate('routeId');
        res.json(collections);
    } catch (error) {
        console.error('❌ Erro ao listar coletas:', error);
        res.status(500).json({ error: 'Erro ao listar coletas' });
    }
});

// ========== ROTAS DE DASHBOARD ==========

// Estatísticas do dashboard
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const points = await CollectionPoint.countDocuments({ userId: req.userId });
        const routes = await Route.countDocuments({ userId: req.userId, status: 'ACTIVE' });
        
        const collections = await Collection.find()
            .populate({
                path: 'collectionPointId',
                match: { userId: req.userId }
            });

        const totalWaste = collections.reduce((sum, c) => sum + (c.wasteVolume || 0), 0);
        const totalCarbon = routes * 65; // Cálculo simplificado

        res.json({
            points,
            routes,
            totalWaste,
            totalCarbon,
            collections: collections.length
        });
    } catch (error) {
        console.error('❌ Erro ao carregar stats:', error);
        res.status(500).json({ error: 'Erro ao carregar estatísticas' });
    }
});

// Dados para gráficos
app.get('/api/dashboard/charts', authenticateToken, async (req, res) => {
    try {
        // Dados de exemplo - você pode implementar a lógica real depois
        const wasteByType = [
            { type: 'Plástico', volume: 850 },
            { type: 'Papel', volume: 1200 },
            { type: 'Vidro', volume: 400 },
            { type: 'Metal', volume: 650 }
        ];

        const impactData = [
            { month: 'Jan', carbon: 120 },
            { month: 'Fev', carbon: 190 },
            { month: 'Mar', carbon: 300 },
            { month: 'Abr', carbon: 450 },
            { month: 'Mai', carbon: 520 },
            { month: 'Jun', carbon: 324 }
        ];

        res.json({ wasteByType, impactData });
    } catch (error) {
        console.error('❌ Erro ao carregar gráficos:', error);
        res.status(500).json({ error: 'Erro ao carregar dados dos gráficos' });
    }
});

// ========== ROTAS DE IMPACTO AMBIENTAL ==========

app.get('/api/impact', authenticateToken, async (req, res) => {
    try {
        const collections = await Collection.find()
            .populate({
                path: 'collectionPointId',
                match: { userId: req.userId }
            });

        const totalWaste = collections.reduce((sum, c) => sum + (c.wasteVolume || 0), 0);
        
        // Cálculos de impacto (simplificados)
        const treesSaved = Math.floor(totalWaste * 0.02); // 1 árvore a cada 50kg
        const waterSaved = totalWaste * 5; // 5L de água por kg reciclado
        const energySaved = totalWaste * 0.35; // 0.35 kWh por kg

        res.json({
            treesSaved,
            waterSaved: Math.floor(waterSaved),
            energySaved: Math.floor(energySaved),
            carbonSaved: Math.floor(totalWaste * 0.13) // 0.13 kg CO2 por kg
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
        database: 'MongoDB Atlas',
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
                criar: 'POST /api/routes (auth)'
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
        database: 'MongoDB Atlas',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// ========== TRATAMENTO DE ERROS ==========

// 404
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Rota não encontrada',
        path: req.originalUrl,
        method: req.method
    });
});

// Middleware de erro global
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