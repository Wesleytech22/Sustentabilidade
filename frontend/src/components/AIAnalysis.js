import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AIAnalysis.css';

// ─── Mapeamentos de UI ────────────────────────────────────────────────────────

const TIPO_ICONS = {
  plastico: '🥤',
  papel: '📄',
  vidro: '🍾',
  metal: '🥫',
  organico: '🍌',
  entulho: '🧱',
  eletronico: '📱',
  perigoso: '☠️',
};

const TIPO_CORES = {
  plastico: '#2196F3',
  papel: '#795548',
  vidro: '#00BCD4',
  metal: '#607D8B',
  organico: '#8BC34A',
  entulho: '#FF9800',
  eletronico: '#9C27B0',
  perigoso: '#F44336',
};

const NIVEL_CONFIG = {
  limpo: { label: 'Área limpa', cor: '#4CAF50', classe: 'normal', icon: 'fas fa-check-circle' },
  baixo: { label: 'Baixa concentração', cor: '#8BC34A', classe: 'normal', icon: 'fas fa-info-circle' },
  medio: { label: 'Atenção', cor: '#FF9800', classe: 'warning', icon: 'fas fa-exclamation-triangle' },
  alto: { label: 'Coleta necessária', cor: '#FF5722', classe: 'warning', icon: 'fas fa-exclamation-triangle' },
  critico: { label: 'URGENTE', cor: '#F44336', classe: 'urgent', icon: 'fas fa-radiation' },
};

// ─── Componente principal ─────────────────────────────────────────────────────

