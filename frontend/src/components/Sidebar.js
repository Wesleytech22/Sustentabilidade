import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = ({ user, onLogout, unreadCount, isConnected }) => {
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <i className="fas fa-recycle"></i>
        <h2>EcoRoute</h2>
        <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          <span className="dot"></span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/dashboard" end className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-chart-line"></i>
          <span>Dashboard</span>
        </NavLink>
        
        <NavLink to="/dashboard/points" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-map-marker-alt"></i>
          <span>Pontos de Coleta</span>
        </NavLink>
        
        <NavLink to="/dashboard/routes" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-route"></i>
          <span>Rotas</span>
        </NavLink>
        
        <NavLink to="/dashboard/impact" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-leaf"></i>
          <span>Impacto Ambiental</span>
        </NavLink>

        {/* Divisor */}
        <div className="nav-divider"></div>

        {/* Chat */}
        <NavLink to="/dashboard/chat" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-comments"></i>
          <span>Chat</span>
          {isConnected && (
            <span className="status-badge online" title="Conectado">●</span>
          )}
        </NavLink>
        
        {/* Notificações */}
        <NavLink to="/dashboard/notifications" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-bell"></i>
          <span>Notificações</span>
          {unreadCount > 0 && (
            <span className="notification-badge">{unreadCount}</span>
          )}
        </NavLink>
      </nav>

      <div className="sidebar-user">
        <div className="user-info">
          <i className="fas fa-user-circle"></i>
          <div>
            <p className="user-name">{user?.name || 'Usuário'}</p>
            <p className="user-role">{user?.role === 'ADMIN' ? 'Administrador' : 'Cooperativa'}</p>
          </div>
        </div>
        <button className="btn-logout" onClick={onLogout} title="Sair">
          <i className="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;