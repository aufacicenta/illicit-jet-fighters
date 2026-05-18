import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { ZipArchive } from "archiver";

const INCLUDED_EXTENSIONS = new Set([".md", ".json", ".ts", ".svg", ".png", ".webp", ".gif"]);
const DISALLOWED_SEGMENT = /^(\.|node_modules)$/;

async function collectFiles(agentRoot: string, relative = ""): Promise<string[]> {
  const listing = await readdir(path.join(agentRoot, relative), { withFileTypes: true });
  const targets: string[] = [];

  for (const entry of listing) {
    if (DISALLOWED_SEGMENT.test(entry.name)) {
      continue;
    }

    const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      targets.push(...(await collectFiles(agentRoot, nextRelative)));
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (INCLUDED_EXTENSIONS.has(ext)) {
      targets.push(nextRelative);
    }
  }

  return targets;
}

export const archiveAgentSlugToZipBuffer = async (agentSlug: string): Promise<Buffer> => {
  const repoRoot = path.resolve(import.meta.dirname, "../../../..");
  const agentRoot = path.join(repoRoot, "jet-arena", "agents", agentSlug);

  const files = await collectFiles(agentRoot);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = new ZipArchive({ zlib: { level: 9 } });

    archive.on("error", reject);
    archive.on("warning", reject);
    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    const appendFiles = async () => {
      try {
        for (const relative of files) {
          const absolute = path.join(agentRoot, relative);
          const body = await readFile(absolute);
          archive.append(body, {
            name: path.posix.join(agentSlug, relative).replaceAll("\\", "/"),
          });
        }
        await archive.finalize();
      } catch (error) {
        reject(error);
      }
    };

    void appendFiles();
  });
};
