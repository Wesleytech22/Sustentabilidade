const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: String,
    date: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        default: 'PLANNED'
    },
    points: [{
        pointId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CollectionPoint'
        },
        order: Number,
        estimatedVolume: Number,
        distance: Number,
        duration: Number
    }],
    totalDistance: Number,
    totalWaste: Number,
    fuelConsumption: Number,
    carbonFootprint: Number,
    vehicleType: {
        type: String,
        enum: ['truck', 'van', 'bike', 'motorcycle'],
        default: 'truck'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Route', RouteSchema);