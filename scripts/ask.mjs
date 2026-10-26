import { envValue } from "./environment.mjs";
const url = envValue("MAGNET_BASE_URL") ?? "http://127.0.0.1:3100";
const query = process.argv.slice(2).join(" ") || "forecast model";
try {
  const response = await fetch(new URL("/api/context/packet", url), {
    method: "POST",
    headers: { "content-type": "application/json", ...(envValue("MAGNET_API_KEY") ? { authorization: `Bearer ${envValue("MAGNET_API_KEY")}` } : {}) },
    body: JSON.stringify({ query, budgetTokens: 1500, includeExternal: false }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Request failed");
  const { packet } = await response.json();
  console.log(packet.markdown);
} catch {
  console.error("Could not ask Magnet. Check MAGNET_BASE_URL and MAGNET_API_KEY, and run pnpm seed first.");
  process.exitCode = 1;
}
