FROM node:22-alpine
WORKDIR /workspace
COPY package.json ./
COPY engine/package.json ./engine/package.json
COPY api/package.json ./api/package.json
COPY web/package.json ./web/package.json
RUN npm install
COPY api ./api
WORKDIR /workspace/api
EXPOSE 3000
CMD ["npm", "run", "dev"]
