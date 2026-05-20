from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import json
import random
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Tipos de resíduos para simulação
TIPOS = ["plastico", "papel", "vidro", "metal", "organico", "entulho", "eletronico", "oleo"]

# ============================================
# BANCO DE FRASES DE CONSCIENTIZAÇÃO
# ============================================

FRASES_CONSCIENTIZACAO = {
    "plastico": [
        "💚 Uma garrafa PET leva mais de 400 anos para se decompor na natureza!",
        "♻️ Reciclar 1 tonelada de plástico economiza 5.000 kWh de energia.",
        "🌊 O plástico é responsável por 80% do lixo nos oceanos. Recicle!",
        "🔄 Plástico reciclado vira novas embalagens, móveis e até roupas!",
        "💡 Prefira embalagens retornáveis ou recicláveis."
    ],
    "papel": [
        "📄 Para produzir 1 tonelada de papel, são necessárias 100 árvores!",
        "♻️ Reciclar papel economiza 70% de energia comparado à produção nova.",
        "🌳 Cada tonelada de papel reciclado salva 20 árvores.",
        "📦 Papelão reciclado vira novas caixas e embalagens.",
        "💡 Use os dois lados da folha antes de reciclar!"
    ],
    "vidro": [
        "🥤 O vidro é 100% reciclável e pode ser reciclado infinitas vezes!",
        "♻️ Reciclar vidro economiza 30% de energia.",
        "🏺 Uma garrafa de vidro leva 1 milhão de anos para se decompor.",
        "🔄 Vidro reciclado vira novas garrafas, potes e fibra de vidro.",
        "💡 Separe o vidro por cor para facilitar a reciclagem!"
    ],
    "metal": [
        "🥫 Reciclar alumínio economiza 95% de energia!",
        "♻️ Uma latinha reciclada vira outra latinha em apenas 60 dias.",
        "🔋 Metais pesados contaminam o solo e lençóis freáticos.",
        "🔄 Aço reciclado mantém 100% de suas propriedades.",
        "💡 Ímã ajuda a separar metais ferrosos dos não ferrosos!"
    ],
    "organico": [
        "🍌 Resíduos orgânicos viram adubo através da compostagem.",
        "♻️ Compostagem reduz a emissão de metano, um gás estufa potente.",
        "🌱 Adubo orgânico melhora a qualidade do solo sem químicos.",
        "🔄 Restos de comida podem virar energia através de biodigestores.",
        "💡 Separe cascas e restos para compostagem doméstica!"
    ],
    "entulho": [
        "🏗️ Entulho reciclado vira base para novas construções.",
        "♻️ Reciclagem de entulho reduz a extração de matéria-prima natural.",
        "🚛 Uma obra gera em média 150 kg de entulho por m².",
        "🔄 Resíduos de construção podem virar blocos e brita reciclada.",
        "💡 Contrate caçambas certificadas para destinação correta!"
    ],
    "eletronico": [
        "📱 Um celular contém ouro, prata, cobre e elementos raros!",
        "♻️ Reciclar 1 milhão de celulares recupera 35kg de ouro.",
        "⚠️ Baterias e componentes eletrônicos contaminam o solo.",
        "🔄 E-lixo reciclado vira novos componentes eletrônicos.",
        "💡 Descarte eletrônicos em pontos de coleta especializados!"
    ],
    "oleo": [
        "🛢️ 1 litro de óleo contamina 20.000 litros de água!",
        "♻️ Óleo usado vira biodiesel, sabão e tinta.",
        "🌊 Nunca jogue óleo na pia - entope canos e polui rios.",
        "🔄 Óleo reciclado reduz a extração de petróleo.",
        "💡 Armazene óleo usado em garrafas PET e entregue para reciclagem!"
    ]
}

