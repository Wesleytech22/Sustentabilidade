const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
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
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);