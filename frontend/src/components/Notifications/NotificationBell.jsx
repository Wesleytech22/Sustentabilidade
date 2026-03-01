import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Notifications.css';

const NotificationBell = ({ notifications, unreadCount }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleViewAll = () => {
    setIsOpen(false);
    navigate('/dashboard/notifications');
  };

  const getIcon = (type) => {
    switch(type) {
      case 'success': return 'fas fa-check-circle';
      case 'warning': return 'fas fa-exclamation-triangle';
      case 'error': return 'fas fa-times-circle';
      default: return 'fas fa-info-circle';
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'agora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <div 
        className={`notification-bell ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <i className="fas fa-bell"></i>
        {unreadCount > 0 && (
          <span className="notification-count">{unreadCount}</span>
        )}
      </div>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="dropdown-header">
            <h4>
              <i className="fas fa-bell"></i>
              Notificações
            </h4>
            <span className="unread-count">{unreadCount} não lida(s)</span>
          </div>

          <div className="dropdown-list">
            {notifications.slice(0, 5).map((notif, idx) => (
              <div 
                key={idx} 
                className={`dropdown-item ${!notif.read ? 'unread' : ''}`}
                onClick={() => {
                  setIsOpen(false);
                  navigate('/dashboard/notifications');
                }}
              >
                <div className="dropdown-icon">
                  <i className={getIcon(notif.type)}></i>
                </div>
                <div className="dropdown-content">
                  <p className="dropdown-message">{notif.message}</p>
                  <span className="dropdown-time">
                    <i className="fas fa-clock"></i>
                    {formatTime(notif.timestamp)}
                  </span>
                </div>
              </div>
            ))}

            {notifications.length === 0 && (
              <div className="dropdown-empty">
                <i className="fas fa-bell-slash"></i>
                <p>Nenhuma notificação</p>
              </div>
            )}
          </div>

          <div className="dropdown-footer">
            <button onClick={handleViewAll}>
              Ver todas as notificações
              <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;