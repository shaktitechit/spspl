# syntax=docker/dockerfile:1.4
FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:7003
ARG NEXT_PUBLIC_OPMS_URL=http://localhost:7002
ARG NEXT_PUBLIC_USER_MANAGER_URL=http://localhost:7004/dashboard
ARG NEXT_PUBLIC_WORK_PLANNER_URL=http://localhost:7008/dashboard
ARG NEXT_PUBLIC_LEAD_MANAGER_URL=http://localhost:7010/dashboard
ENV NEXT_PUBLIC_AUTH_SERVICE_URL=$NEXT_PUBLIC_AUTH_SERVICE_URL
ENV NEXT_PUBLIC_OPMS_URL=$NEXT_PUBLIC_OPMS_URL
ENV NEXT_PUBLIC_USER_MANAGER_URL=$NEXT_PUBLIC_USER_MANAGER_URL
ENV NEXT_PUBLIC_WORK_PLANNER_URL=$NEXT_PUBLIC_WORK_PLANNER_URL
ENV NEXT_PUBLIC_LEAD_MANAGER_URL=$NEXT_PUBLIC_LEAD_MANAGER_URL

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

ARG NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:7003
ARG NEXT_PUBLIC_OPMS_URL=http://localhost:7002
ARG NEXT_PUBLIC_USER_MANAGER_URL=http://localhost:7004/dashboard
ARG NEXT_PUBLIC_WORK_PLANNER_URL=http://localhost:7008/dashboard
ARG NEXT_PUBLIC_LEAD_MANAGER_URL=http://localhost:7010/dashboard
ENV NEXT_PUBLIC_AUTH_SERVICE_URL=$NEXT_PUBLIC_AUTH_SERVICE_URL
ENV NEXT_PUBLIC_OPMS_URL=$NEXT_PUBLIC_OPMS_URL
ENV NEXT_PUBLIC_USER_MANAGER_URL=$NEXT_PUBLIC_USER_MANAGER_URL
ENV NEXT_PUBLIC_WORK_PLANNER_URL=$NEXT_PUBLIC_WORK_PLANNER_URL
ENV NEXT_PUBLIC_LEAD_MANAGER_URL=$NEXT_PUBLIC_LEAD_MANAGER_URL

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts

USER node
EXPOSE 3000

CMD ["npm", "run", "start"]
