// backend/src/models/AnalysisHistory.js
const mongoose = require('mongoose');

const analysisHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    imageUrl: {
        type: String,
        default: null
    },
    imageName: String,
    imageSize: Number,
    location: {
        address: String,
        city: String,
        state: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    analysis: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    readableReport: {
        type: String,
        required: true
    },
    summary: {
        gravidade: String,
        prioridade: String,
        taxa_reciclabilidade: Number,
        impacto_ambiental: Number
    },
    metadata: {
        analyzedAt: Date,
        model: String,
        processingTimeMs: Number
    },
    shared: {
        type: Boolean,
        default: false
    },
    shareToken: {
        type: String,
        unique: true,
        sparse: true
    }
}, { timestamps: true });

// Índices para busca
analysisHistorySchema.index({ userId: 1, createdAt: -1 });
analysisHistorySchema.index({ 'summary.gravidade': 1 });
analysisHistorySchema.index({ shareToken: 1 });

// Método para gerar token de compartilhamento
analysisHistorySchema.methods.generateShareToken = function () {
    this.shareToken = Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
    this.shared = true;
    return this.shareToken;
};

module.exports = mongoose.model('AnalysisHistory', analysisHistorySchema);