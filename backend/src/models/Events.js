// ========== MODELO DE EVENTO (ADICIONAR APÓS O MODELO COLLECTION) ==========
const eventSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    type: {
        type: String,
        enum: ['show', 'festa', 'feira', 'evento_esportivo', 'outro'],
        default: 'outro'
    },
    address: { type: String, required: true },
    neighborhood: String,
    city: { type: String, required: true },
    state: { type: String, required: true, uppercase: true },
    zipCode: String,
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: false,
            index: '2dsphere'
        }
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    expectedAttendees: { type: Number, required: true, default: 0 },
    estimatedWaste: { type: Number, default: 0 },
    wasteCollected: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['agendado', 'planejado', 'em_andamento', 'finalizado', 'cancelado'],
        default: 'agendado'
    },
    scheduledCollectionDate: Date,
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    externalId: { type: String, index: true, sparse: true },
    source: {
        type: String,
        enum: ['manual', 'ticketmaster', 'sympla', 'eventbrite'],
        default: 'manual'
    },
    venueName: String,
    imageUrl: String,
    eventUrl: String,
    importedAt: Date
}, { timestamps: true });

eventSchema.index({ location: '2dsphere' });
eventSchema.methods.setCoordinates = function (latitude, longitude) {
    if (latitude && longitude) {
        this.location = {
            type: 'Point',
            coordinates: [Number(longitude), Number(latitude)]
        };
    }
    return this;
};

const Event = mongoose.model('Event', eventSchema);