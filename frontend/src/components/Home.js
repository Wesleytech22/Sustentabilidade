import React from 'react';

const Home = () => {
  return (
    <div className="home">
      <div className="stats-grid">
        <div className="stat-card">
          <i className="fas fa-map-marker-alt stat-icon"></i>
          <div className="stat-info">
            <h3>Pontos de Coleta</h3>
            <p>12</p>
          </div>
        </div>

        <div className="stat-card">
          <i className="fas fa-truck stat-icon"></i>
          <div className="stat-info">
            <h3>Rotas Ativas</h3>
            <p>5</p>
          </div>
        </div>

        <div className="stat-card">
          <i className="fas fa-weight-hanging stat-icon"></i>
          <div className="stat-info">
            <h3>Resíduos Coletados</h3>
            <p>2.450 kg</p>
          </div>
        </div>

        <div className="stat-card">
          <i className="fas fa-leaf stat-icon"></i>
          <div className="stat-info">
            <h3>CO₂ Economizado</h3>
            <p>324 kg</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;