# Frases gerais (quando não há detecção ou múltiplos tipos)
FRASES_GERAIS = [
    "🌍 Pequenas atitudes mudam o mundo! Comece reciclando hoje.",
    "♻️ Reciclar não é moda, é necessidade! Faça sua parte.",
    "💚 O futuro do planeta depende das nossas escolhas hoje.",
    "🌱 Cada item reciclado é uma árvore preservada.",
    "🏆 Reciclar é um ato de cidadania e amor ao planeta.",
    "📊 Em 2023, apenas 4% do lixo brasileiro foi reciclado. Podemos mais!",
    "🎯 Meta: Reciclar 50% do seu lixo em 6 meses.",
    "🤝 Compartilhe dicas de reciclagem com amigos e familiares.",
    "💰 Reciclar gera renda e empregos para milhares de catadores.",
    "🏠 Comece com 3 lixeiras: papel, plástico e orgânico."
]

# Frases motivacionais por quantidade de itens detectados
FRASES_QUANTIDADE = {
    "0": [
        "🚀 Ótimo! Nenhum resíduo detectado. Continue mantendo o ambiente limpo!",
        "✨ Ambiente perfeito! Você é um exemplo de consciência ambiental.",
        "🏆 Nada para reciclar aqui! Seu compromisso com o planeta é inspirador."
    ],
    "1_2": [
        "👍 Bom começo! Cada resíduo reciclado faz a diferença.",
        "🌱 Pequenos passos levam a grandes mudanças. Continue assim!",
        "💪 Você está no caminho certo! Recicle esses itens e faça a diferença."
    ],
    "3_5": [
        "🌟 Excelente trabalho! Muitos resíduos para reciclar.",
        "🤝 Você está fazendo sua parte! Separe corretamente esses materiais.",
        "📊 Ótima coleta! Com mais 5 itens você ajuda ainda mais o planeta."
    ],
    "6+": [
        "🎉 Impressionante! Você é um herói do meio ambiente!",
        "🏆 Recorde de reciclagem! Continue assim e inspire outras pessoas.",
        "💚 Seu compromisso com o planeta é admirável! Vamos reciclar tudo isso!"
    ]
}

def get_frase_conscientizacao(tipos_detectados, total):
    """Gera frase de conscientização baseada nos tipos detectados"""
    frases_selecionadas = []
    
    # Frase por tipo de resíduo (até 2 tipos)
    tipos_unicos = list(set(tipos_detectados))[:2]
    for tipo in tipos_unicos:
        if tipo in FRASES_CONSCIENTIZACAO:
            frases_selecionadas.append(random.choice(FRASES_CONSCIENTIZACAO[tipo]))
    
    # Frase por quantidade
    if total == 0:
        frases_selecionadas.append(random.choice(FRASES_QUANTIDADE["0"]))
    elif total <= 2:
        frases_selecionadas.append(random.choice(FRASES_QUANTIDADE["1_2"]))
    elif total <= 5:
        frases_selecionadas.append(random.choice(FRASES_QUANTIDADE["3_5"]))
    else:
        frases_selecionadas.append(random.choice(FRASES_QUANTIDADE["6+"]))
    
    # Frase geral aleatória (20% de chance)
    if random.random() < 0.3:
        frases_selecionadas.append(random.choice(FRASES_GERAIS))
    
    # Dica especial (10% de chance)
    dicas = [
        "💡 Dica: Lave embalagens antes de reciclar!",
        "💡 Dica: Amasse latas e garrafas PET para economizar espaço!",
        "💡 Dica: Separe o lixo seco do orgânico!",
        "💡 Dica: Remova tampas de garrafas PET antes de reciclar!",
        "💡 Dica: Verifique o símbolo de reciclagem nos produtos!"
    ]
    
    if random.random() < 0.2:
        frases_selecionadas.append(random.choice(dicas))
    
    return frases_selecionadas

