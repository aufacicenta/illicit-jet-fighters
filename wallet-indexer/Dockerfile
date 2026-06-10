FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY patches/ patches/
COPY shared/package.json shared/
COPY database/package.json database/
COPY wallet-indexer/package.json wallet-indexer/

RUN bun install --frozen-lockfile --production

COPY shared/ shared/
COPY database/ database/
COPY wallet-indexer/ wallet-indexer/

ENV NODE_ENV=production
CMD ["bun", "wallet-indexer/src/index.ts"]
