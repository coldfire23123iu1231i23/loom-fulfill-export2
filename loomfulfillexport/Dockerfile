FROM node:22-alpine

RUN apk add --no-cache openssl
WORKDIR /app
EXPOSE 3000

COPY package.json package-lock.json* ./
# Cài cả devDependencies vì bước build (vite/remix) cần chúng.
RUN npm install --no-audit --no-fund

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
CMD ["npm", "run", "docker-start"]
