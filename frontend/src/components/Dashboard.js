import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';
import Home from './Home';
import CollectionPoints from './CollectionPoints';
import RoutesList from './Routes'; // Importando o componente de Rotas (com nome diferente para não conflitar)
import Impact from './Impact';
import './components.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/points')) return 'Pontos de Coleta';
    if (path.includes('/routes')) return 'Rotas Otimizadas';
    if (path.includes('/impact')) return 'Impacto Ambiental';
    return 'Dashboard';
  };

  const getPageIcon = () => {
    const path = location.pathname;
    if (path.includes('/points')) return 'fas fa-map-marker-alt';
    if (path.includes('/routes')) return 'fas fa-route';
    if (path.includes('/impact')) return 'fas fa-leaf';
    return 'fas fa-chart-line';
  };

  return (
    <div className="dashboard">
      <Sidebar user={user} onLogout={handleLogout} />
      
      <div className="main-content">
        <div className="main-header">
          <div className="header-title">
            <i className={getPageIcon()}></i>
            <h1>{getPageTitle()}</h1>
          </div>
          <div className="header-actions">
            <div className="header-date">
              <i className="fas fa-calendar-alt"></i>
              <span>
                {currentTime.toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
            <div className="header-time">
              <i className="fas fa-clock"></i>
              <span>
                {currentTime.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        </div>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/points" element={<CollectionPoints />} />
          <Route path="/routes" element={<RoutesList />} /> {/* Rota para Rotas */}
          <Route path="/impact" element={<Impact />} />
        </Routes>
      </div>
    </div>
  );
};

export default Dashboard;