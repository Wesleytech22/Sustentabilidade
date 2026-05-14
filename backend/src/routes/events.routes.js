const express = require('express');
const router = express.Router();
const Event = require('../models/Events');
const jwt = require('jsonwebtoken');

// Middleware de autenticação
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const User = require('../models/User');
        const user = await User.findById(decoded.id).select('-password');

        if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });

        req.user = user;
        req.userId = user._id;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

// GET /api/events/external/search - Buscar eventos externos
router.get('/external/search', authenticateToken, async (req, res) => {
    try {
        const { keyword, city, classification } = req.query;

        console.log('🔍 Buscando eventos externos:', { keyword, city, classification });

        const mockEvents = [
            {
                id: '1',
                name: keyword ? `Evento: ${keyword}` : 'Rock in Rio 2026',
                city: city || 'Rio de Janeiro',
                state: 'RJ',
                country: 'Brasil',
                startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                description: 'O maior festival de música do Brasil!',
                classification: classification || 'music',
                expectedAttendees: 100000
            },
            {
                id: '2',
                name: 'Festival de Tecnologia',
                city: city || 'São Paulo',
                state: 'SP',
                country: 'Brasil',
                startDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
                description: 'O maior evento de tecnologia da América Latina',
                classification: classification || 'conference',
                expectedAttendees: 50000
            },
            {
                id: '3',
                name: 'Copa do Mundo de Futebol',
                city: city || 'Brasília',
                state: 'DF',
                country: 'Brasil',
                startDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
                description: 'Partidas emocionantes do campeonato mundial',
                classification: classification || 'sports',
                expectedAttendees: 70000
            },
            {
                id: '4',
                name: 'Feira de Artesanato',
                city: city || 'Salvador',
                state: 'BA',
                country: 'Brasil',
                startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                description: 'Artesanato local e cultura nordestina',
                classification: classification || 'arts',
                expectedAttendees: 15000
            }
        ];

        let filteredEvents = mockEvents;
        if (classification && classification !== '') {
            filteredEvents = mockEvents.filter(e => e.classification === classification);
        }

        res.json({ success: true, events: filteredEvents, source: 'mock' });
    } catch (error) {
        console.error('❌ Erro ao buscar eventos:', error);
        res.status(500).json({ error: 'Erro ao buscar eventos' });
    }
});

// GET /api/events/external/classification/:name - Buscar por classificação
router.get('/external/classification/:name', authenticateToken, async (req, res) => {
    try {
        const { name } = req.params;

        const classificationEvents = {
            music: [
                { id: 'music1', name: 'Lollapalooza', city: 'São Paulo', state: 'SP', startDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), classification: 'music', expectedAttendees: 80000 },
                { id: 'music2', name: 'Rock in Rio', city: 'Rio de Janeiro', state: 'RJ', startDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), classification: 'music', expectedAttendees: 100000 }
            ],
            sports: [
                { id: 'sports1', name: 'Final do Brasileirão', city: 'São Paulo', state: 'SP', startDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), classification: 'sports', expectedAttendees: 50000 }
            ],
            conference: [
                { id: 'conf1', name: 'Web Summit', city: 'Rio de Janeiro', state: 'RJ', startDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(), classification: 'conference', expectedAttendees: 40000 }
            ],
            festival: [
                { id: 'fest1', name: 'Oktoberfest', city: 'Blumenau', state: 'SC', startDate: new Date(Date.now() + 270 * 24 * 60 * 60 * 1000).toISOString(), classification: 'festival', expectedAttendees: 500000 }
            ],
            arts: [
                { id: 'arts1', name: 'Bienal de Artes', city: 'São Paulo', state: 'SP', startDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString(), classification: 'arts', expectedAttendees: 20000 }
            ]
        };

        const events = classificationEvents[name] || [
            { id: `${name}_mock`, name: `Eventos de ${name}`, city: 'São Paulo', state: 'SP', startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), classification: name, expectedAttendees: 10000 }
        ];

        res.json({ success: true, events: events, classification: name, total: events.length });
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ error: 'Erro ao buscar eventos por classificação' });
    }
});

// POST /api/events/external/import/:eventId - Importar evento externo
router.post('/external/import/:eventId', authenticateToken, async (req, res) => {
    try {
        const { eventId } = req.params;

        console.log(`📥 Importando evento: ${eventId}`);

        const mockEventsMap = {
            '1': { name: 'Rock in Rio 2026', city: 'Rio de Janeiro', state: 'RJ', classification: 'music', expectedAttendees: 100000 },
            '2': { name: 'Festival de Tecnologia', city: 'São Paulo', state: 'SP', classification: 'conference', expectedAttendees: 50000 },
            '3': { name: 'Copa do Mundo de Futebol', city: 'Brasília', state: 'DF', classification: 'sports', expectedAttendees: 70000 },
            '4': { name: 'Feira de Artesanato', city: 'Salvador', state: 'BA', classification: 'arts', expectedAttendees: 15000 },
            'music1': { name: 'Lollapalooza', city: 'São Paulo', state: 'SP', classification: 'music', expectedAttendees: 80000 },
            'music2': { name: 'Rock in Rio', city: 'Rio de Janeiro', state: 'RJ', classification: 'music', expectedAttendees: 100000 },
            'sports1': { name: 'Final do Brasileirão', city: 'São Paulo', state: 'SP', classification: 'sports', expectedAttendees: 50000 },
            'conf1': { name: 'Web Summit', city: 'Rio de Janeiro', state: 'RJ', classification: 'conference', expectedAttendees: 40000 },
            'fest1': { name: 'Oktoberfest', city: 'Blumenau', state: 'SC', classification: 'festival', expectedAttendees: 500000 },
            'arts1': { name: 'Bienal de Artes', city: 'São Paulo', state: 'SP', classification: 'arts', expectedAttendees: 20000 }
        };

        const mockData = mockEventsMap[eventId] || {
            name: 'Evento Importado',
            city: 'São Paulo',
            state: 'SP',
            classification: 'evento',
            expectedAttendees: 10000
        };

        const existingEvent = await Event.findOne({ externalId: eventId, userId: req.userId });
        if (existingEvent) {
            return res.status(400).json({ error: 'Evento já foi importado anteriormente' });
        }

        const event = new Event({
            name: mockData.name,
            description: `Evento ${mockData.name} importado do sistema externo`,
            type: mockData.classification,
            address: 'Endereço não informado',
            city: mockData.city,
            state: mockData.state,
            startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
            expectedAttendees: mockData.expectedAttendees,
            estimatedWaste: Math.floor(mockData.expectedAttendees * 0.5),
            wasteCollected: 0,
            userId: req.userId,
            status: 'agendado',
            externalId: eventId,
            source: 'mock'
        });

        await event.save();

        console.log(`✅ Evento importado: ${event.name}`);

        res.status(201).json({
            success: true,
            event: {
                id: event._id,
                name: event.name,
                city: event.city,
                state: event.state,
                startDate: event.startDate,
                expectedAttendees: event.expectedAttendees,
                status: event.status
            },
            message: `Evento "${event.name}" importado com sucesso!`
        });
    } catch (error) {
        console.error('❌ Erro ao importar evento:', error);
        res.status(500).json({ error: 'Erro ao importar evento' });
    }
});

module.exports = router;