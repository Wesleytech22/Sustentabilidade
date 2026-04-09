import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = ({ user, onLogout, unreadCount, isConnected }) => {
  // Função para obter o nome do perfil baseado no role
  const getRoleName = () => {
    if (!user) return 'Usuário';
    
    switch(user.role) {
      case 'SUPPORT':
        return 'Suporte';
      case 'COMPANY':
        return 'Empresa';
      case 'LOGISTICS':
        return 'Logística';
      case 'ADMIN':
        return 'Administrador';
      default:
        return 'Cooperativa';
    }
  };

  // Função para obter o ícone do perfil
  const getRoleIcon = () => {
    if (!user) return 'fas fa-user-circle';
    
    switch(user.role) {
      case 'SUPPORT':
        return 'fas fa-headset';
      case 'COMPANY':
        return 'fas fa-building';
      case 'LOGISTICS':
        return 'fas fa-truck';
      case 'ADMIN':
        return 'fas fa-crown';
      default:
        return 'fas fa-hand-holding-heart';
    }
  };

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

        <NavLink to="/dashboard/events" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-calendar-alt"></i>
          <span>Eventos</span>
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

        {/* Análise IA */}
        <NavLink to="/dashboard/ai" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-robot"></i>
          <span>Análise IA</span>
        </NavLink>
      </nav>

      <div className="sidebar-user">
        <div className="user-info">
          <i className={getRoleIcon()}></i>
          <div>
            <p className="user-name">{user?.name || 'Usuário'}</p>
            <p className="user-role">{getRoleName()}</p>
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