const express = require('express');
const router = express.Router();
const Event = require('../models/Events');
const externalEventService = require('../../services/externalEventService');
const jwt = require('jsonwebtoken');
// NÃO importe Route aqui - será acessado via app.js

// ========== MESMO MIDDLEWARE DO APP.JS ==========
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token não fornecido ou formato inválido' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const User = require('../models/User');
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

// ========== ROTAS ==========

// GET /api/events - Listar eventos
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status, city } = req.query;
        const filter = { userId: req.userId };
        
        if (status) filter.status = status;
        if (city) filter.city = city;
        
        const events = await Event.find(filter).sort({ startDate: -1 });
        
        res.json(events || []);
    } catch (error) {
        console.error('❌ Erro ao listar eventos:', error);
        res.status(500).json({ error: 'Erro ao listar eventos' });
    }
});

// POST /api/events - Criar evento
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            name, description, type, address, city, state,
            startDate, endDate, expectedAttendees, estimatedWaste
        } = req.body;

        if (!name || !address || !city || !state || !startDate || !endDate || !expectedAttendees) {
            return res.status(400).json({ 
                error: 'Campos obrigatórios: name, address, city, state, startDate, endDate, expectedAttendees' 
            });
        }

        const event = new Event({
            name,
            description: description || '',
            type: type || 'outro',
            address,
            city,
            state: state.toUpperCase(),
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            expectedAttendees: Number(expectedAttendees),
            estimatedWaste: estimatedWaste ? Number(estimatedWaste) : Math.floor(Number(expectedAttendees) * 0.5),
            wasteCollected: 0,
            userId: req.userId,
            status: 'agendado'
        });

        await event.save();

        res.status(201).json({ 
            success: true, 
            event, 
            message: 'Evento criado com sucesso' 
        });
    } catch (error) {
        console.error('❌ Erro ao criar evento:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: Object.values(error.errors).map(e => e.message).join(', ') });
        }
        
        res.status(500).json({ error: 'Erro interno ao criar evento' });
    }
});

// POST /api/events/:id/finish - Finalizar evento
router.post('/:id/finish', authenticateToken, async (req, res) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, userId: req.userId });
        
        if (!event) {
            return res.status(404).json({ error: 'Evento não encontrado' });
        }
        
        if (event.status !== 'agendado' && event.status !== 'em_andamento') {
            return res.status(400).json({ error: 'Evento não pode ser finalizado' });
        }
        
        event.status = 'finalizado';
        await event.save();
        
        res.json({ success: true, event, message: 'Evento finalizado com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao finalizar evento:', error);
        res.status(500).json({ error: 'Erro ao finalizar evento' });
    }
});

// POST /api/events/generate-routes - VERSÃO SIMPLIFICADA PARA TESTE
// POST /api/events/generate-routes - VERSÃO COMPLETA
router.post('/generate-routes', authenticateToken, async (req, res) => {
    try {
        console.log('🔍 Buscando eventos finalizados...');
        
        const finishedEvents = await Event.find({ 
            userId: req.userId, 
            status: 'finalizado' 
        });
        
        console.log(`📊 Encontrados ${finishedEvents.length} eventos finalizados`);
        
        if (finishedEvents.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Nenhum evento finalizado aguardando coleta',
                eventsCount: 0
            });
        }
        
        // Importar o modelo Route
        const Route = require('../models/Route');
        
        // Criar a rota
        const newRoute = new Route({
            name: `Coleta Pós-Eventos - ${new Date().toLocaleDateString('pt-BR')}`,
            description: `Rota gerada automaticamente para coleta de resíduos de ${finishedEvents.length} evento(s)`,
            date: new Date(),
            points: finishedEvents.map((event, index) => ({
                pointId: event._id,
                order: index + 1,
                estimatedVolume: event.estimatedWaste || 500,
                distance: 0,
                duration: 0
            })),
            totalDistance: 0,
            totalWaste: finishedEvents.reduce((sum, e) => sum + (e.estimatedWaste || 0), 0),
            fuelConsumption: 0,
            carbonFootprint: 0,
            vehicleType: 'truck',
            status: 'PLANNED',
            userId: req.userId
        });
        
        await newRoute.save();
        console.log(`✅ Rota criada com ID: ${newRoute._id}`);
        
        // Atualizar eventos
        for (const event of finishedEvents) {
            event.status = 'coleta_agendada';
            event.scheduledCollectionDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            event.routeId = newRoute._id;
            await event.save();
        }
        
        res.json({ 
            success: true, 
            route: newRoute,
            eventsCount: finishedEvents.length,
            message: `${finishedEvents.length} eventos prontos para coleta. Rota criada com sucesso!` 
        });
        
    } catch (error) {
        console.error('❌ Erro detalhado ao gerar rotas:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/events/:id - Deletar evento
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const event = await Event.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        
        if (!event) {
            return res.status(404).json({ error: 'Evento não encontrado' });
        }
        
        res.json({ success: true, message: 'Evento deletado com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao deletar evento:', error);
        res.status(500).json({ error: 'Erro ao deletar evento' });
    }
});

