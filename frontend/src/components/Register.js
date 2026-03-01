import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Register.css';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    city: '',
    state: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { register } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const result = await register(formData);
    
    if (result.success) {
      setSuccess('Cadastro realizado com sucesso! Redirecionando...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <i className="fas fa-recycle"></i>
          <h1>EcoRoute</h1>
          <p>Crie sua conta</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <i className="fas fa-check-circle"></i>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <i className="fas fa-user"></i>
            <input
              type="text"
              name="name"
              placeholder="Nome completo"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <i className="fas fa-envelope"></i>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <div className="input-row">
            <div className="input-group">
              <i className="fas fa-phone"></i>
              <input
                type="tel"
                name="phone"
                placeholder="Telefone"
                value={formData.phone}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="input-group">
              <i className="fas fa-lock"></i>
              <input
                type="password"
                name="password"
                placeholder="Senha"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="input-row">
            <div className="input-group">
              <i className="fas fa-city"></i>
              <input
                type="text"
                name="city"
                placeholder="Cidade"
                value={formData.city}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="input-group">
              <i className="fas fa-map-marker-alt"></i>
              <input
                type="text"
                name="state"
                placeholder="UF"
                maxLength="2"
                value={formData.state}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-login"
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner"></i>
                Cadastrando...
              </>
            ) : (
              <>
                Cadastrar
                <i className="fas fa-user-plus"></i>
              </>
            )}
          </button>
        </form>

        <p className="register-link">
          Já tem uma conta? <Link to="/login">Fazer login</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;