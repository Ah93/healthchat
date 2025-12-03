# Base image
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy project files
COPY . .

# Build Next.js app
RUN npm run build

# Production image
FROM node:18-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy built output and dependencies
COPY --from=builder /app ./

EXPOSE 3000

CMD ["npm", "start"]
