FROM node:22-alpine
WORKDIR /workspace
COPY engine/package.json engine/package-lock.json ./engine/
COPY web/package.json ./web/
WORKDIR /workspace/web
RUN npm install
WORKDIR /workspace
COPY engine/src ./engine/src
COPY engine/tsconfig.json ./engine/
COPY web ./web
WORKDIR /workspace/web
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
