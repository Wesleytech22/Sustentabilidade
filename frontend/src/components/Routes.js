import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './components.css';

const RoutesList = () => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estados para busca externa
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [externalEvents, setExternalEvents] = useState([]);
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    city: '',
    countryCode: 'BR',
    classification: ''
  });
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);

  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    points: '',
    distance: '',
    waste: '',
    status: ''
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

  // Buscar rotas do backend
  const fetchRoutes = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getAuthToken();
      if (!token) {
        setError('Usuário não autenticado. Por favor, faça login.');
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_URL}/routes`, getAuthHeaders());

      const formattedRoutes = response.data.map(route => ({
        id: route._id,
        _id: route._id,
        name: route.name,
        date: route.date,
        points: route.points?.length || 0,
        distance: route.totalDistance || 0,
        waste: route.totalWaste || 0,
        status: route.status,
        description: route.description,
        vehicleType: route.vehicleType,
        fuelConsumption: route.fuelConsumption,
        carbonFootprint: route.carbonFootprint,
        pointsDetail: route.points || [],
        eventInfo: route.eventInfo || null,
        eventsSummary: route.eventsSummary || []
      }));

      setRoutes(formattedRoutes);
    } catch (err) {
      console.error('Erro ao buscar rotas:', err);

      if (err.response?.status === 401) {
        setError('Sessão expirada. Por favor, faça login novamente.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (err.code === 'ERR_NETWORK') {
        setError('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
      } else {
        setError('Erro ao carregar rotas: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setLoading(false);
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
        // Limpar busca
        setExternalEvents([]);
        setSearchParams({ keyword: '', city: '', countryCode: 'BR', classification: '' });
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

  // Chamar a rota do backend para criar nova rota
  const handleCreateRoute = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/routes/generate-from-events`, {}, getAuthHeaders());

      const newRoute = {
        id: response.data._id,
        _id: response.data._id,
        name: response.data.name,
        date: response.data.date,
        points: response.data.points?.length || 0,
        distance: response.data.totalDistance || 0,
        waste: response.data.totalWaste || 0,
        status: response.data.status,
        description: response.data.description,
        vehicleType: response.data.vehicleType,
        eventInfo: response.data.eventInfo || null,
        eventsSummary: response.data.eventsSummary || []
      };

      setRoutes([newRoute, ...routes]);
      alert('Rota criada com sucesso!');
    } catch (err) {
      console.error('Erro ao criar rota:', err);
      if (err.response?.status === 401) {
        alert('Sessão expirada. Faça login novamente.');
        window.location.href = '/login';
      } else if (err.response?.status === 404) {
        alert('Nenhum evento finalizado encontrado. Finalize um evento primeiro ou importe eventos externos.');
        // Abrir modal de busca externa
        setShowExternalModal(true);
      } else {
        alert('Erro ao criar rota: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      setLoading(true);

      // Enviar todos os campos para atualização
      await axios.put(`${API_URL}/routes/${selectedRoute._id}`,
        {
          name: editFormData.name,
          status: editFormData.status,
          points: parseInt(editFormData.points) || 0,
          distance: parseFloat(editFormData.distance) || 0,
          totalWaste: parseInt(editFormData.waste) || 0
        },
        getAuthHeaders()
      );

      // Atualizar a lista localmente
      const updatedRoutes = routes.map(route =>
        route.id === selectedRoute.id
          ? {
            ...route,
            name: editFormData.name,
            points: parseInt(editFormData.points) || 0,
            distance: parseFloat(editFormData.distance) || 0,
            waste: parseInt(editFormData.waste) || 0,
            status: editFormData.status
          }
          : route
      );
      setRoutes(updatedRoutes);
      setShowEditModal(false);
      setSelectedRoute(null);
      alert('Rota atualizada com sucesso!');
    } catch (err) {
      console.error('Erro ao atualizar rota:', err);
      if (err.response?.status === 401) {
        alert('Sessão expirada. Faça login novamente.');
        window.location.href = '/login';
      } else {
        alert('Erro ao salvar alterações: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoute = async (routeId) => {
    if (window.confirm('Tem certeza que deseja excluir esta rota?')) {
      try {
        setLoading(true);
        await axios.delete(`${API_URL}/routes/${routeId}`, getAuthHeaders());

        const updatedRoutes = routes.filter(route => route.id !== routeId);
        setRoutes(updatedRoutes);
        alert('Rota excluída com sucesso!');
      } catch (err) {
        console.error('Erro ao excluir rota:', err);
        if (err.response?.status === 401) {
          alert('Sessão expirada. Faça login novamente.');
          window.location.href = '/login';
        } else {
          alert('Erro ao excluir rota');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'PLANNED': return '#ff9800';
      case 'IN_PROGRESS': return '#2196F3';
      case 'COMPLETED': return '#4CAF50';
      default: return '#999';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'PLANNED': return 'Planejada';
      case 'IN_PROGRESS': return 'Em Andamento';
      case 'COMPLETED': return 'Concluída';
      default: return status;
    }
  };

  const handleViewDetails = (route) => {
    setSelectedRoute(route);
    setShowDetailsModal(true);
  };

  const handleEdit = (route) => {
    setSelectedRoute(route);
    setEditFormData({
      name: route.name,
      points: route.points,
      distance: route.distance,
      waste: route.waste,
      status: route.status
    });
    setShowEditModal(true);
  };

  if (loading && routes.length === 0) {
    return (
      <div className="routes-container">
        <div className="loading-state">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Carregando rotas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="routes-container">
      <div className="routes-header">
        <h2>Rotas Otimizadas</h2>
        <div className="header-buttons">
          <button className="btn-primary" onClick={handleCreateRoute} disabled={loading}>
            <i className="fas fa-plus"></i> Nova Rota
          </button>
          <button className="btn-secondary" onClick={() => setShowExternalModal(true)}>
            <i className="fas fa-globe"></i> Buscar Eventos Externos
          </button>
        </div>
      </div>

      {error && (
        <div className="error-state" style={{ marginBottom: '20px' }}>
          <i className="fas fa-exclamation-triangle"></i>
          <p>{error}</p>
          <button onClick={fetchRoutes} className="btn-primary">Tentar Novamente</button>
        </div>
      )}

      {routes.length === 0 && !error ? (
        <div className="empty-state">
          <div className="empty-icon">
            <i className="fas fa-route"></i>
          </div>
          <h3>Nenhuma rota cadastrada</h3>
          <p>Clique em "Nova Rota" para gerar uma rota a partir de eventos finalizados</p>
          <p style={{ marginTop: '10px', color: '#4CAF50' }}>
            <i className="fas fa-globe"></i> Ou busque eventos externos para importar
          </p>
        </div>
      ) : (
        <div className="routes-grid">
          {routes.map(route => (
            <div key={route.id} className="route-card">
              <div className="route-header">
                <h3>{route.name}</h3>
                <span
                  className="status-badge"
                  style={{
                    backgroundColor: getStatusColor(route.status) + '20',
                    color: getStatusColor(route.status)
                  }}
                >
                  {getStatusText(route.status)}
                </span>
              </div>

              {route.eventInfo && route.eventInfo.eventName && (
                <div className="route-event-info" style={{
                  marginBottom: '12px',
                  padding: '8px',
                  background: '#e8f5e9',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#2e7d32'
                }}>
                  <i className="fas fa-calendar-alt" style={{ marginRight: '6px' }}></i>
                  <strong>Evento:</strong> {route.eventInfo.eventName}
                  <br />
                  <small>Data: {new Date(route.eventInfo.eventDate).toLocaleDateString('pt-BR')}</small>
                </div>
              )}

              {route.eventsSummary && route.eventsSummary.length > 0 && (
                <div className="route-event-info" style={{
                  marginBottom: '12px',
                  padding: '8px',
                  background: '#e3f2fd',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#1565c0'
                }}>
                  <i className="fas fa-tasks" style={{ marginRight: '6px' }}></i>
                  <strong>{route.eventsSummary.length} evento(s):</strong>
                  {route.eventsSummary.map((ev, idx) => (
                    <div key={idx} style={{ fontSize: '12px', marginTop: '4px' }}>
                      • {ev.eventName} - {new Date(ev.eventDate).toLocaleDateString('pt-BR')}
                    </div>
                  ))}
                </div>
              )}

              <div className="route-stats">
                <div className="route-stat">
                  <i className="fas fa-calendar"></i>
                  <span>{new Date(route.date).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="route-stat">
                  <i className="fas fa-map-marker-alt"></i>
                  <span>{route.points} pontos</span>
                </div>
                <div className="route-stat">
                  <i className="fas fa-road"></i>
                  <span>{route.distance} km</span>
                </div>
                <div className="route-stat">
                  <i className="fas fa-weight-hanging"></i>
                  <span>{route.waste} kg</span>
                </div>
              </div>

              <div className="route-footer">
                <button
                  className="btn-view"
                  onClick={() => handleViewDetails(route)}
                >
                  <i className="fas fa-eye"></i> Ver Detalhes
                </button>
                <button
                  className="btn-edit"
                  onClick={() => handleEdit(route)}
                >
                  <i className="fas fa-edit"></i> Editar
                </button>
                <button
                  className="btn-delete"
                  onClick={() => handleDeleteRoute(route.id)}
                >
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
                      onChange={(e) => setSearchParams({ ...searchParams, keyword: e.target.value })}
                      placeholder="Ex: Rock in Rio, Show, Teatro"
                      onKeyPress={(e) => e.key === 'Enter' && searchExternalEvents()}
                    />
                  </div>
                  <div className="form-group">
                    <label>Cidade</label>
                    <input
                      type="text"
                      value={searchParams.city}
                      onChange={(e) => setSearchParams({ ...searchParams, city: e.target.value })}
                      placeholder="Ex: São Paulo, Rio de Janeiro"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Classificação</label>
                    <select
                      value={searchParams.classification}
                      onChange={(e) => setSearchParams({ ...searchParams, classification: e.target.value })}
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
                      onChange={(e) => setSearchParams({ ...searchParams, countryCode: e.target.value })}
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

      {/* MODAL DE DETALHES */}
      {showDetailsModal && selectedRoute && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalhes da Rota</h2>
              <button className="close" onClick={() => setShowDetailsModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="details-section">
                <h3>Informações Gerais</h3>
                <p><strong>Nome:</strong> {selectedRoute.name}</p>
                <p><strong>Data da Rota:</strong> {new Date(selectedRoute.date).toLocaleDateString('pt-BR')}</p>
                <p><strong>Status:</strong> {getStatusText(selectedRoute.status)}</p>
                {selectedRoute.description && <p><strong>Descrição:</strong> {selectedRoute.description}</p>}
              </div>

              {selectedRoute.eventInfo && selectedRoute.eventInfo.eventName && (
                <div className="details-section">
                  <h3><i className="fas fa-calendar-alt"></i> Informações do Evento</h3>
                  <p><strong>Nome do Evento:</strong> {selectedRoute.eventInfo.eventName}</p>
                  <p><strong>Data do Evento:</strong> {new Date(selectedRoute.eventInfo.eventDate).toLocaleDateString('pt-BR')}</p>
                  {selectedRoute.eventInfo.eventLocation && (
                    <p><strong>Local do Evento:</strong> {selectedRoute.eventInfo.eventLocation}</p>
                  )}
                </div>
              )}

              {selectedRoute.eventsSummary && selectedRoute.eventsSummary.length > 0 && (
                <div className="details-section">
                  <h3><i className="fas fa-tasks"></i> Eventos Relacionados ({selectedRoute.eventsSummary.length})</h3>
                  {selectedRoute.eventsSummary.map((event, index) => (
                    <div key={index} className="event-item" style={{
                      background: '#f5f5f5',
                      padding: '10px',
                      marginBottom: '10px',
                      borderRadius: '8px',
                      borderLeft: '3px solid #4CAF50'
                    }}>
                      <p><strong>Evento {index + 1}:</strong> {event.eventName}</p>
                      <p><strong>Data do Evento:</strong> {new Date(event.eventDate).toLocaleDateString('pt-BR')}</p>
                      <p><strong>Resíduos Coletados:</strong> {event.wasteCollected || 0} kg</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="details-section">
                <h3>Métricas da Coleta</h3>
                <p><strong>Pontos de Coleta:</strong> {selectedRoute.points}</p>
                <p><strong>Distância Total:</strong> {selectedRoute.distance} km</p>
                <p><strong>Volume Coletado:</strong> {selectedRoute.waste} kg</p>
              </div>

              <div className="details-section">
                <h3>Estimativa de Impacto Ambiental</h3>
                <p><strong>CO₂ Economizado:</strong> {Math.round(selectedRoute.waste * 0.13)} kg</p>
                <p><strong>Água Economizada:</strong> {selectedRoute.waste * 5} L</p>
                <p><strong>Combustível Economizado:</strong> {Math.round(selectedRoute.distance * 0.35)} L</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDetailsModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO */}
      {showEditModal && selectedRoute && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar Rota</h2>
              <button className="close" onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nome da Rota</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="Ex: Rota Zona Norte"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Pontos de Coleta</label>
                  <input
                    type="number"
                    value={editFormData.points}
                    onChange={(e) => setEditFormData({ ...editFormData, points: parseInt(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label>Distância (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editFormData.distance}
                    onChange={(e) => setEditFormData({ ...editFormData, distance: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Volume Coletado (kg)</label>
                  <input
                    type="number"
                    value={editFormData.waste}
                    onChange={(e) => setEditFormData({ ...editFormData, waste: parseInt(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  >
                    <option value="PLANNED">Planejada</option>
                    <option value="IN_PROGRESS">Em Andamento</option>
                    <option value="COMPLETED">Concluída</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveEdit} disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutesList;