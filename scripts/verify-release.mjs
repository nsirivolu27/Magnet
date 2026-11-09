import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const archive = join(root, "artifacts", `magnet-${pkg.version}.tgz`);
const expected = (await readFile(archive + ".sha256", "utf8")).split(/\s/)[0];
assert.equal(createHash("sha256").update(await readFile(archive)).digest("hex"), expected, "archive checksum must match");
const temporary = await mkdtemp(join(tmpdir(), "magnet-release-verify-"));
try {
  // This verifier consumes only the local archive created by package:release.
  execFileSync("tar", ["-xzf", archive, "-C", temporary], { windowsHide: true });
  const manifest = JSON.parse(await readFile(join(temporary, "release-manifest.json"), "utf8"));
  const seen = [];
  async function inspect(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + entry.name;
      assert.ok(!entry.isSymbolicLink(), "release cannot contain links");
      assert.ok(!/(^|\/)(node_modules|\.env[^/]*|\.data|\.git|src)(\/|$)/.test(path), "release cannot include local data or source trees");
      if (entry.isDirectory()) await inspect(join(directory, entry.name), path + "/");
      else if (path !== "release-manifest.json") {
        assert.equal(createHash("sha256").update(await readFile(join(directory, entry.name))).digest("hex"), manifest.files[path], `checksum: ${path}`);
        seen.push(path);
      }
    }
  }
  await inspect(temporary);
  assert.deepEqual(seen.sort(), Object.keys(manifest.files).sort());
  // Run real HTTP and MCP checks with the extracted artifact as cwd, away from
  // the checkout and its node_modules. Test-client dependencies remain in the repo.
  for (const script of ["verify-web.mjs", "verify-http.mjs"]) {
    await new Promise((accept, reject) => {
      const child = spawn(process.execPath, [join(root, "scripts", script)], { cwd: temporary, stdio: "inherit", windowsHide: true });
      child.once("error", reject);
      child.once("exit", (code) => code === 0 ? accept() : reject(new Error(`${script} failed: ${code}`)));
    });
  }
  console.log("PASS: release checksums, clean contents and standalone web/mobile/REST/MCP runtime without node_modules.");
} finally {
  await rm(temporary, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
