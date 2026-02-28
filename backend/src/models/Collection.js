const mongoose = require('mongoose');

const CollectionSchema = new mongoose.Schema({
    collectionPointId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CollectionPoint',
        required: true
    },
    routeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Route'
    },
    date: {
        type: Date,
        default: Date.now
    },
    wasteVolume: {
        type: Number,
        required: true
    },
    wasteType: {
        type: String,
        enum: ['plastico', 'papel', 'vidro', 'metal', 'organico', 'eletronico'],
        required: true
    },
    vehicle: String,
    driver: String,
    notes: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Collection', CollectionSchema);