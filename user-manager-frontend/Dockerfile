# syntax=docker/dockerfile:1.4
FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:7003
ARG NEXT_PUBLIC_COMPANY_NAME=
ARG NEXT_PUBLIC_COMPANY_LOGO_URL=
ENV NEXT_PUBLIC_AUTH_SERVICE_URL=$NEXT_PUBLIC_AUTH_SERVICE_URL
ENV NEXT_PUBLIC_COMPANY_NAME=$NEXT_PUBLIC_COMPANY_NAME
ENV NEXT_PUBLIC_COMPANY_LOGO_URL=$NEXT_PUBLIC_COMPANY_LOGO_URL

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY --from=session_auth . ./session-auth-client
COPY . .
RUN mkdir -p public && npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

ARG NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:7003
ARG NEXT_PUBLIC_COMPANY_NAME=
ARG NEXT_PUBLIC_COMPANY_LOGO_URL=
ENV NEXT_PUBLIC_AUTH_SERVICE_URL=$NEXT_PUBLIC_AUTH_SERVICE_URL
ENV NEXT_PUBLIC_COMPANY_NAME=$NEXT_PUBLIC_COMPANY_NAME
ENV NEXT_PUBLIC_COMPANY_LOGO_URL=$NEXT_PUBLIC_COMPANY_LOGO_URL

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts

USER node
EXPOSE 3000

CMD ["npm", "run", "start"]
