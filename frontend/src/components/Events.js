import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Events = () => {
    const { api } = useAuth();
    const [events, setEvents] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        type: 'outro',
        address: '',
        city: '',
        state: '',
        startDate: '',
        endDate: '',
        expectedAttendees: ''
    });

    useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = async () => {
        setLoading(true);
        try {
            const response = await api.get('/events');
            setEvents(response.data);
        } catch (error) {
            console.error('Erro ao carregar eventos:', error);
            setError('Erro ao carregar eventos');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        
        try {
            // Validar campos obrigatórios
            if (!formData.name || !formData.address || !formData.city || !formData.state || !formData.startDate || !formData.endDate || !formData.expectedAttendees) {
                setError('Preencha todos os campos obrigatórios');
                setSaving(false);
                return;
            }

            const response = await api.post('/events', formData);
            console.log('Evento criado:', response.data);
            
            setShowModal(false);
            loadEvents();
            
            // Limpar formulário
            setFormData({
                name: '', description: '', type: 'outro', address: '',
                city: '', state: '', startDate: '', endDate: '', expectedAttendees: ''
            });
        } catch (error) {
            console.error('Erro ao criar evento:', error);
            setError(error.response?.data?.error || 'Erro ao criar evento');
        } finally {
            setSaving(false);
        }
    };

    const handleFinish = async (id) => {
        try {
            await api.post(`/events/${id}/finish`);
            loadEvents();
        } catch (error) {
            console.error('Erro ao finalizar evento:', error);
            setError('Erro ao finalizar evento');
        }
    };

    const generateRoutes = async () => {
        try {
            const response = await api.post('/events/generate-routes');
            alert(`✅ Rota criada para ${response.data.eventsCount} eventos!`);
            loadEvents();
        } catch (error) {
            console.error('Erro ao gerar rotas:', error);
            setError('Erro ao gerar rotas');
        }
    };

    const getStatusText = (status) => {
        const statusMap = {
            'agendado': '📅 Agendado',
            'em_andamento': '🎉 Em Andamento',
            'finalizado': '✅ Finalizado',
            'coleta_agendada': '🚛 Coleta Agendada',
            'coleta_realizada': '✔️ Coleta Realizada'
        };
        return statusMap[status] || status;
    };

    const getTypeIcon = (type) => {
        const icons = {
            'show': '🎤',
            'festa': '🎉',
            'feira': '🏪',
            'evento_esportivo': '⚽',
            'outro': '📍'
        };
        return icons[type] || '📍';
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Carregando eventos...</p>
            </div>
        );
    }

    return (
        <div className="events-container">
            <div className="events-header">
                <h2><i className="fas fa-calendar-alt"></i> Eventos e Coleta Programada</h2>
                <div className="header-buttons">
                    <button className="btn-primary" onClick={() => setShowModal(true)}>
                        <i className="fas fa-plus"></i> Novo Evento
                    </button>
                    <button className="btn-secondary" onClick={generateRoutes}>
                        <i className="fas fa-route"></i> Gerar Rotas de Coleta
                    </button>
                </div>
            </div>

            {error && (
                <div className="alert alert-error">
                    <i className="fas fa-exclamation-circle"></i>
                    {error}
                </div>
            )}

            {events.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">
                        <i className="fas fa-calendar-alt"></i>
                    </div>
                    <h3>Nenhum evento cadastrado</h3>
                    <p>Clique em "Novo Evento" para começar</p>
                </div>
            ) : (
                <div className="events-grid">
                    {events.map(event => (
                        <div key={event._id} className="event-card">
                            <div className="event-header">
                                <span className="event-icon">{getTypeIcon(event.type)}</span>
                                <h3>{event.name}</h3>
                                <span className={`status-badge ${event.status}`}>
                                    {getStatusText(event.status)}
                                </span>
                            </div>
                            
                            <p className="event-description">{event.description || 'Sem descrição'}</p>
                            
                            <div className="event-details">
                                <div className="detail">
                                    <i className="fas fa-map-marker-alt"></i>
                                    <span>{event.address}, {event.city} - {event.state}</span>
                                </div>
                                <div className="detail">
                                    <i className="fas fa-calendar"></i>
                                    <span>{new Date(event.startDate).toLocaleDateString('pt-BR')} até {new Date(event.endDate).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <div className="detail">
                                    <i className="fas fa-users"></i>
                                    <span>{event.expectedAttendees} pessoas</span>
                                </div>
                                <div className="detail">
                                    <i className="fas fa-trash-alt"></i>
                                    <span>Estimativa: {event.estimatedWaste} kg</span>
                                </div>
                                {event.scheduledCollectionDate && (
                                    <div className="detail highlight">
                                        <i className="fas fa-truck"></i>
                                        <span>Coleta: {new Date(event.scheduledCollectionDate).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                )}
                            </div>

                            {event.status === 'agendado' && (
                                <button className="btn-finish" onClick={() => handleFinish(event._id)}>
                                    <i className="fas fa-check"></i> Finalizar Evento
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Criação - COM ESPAÇAMENTO CORRIGIDO */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Novo Evento</h2>
                            <button className="close" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label>Nome do Evento *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        placeholder="Ex: Show de Rock"
                                        required
                                        disabled={saving}
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Tipo de Evento *</label>
                                    <select
                                        name="type"
                                        value={formData.type}
                                        onChange={(e) => setFormData({...formData, type: e.target.value})}
                                        disabled={saving}
                                    >
                                        <option value="show">🎤 Show/Concerto</option>
                                        <option value="festa">🎉 Festa</option>
                                        <option value="feira">🏪 Feira</option>
                                        <option value="evento_esportivo">⚽ Evento Esportivo</option>
                                        <option value="outro">📍 Outro</option>
                                    </select>
                                </div>
                                
                                <div className="form-group">
                                    <label>Descrição</label>
                                    <textarea
                                        rows="3"
                                        name="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                                        placeholder="Descrição opcional do evento"
                                        disabled={saving}
                                    />
                                </div>
                                
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Data Início *</label>
                                        <input
                                            type="date"
                                            name="startDate"
                                            value={formData.startDate}
                                            onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                                            required
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Data Fim *</label>
                                        <input
                                            type="date"
                                            name="endDate"
                                            value={formData.endDate}
                                            onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                                            required
                                            disabled={saving}
                                        />
                                    </div>
                                </div>
                                
                                <div className="form-group">
                                    <label>Endereço *</label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                                        placeholder="Ex: Av. Paulista, 1000"
                                        required
                                        disabled={saving}
                                    />
                                </div>
                                
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Cidade *</label>
                                        <input
                                            type="text"
                                            name="city"
                                            value={formData.city}
                                            onChange={(e) => setFormData({...formData, city: e.target.value})}
                                            placeholder="São Paulo"
                                            required
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>UF *</label>
                                        <input
                                            type="text"
                                            name="state"
                                            maxLength="2"
                                            value={formData.state}
                                            onChange={(e) => setFormData({...formData, state: e.target.value})}
                                            placeholder="SP"
                                            required
                                            disabled={saving}
                                        />
                                    </div>
                                </div>
                                
                                <div className="form-group">
                                    <label>Público Esperado *</label>
                                    <input
                                        type="number"
                                        name="expectedAttendees"
                                        value={formData.expectedAttendees}
                                        onChange={(e) => setFormData({...formData, expectedAttendees: e.target.value})}
                                        placeholder="5000"
                                        required
                                        disabled={saving}
                                    />
                                </div>

                                {error && (
                                    <div className="alert alert-error">
                                        <i className="fas fa-exclamation-circle"></i>
                                        {error}
                                    </div>
                                )}
                                
                                <div className="modal-actions">
                                    <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
                                        Cancelar
                                    </button>
                                    <button type="submit" className="btn-primary" disabled={saving}>
                                        {saving ? (
                                            <>
                                                <i className="fas fa-spinner fa-spin"></i>
                                                Salvando...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-save"></i>
                                                Salvar Evento
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Events;