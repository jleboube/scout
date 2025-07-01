
# Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p data uploads public

# Copy public files
COPY public/ ./public/

# Expose port
EXPOSE 3000

# Set proper permissions
RUN chown -R node:node /app
USER node

# Start the application
CMD ["node", "server.js"]

