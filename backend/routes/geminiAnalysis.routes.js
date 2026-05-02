// backend/src/routes/geminiAnalysis.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const geminiAnalysisService = require('../services/geminiAnalysisService');
const authMiddleware = require('../middleware/auth');

// Configuração do multer para upload de imagens
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `analysis-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        cb(null, true);
    } else {
        cb(new Error('Apenas imagens são permitidas (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: fileFilter
});

/**
 * POST /api/gemini/analyze
 * Analisar imagem com Gemini e gerar relatório detalhado
 */
router.post('/analyze', authMiddleware, upload.single('image'), async (req, res) => {
    let uploadedFile = null;

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Nenhuma imagem enviada'
            });
        }

        uploadedFile = req.file;

        // Ler imagem e converter para base64
        const imageBuffer = fs.readFileSync(uploadedFile.path);
        const imageBase64 = imageBuffer.toString('base64');

        // Contexto adicional da requisição
        const context = {
            location: req.body.location || null,
            datetime: req.body.datetime || null,
            areaType: req.body.areaType || null,
            userId: req.userId
        };

        console.log(`🤖 Iniciando análise Gemini para usuário ${req.userId}`);

        // Realizar análise com Gemini
        const analysis = await geminiAnalysisService.analyzeImage(imageBase64, context);

        // Gerar relatório legível
        const readableReport = geminiAnalysisService.generateReadableReport(analysis);

        // Salvar no banco de dados (opcional)
        // await AnalysisHistory.create({ ... });

        // Limpar arquivo temporário
        if (fs.existsSync(uploadedFile.path)) {
            fs.unlinkSync(uploadedFile.path);
        }

        res.json({
            success: true,
            analysis: analysis,
            readableReport: readableReport,
            metadata: {
                analyzedAt: new Date().toISOString(),
                imageName: uploadedFile.originalname,
                imageSize: uploadedFile.size,
                model: 'gemini-1.5-flash'
            }
        });

    } catch (error) {
        console.error('❌ Erro na análise Gemini:', error);

        // Limpar arquivo em caso de erro
        if (uploadedFile && fs.existsSync(uploadedFile.path)) {
            fs.unlinkSync(uploadedFile.path);
        }

        res.status(500).json({
            success: false,
            error: 'Erro ao processar análise com Gemini',
            details: error.message
        });
    }
});

/**
 * POST /api/gemini/analyze-base64
 * Analisar imagem enviada como base64
 */
router.post('/analyze-base64', authMiddleware, async (req, res) => {
    try {
        const { imageBase64, context } = req.body;

        if (!imageBase64) {
            return res.status(400).json({
                success: false,
                error: 'Nenhuma imagem fornecida'
            });
        }

        // Remover prefixo data:image/...;base64, se existir
        let cleanBase64 = imageBase64;
        if (imageBase64.includes(',')) {
            cleanBase64 = imageBase64.split(',')[1];
        }

        const analysis = await geminiAnalysisService.analyzeImage(cleanBase64, context || {});
        const readableReport = geminiAnalysisService.generateReadableReport(analysis);

        res.json({
            success: true,
            analysis,
            readableReport,
            metadata: {
                analyzedAt: new Date().toISOString(),
                model: 'gemini-1.5-flash'
            }
        });

    } catch (error) {
        console.error('❌ Erro na análise Gemini:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao processar análise',
            details: error.message
        });
    }
});

/**
 * GET /api/gemini/health
 * Verificar disponibilidade do serviço
 */
router.get('/health', async (req, res) => {
    try {
        const hasApiKey = !!process.env.GEMINI_API_KEY;

        res.json({
            success: true,
            geminiAvailable: hasApiKey,
            message: hasApiKey ? 'Gemini API configurada' : 'Gemini API NÃO configurada'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;