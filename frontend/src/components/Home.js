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
  const { user, api } = useAuth();
  const [stats, setStats] = useState({
    points: 0,
    routes: 0,
    totalWaste: 0,
    totalCarbon: 0
  });
  const [wasteByType, setWasteByType] = useState({
    labels: ['Plástico', 'Papel', 'Vidro', 'Metal', 'Orgânico'],
    data: [0, 0, 0, 0, 0]
  });
  const [monthlyImpact, setMonthlyImpact] = useState({
    labels: [],
    data: []
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Função para obter a mensagem de boas-vindas baseada no role
  const getWelcomeMessage = () => {
    if (!user) return 'Bem-vindo ao EcoRoute!';

    switch (user.role) {
      case 'SUPPORT':
        return 'Bem-vindo, equipe de Suporte!';
      case 'COMPANY':
        return 'Bem-vindo, Empresa Parceira!';
      case 'LOGISTICS':
        return 'Bem-vindo, equipe de Logística!';
      case 'ADMIN':
        return 'Bem-vindo, Administrador!';
      default:
        return 'Bem-vindo, Cooperativa!';
    }
  };

  // Carregar dados reais do backend
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar estatísticas gerais
      const [statsRes, wasteRes, impactRes, activitiesRes] = await Promise.all([
        api.get('/dashboard/stats').catch(() => ({ data: null })),
        api.get('/dashboard/waste-by-type').catch(() => ({ data: null })),
        api.get('/dashboard/monthly-impact').catch(() => ({ data: null })),
        api.get('/dashboard/recent-activities').catch(() => ({ data: null }))
      ]);

      // Estatísticas
      if (statsRes.data) {
        setStats({
          points: statsRes.data.pointsCount || 0,
          routes: statsRes.data.routesCount || 0,
          totalWaste: statsRes.data.totalWaste || 0,
          totalCarbon: statsRes.data.totalCarbon || 0
        });
      }

      // Resíduos por tipo
      if (wasteRes.data && wasteRes.data.labels) {
        setWasteByType({
          labels: wasteRes.data.labels,
          data: wasteRes.data.data
        });
      }

      // Impacto mensal
      if (impactRes.data && impactRes.data.labels) {
        setMonthlyImpact({
          labels: impactRes.data.labels,
          data: impactRes.data.data
        });
      }

      // Atividades recentes
      if (activitiesRes.data && activitiesRes.data.activities) {
        setRecentActivities(activitiesRes.data.activities);
      }

    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err);
      setError('Erro ao carregar dados. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Dados para o gráfico de coleta por tipo
  const wasteData = {
    labels: wasteByType.labels,
    datasets: [
      {
        data: wasteByType.data,
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
    labels: monthlyImpact.labels,
    datasets: [
      {
        label: 'CO₂ Economizado (kg)',
        data: monthlyImpact.data,
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

  const totalWaste = wasteByType.data.reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Carregando dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <i className="fas fa-exclamation-triangle"></i>
        <p>{error}</p>
        <button onClick={loadDashboardData} className="btn-primary">Tentar Novamente</button>
      </div>
    );
  }

  return (
    <div className="home">
      <div className="welcome-header">
        <div className="welcome-text">
          <h2>{getWelcomeMessage()}</h2>
          <p className="user-name">
            <i className="fas fa-user-circle"></i>
            {user?.name || 'Usuário'}
          </p>
        </div>
      </div>

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
            <span className="stat-value">{stats.totalWaste.toLocaleString()} kg</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-leaf"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">CO₂ Economizado</span>
            <span className="stat-value">{stats.totalCarbon.toLocaleString()} kg</span>
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
            {totalWaste > 0 ? (
              <Doughnut data={wasteData} options={doughnutOptions} />
            ) : (
              <div className="no-data-message">
                <i className="fas fa-chart-pie"></i>
                <p>Nenhum dado de coleta disponível</p>
              </div>
            )}
          </div>
          <div className="chart-footer">
            <span>Total: {totalWaste.toLocaleString()} kg</span>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <i className="fas fa-chart-line"></i>
            <h3>Evolução do Impacto Ambiental</h3>
          </div>
          <div className="chart-wrapper">
            {monthlyImpact.data.length > 0 ? (
              <Line data={impactData} options={lineOptions} />
            ) : (
              <div className="no-data-message">
                <i className="fas fa-chart-line"></i>
                <p>Nenhum dado de impacto disponível</p>
              </div>
            )}
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
          {recentActivities.length > 0 ? (
            recentActivities.map((activity, index) => (
              <div key={activity.id || index} className="activity-item">
                <div className="activity-icon">
                  <i className={activity.icon || 'fas fa-info-circle'}></i>
                </div>
                <div className="activity-details">
                  <span className="activity-title">{activity.title}</span>
                  <span className="activity-time">{activity.timeAgo || activity.date}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-activities">
              <p>Nenhuma atividade recente</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .welcome-header {
          margin-bottom: 25px;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          color: white;
        }

        .welcome-text h2 {
          margin: 0 0 8px 0;
          font-size: 22px;
          font-weight: 600;
        }

        .welcome-text .user-name {
          margin: 0;
          font-size: 15px;
          opacity: 0.95;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .no-data-message {
          text-align: center;
          padding: 40px;
          color: #999;
        }

        .no-data-message i {
          font-size: 48px;
          margin-bottom: 10px;
        }

        .empty-activities {
          text-align: center;
          padding: 30px;
          color: #999;
        }

        .error-container {
          text-align: center;
          padding: 50px;
          background: #fff3f3;
          border-radius: 12px;
          color: #d32f2f;
        }

        .error-container i {
          font-size: 48px;
          margin-bottom: 15px;
        }
      `}</style>
    </div>
  );
};

export default Home;