import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';
import Home from './Home';
// import CollectionPoints from './CollectionPoints';
// import RoutesList from './Routes';
// import Impact from './Impact';
import './components.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard">
      <Sidebar user={user} onLogout={handleLogout} />
      
      <div className="main-content">
        <div className="main-header">
          <h1>Dashboard</h1>
          <div className="header-actions">
            {currentTime.toLocaleDateString('pt-BR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </div>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/points" element={<div>Pontos de Coleta</div>} />
          <Route path="/routes" element={<div>Rotas</div>} />
          <Route path="/impact" element={<div>Impacto Ambiental</div>} />
        </Routes>
      </div>
    </div>
  );
};

export default Dashboard;