// ========== ROTAS DE INTEGRAÇÃO EXTERNA ==========

// Buscar eventos de APIs externas (Ticketmaster)
router.get('/external/search', authenticateToken, async (req, res) => {
    try {
        const { countryCode, city, keyword, classification, lat, long, radius } = req.query;
        
        let result;
        
        if (lat && long) {
            result = await externalEventService.searchEventsByLocation({
                lat: parseFloat(lat),
                long: parseFloat(long),
                radius: radius || '50km',
                size: 50
            });
        }
        else if (classification) {
            result = await externalEventService.searchEventsByClassification({
                classificationName: classification,
                countryCode: countryCode || 'BR',
                size: 50
            });
        }
        else {
            result = await externalEventService.searchEvents({
                countryCode: countryCode || 'BR',
                city,
                keyword,
                size: 50
            });
        }
        
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }
        
        res.json({
            success: true,
            events: result.events,
            totalPages: result.totalPages,
            totalElements: result.totalElements,
            source: 'ticketmaster'
        });
    } catch (error) {
        console.error('❌ Erro ao buscar eventos externos:', error);
        res.status(500).json({ error: 'Erro ao buscar eventos externos' });
    }
});

// Importar evento externo para o sistema
router.post('/external/import/:eventId', authenticateToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        
        const externalEvent = await externalEventService.getEventById(eventId);
        
        if (!externalEvent) {
            return res.status(404).json({ error: 'Evento não encontrado na API externa' });
        }
        
        const existingEvent = await Event.findOne({ 
            externalId: eventId, 
            source: 'ticketmaster',
            userId: req.userId 
        });
        
        if (existingEvent) {
            return res.status(400).json({ error: 'Evento já foi importado anteriormente' });
        }
        
        const event = new Event({
            name: externalEvent.name,
            description: externalEvent.description,
            type: externalEvent.type,
            address: externalEvent.address,
            city: externalEvent.city,
            state: externalEvent.state,
            latitude: externalEvent.latitude,
            longitude: externalEvent.longitude,
            startDate: new Date(externalEvent.startDate),
            endDate: new Date(externalEvent.endDate),
            expectedAttendees: externalEvent.expectedAttendees,
            estimatedWaste: externalEvent.estimatedWaste,
            userId: req.userId,
            status: 'agendado',
            externalId: externalEvent.externalId,
            source: externalEvent.source,
            externalData: externalEvent
        });
        
        await event.save();
        
        res.status(201).json({
            success: true,
            event,
            message: `Evento "${event.name}" importado com sucesso!`
        });
    } catch (error) {
        console.error('❌ Erro ao importar evento:', error);
        res.status(500).json({ error: 'Erro ao importar evento' });
    }
});

// Buscar eventos por classificação
router.get('/external/classification/:name', authenticateToken, async (req, res) => {
    try {
        const { name } = req.params;
        const { countryCode = 'BR' } = req.query;
        
        const result = await externalEventService.searchEventsByClassification({
            classificationName: name,
            countryCode,
            size: 50
        });
        
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }
        
        res.json({
            success: true,
            events: result.events,
            classification: name,
            total: result.events.length
        });
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ error: 'Erro ao buscar eventos por classificação' });
    }
});

module.exports = router;