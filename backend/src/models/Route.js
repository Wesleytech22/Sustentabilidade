// backend/src/routes/route.js
const express = require('express');
const router = express.Router();
const Route = require('../models/Route');
const Event = require('../models/Event');

// Middleware de autenticação (se tiver)
const auth = require('../middleware/auth');

// GET - Listar todas as rotas do usuário
router.get('/', auth, async (req, res) => {
  try {
    const routes = await Route.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(routes);
  } catch (error) {
    console.error('Erro ao buscar rotas:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Buscar uma rota específica
router.get('/:id', auth, async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) {
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    if (route.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Criar rota a partir de eventos finalizados
router.post('/generate-from-events', auth, async (req, res) => {
  try {
    console.log('🔍 Buscando eventos finalizados...');
    
    // Buscar eventos finalizados do usuário
    const completedEvents = await Event.find({ 
      status: 'COMPLETED',
      userId: req.userId 
    });
    
    console.log(`📊 Encontrados ${completedEvents.length} eventos finalizados`);
    
    if (completedEvents.length === 0) {
      return res.status(404).json({ 
        error: 'Nenhum evento finalizado encontrado para gerar rota' 
      });
    }
    
    // Criar uma rota para cada evento finalizado
    const createdRoutes = [];
    
    for (const event of completedEvents) {
      const routeData = {
        name: `Coleta Pós-Evento: ${event.name}`,
        description: `Rota gerada automaticamente para coleta de resíduos do evento: ${event.name}`,
        date: new Date(),
        status: 'PLANNED',
        totalWaste: event.wasteCollected || event.estimatedWaste || 0,
        totalDistance: 0,
        fuelConsumption: 0,
        carbonFootprint: 0,
        vehicleType: 'truck',
        userId: req.userId,
        points: [],
        eventInfo: {
          eventId: event._id,
          eventName: event.name,
          eventDate: event.date,
          eventLocation: event.location || 'Local não informado'
        },
        eventsSummary: [{
          eventId: event._id,
          eventName: event.name,
          eventDate: event.date,
          wasteCollected: event.wasteCollected || event.estimatedWaste || 0
        }]
      };
      
      const newRoute = new Route(routeData);
      await newRoute.save();
      createdRoutes.push(newRoute);
      
      console.log(`✅ Rota criada para o evento: ${event.name} (ID: ${newRoute._id})`);
    }
    
    // Retornar a primeira rota criada (ou todas)
    res.status(201).json(createdRoutes[0]);
    
  } catch (error) {
    console.error('❌ Erro ao criar rota:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Atualizar rota
router.put('/:id', auth, async (req, res) => {
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
    res.json(route);
  } catch (error) {
    console.error('Erro ao atualizar rota:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Remover rota
router.delete('/:id', auth, async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    
    if (!route) {
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    
    if (route.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }
    
    await route.deleteOne();
    res.json({ message: 'Rota removida com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar rota:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;