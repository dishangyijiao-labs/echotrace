FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_API_BASE="http://localhost:8001/api"
ENV VITE_API_BASE=${VITE_API_BASE}
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
RUN ls -al /usr/share/nginx/html && test -f /usr/share/nginx/html/index.html
EXPOSE 80
