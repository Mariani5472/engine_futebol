FROM node:22-alpine

WORKDIR /workspace

COPY package.json ./
COPY engine/package.json ./engine/package.json
COPY web/package.json ./web/package.json

RUN npm install

COPY engine ./engine

WORKDIR /workspace/engine

CMD ["npm", "test", "--", "--runInBand"]
