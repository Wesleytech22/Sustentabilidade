import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './components.css';

const EventsList = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [externalEvents, setExternalEvents] = useState([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    city: '',
    countryCode: 'BR',
    classification: ''
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'outro',
    address: '',
    city: '',
    state: '',
    startDate: '',
    endDate: '',
    expectedAttendees: '',
    estimatedWaste: ''
  });

  const API_URL = 'http://localhost:3000/api';

  const getAuthToken = () => {
    const token = localStorage.getItem('token') || 
                  localStorage.getItem('authToken') || 
                  sessionStorage.getItem('token') ||
                  sessionStorage.getItem('authToken');
    return token;
  };

  const getAuthHeaders = () => {
    const token = getAuthToken();
    return {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
  };

  // Buscar eventos
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      if (!token) {
        setError('Usuário não autenticado');
        setLoading(false);
        return;
      }
      
      const response = await axios.get(`${API_URL}/events`, getAuthHeaders());
      setEvents(response.data || []);
    } catch (err) {
      console.error('Erro ao buscar eventos:', err);
      setError('Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  };

  // Criar evento manual
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await axios.post(`${API_URL}/events`, formData, getAuthHeaders());
      alert('Evento criado com sucesso!');
      setShowCreateModal(false);
      setFormData({
        name: '', description: '', type: 'outro', address: '', city: '',
        state: '', startDate: '', endDate: '', expectedAttendees: '', estimatedWaste: ''
      });
      fetchEvents();
    } catch (err) {
      console.error('Erro ao criar evento:', err);
      alert(err.response?.data?.error || 'Erro ao criar evento');
    } finally {
      setLoading(false);
    }
  };

  // Finalizar evento
  const handleFinishEvent = async (eventId) => {
    if (!window.confirm('Finalizar este evento? Uma rota de coleta será criada.')) return;
    
    try {
      await axios.post(`${API_URL}/events/${eventId}/finish`, {}, getAuthHeaders());
      alert('Evento finalizado com sucesso!');
      fetchEvents();
    } catch (err) {
      console.error('Erro ao finalizar evento:', err);
      alert(err.response?.data?.error || 'Erro ao finalizar evento');
    }
  };

  // Deletar evento
  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Tem certeza que deseja excluir este evento?')) return;
    
    try {
      await axios.delete(`${API_URL}/events/${eventId}`, getAuthHeaders());
      alert('Evento excluído com sucesso!');
      fetchEvents();
    } catch (err) {
      console.error('Erro ao excluir evento:', err);
      alert('Erro ao excluir evento');
    }
  };

  // ========== FUNÇÕES DE BUSCA EXTERNA ==========
  
  // Buscar eventos externos
  const searchExternalEvents = async () => {
    try {
      setSearching(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (searchParams.keyword) params.append('keyword', searchParams.keyword);
      if (searchParams.city) params.append('city', searchParams.city);
      if (searchParams.countryCode) params.append('countryCode', searchParams.countryCode);
      if (searchParams.classification) params.append('classification', searchParams.classification);
      
      const response = await axios.get(`${API_URL}/events/external/search?${params.toString()}`, getAuthHeaders());
      
      if (response.data.success) {
        setExternalEvents(response.data.events || []);
        if (response.data.events.length === 0) {
          alert('Nenhum evento encontrado. Tente outros termos de busca.');
        }
      } else {
        setError(response.data.error || 'Erro ao buscar eventos');
      }
    } catch (err) {
      console.error('Erro ao buscar eventos externos:', err);
      setError(err.response?.data?.error || 'Erro ao conectar com a API de eventos');
    } finally {
      setSearching(false);
    }
  };

  // Importar evento externo
  const importExternalEvent = async (eventId) => {
    try {
      setImporting(true);
      const response = await axios.post(`${API_URL}/events/external/import/${eventId}`, {}, getAuthHeaders());
      
      if (response.data.success) {
        alert(`Evento "${response.data.event.name}" importado com sucesso!`);
        setShowExternalModal(false);
        setExternalEvents([]);
        setSearchParams({ keyword: '', city: '', countryCode: 'BR', classification: '' });
        fetchEvents();
      } else {
        alert(response.data.error || 'Erro ao importar evento');
      }
    } catch (err) {
      console.error('Erro ao importar evento:', err);
      alert(err.response?.data?.error || 'Erro ao importar evento');
    } finally {
      setImporting(false);
    }
  };

  // Buscar por classificação popular
  const searchByClassification = async (classification) => {
    try {
      setSearching(true);
      const response = await axios.get(`${API_URL}/events/external/classification/${encodeURIComponent(classification)}?countryCode=BR`, getAuthHeaders());
      
      if (response.data.success) {
        setExternalEvents(response.data.events || []);
        if (response.data.events.length === 0) {
          alert(`Nenhum evento encontrado para a classificação: ${classification}`);
        }
      } else {
        setError(response.data.error || 'Erro ao buscar eventos');
      }
    } catch (err) {
      console.error('Erro ao buscar por classificação:', err);
      setError(err.response?.data?.error || 'Erro ao buscar eventos por classificação');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const getStatusText = (status) => {
    switch(status) {
      case 'agendado': return 'Agendado';
      case 'em_andamento': return 'Em Andamento';
      case 'finalizado': return 'Finalizado';
      case 'coleta_agendada': return 'Coleta Agendada';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'agendado': return '#2196F3';
      case 'em_andamento': return '#ff9800';
      case 'finalizado': return '#4CAF50';
      case 'coleta_agendada': return '#9C27B0';
      default: return '#999';
    }
  };

  if (loading && events.length === 0) {
    return (
      <div className="events-container">
        <div className="loading-state">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Carregando eventos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="events-container">
      <div className="events-header">
        <h2><i className="fas fa-calendar-alt"></i> Eventos</h2>
        <div className="header-buttons">
          <button className="btn-primary" onClick={() => setShowExternalModal(true)}>
            <i className="fas fa-globe"></i> Buscar Eventos Externos
          </button>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            <i className="fas fa-plus"></i> Criar Evento
          </button>
        </div>
      </div>

      {error && (
        <div className="error-state">
          <i className="fas fa-exclamation-triangle"></i>
          <p>{error}</p>
          <button onClick={fetchEvents} className="btn-primary">Tentar Novamente</button>
        </div>
      )}

      {events.length === 0 && !error ? (
        <div className="empty-state">
          <div className="empty-icon">
            <i className="fas fa-calendar-alt"></i>
          </div>
          <h3>Nenhum evento cadastrado</h3>
          <p>Clique em "Buscar Eventos Externos" para importar eventos ou "Criar Evento" para cadastrar manualmente</p>
        </div>
      ) : (
        <div className="events-grid">
          {events.map(event => (
            <div key={event._id} className="event-card">
              <div className="event-header">
                <div className="event-icon">
                  <i className="fas fa-calendar-alt"></i>
                </div>
                <h3>{event.name}</h3>
                <span 
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(event.status) + '20', color: getStatusColor(event.status) }}
                >
                  {getStatusText(event.status)}
                </span>
              </div>
              
              <p className="event-description">{event.description || 'Sem descrição'}</p>
              
              <div className="event-details">
                <div className="detail">
                  <i className="fas fa-map-marker-alt"></i>
                  <span>{event.city}, {event.state}</span>
                </div>
                <div className="detail">
                  <i className="fas fa-calendar"></i>
                  <span>{new Date(event.startDate).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="detail">
                  <i className="fas fa-users"></i>
                  <span>{event.expectedAttendees?.toLocaleString()} pessoas</span>
                </div>
                <div className="detail">
                  <i className="fas fa-trash-alt"></i>
                  <span>{event.estimatedWaste} kg estimados</span>
                </div>
                {event.status === 'finalizado' && (
                  <div className="detail highlight">
                    <i className="fas fa-check-circle"></i>
                    <span>Aguardando coleta</span>
                  </div>
                )}
                {event.status === 'coleta_agendada' && (
                  <div className="detail highlight">
                    <i className="fas fa-truck"></i>
                    <span>Coleta agendada para {event.scheduledCollectionDate ? new Date(event.scheduledCollectionDate).toLocaleDateString('pt-BR') : 'em breve'}</span>
                  </div>
                )}
              </div>

              <div className="event-actions">
                {(event.status === 'agendado' || event.status === 'em_andamento') && (
                  <button className="btn-finish" onClick={() => handleFinishEvent(event._id)}>
                    <i className="fas fa-check"></i> Finalizar Evento
                  </button>
                )}
                <button className="btn-delete" onClick={() => handleDeleteEvent(event._id)}>
                  <i className="fas fa-trash"></i> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE BUSCA EXTERNA */}
      {showExternalModal && (
        <div className="modal-overlay" onClick={() => setShowExternalModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2><i className="fas fa-globe"></i> Buscar Eventos Externos</h2>
              <button className="close" onClick={() => setShowExternalModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {/* Busca Rápida por Classificação */}
              <div className="details-section">
                <h3>Busca Rápida</h3>
                <div className="quick-search-buttons" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button className="btn-secondary" onClick={() => searchByClassification('music')}>
                    <i className="fas fa-music"></i> Shows
                  </button>
                  <button className="btn-secondary" onClick={() => searchByClassification('sports')}>
                    <i className="fas fa-futbol"></i> Esportes
                  </button>
                  <button className="btn-secondary" onClick={() => searchByClassification('conference')}>
                    <i className="fas fa-chalkboard-user"></i> Conferências
                  </button>
                  <button className="btn-secondary" onClick={() => searchByClassification('festival')}>
                    <i className="fas fa-tree"></i> Festivais
                  </button>
                </div>
              </div>

              {/* Formulário de Busca */}
              <div className="details-section">
                <h3>Busca Personalizada</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Palavra-chave</label>
                    <input
                      type="text"
                      value={searchParams.keyword}
                      onChange={(e) => setSearchParams({...searchParams, keyword: e.target.value})}
                      placeholder="Ex: Rock in Rio, Show, Teatro"
                      onKeyPress={(e) => e.key === 'Enter' && searchExternalEvents()}
                    />
                  </div>
                  <div className="form-group">
                    <label>Cidade</label>
                    <input
                      type="text"
                      value={searchParams.city}
                      onChange={(e) => setSearchParams({...searchParams, city: e.target.value})}
                      placeholder="Ex: São Paulo, Rio de Janeiro"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Classificação</label>
                    <select
                      value={searchParams.classification}
                      onChange={(e) => setSearchParams({...searchParams, classification: e.target.value})}
                    >
                      <option value="">Todas</option>
                      <option value="music">Música/Shows</option>
                      <option value="sports">Esportes</option>
                      <option value="arts">Artes e Teatro</option>
                      <option value="conference">Conferências</option>
                      <option value="festival">Festivais</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>País</label>
                    <select
                      value={searchParams.countryCode}
                      onChange={(e) => setSearchParams({...searchParams, countryCode: e.target.value})}
                    >
                      <option value="BR">Brasil</option>
                      <option value="US">Estados Unidos</option>
                      <option value="PT">Portugal</option>
                      <option value="ES">Espanha</option>
                      <option value="FR">França</option>
                      <option value="UK">Reino Unido</option>
                    </select>
                  </div>
                </div>
                <button 
                  className="btn-primary" 
                  onClick={searchExternalEvents} 
                  disabled={searching}
                  style={{ width: '100%', marginTop: '10px' }}
                >
                  {searching ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-search"></i>}
                  {' '}{searching ? 'Buscando...' : 'Buscar Eventos'}
                </button>
              </div>

              {/* Resultados da Busca */}
              {externalEvents.length > 0 && (
                <div className="details-section">
                  <h3>Resultados ({externalEvents.length} eventos)</h3>
                  <div className="external-events-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {externalEvents.map((event, index) => (
                      <div key={event.id || index} className="external-event-card" style={{
                        background: '#f8f9fa',
                        padding: '15px',
                        marginBottom: '10px',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>
                              <i className="fas fa-calendar-alt" style={{ color: '#4CAF50', marginRight: '8px' }}></i>
                              {event.name}
                            </h4>
                            <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>
                              <i className="fas fa-map-marker-alt"></i> {event.city}, {event.state} - {event.country}
                            </p>
                            <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>
                              <i className="fas fa-calendar"></i> {new Date(event.startDate).toLocaleDateString('pt-BR')}
                              {event.endDate && event.endDate !== event.startDate && ` até ${new Date(event.endDate).toLocaleDateString('pt-BR')}`}
                            </p>
                            {event.description && (
                              <p style={{ margin: '5px 0', fontSize: '12px', color: '#888' }}>
                                {event.description.substring(0, 100)}...
                              </p>
                            )}
                            <div style={{ marginTop: '8px' }}>
                              <span className="status-badge" style={{ 
                                background: '#e3f2fd', 
                                color: '#1976d2',
                                fontSize: '11px'
                              }}>
                                {event.classification || 'Evento'}
                              </span>
                              {event.expectedAttendees && (
                                <span className="status-badge" style={{ 
                                  background: '#e8f5e9', 
                                  color: '#2e7d32',
                                  fontSize: '11px',
                                  marginLeft: '8px'
                                }}>
                                  <i className="fas fa-users"></i> {event.expectedAttendees.toLocaleString()} pessoas
                                </span>
                              )}
                            </div>
                          </div>
                          <button 
                            className="btn-primary" 
                            onClick={() => importExternalEvent(event.id)}
                            disabled={importing}
                            style={{ marginLeft: '15px', padding: '8px 16px', fontSize: '12px' }}
                          >
                            <i className="fas fa-download"></i> Importar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {externalEvents.length === 0 && !searching && (
                <div className="empty-state" style={{ padding: '40px' }}>
                  <i className="fas fa-search" style={{ fontSize: '48px', color: '#ccc' }}></i>
                  <p>Busque por eventos para importar</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowExternalModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAR EVENTO MANUAL */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Criar Evento</h2>
              <button className="close" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateEvent}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nome do Evento *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Descrição</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows="3"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Endereço *</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Cidade *</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Estado *</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({...formData, state: e.target.value.toUpperCase()})}
                      placeholder="SP"
                      maxLength="2"
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Data Início *</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Data Fim *</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Público Esperado *</label>
                    <input
                      type="number"
                      value={formData.expectedAttendees}
                      onChange={(e) => setFormData({...formData, expectedAttendees: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Resíduos Estimados (kg)</label>
                    <input
                      type="number"
                      value={formData.estimatedWaste}
                      onChange={(e) => setFormData({...formData, estimatedWaste: e.target.value})}
                      placeholder="Automático"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={loading}>Criar Evento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsList;