FROM node:22-alpine

WORKDIR /app

COPY engine/package.json engine/package-lock.json ./
RUN npm ci

COPY engine/src ./src
COPY engine/scripts ./scripts
COPY engine/tsconfig.json ./

RUN npm run build

CMD ["npm", "run", "demo"]
