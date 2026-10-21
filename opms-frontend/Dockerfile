# syntax=docker/dockerfile:1.4
FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_ORIGIN=http://localhost:5001
ARG NEXT_PUBLIC_COMPANY_NAME=Medica Enterprises
ARG NEXT_PUBLIC_COMPANY_LOGO_URL=/medica-logo.png
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
ENV NEXT_PUBLIC_API_ORIGIN=$NEXT_PUBLIC_API_ORIGIN
ENV NEXT_PUBLIC_COMPANY_NAME=$NEXT_PUBLIC_COMPANY_NAME
ENV NEXT_PUBLIC_COMPANY_LOGO_URL=$NEXT_PUBLIC_COMPANY_LOGO_URL
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --from=session_auth . ./session-auth-client
COPY . .
RUN mkdir -p public && npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

ARG NEXT_PUBLIC_API_ORIGIN=http://localhost:5001
ARG NEXT_PUBLIC_COMPANY_NAME=Medica Enterprises
ARG NEXT_PUBLIC_COMPANY_LOGO_URL=/medica-logo.png
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
ENV NEXT_PUBLIC_API_ORIGIN=$NEXT_PUBLIC_API_ORIGIN
ENV NEXT_PUBLIC_COMPANY_NAME=$NEXT_PUBLIC_COMPANY_NAME
ENV NEXT_PUBLIC_COMPANY_LOGO_URL=$NEXT_PUBLIC_COMPANY_LOGO_URL
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts

USER node
EXPOSE 3000

CMD ["npm", "run", "start"]
