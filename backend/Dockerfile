# syntax=docker/dockerfile:1

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
EXPOSE 3333
CMD ["npm", "run", "start"]
