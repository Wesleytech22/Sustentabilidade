const vision = require('@google-cloud/vision');

class VisionAnalysis {
    constructor() {
        this.client = null;
        this.initClient();
    }

    initClient() {
        try {
            this.client = new vision.ImageAnnotatorClient();
            console.log('âœ… Google Cloud Vision inicializado');
        } catch (error) {
            console.error('âŒ Erro ao inicializar Vision:', error.message);
        }
    }

    async analyzeImage(imagePath) {
        try {
            console.log('í´ Analisando imagem com Google Cloud Vision...');
            
            const [result] = await this.client.labelDetection(imagePath);
            const labels = result.labelAnnotations || [];
            
            const wasteLabels = ['bottle', 'can', 'plastic', 'glass', 'paper', 'box', 'container'];
            const foundWaste = labels.filter(label => 
                wasteLabels.some(w => label.description.toLowerCase().includes(w))
            );
            
            if (foundWaste.length === 0) {
                return {
                    identificacao: { tipos_detectados: [], volume_total_m3: 0, observacoes_adicionais: "âœ… Nenhum resÃ­duo identificado" },
                    resumo: { mensagem_conscientizacao: "Continue mantendo o ambiente limpo!" }
                };
            }
            
            return {
                identificacao: {
                    tipos_detectados: foundWaste.map(w => ({
                        tipo: w.description,
                        confianca: Math.round(w.score * 100),
                        quantidade_estimada: "1-2 kg"
                    })),
                    volume_total_m3: 0.5,
                    observacoes_adicionais: `${foundWaste.length} material(is) detectado(s)`
                },
                resumo: { mensagem_conscientizacao: "Recicle corretamente!" }
            };
        } catch (error) {
            console.error('âŒ Erro:', error.message);
            return {
                identificacao: { tipos_detectados: [], volume_total_m3: 0, observacoes_adicionais: "Erro na anÃ¡lise" }
            };
        }
    }

    generateReadableText(analysis) {
        if (!analysis.identificacao.tipos_detectados?.length) {
            return analysis.identificacao.observacoes_adicionais;
        }
        return `í´ Detectado: ${analysis.identificacao.tipos_detectados.map(t => t.tipo).join(', ')}`;
    }
}

module.exports = new VisionAnalysis();
