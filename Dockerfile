# Base stage for building and running
FROM node:20-alpine AS base

# Install dependencies needed for some node packages
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma ./prisma/

# Install dependencies
# This will trigger the postinstall script (npx prisma generate)
# which requires the prisma/schema.prisma file to be present
RUN npm install

# Copy source code
COPY src ./src

# Development stage
FROM base AS development
ENV NODE_ENV=development
CMD ["npm", "run", "start:dev"]

# Production build stage
FROM base AS build
COPY . .
RUN npm install
RUN npm run build

# Production runtime stage
FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

CMD ["node", "dist/main"]
