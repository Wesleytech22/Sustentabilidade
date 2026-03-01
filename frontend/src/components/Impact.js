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
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [impact, setImpact] = useState({
    treesSaved: 1248,
    waterSaved: 62400,
    energySaved: 21840,
    carbonSaved: 8424,
    recyclingRate: 78,
    co2Reduction: 3240,
    fuelSaved: 1250,
    wasteDiverted: 8450
  });

  // Dados para o gráfico de evolução mensal
  const evolutionData = {
    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    datasets: [
      {
        label: 'CO₂ Evitado (kg)',
        data: [3240, 3560, 3890, 4120, 4450, 4680, 4920, 5230, 5540, 5860, 6120, 6420],
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
        data: [3000, 3300, 3600, 3900, 4200, 4500, 4800, 5100, 5400, 5700, 6000, 6300],
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
    labels: ['Plástico', 'Papel', 'Vidro', 'Metal', 'Orgânico'],
    datasets: [
      {
        data: [2850, 3420, 1250, 980, 1950],
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
          label: (context) => `${context.label}: ${context.raw.toLocaleString()} kg (${((context.raw / 10450) * 100).toFixed(1)}%)`
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Carregando dados de impacto...</p>
      </div>
    );
  }

  return (
    <div className="impact-container">
      {/* Header com período e metas */}
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
            <span className="impact-trend positive">
              <i className="fas fa-arrow-up"></i> +12% este mês
            </span>
          </div>
        </div>

        <div className="impact-card">
          <div className="impact-icon-wrapper blue">
            <i className="fas fa-water"></i>
          </div>
          <div className="impact-content">
            <span className="impact-label">Água Economizada</span>
            <span className="impact-value">{impact.waterSaved.toLocaleString()} L</span>
            <span className="impact-trend positive">
              <i className="fas fa-arrow-up"></i> +8% este mês
            </span>
          </div>
        </div>

        <div className="impact-card">
          <div className="impact-icon-wrapper orange">
            <i className="fas fa-bolt"></i>
          </div>
          <div className="impact-content">
            <span className="impact-label">Energia Economizada</span>
            <span className="impact-value">{impact.energySaved.toLocaleString()} kWh</span>
            <span className="impact-trend positive">
              <i className="fas fa-arrow-up"></i> +15% este mês
            </span>
          </div>
        </div>

        <div className="impact-card">
          <div className="impact-icon-wrapper green">
            <i className="fas fa-leaf"></i>
          </div>
          <div className="impact-content">
            <span className="impact-label">CO₂ Evitado</span>
            <span className="impact-value">{impact.carbonSaved.toLocaleString()} kg</span>
            <span className="impact-trend positive">
              <i className="fas fa-arrow-up"></i> +10% este mês
            </span>
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
            <Line data={evolutionData} options={lineOptions} />
          </div>
          <div className="chart-footer">
            <div className="achievement-badge">
              <i className="fas fa-trophy"></i>
              <span>Meta anual: 82% atingida</span>
            </div>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <i className="fas fa-chart-pie"></i>
            <h3>Distribuição por Tipo de Resíduo</h3>
          </div>
          <div className="chart-wrapper">
            <Doughnut data={wasteDistributionData} options={doughnutOptions} />
          </div>
          <div className="chart-footer">
            <div className="total-badge">
              <i className="fas fa-weight-hanging"></i>
              <span>Total: 10.450 kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* Benefícios detalhados */}
      <div className="benefits-section">
        <h3>
          <i className="fas fa-star"></i>
          Impacto Detalhado
        </h3>
        <div className="benefits-grid">
          <div className="benefit-card">
            <div className="benefit-header">
              <i className="fas fa-tree"></i>
              <h4>Florestas Preservadas</h4>
            </div>
            <p className="benefit-description">
              Com {impact.treesSaved.toLocaleString()} árvores preservadas, 
              equivalentes a {Math.round(impact.treesSaved / 100)} hectares de floresta.
            </p>
            <div className="benefit-stats">
              <div className="stat">
                <span>O₂ Gerado</span>
                <strong>{(impact.treesSaved * 118).toLocaleString()} kg/ano</strong>
              </div>
              <div className="stat">
                <span>Habitat Preservado</span>
                <strong>{Math.round(impact.treesSaved * 0.5)} espécies</strong>
              </div>
            </div>
          </div>

          <div className="benefit-card">
            <div className="benefit-header">
              <i className="fas fa-water"></i>
              <h4>Recursos Hídricos</h4>
            </div>
            <p className="benefit-description">
              Economia de {impact.waterSaved.toLocaleString()} litros de água, 
              suficiente para abastecer {Math.round(impact.waterSaved / 150)} famílias por mês.
            </p>
            <div className="benefit-stats">
              <div className="stat">
                <span>Piscinas Olímpicas</span>
                <strong>{Math.round(impact.waterSaved / 2500000)} unidades</strong>
              </div>
              <div className="stat">
                <span>Dias de consumo</span>
                <strong>{Math.round(impact.waterSaved / 150)} dias</strong>
              </div>
            </div>
          </div>

          <div className="benefit-card">
            <div className="benefit-header">
              <i className="fas fa-bolt"></i>
              <h4>Energia Renovável</h4>
            </div>
            <p className="benefit-description">
              {impact.energySaved.toLocaleString()} kWh economizados, 
              equivalente a {Math.round(impact.energySaved / 150)} meses de consumo residencial.
            </p>
            <div className="benefit-stats">
              <div className="stat">
                <span>Casas abastecidas</span>
                <strong>{Math.round(impact.energySaved / 150)} meses</strong>
              </div>
              <div className="stat">
                <span>Carvão evitado</span>
                <strong>{Math.round(impact.energySaved * 0.5)} kg</strong>
              </div>
            </div>
          </div>

          <div className="benefit-card">
            <div className="benefit-header">
              <i className="fas fa-leaf"></i>
              <h4>Qualidade do Ar</h4>
            </div>
            <p className="benefit-description">
              {impact.carbonSaved.toLocaleString()} kg de CO₂ deixaram de ser emitidos, 
              equivalente a {Math.round(impact.carbonSaved / 20)} carros populares.
            </p>
            <div className="benefit-stats">
              <div className="stat">
                <span>Árvores necessárias</span>
                <strong>{Math.round(impact.carbonSaved / 22)} unidades</strong>
              </div>
              <div className="stat">
                <span>Voos SP-Rio</span>
                <strong>{Math.round(impact.carbonSaved / 100)} viagens</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Impact;