const mongoose = require('mongoose');

const CollectionPointSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
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
            type: [Number], // [longitude, latitude]
            required: true,
            index: '2dsphere'
        }
    },
    wasteTypes: [{
        type: String,
        enum: ['plastico', 'papel', 'vidro', 'metal', 'organico', 'eletronico']
    }],
    capacity: {
        type: Number, // em kg
        required: true
    },
    currentVolume: {
        type: Number,
        default: 0
    },
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
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Índice para busca geoespacial
CollectionPointSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('CollectionPoint', CollectionPointSchema);