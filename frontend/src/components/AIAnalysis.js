import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AIAnalysis.css';

const AIAnalysis = () => {
  const { api } = useAuth();
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      setError('Selecione uma imagem primeiro');
      return;
    }

    setAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', selectedImage);

    try {
      const response = await api.post('/ai/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(response.data);
    } catch (err) {
      console.error('Erro na análise:', err);
      setError('Erro ao analisar a imagem. Tente novamente.');
    } finally {
      setAnalyzing(false);
    }
  };

  const getSugestaoClass = (sugestao) => {
    if (sugestao?.includes('URGENTE')) return 'urgent';
    if (sugestao?.includes('Atenção')) return 'warning';
    return 'normal';
  };

  const getTipoIcon = (tipo) => {
    const icons = {
      'plastico': '🥤',
      'papel': '📄',
      'vidro': '🍾',
      'metal': '🥫',
      'organico': '🍌',
      'entulho': '🧱'
    };
    return icons[tipo] || '🗑️';
  };

  return (
    <div className="ai-analysis-container">
      <div className="ai-header">
        <h2>
          <i className="fas fa-robot"></i>
          Análise por Inteligência Artificial
        </h2>
        <p>Faça upload de uma imagem para detectar resíduos e receber sugestões de coleta</p>
      </div>

      <div className="ai-content">
        {/* Área de upload */}
        <div className="upload-area">
          <div className="upload-box" onClick={() => document.getElementById('imageInput').click()}>
            {preview ? (
              <img src={preview} alt="Preview" className="image-preview" />
            ) : (
              <>
                <i className="fas fa-cloud-upload-alt"></i>
                <p>Clique ou arraste uma imagem</p>
                <span>Formatos: JPG, PNG (máx. 10MB)</span>
              </>
            )}
            <input
              id="imageInput"
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
          </div>

          {selectedImage && (
            <button 
              className="btn-analyze" 
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Analisando...
                </>
              ) : (
                <>
                  <i className="fas fa-microchip"></i>
                  Analisar com IA
                </>
              )}
            </button>
          )}
        </div>

        {/* Mensagens de erro */}
        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}

        {/* Resultados da análise */}
        {result && (
          <div className="results-area">
            <div className="results-header">
              <h3>
                <i className="fas fa-chart-bar"></i>
                Resultado da Análise
              </h3>
              <div className={`sugestao-card ${getSugestaoClass(result.sugestao)}`}>
                <i className="fas fa-lightbulb"></i>
                <span>{result.sugestao}</span>
              </div>
            </div>

            <div className="stats-summary">
              <div className="stat">
                <span className="stat-value">{result.total_residuos}</span>
                <span className="stat-label">Resíduos Detectados</span>
              </div>
            </div>

            <div className="deteccoes-list">
              <h4>Detecções:</h4>
              <div className="deteccoes-grid">
                {result.deteccoes.map((det, index) => (
                  <div key={index} className="deteccao-card">
                    <span className="deteccao-icon">{getTipoIcon(det.tipo)}</span>
                    <div className="deteccao-info">
                      <span className="deteccao-tipo">{det.tipo}</span>
                      <span className="deteccao-confianca">
                        Confiança: {(det.confianca * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="confidence-bar">
                      <div 
                        className="confidence-fill" 
                        style={{ width: `${det.confianca * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="actions">
              <button className="btn-new" onClick={() => {
                setSelectedImage(null);
                setPreview(null);
                setResult(null);
              }}>
                <i className="fas fa-plus"></i>
                Nova Análise
              </button>
              <button className="btn-route" onClick={() => window.location.href = '/dashboard/routes'}>
                <i className="fas fa-route"></i>
                Criar Rota de Coleta
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAnalysis;