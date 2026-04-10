const axios = require('axios');
require('dotenv').config(); // Garantir que o .env seja carregado

class ExternalEventService {
    constructor() {
        // Garantir que a API key seja carregada corretamente
        this.ticketmasterApiKey = process.env.TICKETMASTER_API_KEY;
        this.baseUrl = 'https://app.ticketmaster.com/discovery/v2';
        
        // Log para debug (remover em produção)
        console.log('📡 Inicializando ExternalEventService...');
        console.log('🔑 Ticketmaster API Key:', this.ticketmasterApiKey ? `${this.ticketmasterApiKey.substring(0, 10)}...✅` : '❌ NÃO ENCONTRADA');
        
        if (!this.ticketmasterApiKey) {
            console.error('⚠️ ATENÇÃO: TICKETMASTER_API_KEY não configurada no arquivo .env');
        }
    }

    // Buscar eventos por país/cidade
    async searchEvents({ countryCode = 'BR', city, keyword, size = 20, page = 0 }) {
        try {
            // Validação da API Key
            if (!this.ticketmasterApiKey) {
                console.error('❌ API Key não configurada');
                return { success: false, error: 'API Key não configurada', events: [] };
            }

            const params = {
                apikey: this.ticketmasterApiKey,
                countryCode,
                size,
                page,
                sort: 'date,asc'
            };

            if (city) params.city = city;
            if (keyword) params.keyword = keyword;

            console.log('🔍 Buscando eventos:', { city, keyword, countryCode });

            const response = await axios.get(`${this.baseUrl}/events.json`, { 
                params,
                timeout: 15000,
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.data._embedded?.events) {
                console.log('📭 Nenhum evento encontrado');
                return { success: true, events: [], totalPages: 0 };
            }

            const events = this.transformTicketmasterEvents(response.data._embedded.events);
            
            console.log(`✅ Encontrados ${events.length} eventos`);
            
            return {
                success: true,
                events,
                totalPages: response.data.page?.totalPages || 0,
                totalElements: response.data.page?.totalElements || 0
            };
        } catch (error) {
            console.error('❌ Erro ao buscar eventos Ticketmaster:');
            console.error('   Mensagem:', error.message);
            if (error.response) {
                console.error('   Status:', error.response.status);
                console.error('   Data:', JSON.stringify(error.response.data).substring(0, 200));
            }
            return { success: false, error: error.message, events: [] };
        }
    }

    // Buscar evento por ID
    async getEventById(eventId) {
        try {
            if (!this.ticketmasterApiKey) {
                console.error('❌ API Key não configurada');
                return null;
            }

            const response = await axios.get(`${this.baseUrl}/events/${eventId}.json`, {
                params: { apikey: this.ticketmasterApiKey },
                timeout: 10000
            });
            
            return this.transformSingleTicketmasterEvent(response.data);
        } catch (error) {
            console.error('❌ Erro ao buscar evento por ID:', error.message);
            return null;
        }
    }

    // Buscar eventos por localização (lat/long)
    async searchEventsByLocation({ lat, long, radius = '50km', size = 20 }) {
        try {
            if (!this.ticketmasterApiKey) {
                return { success: false, error: 'API Key não configurada', events: [] };
            }

            const params = {
                apikey: this.ticketmasterApiKey,
                geoPoint: `${lat},${long}`,
                radius,
                size,
                sort: 'date,asc'
            };

            const response = await axios.get(`${this.baseUrl}/events.json`, { params, timeout: 10000 });
            
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
            if (!this.ticketmasterApiKey) {
                return { success: false, error: 'API Key não configurada', events: [] };
            }

            const params = {
                apikey: this.ticketmasterApiKey,
                classificationName,
                countryCode,
                size,
                sort: 'date,asc'
            };

            const response = await axios.get(`${this.baseUrl}/events.json`, { params, timeout: 10000 });
            
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
        return events.map(event => {
            const venue = event._embedded?.venues?.[0];
            const classification = event.classifications?.[0];
            
            return {
                externalId: event.id,
                source: 'ticketmaster',
                name: event.name || 'Sem nome',
                description: event.info || event.description || '',
                type: this.mapEventType(classification),
                address: venue?.address?.line1 || venue?.address?.line2 || 'Endereço não informado',
                city: venue?.city?.name || '',
                state: venue?.state?.stateCode || '',
                latitude: venue?.location?.latitude ? parseFloat(venue.location.latitude) : null,
                longitude: venue?.location?.longitude ? parseFloat(venue.location.longitude) : null,
                venueName: venue?.name || '',
                startDate: event.dates?.start?.dateTime || event.dates?.start?.localDate,
                endDate: event.dates?.end?.dateTime || event.dates?.end?.localDate || event.dates?.start?.localDate,
                expectedAttendees: this.estimateAttendees(event),
                estimatedWaste: this.estimateWaste(event),
                imageUrl: event.images?.find(img => img.ratio === '16_9')?.url || event.images?.[0]?.url || '',
                url: event.url || '',
                status: this.mapEventStatus(event.dates?.status?.code),
                priceRange: event.priceRanges?.[0] ? {
                    min: event.priceRanges[0].min,
                    max: event.priceRanges[0].max,
                    currency: event.priceRanges[0].currency
                } : null
            };
        });
    }

    transformSingleTicketmasterEvent(event) {
        const transformed = this.transformTicketmasterEvents([event]);
        return transformed[0] || null;
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
            'theatre': 'show',
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
            'music': 8000,
            'festival': 25000,
            'sports': 20000,
            'arts & theatre': 1500,
            'family': 5000,
            'theatre': 2000
        };
        
        return estimates[segment] || 3000;
    }

    // Estimar resíduos (0.5kg por pessoa em média)
    estimateWaste(event) {
        const attendees = this.estimateAttendees(event);
        return Math.floor(attendees * 0.5);
    }
}

module.exports = new ExternalEventService();