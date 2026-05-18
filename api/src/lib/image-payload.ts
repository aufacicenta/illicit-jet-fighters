/** Decode OpenRouter / model image payloads into raw bytes for R2 uploads. */

const dataUrlRegex = /^data:([^;,]+)?(;base64)?,(.+)$/is;

export const extensionForMime = (mimeType: string): string => {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("gif")) return "gif";
  return "bin";
};

export const decodeImagePayload = async (
  imageUrl: string,
  fallbackMime: string,
): Promise<{ buffer: Buffer; mimeType: string }> => {
  if (imageUrl.startsWith("data:")) {
    const match = dataUrlRegex.exec(imageUrl);
    if (!match?.[3]) {
      throw new Error("Invalid image data URL payload.");
    }
    const mimeType = match[1]?.trim() || fallbackMime || "image/png";
    const isBase64 = Boolean(match[2]);
    const dataPart = match[3];

    const buffer = isBase64
      ? Buffer.from(dataPart.replace(/\s+/g, ""), "base64")
      : Buffer.from(decodeURIComponent(dataPart), "utf8");

    return { buffer, mimeType };
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Unable to fetch remote image (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get("content-type") ?? fallbackMime;

  return { buffer: Buffer.from(arrayBuffer), mimeType };
};
