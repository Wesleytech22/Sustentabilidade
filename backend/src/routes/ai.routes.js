const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: 'uploads/' });

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:5001';

router.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhuma imagem enviada' });
        }

        const formData = new FormData();
        formData.append('image', fs.createReadStream(req.file.path));
        
        const response = await axios.post(`${AI_SERVICE_URL}/detect`, formData, {
            headers: formData.getHeaders(),
            timeout: 30000
        });
        
        // Remove arquivo temporário
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.json({
            success: true,
            deteccoes: response.data.deteccoes || [],
            total_residuos: response.data.total_residuos || 0,
            sugestao: gerarSugestao(response.data.total_residuos || 0)
        });
        
    } catch (error) {
        console.error('Erro na análise:', error.message);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ 
            error: 'Erro ao analisar imagem', 
            details: error.message 
        });
    }
});

function gerarSugestao(total) {
    if (total === 0) return "✅ Área limpa! Nenhum resíduo detectado.";
    if (total > 50) return "🚨 URGENTE! Alta concentração de resíduos. Coleta imediata necessária!";
    if (total > 20) return "⚠️ Atenção! Volume considerável de resíduos. Incluir na próxima rota.";
    return "📝 Área com poucos resíduos. Monitoramento contínuo.";
}

module.exports = router;