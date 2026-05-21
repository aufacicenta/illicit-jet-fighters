import sharp from "sharp";

const MIN_MEANINGFUL_TRANSPARENCY_RATIO = 0.02;
const EDGE_COLOR_TOLERANCE = 34;
const COLOR_BUCKET_SIZE = 24;
const MAX_EDGE_COLOR_SEEDS = 8;

const distance = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) =>
  Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);

const pixelAt = (data: Uint8Array, width: number, x: number, y: number) => {
  const offset = (y * width + x) * 4;
  return {
    r: data[offset] ?? 0,
    g: data[offset + 1] ?? 0,
    b: data[offset + 2] ?? 0,
    a: data[offset + 3] ?? 255,
    offset,
  };
};

const isNearGray = (r: number, g: number, b: number) =>
  Math.abs(r - g) <= 14 && Math.abs(g - b) <= 14 && Math.abs(r - b) <= 14;

const collectEdgeSeeds = (data: Uint8Array, width: number, height: number) => {
  const histogram = new Map<string, { r: number; g: number; b: number; count: number }>();

  const addSeed = (x: number, y: number) => {
    const { r, g, b } = pixelAt(data, width, x, y);
    if (!isNearGray(r, g, b)) {
      return;
    }

    const bucketKey = `${Math.floor(r / COLOR_BUCKET_SIZE)}:${Math.floor(g / COLOR_BUCKET_SIZE)}:${Math.floor(b / COLOR_BUCKET_SIZE)}`;
    const previous = histogram.get(bucketKey);
    if (previous) {
      previous.r += r;
      previous.g += g;
      previous.b += b;
      previous.count += 1;
      return;
    }

    histogram.set(bucketKey, { r, g, b, count: 1 });
  };

  for (let x = 0; x < width; x += 1) {
    addSeed(x, 0);
    addSeed(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    addSeed(0, y);
    addSeed(width - 1, y);
  }

  return [...histogram.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_EDGE_COLOR_SEEDS)
    .map(({ r, g, b, count }) => ({
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count),
    }));
};

const pixelMatchesAnySeed = (
  pixel: { r: number; g: number; b: number },
  seeds: Array<{ r: number; g: number; b: number }>,
) => {
  for (const seed of seeds) {
    if (distance(pixel, seed) <= EDGE_COLOR_TOLERANCE) {
      return true;
    }
  }
  return false;
};

const eraseEdgeConnectedBackground = (data: Uint8Array, width: number, height: number) => {
  const seeds = collectEdgeSeeds(data, width, height);
  if (seeds.length === 0) {
    return;
  }

  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const queueX = new Int32Array(totalPixels);
  const queueY = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const enqueueIfMatch = (x: number, y: number) => {
    const index = y * width + x;
    if (visited[index] === 1) {
      return;
    }
    visited[index] = 1;

    const pixel = pixelAt(data, width, x, y);
    if (!pixelMatchesAnySeed(pixel, seeds)) {
      return;
    }

    queueX[tail] = x;
    queueY[tail] = y;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueueIfMatch(x, 0);
    enqueueIfMatch(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueueIfMatch(0, y);
    enqueueIfMatch(width - 1, y);
  }

  while (head < tail) {
    const x = queueX[head] ?? 0;
    const y = queueY[head] ?? 0;
    head += 1;

    const center = pixelAt(data, width, x, y);
    data[center.offset + 3] = 0;

    if (x > 0) {
      enqueueIfMatch(x - 1, y);
    }
    if (x < width - 1) {
      enqueueIfMatch(x + 1, y);
    }
    if (y > 0) {
      enqueueIfMatch(x, y - 1);
    }
    if (y < height - 1) {
      enqueueIfMatch(x, y + 1);
    }
  }
};

const transparencyRatio = (data: Uint8Array, width: number, height: number) => {
  const totalPixels = width * height;
  let transparentPixels = 0;

  for (let offset = 3; offset < data.length; offset += 4) {
    if ((data[offset] ?? 255) <= 5) {
      transparentPixels += 1;
    }
  }

  return transparentPixels / Math.max(1, totalPixels);
};

const toRawRgba = async (buffer: Buffer) => {
  const { data, info } = await sharp(buffer, { failOn: "none" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: new Uint8Array(data),
    width: info.width,
    height: info.height,
  };
};

const toPng = async (data: Uint8Array, width: number, height: number) => {
  return sharp(data, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
};

export const normalizeForStoragePng = async ({
  sourceBuffer,
  sectionLabel,
  requireTransparentBackground,
}: {
  sourceBuffer: Buffer;
  sectionLabel: string;
  requireTransparentBackground: boolean;
}): Promise<{ buffer: Buffer; mimeType: "image/png" }> => {
  const { data, width, height } = await toRawRgba(sourceBuffer);

  if (requireTransparentBackground) {
    const initialRatio = transparencyRatio(data, width, height);
    if (initialRatio < MIN_MEANINGFUL_TRANSPARENCY_RATIO) {
      eraseEdgeConnectedBackground(data, width, height);
    }

    const finalRatio = transparencyRatio(data, width, height);
    if (finalRatio < MIN_MEANINGFUL_TRANSPARENCY_RATIO) {
      throw new Error(
        `${sectionLabel} image failed alpha validation (transparent pixel ratio ${finalRatio.toFixed(4)}).`,
      );
    }
  }

  return {
    buffer: await toPng(data, width, height),
    mimeType: "image/png",
  };
};

export const getImageDimensions = async (
  sourceBuffer: Buffer,
): Promise<{ width: number; height: number }> => {
  const metadata = await sharp(sourceBuffer, { failOn: "none" }).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) {
    throw new Error("Unable to determine image dimensions.");
  }
  return { width, height };
};
