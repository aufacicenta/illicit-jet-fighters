FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY patches/ patches/
COPY shared/package.json shared/
COPY database/package.json database/
COPY simulator/package.json simulator/
COPY api/package.json api/

RUN bun install --frozen-lockfile --production

COPY shared/ shared/
COPY database/ database/
COPY simulator/ simulator/
COPY api/ api/

ENV NODE_ENV=production
EXPOSE 4000
CMD ["bun", "api/src/index.ts"]
