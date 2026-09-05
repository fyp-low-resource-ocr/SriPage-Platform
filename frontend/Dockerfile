FROM node:22-alpine AS build

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm build


FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package.json /app/pnpm-lock.yaml ./

RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public

CMD ["pnpm", "start"]