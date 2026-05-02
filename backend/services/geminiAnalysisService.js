// backend/src/services/geminiAnalysisService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

class GeminiAnalysisService {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('❌ GEMINI_API_KEY não configurada no .env');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
            ]
        });
    }

    /**
     * Analisar imagem e gerar relatório detalhado
     */
    async analyzeImage(imageBase64, additionalContext = {}) {
        try {
            console.log('🤖 Iniciando análise com Gemini...');

            const prompt = this.buildAnalysisPrompt(additionalContext);

            const imagePart = {
                inlineData: {
                    data: imageBase64,
                    mimeType: 'image/jpeg'
                }
            };

            const result = await this.model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();

            console.log('✅ Análise Gemini concluída');

            return this.parseGeminiResponse(text);

        } catch (error) {
            console.error('❌ Erro na análise Gemini:', error);
            throw error;
        }
    }

    /**
     * Construir prompt detalhado para o Gemini
     */
    buildAnalysisPrompt(context) {
        return `
Você é um especialista em resíduos sólidos, sustentabilidade e impacto ambiental.
Analise a imagem fornecida e gere um relatório DETALHADO em português brasileiro.

CONTEXTO ADICIONAL (se fornecido):
- Localização: ${context.location || 'Não informada'}
- Data/Hora: ${context.datetime || new Date().toLocaleString('pt-BR')}
- Tipo de área: ${context.areaType || 'Não especificado'}

REQUISITOS DA ANÁLISE:

1. **IDENTIFICAÇÃO DE RESÍDUOS** (Detalhado)
   - Liste CADA tipo de resíduo visível com sua porcentagem estimada
   - Classifique por categoria: Plástico, Papel/Papelão, Vidro, Metal, Orgânico, Eletrônico, Perigoso, Entulho
   - Estime o volume total aproximado (em litros ou m³)
   - Nível de dispersão (pontual, espalhado, muito espalhado)

2. **IMPACTO AMBIENTAL** (Análise detalhada)
   Para CADA categoria identificada, descreva:
   - Tempo de decomposição na natureza
   - Riscos ao solo, água e fauna
   - Emissões de gases de efeito estufa potencial
   - Impacto na biodiversidade local
   - Riscos à saúde humana

3. **VIABILIDADE DE RECICLAGEM**
   - Para cada material: reciclável? (Sim/Parcial/Não)
   - Potencial econômico (Alto/Médio/Baixo/Nenhum)
   - Infraestrutura necessária para reciclagem

4. **RECOMENDAÇÕES OPERACIONAIS**
   - Método de coleta mais adequado (manual/mecanizada/mista)
   - Equipamentos necessários
   - Prioridade de coleta (Alta/Média/Baixa)
   - Número estimado de pessoas para coleta
   - Tempo estimado para coleta completa

5. **ESTRATÉGIAS DE PREVENÇÃO**
   - Ações educativas recomendadas
   - Infraestrutura que deveria existir no local
   - Políticas públicas sugeridas
   - Parcerias com cooperativas/recicladores

6. **MÉTRICAS E INDICADORES**
   - Taxa de reciclabilidade estimada (%)
   - Potencial de geração de renda com recicláveis (R$ estimado)
   - Economia de CO₂ se reciclado corretamente (kg)
   - Índice de Impacto Ambiental (0-100)

7. **RESUMO EXECUTIVO**
   - Gravidade da situação (Leve/Moderada/Grave/Crítica)
   - Top 3 ações imediatas
   - Mensagem de conscientização para o público

Formato da resposta (JSON VÁLIDO):
{
    "identificacao": {
        "tipos_detectados": [{"tipo": "string", "porcentagem": number, "quantidade_estimada": "string"}],
        "volume_total_m3": number,
        "dispersao": "string",
        "condicoes_locais": "string",
        "observacoes_adicionais": "string"
    },
    "impactos": {
        "por_tipo": [
            {"material": "string", "tempo_decomposicao": "string", "riscos": "string", "emissoes": "string"}
        ],
        "impacto_geral": "string",
        "nivel_critico": "baixo|moderado|alto|critico"
    },
    "reciclabilidade": {
        "taxa_reciclavel_percentual": number,
        "potencial_economico_estimado_reais": number,
        "materiais_aproveitaveis": ["string"],
        "infraestrutura_necessaria": "string"
    },
    "recomendacoes": {
        "prioridade": "alta|media|baixa",
        "metodo_coleta": "string",
        "equipamentos": ["string"],
        "pessoas_estimadas": number,
        "tempo_estimado_horas": number,
        "cuidados_especiais": "string"
    },
    "prevencao": {
        "acoes_educativas": ["string"],
        "infraestrutura_sugerida": ["string"],
        "politicas_publicas": ["string"],
        "parcerias_sugeridas": ["string"]
    },
    "metricas": {
        "indice_impacto_ambiental": number,
        "economia_co2_kg": number,
        "geracao_renda_potencial": number,
        "arvores_equivalentes": number,
        "agua_preservada_litros": number
    },
    "resumo": {
        "gravidade": "leve|moderada|grave|critica",
        "acoes_imediatas": ["string"],
        "mensagem_conscientizacao": "string"
    }
}`;
    }

    /**
     * Parse da resposta do Gemini
     */
    parseGeminiResponse(responseText) {
        try {
            // Tentar extrair JSON da resposta
            let jsonStr = responseText;

            // Se tiver markdown code block
            const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1];
            }

            const analysis = JSON.parse(jsonStr);

            // Adicionar metadados
            analysis.metadata = {
                analyzedAt: new Date().toISOString(),
                model: 'gemini-1.5-flash',
                version: '1.0'
            };

            return analysis;

        } catch (error) {
            console.error('Erro ao parsear resposta Gemini:', error);
            // Retornar estrutura padrão em caso de erro
            return this.getDefaultAnalysis(responseText);
        }
    }

    /**
     * Análise padrão (fallback)
     */
    getDefaultAnalysis(rawResponse) {
        return {
            identificacao: {
                tipos_detectados: [],
                volume_total_m3: 0,
                dispersao: "Não foi possível determinar",
                condicoes_locais: "Análise em processamento",
                observacoes_adicionais: rawResponse.substring(0, 500)
            },
            impactos: {
                por_tipo: [],
                impacto_geral: "Análise em andamento",
                nivel_critico: "moderado"
            },
            reciclabilidade: {
                taxa_reciclavel_percentual: 50,
                potencial_economico_estimado_reais: 0,
                materiais_aproveitaveis: [],
                infraestrutura_necessaria: "Aguardando análise detalhada"
            },
            recomendacoes: {
                prioridade: "media",
                metodo_coleta: "A ser definido",
                equipamentos: ["Equipamentos de proteção individual", "Sacos de coleta"],
                pessoas_estimadas: 2,
                tempo_estimado_horas: 1,
                cuidados_especiais: "Aguardando análise"
            },
            prevencao: {
                acoes_educativas: ["Conscientização sobre descarte correto"],
                infraestrutura_sugerida: ["Lixeiras seletivas no local"],
                politicas_publicas: ["Programa de coleta seletiva na região"],
                parcerias_sugeridas: ["Cooperativas de reciclagem locais"]
            },
            metricas: {
                indice_impacto_ambiental: 50,
                economia_co2_kg: 0,
                geracao_renda_potencial: 0,
                arvores_equivalentes: 0,
                agua_preservada_litros: 0
            },
            resumo: {
                gravidade: "moderada",
                acoes_imediatas: ["Realizar coleta dos resíduos visíveis", "Separar materiais recicláveis"],
                mensagem_conscientizacao: "Pequenas ações individuais geram grandes mudanças ambientais. Descarte o lixo corretamente!"
            }
        };
    }

    /**
     * Gerar relatório completo em texto para exibição
     */
    generateReadableReport(analysis) {
        let report = '';

        report += '='.repeat(60) + '\n';
        report += '📊 RELATÓRIO COMPLETO DE ANÁLISE DE RESÍDUOS\n';
        report += '='.repeat(60) + '\n\n';

        // Identificação
        report += '🔍 1. IDENTIFICAÇÃO DOS RESÍDUOS\n';
        report += '-'.repeat(40) + '\n';
        if (analysis.identificacao.tipos_detectados.length > 0) {
            analysis.identificacao.tipos_detectados.forEach(tipo => {
                report += `  • ${tipo.tipo}: ${tipo.porcentagem}% (${tipo.quantidade_estimada})\n`;
            });
        } else {
            report += '  • Nenhum resíduo específico identificado\n';
        }
        report += `  📦 Volume total estimado: ${analysis.identificacao.volume_total_m3} m³\n`;
        report += `  📍 Dispersão: ${analysis.identificacao.dispersao}\n`;
        report += `  📝 ${analysis.identificacao.observacoes_adicionais}\n\n`;

        // Impactos Ambientais
        report += '🌍 2. IMPACTOS AMBIENTAIS\n';
        report += '-'.repeat(40) + '\n';
        report += `  ⚠️ Nível crítico: ${analysis.impactos.nivel_critico.toUpperCase()}\n`;
        report += `  📝 ${analysis.impactos.impacto_geral}\n`;
        if (analysis.impactos.por_tipo.length > 0) {
            report += '  Por tipo de material:\n';
            analysis.impactos.por_tipo.forEach(impacto => {
                report += `    • ${impacto.material}:\n`;
                report += `      - Decomposição: ${impacto.tempo_decomposicao}\n`;
                report += `      - Riscos: ${impacto.riscos}\n`;
            });
        }
        report += '\n';

        // Reciclabilidade
        report += '♻️ 3. RECICLABILIDADE\n';
        report += '-'.repeat(40) + '\n';
        report += `  📊 Taxa de reciclabilidade: ${analysis.reciclabilidade.taxa_reciclavel_percentual}%\n`;
        report += `  💰 Potencial econômico: R$ ${analysis.reciclabilidade.potencial_economico_estimado_reais.toLocaleString()}\n`;
        report += `  🏭 Infraestrutura necessária: ${analysis.reciclabilidade.infraestrutura_necessaria}\n`;
        report += `  ♻️ Materiais aproveitáveis: ${analysis.reciclabilidade.materiais_aproveitaveis.join(', ') || 'Nenhum'}\n\n`;

        // Recomendações
        report += '🛠️ 4. RECOMENDAÇÕES OPERACIONAIS\n';
        report += '-'.repeat(40) + '\n';
        report += `  🎯 Prioridade: ${analysis.recomendacoes.prioridade.toUpperCase()}\n`;
        report += `  🚚 Método de coleta: ${analysis.recomendacoes.metodo_coleta}\n`;
        report += `  👥 Equipe necessária: ${analysis.recomendacoes.pessoas_estimadas} pessoas\n`;
        report += `  ⏱️ Tempo estimado: ${analysis.recomendacoes.tempo_estimado_horas} horas\n`;
        report += `  🧰 Equipamentos: ${analysis.recomendacoes.equipamentos.join(', ')}\n`;
        report += `  ⚠️ Cuidados especiais: ${analysis.recomendacoes.cuidados_especiais}\n\n`;

        // Métricas
        report += '📈 5. MÉTRICAS E INDICADORES\n';
        report += '-'.repeat(40) + '\n';
        report += `  📊 Índice de Impacto Ambiental: ${analysis.metricas.indice_impacto_ambiental}/100\n`;
        report += `  🌳 Economia de CO₂: ${analysis.metricas.economia_co2_kg.toLocaleString()} kg\n`;
        report += `  🎄 Árvores equivalentes: ${analysis.metricas.arvores_equivalentes}\n`;
        report += `  💧 Água preservada: ${analysis.metricas.agua_preservada_litros.toLocaleString()} litros\n`;
        report += `  💰 Geração de renda potencial: R$ ${analysis.metricas.geracao_renda_potencial.toLocaleString()}\n\n`;

        // Ações Preventivas
        report += '📚 6. AÇÕES PREVENTIVAS\n';
        report += '-'.repeat(40) + '\n';
        report += '  Ações educativas:\n';
        analysis.prevencao.acoes_educativas.forEach(acao => {
            report += `    • ${acao}\n`;
        });
        report += '  Infraestrutura sugerida:\n';
        analysis.prevencao.infraestrutura_sugerida.forEach(infra => {
            report += `    • ${infra}\n`;
        });
        report += '\n';

        // Resumo Executivo
        report += '🎯 7. RESUMO EXECUTIVO\n';
        report += '-'.repeat(40) + '\n';
        report += `  🔴 Gravidade: ${analysis.resumo.gravidade.toUpperCase()}\n`;
        report += '  ⚡ Ações imediatas:\n';
        analysis.resumo.acoes_imediatas.forEach(acao => {
            report += `    • ${acao}\n`;
        });
        report += `\n  💚 MENSAGEM: ${analysis.resumo.mensagem_conscientizacao}\n\n`;

        report += '='.repeat(60) + '\n';
        report += '📅 Relatório gerado por EcoRoute AI - Análise com Google Gemini\n';
        report += '='.repeat(60);

        return report;
    }
}

module.exports = new GeminiAnalysisService();