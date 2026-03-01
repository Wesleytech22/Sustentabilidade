import React, { useState, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import './Chat.css';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [room, setRoom] = useState('geral');
  const { socket, onlineUsers } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (socket) {
      socket.on('new-message', (msg) => {
        setMessages(prev => [...prev, msg]);
      });

      socket.on('message-history', (history) => {
        setMessages(history);
      });

      // Entrar na sala padrão
      socket.emit('join-room', room);

      return () => {
        socket.off('new-message');
        socket.off('message-history');
      };
    }
  }, [socket, room]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (input.trim() && socket) {
      socket.emit('send-message', {
        room,
        message: input,
        user: user.name,
        userId: user._id
      });
      setInput('');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <h3>Usuários Online ({onlineUsers.length})</h3>
        <ul>
          {onlineUsers.map(u => (
            <li key={u.userId}>
              {u.name} {u.userId === user?._id && '(você)'}
            </li>
          ))}
        </ul>
      </div>
      
      <div className="chat-main">
        <div className="chat-header">
          <h2>Sala: {room}</h2>
          <select value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="geral">Geral</option>
            <option value="suporte">Suporte</option>
            <option value="cooperativas">Cooperativas</option>
          </select>
        </div>

        <div className="messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.userId === user?._id ? 'own' : ''}`}>
              <strong>{msg.user}:</strong> {msg.message}
              <span className="time">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>

        <form onSubmit={sendMessage} className="chat-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
          />
          <button type="submit">Enviar</button>
        </form>
      </div>
    </div>
  );
};

export default Chat;