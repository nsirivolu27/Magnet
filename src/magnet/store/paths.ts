import { existsSync } from "node:fs";
import { join } from "node:path";

/** Reuse the old store in place; never silently start an empty replacement. */
export function defaultDataPath(extension: "db" | "json", directory = ".data"): string {
  const current = join(directory, `magnet.${extension}`);
  const legacy = join(directory, `lnkz.${extension}`);
  return !existsSync(current) && existsSync(legacy) ? legacy : current;
}
