// backend/src/routes/ai_routes.js
// Proxy entre o frontend e o serviço Python YOLO (porta 5001).
// Adiciona autenticação JWT e sanitização antes de repassar ao serviço AI.

const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// ─── Configuração ─────────────────────────────────────────────────────────────

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Upload temporário em memória (não salva em disco desnecessariamente)
const upload = multer({
    dest: path.join(__dirname, '../../uploads/ai-tmp/'),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) return cb(null, true);
        cb(new Error('Apenas imagens JPEG, PNG ou WebP são permitidas'));
    },
});

// Garante que o diretório temporário existe
const tmpDir = path.join(__dirname, '../../uploads/ai-tmp/');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

// ─── Helper: limpar arquivo temporário ────────────────────────────────────────

const cleanTmp = (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) { /* silencioso */ }
};

// ─── POST /api/ai/analyze ─────────────────────────────────────────────────────

/**
 * Recebe a imagem do frontend, repassa ao serviço Python YOLO
 * e devolve a resposta enriquecida com conscientização.
 */
router.post('/analyze', upload.single('image'), async (req, res) => {
    const tmpPath = req.file?.path;

    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Nenhuma imagem enviada' });
        }

        // Monta o FormData para enviar ao serviço Python
        const form = new FormData();
        form.append('image', fs.createReadStream(tmpPath), {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });

        const aiResponse = await axios.post(`${AI_SERVICE_URL}/detect`, form, {
            headers: { ...form.getHeaders() },
            timeout: 60_000, // YOLO pode demorar alguns segundos na primeira inferência
        });

        cleanTmp(tmpPath);

        const data = aiResponse.data;

        if (!data.success) {
            return res.status(502).json({
                success: false,
                error: data.error || 'Erro no serviço de IA',
            });
        }

        // ── Enriquecer resposta com resumo por categoria ──────────────────────────

        const resumoPorCategoria = gerarResumoPorCategoria(data.deteccoes || []);
        const nivelAlerta = calcularNivelAlerta(data.total_residuos || 0);

        return res.json({
            success: true,
            deteccoes: data.deteccoes || [],
            total_residuos: data.total_residuos || 0,
            tipos_unicos: data.tipos_unicos || 0,
            sugestao: data.sugestao || '',
            conscientizacao: data.conscientizacao || '',
            nivel_alerta: nivelAlerta,
            resumo_categorias: resumoPorCategoria,
            metadata: {
                analisado_em: new Date().toISOString(),
                modelo: data.modelo || 'yolov8',
                imagem: req.file.originalname,
                tamanho_bytes: req.file.size,
            },
        });

    } catch (error) {
        cleanTmp(tmpPath);

        console.error('❌ Erro ao chamar serviço AI:', error.message);

        // Serviço Python fora do ar
        if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
            return res.status(503).json({
                success: false,
                error: 'Serviço de IA temporariamente indisponível. Tente novamente em instantes.',
            });
        }

        // Timeout
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({
                success: false,
                error: 'A análise demorou muito. Tente uma imagem menor ou aguarde.',
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Erro ao processar análise de IA',
            details: error.message,
        });
    }
});

// ─── GET /api/ai/health ───────────────────────────────────────────────────────

router.get('/health', async (req, res) => {
    try {
        const response = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5_000 });
        res.json({
            success: true,
            ai_service: response.data,
            service_url: AI_SERVICE_URL,
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            error: 'Serviço AI inacessível',
            service_url: AI_SERVICE_URL,
        });
    }
});

// ─── Helpers locais ───────────────────────────────────────────────────────────

/**
 * Calcula nível de alerta com base no total de resíduos detectados.
 * @returns {'limpo' | 'baixo' | 'medio' | 'alto' | 'critico'}
 */
function calcularNivelAlerta(total) {
    if (total === 0) return 'limpo';
    if (total <= 3) return 'baixo';
    if (total <= 6) return 'medio';
    if (total <= 15) return 'alto';
    return 'critico';
}

/**
 * Gera um resumo de porcentagem por categoria para exibição em gráfico.
 */
function gerarResumoPorCategoria(deteccoes) {
    const total = deteccoes.reduce((sum, d) => sum + (d.quantidade || 1), 0);
    if (total === 0) return [];

    return deteccoes.map(d => ({
        tipo: d.tipo,
        quantidade: d.quantidade || 1,
        percentual: Math.round(((d.quantidade || 1) / total) * 100),
        confianca: d.confianca,
    }));
}

module.exports = router;