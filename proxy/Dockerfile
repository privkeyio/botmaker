FROM node:20-alpine

WORKDIR /app

# Install build dependencies for better-sqlite3 and debugging tools
RUN apk add --no-cache python3 make g++ wget

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Copy schema.sql to dist (needed at runtime)
RUN cp src/db/schema.sql dist/db/

EXPOSE 9100 9101

CMD ["node", "dist/index.js"]
