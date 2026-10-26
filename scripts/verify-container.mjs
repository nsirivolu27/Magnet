import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const image = process.argv[2] ?? "magnet:local";
const name = `magnet-verify-${randomBytes(6).toString("hex")}`;
const volume = `${name}-data`;
const key = randomBytes(32).toString("base64url");
function docker(args, options = {}) {
  return execFileSync("docker", args, { encoding: "utf8", windowsHide: true, timeout: 120_000, ...options }).trim();
}
// Fail rather than skipping if Docker or the requested image is unavailable.
docker(["image", "inspect", image]);
let created = false;
try {
  docker(["volume", "create", volume]);
  created = true;
  docker(["run", "-d", "--name", name, "-p", "127.0.0.1::3100", "--mount", `type=volume,src=${volume},dst=/app/.data`,
    "-e", "MAGNET_API_KEY", "-e", "ALLOWED_HOSTS=localhost,127.0.0.1", image],
    { env: { ...process.env, MAGNET_API_KEY: key } });
  const binding = JSON.parse(docker(["inspect", name]))[0].NetworkSettings.Ports["3100/tcp"][0];
  const base = `http://127.0.0.1:${binding.HostPort}`;
  async function ready() {
    for (let attempt = 0; attempt < 120; attempt++) {
      try { if ((await fetch(base + "/ready", { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("Container did not become ready; inspect its configuration.");
  }
  async function api(path, body) {
    const response = await fetch(base + path, { method: body ? "POST" : "GET",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(5000) });
    assert.ok(response.ok, `API status ${response.status}`);
    return response.json();
  }
  await ready();
  for (const path of ["/", "/console.html", "/mobile/"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)];
    assert.ok(assets.length > 0, `${path} must include built assets`);
    for (const [, asset] of assets) {
      const url = new URL(asset, base + path);
      assert.equal(url.origin, base);
      const loaded = await fetch(url);
      assert.equal(loaded.status, 200);
      assert.ok((await loaded.arrayBuffer()).byteLength > 0);
    }
  }
  assert.equal((await fetch(base + "/api/stats")).status, 401);
  const saved = await api("/api/conversations", { title: "Container persistence check", source: { provider: "local" }, messages: [{ role: "user", content: "Keep this synthetic conversation after restart." }] });
  const id = saved.conversation.id;
  const link = await api(`/api/conversations/${id}/handoffs`, { maxUses: 1, ttlMinutes: 5 });
  assert.equal((await fetch(base + `/share/${link.token}`)).status, 200);
  assert.equal((await fetch(base + `/share/${link.token}`)).status, 404);
  docker(["restart", "--time", "30", name]);
  await ready();
  assert.equal((await api(`/api/conversations/${id}`)).conversation.id, id);
  assert.equal((await fetch(base + `/share/${link.token}`)).status, 404, "spent use persists across restart");
  const identityProbe = `const fs=require('node:fs');const ids=[];for(const pid of fs.readdirSync('/proc').filter(p=>/^\\d+$/.test(p))){try{const args=fs.readFileSync('/proc/'+pid+'/cmdline','utf8').split('\\0');if(args[0].endsWith('node')&&args.includes('dist/index.mjs'))ids.push(Number(fs.readFileSync('/proc/'+pid+'/status','utf8').match(/^Uid:\\s+(\\d+)/m)[1]));}catch{}}console.log(JSON.stringify(ids));`;
  const serverUids = JSON.parse(docker(["exec", name, "node", "-e", identityProbe]));
  assert.equal(serverUids.length, 1, "exactly one server process must be present");
  assert.notEqual(serverUids[0], 0, "server must run as the unprivileged user");
  const logs = docker(["logs", name], { stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(logs.includes(key) || logs.includes(link.token), false);
  console.log("PASS: container web/mobile assets, authentication, handoffs, restart persistence and non-root server.");
} finally {
  if (created) {
    try { docker(["rm", "-f", name], { stdio: "ignore" }); }
    finally { docker(["volume", "rm", volume], { stdio: "ignore" }); }
  }
}
