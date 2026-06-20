# --- Builder Stage ---
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies based on package-lock.json
COPY package.json package-lock.json /app/
RUN npm ci

# Copy code and build Next.js application
COPY . /app/
ENV NEXT_PUBLIC_API_URL=http://localhost:8000
RUN npm run build

# --- Runner Stage ---
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy necessary production artifacts from builder
COPY --from=builder /app/package.json /app/package-lock.json /app/
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/node_modules /app/node_modules

EXPOSE 3000

# Start Next.js production server
CMD ["npm", "run", "start"]
