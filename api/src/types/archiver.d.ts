declare module "archiver" {
  import { Transform } from "node:stream";
  import type { ZlibOptions } from "node:zlib";

  export interface ZipArchiveOptions {
    zlib?: ZlibOptions;
  }

  export class ZipArchive extends Transform {
    constructor(options?: ZipArchiveOptions);

    append(
      source: Buffer | Uint8Array | string,
      data: { name: string; date?: Date | string },
    ): this;

    finalize(): Promise<void>;
  }
}