def calcular_impacto_ambiental(tipos_detectados):
    """Calcula impacto ambiental estimado"""
    impacto = {
        "co2_evitado_kg": 0,
        "energia_economizada_kwh": 0,
        "agua_economizada_litros": 0,
        "arvores_preservadas": 0
    }
    
    # Valores médios por item (estimativas)
    for tipo in tipos_detectados:
        if tipo == "plastico":
            impacto["co2_evitado_kg"] += 1.5
            impacto["energia_economizada_kwh"] += 5
            impacto["agua_economizada_litros"] += 100
        elif tipo == "papel":
            impacto["co2_evitado_kg"] += 0.8
            impacto["energia_economizada_kwh"] += 4
            impacto["agua_economizada_litros"] += 10
            impacto["arvores_preservadas"] += 0.05
        elif tipo == "vidro":
            impacto["co2_evitado_kg"] += 0.5
            impacto["energia_economizada_kwh"] += 2
        elif tipo == "metal":
            impacto["co2_evitado_kg"] += 2.5
            impacto["energia_economizada_kwh"] += 15
            impacto["agua_economizada_litros"] += 200
        elif tipo == "organico":
            impacto["co2_evitado_kg"] += 0.3
            impacto["energia_economizada_kwh"] += 1
        elif tipo == "eletronico":
            impacto["co2_evitado_kg"] += 5
            impacto["energia_economizada_kwh"] += 20
        elif tipo == "oleo":
            impacto["co2_evitado_kg"] += 2
            impacto["agua_economizada_litros"] += 20000
    
    return impacto

@app.route('/health')
def health():
    return jsonify({
        'status': 'ok', 
        'modo': 'simulacao',
        'versao': '2.0',
        'frases_disponiveis': sum(len(f) for f in FRASES_CONSCIENTIZACAO.values()) + len(FRASES_GERAIS)
    })

@app.route('/detect', methods=['POST'])
def detect():
    try:
        # Verifica se veio imagem
        if 'image' not in request.files:
            return jsonify({'error': 'Nenhuma imagem fornecida'}), 400
        
        # Simula detecção mais realista
        num_deteccoes = random.randint(0, 8)
        deteccoes = []
        tipos_detectados = []
        
        for _ in range(num_deteccoes):
            tipo = random.choice(TIPOS)
            tipos_detectados.append(tipo)
            deteccoes.append({
                'tipo': tipo,
                'confianca': round(random.uniform(0.65, 0.98), 2),
                'bbox': [random.randint(0, 100) for _ in range(4)]  # Simula bounding box
            })
        
        # Gerar frases de conscientização
        frases = get_frase_conscientizacao(tipos_detectados, num_deteccoes)
        
        # Calcular impacto ambiental
        impacto = calcular_impacto_ambiental(tipos_detectados)
        
        # Resumo dos tipos para resposta
        resumo_tipos = {}
        for tipo in tipos_detectados:
            resumo_tipos[tipo] = resumo_tipos.get(tipo, 0) + 1
        
        return jsonify({
            'success': True,
            'deteccoes': deteccoes,
            'total_residuos': num_deteccoes,
            'resumo_por_tipo': resumo_tipos,
            'frases_conscientizacao': frases,
            'impacto_estimado': impacto,
            'data': datetime.now().isoformat(),
            'modo': 'simulacao'
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/frases', methods=['GET'])
def listar_frases():
    """Endpoint para consultar todas as frases disponíveis"""
    return jsonify({
        'por_tipo': FRASES_CONSCIENTIZACAO,
        'gerais': FRASES_GERAIS,
        'por_quantidade': FRASES_QUANTIDADE
    })

@app.route('/impacto', methods=['POST'])
def calcular_impacto():
    """Endpoint para calcular impacto baseado nos tipos enviados"""
    data = request.json
    tipos = data.get('tipos', [])
    impacto = calcular_impacto_ambiental(tipos)
    return jsonify(impacto)

@app.route('/dica_aleatoria', methods=['GET'])
def dica_aleatoria():
    """Retorna uma dica aleatória"""
    todas_frases = FRASES_GERAIS.copy()
    for tipo in FRASES_CONSCIENTIZACAO:
        todas_frases.extend(FRASES_CONSCIENTIZACAO[tipo])
    
    return jsonify({
        'frase': random.choice(todas_frases)
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)