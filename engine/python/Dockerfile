FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY package.json ./
COPY engine/package.json ./engine/package.json
COPY api/package.json ./api/package.json
COPY web/package.json ./web/package.json
RUN npm install

COPY engine ./engine
RUN python3 -m venv /opt/football-venv \
    && /opt/football-venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/football-venv/bin/pip install --no-cache-dir -e /workspace/engine/python

WORKDIR /workspace/engine
ENV PATH="/opt/football-venv/bin:${PATH}"

CMD ["python", "python/train_ppo.py"]
