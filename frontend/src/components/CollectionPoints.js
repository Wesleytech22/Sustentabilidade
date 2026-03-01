import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const CollectionPoints = () => {
  const { api } = useAuth();
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    latitude: '',
    longitude: '',
    wasteTypes: [],
    capacity: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadPoints();
  }, []);

  const loadPoints = async () => {
    setLoading(true);
    try {
      const response = await api.get('/points');
      setPoints(response.data);
    } catch (error) {
      console.error('Erro ao carregar pontos:', error);
      setError('Erro ao carregar pontos de coleta');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleWasteTypeChange = (type) => {
    const newTypes = formData.wasteTypes.includes(type)
      ? formData.wasteTypes.filter(t => t !== type)
      : [...formData.wasteTypes, type];
    
    setFormData({
      ...formData,
      wasteTypes: newTypes
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      // Validar campos obrigatórios
      if (!formData.name || !formData.address || !formData.city || !formData.state || !formData.capacity) {
        throw new Error('Preencha todos os campos obrigatórios');
      }

      // Preparar dados para envio
      const pointData = {
        name: formData.name,
        address: formData.address,
        city: formData.city,
        state: formData.state.toUpperCase(),
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        wasteTypes: formData.wasteTypes,
        capacity: parseFloat(formData.capacity),
        currentVolume: 0,
        status: 'ACTIVE'
      };

      console.log('Enviando dados:', pointData); // Para debug

      const response = await api.post('/points', pointData);
      
      console.log('Resposta:', response.data); // Para debug
      
      setSuccess('Ponto de coleta criado com sucesso!');
      
      // Fechar modal e limpar formulário
      setTimeout(() => {
        setShowModal(false);
        setFormData({
          name: '',
          address: '',
          city: '',
          state: '',
          latitude: '',
          longitude: '',
          wasteTypes: [],
          capacity: ''
        });
        loadPoints(); // Recarregar a lista
      }, 1500);
      
    } catch (error) {
      console.error('Erro detalhado:', error);
      setError(error.response?.data?.error || error.message || 'Erro ao criar ponto de coleta');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar este ponto?')) {
      try {
        await api.delete(`/points/${id}`);
        setSuccess('Ponto deletado com sucesso!');
        loadPoints();
      } catch (error) {
        console.error('Erro ao deletar ponto:', error);
        setError('Erro ao deletar ponto');
      }
    }
  };

  const getWasteTypeLabel = (type) => {
    const types = {
      'plastico': 'Plástico',
      'papel': 'Papel',
      'vidro': 'Vidro',
      'metal': 'Metal',
      'organico': 'Orgânico'
    };
    return types[type] || type;
  };

  const filteredPoints = points.filter(point => {
    const matchesSearch = filter === '' || 
      point.name?.toLowerCase().includes(filter.toLowerCase()) ||
      point.address?.toLowerCase().includes(filter.toLowerCase()) ||
      point.city?.toLowerCase().includes(filter.toLowerCase());
    
    const matchesType = typeFilter === '' || 
      (point.wasteTypes && point.wasteTypes.includes(typeFilter));
    
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Carregando pontos de coleta...</p>
      </div>
    );
  }

  return (
    <div className="points-container">
      {/* Header da página */}
      <div className="points-header">
        <h2>Pontos de Coleta</h2>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <i className="fas fa-plus"></i> Novo Ponto
        </button>
      </div>

      {/* Mensagens de feedback */}
      {error && (
        <div className="alert alert-error">
          <i className="fas fa-exclamation-circle"></i>
          {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success">
          <i className="fas fa-check-circle"></i>
          {success}
        </div>
      )}

      {/* Filtros */}
      <div className="filters-section">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Buscar por nome, endereço ou cidade..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        
        <select 
          className="filter-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          <option value="plastico">Plástico</option>
          <option value="papel">Papel</option>
          <option value="vidro">Vidro</option>
          <option value="metal">Metal</option>
          <option value="organico">Orgânico</option>
        </select>
      </div>

      {/* Grid de Pontos */}
      {filteredPoints.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <i className="fas fa-map-marker-alt"></i>
          </div>
          <h3>Nenhum ponto de coleta encontrado</h3>
          <p>{filter || typeFilter ? 'Tente outros filtros' : 'Clique em "Novo Ponto" para começar'}</p>
        </div>
      ) : (
        <div className="points-grid">
          {filteredPoints.map(point => (
            <div key={point._id} className="point-card">
              <div className="point-card-header">
                <h3>{point.name}</h3>
                <button 
                  className="btn-delete"
                  onClick={() => handleDelete(point._id)}
                  title="Deletar ponto"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
              
              <div className="point-address">
                <i className="fas fa-map-marker-alt"></i>
                <span>{point.address}, {point.city} - {point.state}</span>
              </div>
              
              {point.wasteTypes && point.wasteTypes.length > 0 && (
                <div className="point-types">
                  {point.wasteTypes.map(type => (
                    <span key={type} className="type-tag">
                      {getWasteTypeLabel(type)}
                    </span>
                  ))}
                </div>
              )}
              
              <div className="point-capacity">
                <div className="capacity-info">
                  <i className="fas fa-weight-hanging"></i>
                  <span>Capacidade: {point.currentVolume || 0}/{point.capacity} kg</span>
                </div>
                <div className="capacity-bar">
                  <div 
                    className="capacity-fill"
                    style={{ width: `${((point.currentVolume || 0) / point.capacity) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="point-footer">
                <span className={`status-badge ${point.status?.toLowerCase() || 'active'}`}>
                  {point.status === 'ACTIVE' ? 'Ativo' : point.status || 'Ativo'}
                </span>
                <button className="btn-edit">
                  <i className="fas fa-edit"></i> Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Criação */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Novo Ponto de Coleta</h2>
              <button className="close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Nome do Ponto *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="Ex: Ecoponto Centro"
                    disabled={saving}
                  />
                </div>

                <div className="form-group">
                  <label>Endereço *</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                    placeholder="Ex: Rua Augusta, 500"
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
                      onChange={handleInputChange}
                      required
                      placeholder="São Paulo"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label>UF *</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      required
                      maxLength="2"
                      placeholder="SP"
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Latitude</label>
                    <input
                      type="number"
                      step="any"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleInputChange}
                      placeholder="-23.5505"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label>Longitude</label>
                    <input
                      type="number"
                      step="any"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleInputChange}
                      placeholder="-46.6333"
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Capacidade (kg) *</label>
                  <input
                    type="number"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleInputChange}
                    required
                    placeholder="5000"
                    min="1"
                    disabled={saving}
                  />
                </div>

                <div className="form-group">
                  <label>Tipos de Resíduos Aceitos</label>
                  <div className="checkbox-group">
                    {['plastico', 'papel', 'vidro', 'metal', 'organico'].map(type => (
                      <label key={type}>
                        <input
                          type="checkbox"
                          checked={formData.wasteTypes.includes(type)}
                          onChange={() => handleWasteTypeChange(type)}
                          disabled={saving}
                        />
                        {getWasteTypeLabel(type)}
                      </label>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="alert alert-error">
                    <i className="fas fa-exclamation-circle"></i>
                    {error}
                  </div>
                )}

                <div className="modal-actions">
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save"></i>
                        Salvar Ponto
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

export default CollectionPoints;