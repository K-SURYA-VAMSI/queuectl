# QueueCTL Docker Image
FROM node:18-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ bash

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Link the CLI globally
RUN npm link

# Create queuectl directory
RUN mkdir -p /root/.queuectl/logs

# Default command shows help
CMD ["queuectl", "--help"]
