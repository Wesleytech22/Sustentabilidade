// backend/src/routes/analysisHistory.routes.js
const express = require('express');
const router = express.Router();
const AnalysisHistory = require('../models/AnalysisHistory');
const authMiddleware = require('../middleware/auth');

/**
 * GET /api/analysis/history
 * Listar histórico de análises do usuário
 */
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const { limit = 20, page = 1 } = req.query;

        const analyses = await AnalysisHistory.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .select('imageName createdAt summary readableReport metadata.shared');

        const total = await AnalysisHistory.countDocuments({ userId: req.userId });

        res.json({
            success: true,
            analyses,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar histórico:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/analysis/:id
 * Buscar análise específica
 */
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const analysis = await AnalysisHistory.findOne({
            _id: req.params.id,
            userId: req.userId
        });

        if (!analysis) {
            return res.status(404).json({
                success: false,
                error: 'Análise não encontrada'
            });
        }

        res.json({ success: true, analysis });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/analysis/:id/share
 * Compartilhar análise (token público)
 */
router.post('/:id/share', authMiddleware, async (req, res) => {
    try {
        const analysis = await AnalysisHistory.findOne({
            _id: req.params.id,
            userId: req.userId
        });

        if (!analysis) {
            return res.status(404).json({
                success: false,
                error: 'Análise não encontrada'
            });
        }

        const token = analysis.generateShareToken();
        await analysis.save();

        const shareUrl = `${process.env.FRONTEND_URL}/shared-analysis/${token}`;

        res.json({
            success: true,
            shareToken: token,
            shareUrl
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/analysis/shared/:token
 * Visualizar análise compartilhada (público)
 */
router.get('/shared/:token', async (req, res) => {
    try {
        const analysis = await AnalysisHistory.findOne({
            shareToken: req.params.token,
            shared: true
        });

        if (!analysis) {
            return res.status(404).json({
                success: false,
                error: 'Análise não encontrada ou não está compartilhada'
            });
        }

        res.json({
            success: true,
            analysis: {
                readableReport: analysis.readableReport,
                summary: analysis.summary,
                createdAt: analysis.createdAt,
                imageName: analysis.imageName
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;