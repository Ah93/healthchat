# -------------------------
# Install dependencies
# -------------------------
FROM node:20-bullseye AS deps

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci


# -------------------------
# Build the Next.js app
# -------------------------
FROM node:20-bullseye AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build


# -------------------------
# Production image
# -------------------------
FROM node:20-bullseye AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app ./

EXPOSE 8080

CMD ["npm", "start"]
