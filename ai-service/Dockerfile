FROM python:3.10-slim

WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Instalar ultralytics explicitamente (forçar instalação)
RUN pip install ultralytics --no-cache-dir

# Copiar código fonte
COPY . .

# Criar diretório para modelos
RUN mkdir -p /app/models

# Baixar modelo base (opcional, mas útil)
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')" || true

# Expor porta
EXPOSE 5001

# Comando para iniciar
CMD ["python", "app.py"]