import React, { useState } from 'react';
import './components.css';

const RoutesList = () => {
  const [routes, setRoutes] = useState([
    {
      id: '1',
      name: 'Rota Zona Norte',
      date: '2026-03-01',
      points: 5,
      distance: 45.2,
      waste: 1200,
      status: 'PLANNED'
    },
    {
      id: '2',
      name: 'Rota Centro',
      date: '2026-03-01',
      points: 8,
      distance: 32.5,
      waste: 2450,
      status: 'COMPLETED'
    }
  ]);

  const getStatusColor = (status) => {
    switch(status) {
      case 'PLANNED': return '#ff9800';
      case 'IN_PROGRESS': return '#2196F3';
      case 'COMPLETED': return '#4CAF50';
      default: return '#999';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'PLANNED': return 'Planejada';
      case 'IN_PROGRESS': return 'Em Andamento';
      case 'COMPLETED': return 'Concluída';
      default: return status;
    }
  };

  return (
    <div className="routes-container">
      <div className="routes-header">
        <h2>Rotas Otimizadas</h2>
        <button className="btn-primary">
          <i className="fas fa-plus"></i> Nova Rota
        </button>
      </div>

      {routes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <i className="fas fa-route"></i>
          </div>
          <h3>Nenhuma rota cadastrada</h3>
          <p>Clique em "Nova Rota" para começar</p>
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
                <button className="btn-view">
                  <i className="fas fa-eye"></i> Ver Detalhes
                </button>
                <button className="btn-edit">
                  <i className="fas fa-edit"></i> Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoutesList;