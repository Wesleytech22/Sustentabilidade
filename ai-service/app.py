from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import json
import random

app = Flask(__name__)
CORS(app)

# Simulação de detecção - SEM ULTRALYTICS
TIPOS = ["plastico", "papel", "vidro", "metal", "organico", "entulho"]

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'modo': 'simulacao'})

@app.route('/detect', methods=['POST'])
def detect():
    if 'image' not in request.files:
        return jsonify({'error': 'Nenhuma imagem'}), 400
    
    # Simula detecção aleatória
    num = random.randint(0, 8)
    deteccoes = []
    for _ in range(num):
        deteccoes.append({
            'tipo': random.choice(TIPOS),
            'confianca': round(random.uniform(0.6, 0.95), 2)
        })
    
    return jsonify({
        'success': True,
        'deteccoes': deteccoes,
        'total_residuos': len(deteccoes),
        'modo': 'simulacao'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)