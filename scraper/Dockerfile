FROM node:22

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

CMD ["npm", "run", "scrape"]