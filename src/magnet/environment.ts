/** Magnet names win, including explicit empty values; old deployments still work. */
export function envValue(name: `MAGNET_${string}`, environment: NodeJS.ProcessEnv = process.env): string | undefined {
  return environment[name] ?? environment[name.replace(/^MAGNET_/, "LNKZ_")];
}
