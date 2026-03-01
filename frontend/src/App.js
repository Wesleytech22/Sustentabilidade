import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext'; // 👈 ADICIONE ESTA LINHA
import PrivateRoute from './components/PrivateRoute';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <SocketProvider> {/* 👈 ADICIONE ESTE PROVIDER */}
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard/*" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </SocketProvider> {/* 👈 FECHE O PROVIDER */}
    </AuthProvider>
  );
}

export default App;