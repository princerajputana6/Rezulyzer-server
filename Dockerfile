FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY server/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY server/ .

# Create uploads directory
RUN mkdir -p uploads/resumes uploads/temp logs

# Expose port
EXPOSE 8000

# Start server
CMD ["npm", "start"]
