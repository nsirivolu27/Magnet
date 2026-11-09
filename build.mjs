import { build } from "esbuild";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await build({
  entryPoints: ["src/index.ts", "src/magnet/stdio.ts", "src/magnet/store/migrate.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  sourcemap: "linked",
  logLevel: "info",
  external: ["node:*"],
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; globalThis.require = __createRequire(import.meta.url);",
  },
});
await cp("src/magnet/store/migrations", "dist/magnet/store/migrations", { recursive: true });
// Existing desktop MCP configurations can keep their launch path during upgrades.
await mkdir("dist/lnkz/store", { recursive: true });
await writeFile("dist/lnkz/stdio.mjs", 'import "../magnet/stdio.mjs";\n');
await writeFile("dist/lnkz/store/migrate.mjs", `import { fileURLToPath } from "node:url";
process.argv[1] = fileURLToPath(new URL("../../magnet/store/migrate.mjs", import.meta.url));
await import("../../magnet/store/migrate.mjs");
`);
