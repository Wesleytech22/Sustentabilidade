import React, { useState, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext'; // Corrigido o caminho
import NotificationItem from './NotificationItem';
import './Notifications.css';

const Notifications = () => {
  // Usando as funções corretas do SocketContext
  const { 
    notifications, 
    markNotificationAsRead,  // 👈 Nome corrigido
    clearNotifications, 
    unreadCount: socketUnreadCount 
  } = useSocket();
  
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchTerm, setSearchTerm] = useState('');

  // Calcular estatísticas
  const totalCount = notifications.length;
  const unreadCount = notifications.filter(n => !n.read).length;
  const readCount = totalCount - unreadCount;

  // Filtrar e ordenar notificações
  const filteredNotifications = notifications
    .filter(notif => {
      // Filtro por status
      if (filter === 'unread' && notif.read) return false;
      if (filter === 'read' && !notif.read) return false;
      
      // Filtro por busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          (notif.title?.toLowerCase() || '').includes(term) ||
          (notif.message?.toLowerCase() || '').includes(term)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.timestamp || a.createdAt || 0);
      const dateB = new Date(b.timestamp || b.createdAt || 0);
      
      if (sortBy === 'newest') {
        return dateB - dateA;
      } else {
        return dateA - dateB;
      }
    });

  const handleMarkAllAsRead = () => {
    notifications.forEach(notif => {
      if (!notif.read && notif.id) {
        markNotificationAsRead(notif.id);
      }
    });
  };

  const handleClearAll = () => {
    if (window.confirm('Tem certeza que deseja limpar todas as notificações?')) {
      clearNotifications();
    }
  };

  const handleMarkAsRead = (id) => {
    markNotificationAsRead(id);
  };

  const handleDelete = (id) => {
    if (window.confirm('Remover esta notificação?')) {
      // Se você tiver uma função de delete no contexto
      // deleteNotification(id);
      // Por enquanto, vamos apenas marcar como lida
      markNotificationAsRead(id);
    }
  };

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <div className="notifications-title-section">
          <h2>
            <i className="fas fa-bell"></i>
            Notificações
          </h2>
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount} não lida(s)</span>
          )}
        </div>

        <div className="notifications-actions">
          <button 
            className="btn-action"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
          >
            <i className="fas fa-check-double"></i>
            Marcar todas como lidas
          </button>
          <button 
            className="btn-action btn-danger"
            onClick={handleClearAll}
            disabled={totalCount === 0}
          >
            <i className="fas fa-trash-alt"></i>
            Limpar todas
          </button>
        </div>
      </div>

      <div className="notifications-filters">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Buscar notificações..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <select 
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todas</option>
            <option value="unread">Não lidas</option>
            <option value="read">Lidas</option>
          </select>

          <select 
            className="filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
          </select>
        </div>
      </div>

      <div className="notifications-stats">
        <div className="stat-card">
          <span className="stat-value">{totalCount}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{unreadCount}</span>
          <span className="stat-label">Não lidas</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{readCount}</span>
          <span className="stat-label">Lidas</span>
        </div>
      </div>

      <div className="notifications-list">
        {filteredNotifications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <i className="fas fa-bell-slash"></i>
            </div>
            <h3>Nenhuma notificação</h3>
            <p>
              {searchTerm 
                ? 'Nenhuma notificação encontrada com este termo'
                : filter !== 'all' 
                ? `Nenhuma notificação ${filter === 'unread' ? 'não lida' : 'lida'}`
                : 'Você não tem notificações no momento'}
            </p>
          </div>
        ) : (
          filteredNotifications.map(notification => (
            <NotificationItem
              key={notification.id || notification._id}
              notification={notification}
              onMarkAsRead={handleMarkAsRead}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;