FROM node:22-alpine

WORKDIR /workspace

COPY package.json ./
COPY engine/package.json ./engine/package.json
COPY api/package.json ./api/package.json
COPY web/package.json ./web/package.json

RUN npm install

COPY engine ./engine
COPY web ./web

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace", "web", "--", "--host", "0.0.0.0"]
