import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/magnet/config.js";
import { envValue } from "../src/magnet/environment.js";
import { defaultDataPath } from "../src/magnet/store/paths.js";
import { SqliteConversationStore } from "../src/magnet/store/sqlite.js";
import { importConversations } from "../src/magnet/import/index.js";
import { exportConversation } from "../src/magnet/export/index.js";

test("legacy production configuration retains authentication and forwarding controls", () => {
  const config = loadConfig({ NODE_ENV: "production", LNKZ_API_KEY: "legacy-test-key", LNKZ_PUBLIC_BASE_URL: "https://relay.example", LNKZ_MCP_API_KEY_REQUIRED: "true", LNKZ_MCP_CONTEXT_SECRET: "s".repeat(48) });
  assert.equal(config.auth.apiKeyRequired, true);
  assert.equal(config.auth.principals[0].key, "legacy-test-key");
  assert.equal(config.publicBaseUrl, "https://relay.example");
  assert.equal(config.mcp.authRequired, true);
  assert.equal(config.mcp.contextSecret, "s".repeat(48));
});

test("Magnet configuration takes precedence and empty keys do not revive old credentials", () => {
  assert.equal(envValue("MAGNET_API_KEY", { MAGNET_API_KEY: "new", LNKZ_API_KEY: "old" }), "new");
  assert.throws(() => loadConfig({ NODE_ENV: "production", MAGNET_API_KEY: "", LNKZ_API_KEY: "old" }), /Authentication is required/);
  assert.equal(envValue("MAGNET_TRANSFER_ALLOW_PRIVATE", { MAGNET_TRANSFER_ALLOW_PRIVATE: "false", LNKZ_TRANSFER_ALLOW_PRIVATE: "true" }), "false");
});

test("existing legacy SQLite data is reused without moving or replacing it", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "magnet-rename-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const legacy = join(directory, "lnkz.db");
  let store = new SqliteConversationStore(legacy);
  const saved = await store.save({ title: "Existing history", source: { provider: "local" }, messages: [{ role: "user", content: "Preserve this content." }] });
  await store.close();
  assert.equal(defaultDataPath("db", directory), legacy);
  store = new SqliteConversationStore(defaultDataPath("db", directory));
  try { assert.equal((await store.get(saved.id))?.messages[0].content, "Preserve this content."); }
  finally { await store.close(); }
  writeFileSync(join(directory, "magnet.db"), "");
  assert.equal(defaultDataPath("db", directory), join(directory, "magnet.db"));
});

test("legacy JSON data remains discoverable and fresh installs use Magnet paths", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "magnet-paths-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  assert.equal(defaultDataPath("json", directory), join(directory, "magnet.json"));
  writeFileSync(join(directory, "lnkz.json"), "{}");
  assert.equal(defaultDataPath("json", directory), join(directory, "lnkz.json"));
});

test("Magnet and legacy format names round-trip the same interoperable packet", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_790_000_000_000 });
  const store = new SqliteConversationStore(":memory:");
  try {
    const saved = await store.save({ title: "Portable", source: { provider: "local" }, messages: [{ role: "user", content: "Same content, new name." }] });
    const current = exportConversation(saved, "magnet");
    assert.equal(current.body, exportConversation(saved, "lnkz").body);
    assert.equal(JSON.parse(current.body).format, "lnkz.conversation.v1");
    assert.equal(importConversations(current.body, "magnet").conversations[0].messages[0].content, "Same content, new name.");
    assert.equal(importConversations(current.body, "lnkz").conversations[0].messages[0].content, "Same content, new name.");
  } finally { await store.close(); }
});
