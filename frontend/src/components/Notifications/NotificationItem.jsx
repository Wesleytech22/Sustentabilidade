import React from 'react';

const NotificationItem = ({ notification, onMarkAsRead, onDelete }) => {
  const getIcon = (type) => {
    switch(type) {
      case 'success': return 'fas fa-check-circle';
      case 'warning': return 'fas fa-exclamation-triangle';
      case 'error': return 'fas fa-times-circle';
      case 'info': return 'fas fa-info-circle';
      default: return 'fas fa-bell';
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'agora mesmo';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min atrás`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} h atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className={`notification-card ${!notification.read ? 'unread' : ''}`}>
      <div className="notification-icon">
        <i className={getIcon(notification.type)}></i>
      </div>
      
      <div className="notification-content">
        <div className="notification-title">
          {notification.title || 'Notificação'}
          {!notification.read && <span className="notification-badge">Nova</span>}
        </div>
        
        <p className="notification-message">{notification.message}</p>
        
        <div className="notification-meta">
          <span className="notification-time">
            <i className="fas fa-clock"></i>
            {formatDate(notification.timestamp || notification.createdAt)}
          </span>
        </div>
      </div>

      <div className="notification-actions">
        {!notification.read && (
          <button 
            className="btn-notification"
            onClick={() => onMarkAsRead(notification.id || notification._id)}
            title="Marcar como lida"
          >
            <i className="fas fa-check"></i>
          </button>
        )}
        <button 
          className="btn-notification delete"
          onClick={() => onDelete(notification.id || notification._id)}
          title="Remover"
        >
          <i className="fas fa-trash"></i>
        </button>
      </div>
    </div>
  );
};

export default NotificationItem;