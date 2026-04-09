const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    // ========== CAMPOS EXISTENTES (NÃO MODIFICADOS) ==========
    name: { type: String, required: true },
    description: String,
    type: { 
        type: String, 
        enum: ['show', 'festa', 'feira', 'evento_esportivo', 'outro'],
        default: 'outro'
    },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true, uppercase: true },
    latitude: Number,
    longitude: Number,
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    expectedAttendees: { type: Number, required: true },
    estimatedWaste: { type: Number, default: 0 },
    wasteCollected: { type: Number, default: 0 },
    status: { 
        type: String, 
        enum: ['agendado', 'em_andamento', 'finalizado', 'coleta_agendada', 'coleta_realizada'],
        default: 'agendado'
    },
    scheduledCollectionDate: Date,
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // ========== NOVOS CAMPOS PARA INTEGRAÇÃO EXTERNA ==========
    externalId: { 
        type: String, 
        index: true,
        sparse: true  // Permite múltiplos documentos sem externalId
    },
    source: { 
        type: String, 
        enum: ['manual', 'ticketmaster', 'sympla', 'eventbrite', 'google_calendar'],
        default: 'manual'
    },
    externalData: { 
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    venueName: { type: String },  // Nome do local/estádio/casa de shows
    imageUrl: { type: String },    // URL da imagem do evento
    eventUrl: { type: String },    // URL oficial do evento
    priceRange: {
        min: Number,
        max: Number,
        currency: { type: String, default: 'BRL' }
    },
    categories: [{ type: String }],  // Categorias/gêneros do evento
    importedAt: { type: Date }       // Data de importação
}, { timestamps: true });

// ========== ÍNDICES PARA BUSCA RÁPIDA ==========
eventSchema.index({ userId: 1, status: 1 });
eventSchema.index({ userId: 1, startDate: -1 });
eventSchema.index({ externalId: 1, source: 1 });
eventSchema.index({ city: 1, state: 1 });

// ========== MÉTODOS ADICIONAIS ==========
// Verificar se o evento veio de fonte externa
eventSchema.methods.isExternal = function() {
    return this.source !== 'manual';
};

// Marcar como importado
eventSchema.methods.markAsImported = function(source, externalId, externalData) {
    this.source = source;
    this.externalId = externalId;
    this.externalData = externalData;
    this.importedAt = new Date();
    return this.save();
};

// Calcular impacto ambiental do evento
eventSchema.methods.calculateEnvironmentalImpact = function() {
    const wastePerPerson = 0.5; // 0.5kg por pessoa
    const carbonPerKg = 0.13;   // 0.13kg CO2 por kg de resíduo
    
    const totalWaste = this.wasteCollected || this.estimatedWaste;
    
    return {
        totalWaste: totalWaste,
        carbonSaved: totalWaste * carbonPerKg,
        treesEquivalent: Math.floor(totalWaste * 0.02), // 2 árvores por 100kg
        recyclingRate: this.wasteCollected ? (this.wasteCollected / this.estimatedWaste) * 100 : 0
    };
};

// ========== STATICS ==========
// Buscar eventos externos importados
eventSchema.statics.findExternalEvents = function(userId, source = null) {
    const query = { userId, source: { $ne: 'manual' } };
    if (source) query.source = source;
    return this.find(query).sort({ importedAt: -1 });
};

// Buscar eventos próximos (por localização)
eventSchema.statics.findNearby = function(userId, lat, long, maxDistance = 10000) {
    return this.find({
        userId,
        latitude: { $exists: true, $ne: null },
        longitude: { $exists: true, $ne: null },
        status: 'agendado'
    }).where('latitude').near({
        center: { type: 'Point', coordinates: [long, lat] },
        maxDistance: maxDistance,
        spherical: true
    });
};

module.exports = mongoose.model('Event', eventSchema);