const AIAnalysis = () => {
  const { api } = useAuth();
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [cardAberto, setCardAberto] = useState(null); // tipo selecionado no painel de conscientização

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
    setCardAberto(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } };
      handleImageChange(fakeEvent);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      setError('Selecione uma imagem primeiro.');
      return;
    }

    setAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', selectedImage);

    try {
      const response = await api.post('/ai/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(response.data);
    } catch (err) {
      console.error('Erro na análise:', err);
      setError(
        err.response?.data?.error ||
        'Erro ao analisar a imagem. Verifique se o serviço de IA está rodando.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const resetar = () => {
    setSelectedImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setCardAberto(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const nivelInfo = result ? (NIVEL_CONFIG[result.nivel_alerta] || NIVEL_CONFIG.limpo) : null;

  return (
    <div className="ai-analysis-container">
      {/* Cabeçalho */}
      <div className="ai-header">
        <h2>
          <i className="fas fa-microscope"></i>
          Análise de Resíduos com IA
        </h2>
        <p>
          Faça upload de uma imagem para detectar resíduos, receber sugestões de coleta
          e informações de conscientização ambiental.
        </p>
      </div>

      <div className="ai-content">
        {/* ── Área de upload ── */}
        <div className="upload-area">
          <div
            className={`upload-box ${preview ? 'has-preview' : ''}`}
            onClick={() => document.getElementById('imageInput').click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {preview ? (
              <img src={preview} alt="Preview" className="image-preview" />
            ) : (
              <>
                <i className="fas fa-cloud-upload-alt"></i>
                <p>Clique ou arraste uma imagem aqui</p>
                <span>Formatos: JPG, PNG, WebP · Máx. 10 MB</span>
              </>
            )}
            <input
              id="imageInput"
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
          </div>

          {selectedImage && !analyzing && (
            <div className="upload-actions">
              <button className="btn-reset-img" onClick={resetar}>
                <i className="fas fa-times"></i> Remover
              </button>
              <button className="btn-analyze" onClick={handleAnalyze}>
                <i className="fas fa-microchip"></i>
                Analisar com YOLO
              </button>
            </div>
          )}

          {analyzing && (
            <div className="analyzing-progress">
              <div className="progress-bar-anim"></div>
              <span>
                <i className="fas fa-spinner fa-spin"></i>
                Processando com YOLO... pode levar alguns segundos
              </span>
            </div>
          )}
        </div>

        {/* ── Erro ── */}
        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}

        {/* ── Resultados ── */}
        {result && (
          <div className="results-area">

            {/* Nível de alerta */}
            <div className="nivel-alerta-banner" style={{ borderColor: nivelInfo.cor }}>
              <i className={nivelInfo.icon} style={{ color: nivelInfo.cor }}></i>
              <div className="nivel-texto">
                <strong style={{ color: nivelInfo.cor }}>{nivelInfo.label}</strong>
                <span>{result.sugestao}</span>
              </div>
              <div className="nivel-badge" style={{ background: nivelInfo.cor }}>
                {result.total_residuos} resíduo{result.total_residuos !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Conscientização geral */}
            {result.conscientizacao && (
              <div className="conscientizacao-geral">
                <i className="fas fa-leaf"></i>
                <p>{result.conscientizacao}</p>
              </div>
            )}

            {/* Resumo visual por categoria (barras de porcentagem) */}
            {result.resumo_categorias && result.resumo_categorias.length > 0 && (
              <div className="resumo-categorias">
                <h4>
                  <i className="fas fa-chart-bar"></i>
                  Composição dos resíduos detectados
                </h4>
                <div className="barras-categorias">
                  {result.resumo_categorias.map((cat) => (
                    <div key={cat.tipo} className="barra-item">
                      <div className="barra-label">
                        <span>{TIPO_ICONS[cat.tipo] || '🗑️'} {cat.tipo}</span>
                        <span className="barra-qtd">
                          {cat.quantidade}× · {cat.percentual}%
                        </span>
                      </div>
                      <div className="barra-track">
                        <div
                          className="barra-fill"
                          style={{
                            width: `${cat.percentual}%`,
                            background: TIPO_CORES[cat.tipo] || '#888',
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cards de detecção com conscientização expansível */}
            {result.deteccoes && result.deteccoes.length > 0 && (
              <div className="deteccoes-list">
                <h4>
                  <i className="fas fa-search"></i>
                  Detalhes por tipo de resíduo
                </h4>
                <div className="deteccoes-grid">
                  {result.deteccoes.map((det) => {
                    const aberto = cardAberto === det.tipo;
                    return (
                      <div
                        key={det.tipo}
                        className={`deteccao-card ${aberto ? 'aberto' : ''}`}
                        onClick={() => setCardAberto(aberto ? null : det.tipo)}
                      >
                        {/* Linha principal */}
                        <div className="deteccao-main">
                          <span className="deteccao-icon">{TIPO_ICONS[det.tipo] || '🗑️'}</span>
                          <div className="deteccao-info">
                            <span className="deteccao-tipo">{det.tipo}</span>
                            <span className="deteccao-confianca">
                              {det.quantidade}× detectado · confiança{' '}
                              {(det.confianca * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="deteccao-right">
                            <div className="confidence-bar">
                              <div
                                className="confidence-fill"
                                style={{
                                  width: `${det.confianca * 100}%`,
                                  background: TIPO_CORES[det.tipo] || '#4CAF50',
                                }}
                              ></div>
                            </div>
                            <i className={`fas fa-chevron-${aberto ? 'up' : 'down'} chevron`}></i>
                          </div>
                        </div>

                        {/* Painel de conscientização (expansível) */}
                        {aberto && (det.impacto || det.acao) && (
                          <div className="consciencia-painel">
                            {det.impacto && (
                              <div className="consciencia-bloco impacto">
                                <i className="fas fa-exclamation-triangle"></i>
                                <div>
                                  <strong>Impacto ambiental</strong>
                                  <p>{det.impacto}</p>
                                </div>
                              </div>
                            )}
                            {det.acao && (
                              <div className="consciencia-bloco acao">
                                <i className="fas fa-recycle"></i>
                                <div>
                                  <strong>Como descartar corretamente</strong>
                                  <p>{det.acao}</p>
                                </div>
                              </div>
                            )}
                            {det.dados && (
                              <div className="consciencia-bloco dados">
                                <i className="fas fa-chart-pie"></i>
                                <div>
                                  <strong>Dado importante</strong>
                                  <p>{det.dados}</p>
                                </div>
                              </div>
                            )}
                            {det.destino && (
                              <div className="consciencia-bloco destino">
                                <i className="fas fa-route"></i>
                                <div>
                                  <strong>Destino correto</strong>
                                  <p>{det.destino}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Metadados */}
            {result.metadata && (
              <div className="metadata-bar">
                <span>
                  <i className="fas fa-brain"></i>
                  Modelo: {result.metadata.modelo}
                </span>
                <span>
                  <i className="fas fa-image"></i>
                  {result.metadata.imagem}
                </span>
                <span>
                  <i className="fas fa-clock"></i>
                  {new Date(result.metadata.analisado_em).toLocaleString('pt-BR')}
                </span>
              </div>
            )}

            {/* Ações */}
            <div className="actions">
              <button className="btn-new" onClick={resetar}>
                <i className="fas fa-plus"></i>
                Nova Análise
              </button>
              <button
                className="btn-route"
                onClick={() => (window.location.href = '/dashboard/routes')}
              >
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