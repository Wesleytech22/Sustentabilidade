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
import { Line, Doughnut } from 'react-chartjs-2';

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

const Impact = () => {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [impact, setImpact] = useState({
    treesSaved: 0,
    waterSaved: 0,
    energySaved: 0,
    carbonSaved: 0,
    recyclingRate: 0,
    co2Reduction: 0,
    fuelSaved: 0,
    wasteDiverted: 0
  });
  const [evolutionData, setEvolutionData] = useState({
    labels: [],
    actual: [],
    goal: []
  });
  const [wasteDistribution, setWasteDistribution] = useState({
    labels: [],
    data: []
  });
  const [benefitsDetail, setBenefitsDetail] = useState([]);

  // Carregar dados reais
  const loadImpactData = async (period) => {
    try {
      setLoading(true);
      setError(null);

      const [impactRes, evolutionRes, distributionRes, benefitsRes] = await Promise.all([
        api.get('/impact/summary').catch(() => ({ data: null })),
        api.get(`/impact/evolution?period=${period}`).catch(() => ({ data: null })),
        api.get('/impact/waste-distribution').catch(() => ({ data: null })),
        api.get('/impact/benefits').catch(() => ({ data: null }))
      ]);

      // Impacto principal
      if (impactRes.data) {
        setImpact({
          treesSaved: impactRes.data.treesSaved || 0,
          waterSaved: impactRes.data.waterSaved || 0,
          energySaved: impactRes.data.energySaved || 0,
          carbonSaved: impactRes.data.carbonSaved || 0,
          recyclingRate: impactRes.data.recyclingRate || 0,
          co2Reduction: impactRes.data.co2Reduction || 0,
          fuelSaved: impactRes.data.fuelSaved || 0,
          wasteDiverted: impactRes.data.wasteDiverted || 0
        });
      }

      // Evolução
      if (evolutionRes.data && evolutionRes.data.labels) {
        setEvolutionData({
          labels: evolutionRes.data.labels,
          actual: evolutionRes.data.actual,
          goal: evolutionRes.data.goal
        });
      }

      // Distribuição de resíduos
      if (distributionRes.data && distributionRes.data.labels) {
        setWasteDistribution({
          labels: distributionRes.data.labels,
          data: distributionRes.data.data
        });
      }

      // Benefícios detalhados
      if (benefitsRes.data && benefitsRes.data.benefits) {
        setBenefitsDetail(benefitsRes.data.benefits);
      }

    } catch (err) {
      console.error('Erro ao carregar dados de impacto:', err);
      setError('Erro ao carregar dados de impacto. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImpactData(selectedPeriod);
  }, [selectedPeriod]);

  // Dados para o gráfico de evolução
  const evolutionChartData = {
    labels: evolutionData.labels,
    datasets: [
      {
        label: 'CO₂ Evitado (kg)',
        data: evolutionData.actual,
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#4CAF50',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Meta',
        data: evolutionData.goal,
        borderColor: '#FF9800',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0.4,
      }
    ]
  };

  // Dados para o gráfico de distribuição de resíduos
  const wasteDistributionData = {
    labels: wasteDistribution.labels,
    datasets: [
      {
        data: wasteDistribution.data,
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

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          font: { size: 12 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.raw.toLocaleString()} kg`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: {
          callback: value => value.toLocaleString() + ' kg',
          font: { size: 11 }
        }
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: 12 },
          generateLabels: (chart) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => ({
                text: `${label}: ${data.datasets[0].data[i].toLocaleString()} kg`,
                fillStyle: data.datasets[0].backgroundColor[i],
                strokeStyle: 'transparent',
                lineWidth: 0,
                hidden: false,
                index: i
              }));
            }
            return [];
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const total = wasteDistribution.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
            return `${context.label}: ${context.raw.toLocaleString()} kg (${percentage}%)`;
          }
        }
      }
    }
  };

  const totalWaste = wasteDistribution.data.reduce((a, b) => a + b, 0);

  // Calcular percentual da meta anual
  const getGoalPercentage = () => {
    const totalActual = evolutionData.actual.reduce((a, b) => a + b, 0);
    const totalGoal = evolutionData.goal.reduce((a, b) => a + b, 0);
    if (totalGoal === 0) return 0;
    return Math.round((totalActual / totalGoal) * 100);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Carregando dados de impacto...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <i className="fas fa-exclamation-triangle"></i>
        <p>{error}</p>
        <button onClick={() => loadImpactData(selectedPeriod)} className="btn-primary">Tentar Novamente</button>
      </div>
    );
  }

  return (
    <div className="impact-container">
      <div className="impact-header">
        <div>
          <h2>Impacto Ambiental</h2>
          <p className="impact-subtitle">Acompanhe o impacto positivo das suas ações</p>
        </div>
        <div className="period-selector">
          <button
            className={`period-btn ${selectedPeriod === 'week' ? 'active' : ''}`}
            onClick={() => setSelectedPeriod('week')}
          >
            <i className="fas fa-calendar-week"></i>
            Semana
          </button>
          <button
            className={`period-btn ${selectedPeriod === 'month' ? 'active' : ''}`}
            onClick={() => setSelectedPeriod('month')}
          >
            <i className="fas fa-calendar-alt"></i>
            Mês
          </button>
          <button
            className={`period-btn ${selectedPeriod === 'year' ? 'active' : ''}`}
            onClick={() => setSelectedPeriod('year')}
          >
            <i className="fas fa-calendar"></i>
            Ano
          </button>
        </div>
      </div>

      {/* Cards de impacto principal */}
      <div className="impact-cards-grid">
        <div className="impact-card primary">
          <div className="impact-icon-wrapper">
            <i className="fas fa-tree"></i>
          </div>
          <div className="impact-content">
            <span className="impact-label">Árvores Preservadas</span>
            <span className="impact-value">{impact.treesSaved.toLocaleString()}</span>
          </div>
        </div>

        <div className="impact-card">
          <div className="impact-icon-wrapper blue">
            <i className="fas fa-water"></i>
          </div>
          <div className="impact-content">
            <span className="impact-label">Água Economizada</span>
            <span className="impact-value">{impact.waterSaved.toLocaleString()} L</span>
          </div>
        </div>

        <div className="impact-card">
          <div className="impact-icon-wrapper orange">
            <i className="fas fa-bolt"></i>
          </div>
          <div className="impact-content">
            <span className="impact-label">Energia Economizada</span>
            <span className="impact-value">{impact.energySaved.toLocaleString()} kWh</span>
          </div>
        </div>

        <div className="impact-card">
          <div className="impact-icon-wrapper green">
            <i className="fas fa-leaf"></i>
          </div>
          <div className="impact-content">
            <span className="impact-label">CO₂ Evitado</span>
            <span className="impact-value">{impact.carbonSaved.toLocaleString()} kg</span>
          </div>
        </div>
      </div>

      {/* Métricas secundárias */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="metric-info">
            <span className="metric-label">Taxa de Reciclagem</span>
            <span className="metric-value">{impact.recyclingRate}%</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${impact.recyclingRate}%` }}></div>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <i className="fas fa-industry"></i>
          </div>
          <div className="metric-info">
            <span className="metric-label">Redução de CO₂</span>
            <span className="metric-value">{impact.co2Reduction.toLocaleString()} kg</span>
            <span className="metric-sub">Equivalente a {Math.round(impact.co2Reduction / 20)} carros/ano</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <i className="fas fa-gas-pump"></i>
          </div>
          <div className="metric-info">
            <span className="metric-label">Combustível Economizado</span>
            <span className="metric-value">{impact.fuelSaved.toLocaleString()} L</span>
            <span className="metric-sub">Rotas otimizadas</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <i className="fas fa-trash-alt"></i>
          </div>
          <div className="metric-info">
            <span className="metric-label">Resíduos Desviados</span>
            <span className="metric-value">{impact.wasteDiverted.toLocaleString()} kg</span>
            <span className="metric-sub">De aterros sanitários</span>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="impact-charts">
        <div className="chart-card">
          <div className="chart-header">
            <i className="fas fa-chart-line"></i>
            <h3>Evolução da Redução de CO₂</h3>
          </div>
          <div className="chart-wrapper">
            {evolutionData.actual.length > 0 ? (
              <Line data={evolutionChartData} options={lineOptions} />
            ) : (
              <div className="no-data-message">
                <i className="fas fa-chart-line"></i>
                <p>Nenhum dado de evolução disponível</p>
              </div>
            )}
          </div>
          <div className="chart-footer">
            <div className="achievement-badge">
              <i className="fas fa-trophy"></i>
              <span>Meta anual: {getGoalPercentage()}% atingida</span>
            </div>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <i className="fas fa-chart-pie"></i>
            <h3>Distribuição por Tipo de Resíduo</h3>
          </div>
          <div className="chart-wrapper">
            {totalWaste > 0 ? (
              <Doughnut data={wasteDistributionData} options={doughnutOptions} />
            ) : (
              <div className="no-data-message">
                <i className="fas fa-chart-pie"></i>
                <p>Nenhum dado de distribuição disponível</p>
              </div>
            )}
          </div>
          <div className="chart-footer">
            <div className="total-badge">
              <i className="fas fa-weight-hanging"></i>
              <span>Total: {totalWaste.toLocaleString()} kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* Benefícios detalhados */}
      {benefitsDetail.length > 0 && (
        <div className="benefits-section">
          <h3>
            <i className="fas fa-star"></i>
            Impacto Detalhado
          </h3>
          <div className="benefits-grid">
            {benefitsDetail.map((benefit, index) => (
              <div key={benefit.id || index} className="benefit-card">
                <div className="benefit-header">
                  <i className={`fas fa-${benefit.icon || 'leaf'}`}></i>
                  <h4>{benefit.title}</h4>
                </div>
                <p className="benefit-description">{benefit.description}</p>
                <div className="benefit-stats">
                  {benefit.stats?.map((stat, idx) => (
                    <div key={idx} className="stat">
                      <span>{stat.label}</span>
                      <strong>{stat.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .no-data-message {
          text-align: center;
          padding: 60px;
          color: #999;
        }
        .no-data-message i {
          font-size: 48px;
          margin-bottom: 10px;
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

export default Impact;