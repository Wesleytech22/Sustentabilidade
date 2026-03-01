import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

const Home = () => {
  const { api } = useAuth();
  const [stats, setStats] = useState({
    points: 12,
    routes: 5,
    totalWaste: 2450,
    totalCarbon: 324
  });
  const [loading, setLoading] = useState(false);

  // Dados para o gráfico de coleta por tipo
  const wasteData = {
    labels: ['Plástico', 'Papel', 'Vidro', 'Metal', 'Orgânico'],
    datasets: [
      {
        data: [850, 1200, 400, 650, 350],
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4CAF50',
          '#FF9F40'
        ],
        borderWidth: 0,
      }
    ]
  };

  // Dados para o gráfico de impacto mensal
  const impactData = {
    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    datasets: [
      {
        label: 'CO₂ Economizado (kg)',
        data: [120, 190, 300, 450, 520, 324, 480, 510, 600, 720, 800, 950],
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#4CAF50',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: 12 }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.raw} kg`
        }
      }
    },
    cutout: '65%',
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        callbacks: {
          label: (context) => `${context.raw} kg CO₂`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { 
          callback: value => value + ' kg',
          font: { size: 11 }
        }
      },
      x: { 
        grid: { display: false },
        ticks: { font: { size: 11 } }
      }
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="home">
      {/* Cards de Estatísticas */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-map-marker-alt"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Pontos de Coleta</span>
            <span className="stat-value">{stats.points}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-truck"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Rotas Ativas</span>
            <span className="stat-value">{stats.routes}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-weight-hanging"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Resíduos Coletados</span>
            <span className="stat-value">{stats.totalWaste} kg</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-leaf"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">CO₂ Economizado</span>
            <span className="stat-value">{stats.totalCarbon} kg</span>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-header">
            <i className="fas fa-chart-pie"></i>
            <h3>Coletas por Tipo de Material</h3>
          </div>
          <div className="chart-wrapper">
            <Doughnut data={wasteData} options={doughnutOptions} />
          </div>
          <div className="chart-footer">
            <span>Total: 3.450 kg</span>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <i className="fas fa-chart-line"></i>
            <h3>Evolução do Impacto Ambiental</h3>
          </div>
          <div className="chart-wrapper">
            <Line data={impactData} options={lineOptions} />
          </div>
          <div className="chart-footer">
            <span>Meta mensal: 1.000 kg CO₂</span>
          </div>
        </div>
      </div>

      {/* Últimas Atividades */}
      <div className="activities-section">
        <h3>
          <i className="fas fa-history"></i>
          Últimas Atividades
        </h3>
        <div className="activities-list">
          <div className="activity-item">
            <div className="activity-icon">
              <i className="fas fa-plus-circle"></i>
            </div>
            <div className="activity-details">
              <span className="activity-title">Novo ponto de coleta cadastrado</span>
              <span className="activity-time">Há 2 horas</span>
            </div>
          </div>

          <div className="activity-item">
            <div className="activity-icon">
              <i className="fas fa-truck"></i>
            </div>
            <div className="activity-details">
              <span className="activity-title">Rota #123 concluída</span>
              <span className="activity-time">Há 5 horas</span>
            </div>
          </div>

          <div className="activity-item">
            <div className="activity-icon">
              <i className="fas fa-recycle"></i>
            </div>
            <div className="activity-details">
              <span className="activity-title">850 kg de plástico reciclados</span>
              <span className="activity-time">Há 1 dia</span>
            </div>
          </div>

          <div className="activity-item">
            <div className="activity-icon">
              <i className="fas fa-leaf"></i>
            </div>
            <div className="activity-details">
              <span className="activity-title">324 kg de CO₂ economizados este mês</span>
              <span className="activity-time">Há 2 dias</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;