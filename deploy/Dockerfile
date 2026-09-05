# Dubyx API — multi-stage build
FROM node:20-alpine AS build
WORKDIR /app
# Prisma needs OpenSSL on Alpine
RUN apk add --no-cache openssl
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma ./prisma
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build
# Compile the seed separately — it lives outside src/ and is needed to
# populate a brand-new database (company settings, admin users, samples)
RUN npx tsc prisma/seed.ts --outDir /app/seed-dist --module commonjs \
    --target es2020 --esModuleInterop --skipLibCheck --resolveJsonModule

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist
COPY --from=build /app/seed-dist ./seed-dist
# Arabic fonts for the ZATCA tax invoice PDF — the invoice is unreadable without them
COPY backend/assets ./assets
EXPOSE 5000
# Apply the schema, then start. `db push` is used because this project does not
# keep a migrations folder (it is gitignored).
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss=false || npx prisma db push --skip-generate; node dist/index.js"]
