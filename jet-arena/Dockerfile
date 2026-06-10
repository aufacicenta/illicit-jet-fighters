FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY patches/ patches/
COPY shared/package.json shared/
COPY jet-arena/package.json jet-arena/

RUN bun install --frozen-lockfile

COPY shared/ shared/
COPY jet-arena/ jet-arena/

ARG VITE_API_URL
ARG VITE_NEON_AUTH_URL
ARG VITE_R2_ENDPOINT
ARG VITE_IMAGE_CDN_URL

RUN cd jet-arena && bun run build

FROM oven/bun:1 AS runtime
WORKDIR /app
COPY --from=build /app/jet-arena/dist ./dist

RUN bun add serve@latest
EXPOSE 3000
CMD ["bunx", "serve", "dist", "-s", "-l", "3000"]
