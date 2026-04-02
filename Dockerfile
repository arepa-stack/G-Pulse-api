# Base stage for building and running
FROM node:20-alpine AS base

# Install dependencies needed for some node packages
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma ./prisma/

# Install dependencies
# This will trigger the postinstall script (npx prisma generate)
RUN npm install

# Development stage
FROM base AS development
ENV NODE_ENV=development
COPY src ./src
RUN npx prisma generate
CMD ["npm", "run", "start:dev"]

# Production build stage
FROM base AS build
COPY src ./src
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# Production runtime stage
FROM node:20-alpine AS production
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

CMD ["node", "dist/src/main"]
