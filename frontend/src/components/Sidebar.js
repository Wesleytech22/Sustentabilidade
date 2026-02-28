import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = ({ user, onLogout }) => {
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <i className="fas fa-recycle"></i>
        <h2>EcoRoute</h2>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/dashboard" end className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-home"></i>
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/dashboard/points">
          <i className="fas fa-map-marker-alt"></i>
          <span>Pontos de Coleta</span>
        </NavLink>
        <NavLink to="/dashboard/routes">
          <i className="fas fa-route"></i>
          <span>Rotas</span>
        </NavLink>
        <NavLink to="/dashboard/impact">
          <i className="fas fa-leaf"></i>
          <span>Impacto Ambiental</span>
        </NavLink>
      </nav>

      <div className="sidebar-user">
        <div className="user-info">
          <i className="fas fa-user-circle"></i>
          <div>
            <p>{user?.name || 'Usuário'}</p>
            <small>{user?.role === 'ADMIN' ? 'Administrador' : 'Cooperativa'}</small>
          </div>
        </div>
        <button className="btn-logout" onClick={onLogout}>
          <i className="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;