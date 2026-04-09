const axios = require('axios');

class ExternalEventService {
    constructor() {
        this.ticketmasterApiKey = process.env.TICKETMASTER_API_KEY;
        this.baseUrl = 'https://app.ticketmaster.com/discovery/v2';
    }

    // Buscar eventos por país/cidade
    async searchEvents({ countryCode = 'BR', city, keyword, size = 20, page = 0 }) {
        try {
            const params = {
                apikey: this.ticketmasterApiKey,
                countryCode,
                size,
                page,
                sort: 'date,asc'
            };

            if (city) params.city = city;
            if (keyword) params.keyword = keyword;

            const response = await axios.get(`${this.baseUrl}/events.json`, { params });
            
            if (!response.data._embedded?.events) {
                return { success: true, events: [], totalPages: 0 };
            }

            const events = this.transformTicketmasterEvents(response.data._embedded.events);
            
            return {
                success: true,
                events,
                totalPages: response.data.page?.totalPages || 0,
                totalElements: response.data.page?.totalElements || 0
            };
        } catch (error) {
            console.error('❌ Erro ao buscar eventos Ticketmaster:', error.message);
            return { success: false, error: error.message, events: [] };
        }
    }

    // Buscar evento por ID
    async getEventById(eventId) {
        try {
            const response = await axios.get(`${this.baseUrl}/events/${eventId}.json`, {
                params: { apikey: this.ticketmasterApiKey }
            });
            
            return this.transformSingleTicketmasterEvent(response.data);
        } catch (error) {
            console.error('❌ Erro ao buscar evento:', error.message);
            return null;
        }
    }

    // Buscar eventos por localização (lat/long)
    async searchEventsByLocation({ lat, long, radius = '50km', size = 20 }) {
        try {
            const params = {
                apikey: this.ticketmasterApiKey,
                geoPoint: `${lat},${long}`,
                radius,
                size,
                sort: 'date,asc'
            };

            const response = await axios.get(`${this.baseUrl}/events.json`, { params });
            
            if (!response.data._embedded?.events) {
                return { success: true, events: [], totalPages: 0 };
            }

            const events = this.transformTicketmasterEvents(response.data._embedded.events);
            return { success: true, events, totalPages: response.data.page?.totalPages || 0 };
        } catch (error) {
            console.error('❌ Erro ao buscar eventos por localização:', error.message);
            return { success: false, error: error.message, events: [] };
        }
    }

    // Buscar eventos por classificação (gênero musical, esporte, etc)
    async searchEventsByClassification({ classificationName, countryCode = 'BR', size = 20 }) {
        try {
            const params = {
                apikey: this.ticketmasterApiKey,
                classificationName,
                countryCode,
                size,
                sort: 'date,asc'
            };

            const response = await axios.get(`${this.baseUrl}/events.json`, { params });
            
            if (!response.data._embedded?.events) {
                return { success: true, events: [], totalPages: 0 };
            }

            const events = this.transformTicketmasterEvents(response.data._embedded.events);
            return { success: true, events, totalPages: response.data.page?.totalPages || 0 };
        } catch (error) {
            console.error('❌ Erro ao buscar eventos por classificação:', error.message);
            return { success: false, error: error.message, events: [] };
        }
    }

    // Transformar eventos da Ticketmaster para o formato do seu sistema
    transformTicketmasterEvents(events) {
        return events.map(event => ({
            externalId: event.id,
            source: 'ticketmaster',
            name: event.name,
            description: event.info || event.description || '',
            type: this.mapEventType(event.classifications?.[0]),
            address: event._embedded?.venues?.[0]?.address?.line1 || '',
            city: event._embedded?.venues?.[0]?.city?.name || '',
            state: event._embedded?.venues?.[0]?.state?.stateCode || '',
            latitude: event._embedded?.venues?.[0]?.location?.latitude || null,
            longitude: event._embedded?.venues?.[0]?.location?.longitude || null,
            venueName: event._embedded?.venues?.[0]?.name || '',
            startDate: event.dates?.start?.dateTime || event.dates?.start?.localDate,
            endDate: event.dates?.end?.dateTime || event.dates?.start?.localDate,
            expectedAttendees: this.estimateAttendees(event),
            estimatedWaste: this.estimateWaste(event),
            imageUrl: event.images?.[0]?.url || '',
            url: event.url,
            status: this.mapEventStatus(event.dates?.status?.code),
            priceRange: event.priceRanges ? {
                min: event.priceRanges[0].min,
                max: event.priceRanges[0].max,
                currency: event.priceRanges[0].currency
            } : null
        }));
    }

    transformSingleTicketmasterEvent(event) {
        return {
            externalId: event.id,
            source: 'ticketmaster',
            name: event.name,
            description: event.info || event.description || '',
            type: this.mapEventType(event.classifications?.[0]),
            address: event._embedded?.venues?.[0]?.address?.line1 || '',
            city: event._embedded?.venues?.[0]?.city?.name || '',
            state: event._embedded?.venues?.[0]?.state?.stateCode || '',
            latitude: event._embedded?.venues?.[0]?.location?.latitude || null,
            longitude: event._embedded?.venues?.[0]?.location?.longitude || null,
            venueName: event._embedded?.venues?.[0]?.name || '',
            startDate: event.dates?.start?.dateTime || event.dates?.start?.localDate,
            endDate: event.dates?.end?.dateTime || event.dates?.start?.localDate,
            expectedAttendees: this.estimateAttendees(event),
            estimatedWaste: this.estimateWaste(event),
            imageUrl: event.images?.[0]?.url || '',
            url: event.url,
            status: this.mapEventStatus(event.dates?.status?.code),
            priceRange: event.priceRanges ? {
                min: event.priceRanges[0].min,
                max: event.priceRanges[0].max,
                currency: event.priceRanges[0].currency
            } : null
        };
    }

    // Mapear classificação Ticketmaster para tipo do sistema
    mapEventType(classification) {
        if (!classification) return 'outro';
        
        const segment = classification.segment?.name?.toLowerCase();
        
        const typeMap = {
            'music': 'show',
            'concert': 'show',
            'festival': 'festa',
            'sports': 'evento_esportivo',
            'arts & theatre': 'show',
            'family': 'outro',
            'miscellaneous': 'outro'
        };
        
        return typeMap[segment] || 'outro';
    }

    // Mapear status do evento
    mapEventStatus(statusCode) {
        const statusMap = {
            'onsale': 'agendado',
            'offsale': 'finalizado',
            'cancelled': 'finalizado',
            'postponed': 'agendado',
            'rescheduled': 'agendado'
        };
        return statusMap[statusCode] || 'agendado';
    }

    // Estimar público baseado no tipo/classificação do evento
    estimateAttendees(event) {
        // Se tiver informação de público, usar
        if (event.attendance) return event.attendance;
        
        // Estimativa baseada no tipo de evento
        const segment = event.classifications?.[0]?.segment?.name?.toLowerCase();
        
        const estimates = {
            'music': 5000,
            'festival': 20000,
            'sports': 15000,
            'arts & theatre': 1000,
            'family': 3000
        };
        
        return estimates[segment] || 2000;
    }

    // Estimar resíduos (0.5kg por pessoa em média)
    estimateWaste(event) {
        const attendees = this.estimateAttendees(event);
        return Math.floor(attendees * 0.5);
    }
}

module.exports = new ExternalEventService();