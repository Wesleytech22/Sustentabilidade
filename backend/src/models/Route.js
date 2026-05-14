// backend/src/routes/route.js
const express = require('express');
const router = express.Router();
const Route = require('../models/Route');
const Event = require('../models/Events');
const auth = require('../middleware/auth');

// ========== ROTAS DE ROTAS ==========

// GET - Listar todas as rotas do usuário
router.get('/', auth, async (req, res) => {
  try {
    const routes = await Route.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(routes);
  } catch (error) {
    console.error('❌ Erro ao buscar rotas:', error);
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
    console.error('❌ Erro ao buscar rota:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Criar rota manualmente
router.post('/', auth, async (req, res) => {
  try {
    const routeData = { ...req.body, userId: req.userId };
    const route = new Route(routeData);
    await route.save();
    res.status(201).json(route);
  } catch (error) {
    console.error('❌ Erro ao criar rota:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Gerar rota a partir de eventos finalizados
router.post('/generate-from-events', auth, async (req, res) => {
  try {
    console.log('🔍 Buscando eventos finalizados para o usuário:', req.userId);

    const finishedEvents = await Event.find({
      status: 'finalizado',
      userId: req.userId
    });

    console.log(`📊 Encontrados ${finishedEvents.length} eventos finalizados`);

    if (finishedEvents.length === 0) {
      return res.status(404).json({
        error: 'Nenhum evento finalizado encontrado para gerar rota',
        message: 'Finalize um evento primeiro antes de criar uma rota'
      });
    }

    const totalWaste = finishedEvents.reduce((sum, e) => sum + (e.estimatedWaste || e.wasteCollected || 0), 0);

    const routeData = {
      name: `Coleta Pós-Eventos - ${new Date().toLocaleDateString('pt-BR')}`,
      description: `Rota gerada automaticamente para coleta de resíduos de ${finishedEvents.length} evento(s)`,
      date: new Date(),
      status: 'PLANNED',
      totalWaste: totalWaste,
      totalDistance: 0,
      fuelConsumption: 0,
      carbonFootprint: totalWaste * 0.13,
      vehicleType: 'truck',
      userId: req.userId,
      points: finishedEvents.map((event, index) => ({
        pointId: event._id,
        order: index + 1,
        estimatedVolume: event.estimatedWaste || event.wasteCollected || 500,
        actualVolume: 0,
        collectedAt: null
      })),
      eventInfo: {
        eventId: finishedEvents[0]._id,
        eventName: finishedEvents[0].name,
        eventDate: finishedEvents[0].startDate || finishedEvents[0].date,
        eventLocation: finishedEvents[0].city || finishedEvents[0].location || 'Local não informado'
      },
      eventsSummary: finishedEvents.map(event => ({
        eventId: event._id,
        eventName: event.name,
        eventDate: event.startDate || event.date,
        wasteCollected: event.estimatedWaste || event.wasteCollected || 0
      }))
    };

    const newRoute = new Route(routeData);
    await newRoute.save();

    console.log(`✅ Rota criada com sucesso! ID: ${newRoute._id}`);

    // Atualizar eventos com o ID da rota
    for (const event of finishedEvents) {
      event.status = 'coleta_agendada';
      event.scheduledCollectionDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      event.routeId = newRoute._id;
      await event.save();
    }

    res.status(201).json(newRoute);

  } catch (error) {
    console.error('❌ Erro ao gerar rota:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Atualizar rota
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, status, totalDistance, totalWaste } = req.body;
    const route = await Route.findById(req.params.id);

    if (!route) {
      return res.status(404).json({ error: 'Rota não encontrada' });
    }

    if (route.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    if (name) route.name = name;
    if (status) route.status = status;
    if (totalDistance !== undefined) route.totalDistance = totalDistance;
    if (totalWaste !== undefined) {
      route.totalWaste = totalWaste;
      route.carbonFootprint = totalWaste * 0.13;
    }

    await route.save();
    console.log(`✅ Rota atualizada: ${route.name}`);
    res.json(route);
  } catch (error) {
    console.error('❌ Erro ao atualizar rota:', error);
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
    console.log(`🗑️ Rota removida: ${route.name}`);
    res.json({ message: 'Rota removida com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar rota:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;