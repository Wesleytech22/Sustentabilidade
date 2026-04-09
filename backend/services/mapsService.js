const axios = require('axios');

// Usar OpenStreetMap Nominatim (gratuito, sem chave)
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

class MapsService {
    // Geocodificação (endereço → coordenadas)
    async geocode(address, city, state) {
        try {
            const query = `${address}, ${city}, ${state}, Brasil`;
            const response = await axios.get(`${NOMINATIM_URL}/search`, {
                params: {
                    q: query,
                    format: 'json',
                    limit: 1,
                    'accept-language': 'pt-BR'
                },
                headers: { 'User-Agent': 'EcoRoute/1.0' }
            });
            
            if (response.data && response.data.length > 0) {
                return {
                    latitude: parseFloat(response.data[0].lat),
                    longitude: parseFloat(response.data[0].lon)
                };
            }
            return null;
        } catch (error) {
            console.error('Erro na geocodificação:', error.message);
            return null;
        }
    }

    // Calcular distância entre dois pontos (Haversine)
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    deg2rad(deg) {
        return deg * (Math.PI/180);
    }

    // Otimizar rota para múltiplos eventos (Algoritmo do vizinho mais próximo)
    optimizeRoute(points, startPoint = null) {
        if (points.length <= 1) return points;
        
        let unvisited = [...points];
        let route = [];
        
        if (startPoint) {
            const startIndex = unvisited.findIndex(p => 
                p.latitude === startPoint.latitude && p.longitude === startPoint.longitude
            );
            if (startIndex !== -1) {
                route.push(unvisited[startIndex]);
                unvisited.splice(startIndex, 1);
            }
        } else {
            route.push(unvisited[0]);
            unvisited.splice(0, 1);
        }
        
        while (unvisited.length > 0) {
            let lastPoint = route[route.length - 1];
            let nearestIndex = 0;
            let minDistance = Infinity;
            
            unvisited.forEach((point, index) => {
                const distance = this.calculateDistance(
                    lastPoint.latitude, lastPoint.longitude,
                    point.latitude, point.longitude
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestIndex = index;
                }
            });
            
            route.push(unvisited[nearestIndex]);
            unvisited.splice(nearestIndex, 1);
        }
        
        return route;
    }
}

module.exports = new MapsService();