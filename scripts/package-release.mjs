import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:[-.][a-zA-Z0-9.-]+)?$/.test(pkg.version)) throw new Error("Unsafe release version");
for (const file of ["index.mjs", "magnet/stdio.mjs", "magnet/store/migrate.mjs", "magnet/store/migrations/001_initial.sql", "magnet/store/migrations/002_identity_context.sql", "web/index.html", "web/console.html", "web/receive.html", "mobile/index.html"]) {
  if (!(await stat(join(root, "dist", file))).isFile()) throw new Error(`Missing release file: ${file}`);
}
const temporary = await mkdtemp(join(tmpdir(), "magnet-package-"));
const output = join(root, "artifacts");
try {
  await cp(join(root, "dist"), join(temporary, "dist"), { recursive: true });
  for (const file of ["LICENSE", "DEPLOY.md"]) await cp(join(root, file), join(temporary, file));
  await mkdir(join(temporary, "scripts"));
  for (const file of ["backup-sqlite.mjs", "smoke.mjs", "environment.mjs"]) await cp(join(root, "scripts", file), join(temporary, "scripts", file));
  await writeFile(join(temporary, "package.json"), JSON.stringify({
    name: "magnet-release", version: pkg.version, private: true, type: "module",
    engines: { node: ">=22.16.0" },
    scripts: { start: "node dist/index.mjs", "db:migrate": "node dist/magnet/store/migrate.mjs", "db:backup": "node scripts/backup-sqlite.mjs", smoke: "node scripts/smoke.mjs" },
  }, null, 2) + "\n");
  const files = {};
  async function hashTree(directory, prefix = "") {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = prefix + entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Release must not contain symlinks: ${path}`);
      if (entry.isDirectory()) await hashTree(join(directory, entry.name), path + "/");
      else files[path] = createHash("sha256").update(await readFile(join(directory, entry.name))).digest("hex");
    }
  }
  await hashTree(temporary);
  let commit = "unknown";
  let dirty = true;
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true }).trim();
    dirty = Boolean(execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8", windowsHide: true }).trim());
  } catch {}
  await writeFile(join(temporary, "release-manifest.json"), JSON.stringify({ version: pkg.version, commit, dirty, builtAt: new Date().toISOString(), files }, null, 2) + "\n");
  await mkdir(output, { recursive: true });
  const filename = `magnet-${pkg.version}.tgz`;
  const archive = join(output, filename);
  execFileSync("tar", ["-czf", archive, "-C", temporary, "."], { windowsHide: true });
  const checksum = createHash("sha256").update(await readFile(archive)).digest("hex");
  await writeFile(archive + ".sha256", `${checksum}  ${filename}\n`);
  console.log(`Release: artifacts/${filename} (plus SHA-256 checksum; source dirty=${dirty})`);
} finally {
  // Only the fresh directory returned by mkdtemp is removed.
  await rm(temporary, { recursive: true, force: true, maxRetries: 3 });
}
