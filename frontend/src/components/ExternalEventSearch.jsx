import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ExternalEventSearch = ({ onEventImported }) => {
    const { api } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [city, setCity] = useState('');
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [importing, setImporting] = useState(null);

    const searchExternalEvents = async () => {
        if (!searchTerm.trim() && !city.trim()) {
            alert('Digite um nome de evento ou cidade para buscar');
            return;
        }

        setLoading(true);
        try {
            const response = await api.get('/events/external/search', {
                params: {
                    keyword: searchTerm,
                    city: city,
                    countryCode: 'BR',
                    size: 20
                }
            });
            
            if (response.data.events && response.data.events.length > 0) {
                setEvents(response.data.events);
                setShowModal(true);
            } else {
                alert('Nenhum evento encontrado. Tente outro termo de busca.');
            }
        } catch (error) {
            console.error('Erro ao buscar eventos:', error);
            alert(error.response?.data?.error || 'Erro ao buscar eventos externos');
        } finally {
            setLoading(false);
        }
    };

    const importEvent = async (event) => {
        setImporting(event.externalId);
        try {
            const response = await api.post(`/events/external/import/${event.externalId}`);
            alert(`✅ Evento "${response.data.event.name}" importado com sucesso!`);
            setShowModal(false);
            setSearchTerm('');
            setCity('');
            if (onEventImported) onEventImported();
        } catch (error) {
            console.error('Erro ao importar:', error);
            alert(error.response?.data?.error || 'Erro ao importar evento');
        } finally {
            setImporting(null);
        }
    };

    return (
        <>
            <div className="external-search-wrapper">
                <button 
                    className="btn-external" 
                    onClick={searchExternalEvents}
                    disabled={loading}
                >
                    <i className="fas fa-globe"></i>
                    {loading ? 'Buscando...' : 'Buscar Eventos Externos'}
                </button>
                
                {/* Modal de busca rápida */}
                <div className="external-search-quick">
                    <input
                        type="text"
                        placeholder="Evento (ex: Rock in Rio)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchExternalEvents()}
                    />
                    <input
                        type="text"
                        placeholder="Cidade"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchExternalEvents()}
                        style={{ width: '120px' }}
                    />
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content large" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                <i className="fas fa-globe"></i> 
                                Eventos Encontrados - Ticketmaster
                            </h2>
                            <button className="close" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            {events.length === 0 ? (
                                <p className="no-results">Nenhum evento encontrado</p>
                            ) : (
                                <div className="external-events-list">
                                    {events.map(event => (
                                        <div key={event.externalId} className="external-event-card">
                                            {event.imageUrl && (
                                                <div className="event-image">
                                                    <img src={event.imageUrl} alt={event.name} />
                                                </div>
                                            )}
                                            <div className="event-info">
                                                <h3>{event.name}</h3>
                                                {event.venueName && (
                                                    <p className="venue">
                                                        <i className="fas fa-building"></i> {event.venueName}
                                                    </p>
                                                )}
                                                <p className="address">
                                                    <i className="fas fa-map-marker-alt"></i> 
                                                    {event.address}, {event.city} - {event.state}
                                                </p>
                                                <p className="date">
                                                    <i className="fas fa-calendar"></i> 
                                                    {new Date(event.startDate).toLocaleDateString('pt-BR')}
                                                    {event.endDate !== event.startDate && 
                                                        ` até ${new Date(event.endDate).toLocaleDateString('pt-BR')}`
                                                    }
                                                </p>
                                                <div className="stats">
                                                    <span>
                                                        <i className="fas fa-users"></i> 
                                                        {event.expectedAttendees.toLocaleString()} pessoas
                                                    </span>
                                                    <span>
                                                        <i className="fas fa-trash-alt"></i> 
                                                        {event.estimatedWaste.toLocaleString()} kg estimados
                                                    </span>
                                                </div>
                                            </div>
                                            <button 
                                                className="btn-import"
                                                onClick={() => importEvent(event)}
                                                disabled={importing === event.externalId}
                                            >
                                                {importing === event.externalId ? (
                                                    <i className="fas fa-spinner fa-spin"></i>
                                                ) : (
                                                    <i className="fas fa-download"></i>
                                                )}
                                                Importar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowModal(false)}>
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .external-search-wrapper {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                .external-search-quick {
                    display: flex;
                    gap: 8px;
                }
                .external-search-quick input {
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                }
                .btn-external {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                }
                .btn-external:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                }
                .external-events-list {
                    max-height: 500px;
                    overflow-y: auto;
                }
                .external-event-card {
                    display: flex;
                    gap: 16px;
                    padding: 16px;
                    border-bottom: 1px solid #eee;
                    background: white;
                }
                .external-event-card:hover {
                    background: #f8f9fa;
                }
                .event-image {
                    width: 100px;
                    height: 100px;
                    flex-shrink: 0;
                }
                .event-image img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 8px;
                }
                .event-info {
                    flex: 1;
                }
                .event-info h3 {
                    margin: 0 0 8px 0;
                    color: #333;
                }
                .event-info .venue {
                    color: #666;
                    margin: 4px 0;
                    font-size: 14px;
                }
                .event-info .address {
                    color: #888;
                    margin: 4px 0;
                    font-size: 13px;
                }
                .event-info .date {
                    color: #667eea;
                    margin: 4px 0;
                    font-size: 13px;
                    font-weight: 500;
                }
                .stats {
                    display: flex;
                    gap: 16px;
                    margin-top: 8px;
                }
                .stats span {
                    font-size: 12px;
                    color: #666;
                    background: #f0f0f0;
                    padding: 4px 8px;
                    border-radius: 4px;
                }
                .stats i {
                    margin-right: 4px;
                }
                .btn-import {
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    height: 40px;
                    align-self: center;
                }
                .btn-import:hover {
                    background: #218838;
                }
                .source-badge {
                    font-size: 12px;
                    margin-left: 8px;
                }
                .modal-content.large {
                    max-width: 800px;
                    width: 90%;
                }
            `}</style>
        </>
    );
};

export default ExternalEventSearch;