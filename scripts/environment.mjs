import { existsSync } from "node:fs";
import { join } from "node:path";

export function envValue(name, environment = process.env) {
  return environment[name] ?? environment[name.replace(/^MAGNET_/, "LNKZ_")];
}

export function defaultDatabasePath() {
  const current = join(".data", "magnet.db");
  const legacy = join(".data", "lnkz.db");
  return !existsSync(current) && existsSync(legacy) ? legacy : current;
}
