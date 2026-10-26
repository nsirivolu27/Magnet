import assert from "node:assert/strict";
import test from "node:test";
import { MagnetClient, normalizeBaseUrl } from "../apps/mobile/src/api.js";

test("a new chat saves a human message with authentication and no invented AI response", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "http://relay.test/api/conversations");
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer test-key");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(String(init.body)), {
      title: "An idea worth sharing", source: { provider: "local", app: "Magnet" },
      messages: [{ role: "user", content: "An idea worth sharing" }],
    });
    return Response.json({ conversation: { id: "saved" } });
  });
  const client = new MagnetClient("http://relay.test", "test-key");
  assert.throws(() => client.createConversation("  "), /Write a message/);
  assert.equal((await client.createConversation("  An idea worth sharing  ")).conversation.id, "saved");
});

test("connection probes readiness without a key, then authenticates stats", async (t) => {
  const calls: { url: string; auth: string | null }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, auth: new Headers(init.headers).get("authorization") });
    assert.equal(init.redirect, "error");
    return Response.json(url.endsWith("/ready") ? { ok: true } : { stats: { conversations: 0 } });
  });
  await new MagnetClient("http://relay.test", "test-key").checkConnection();
  assert.deepEqual(calls, [{ url: "http://relay.test/ready", auth: null }, { url: "http://relay.test/api/stats", auth: "Bearer test-key" }]);
});

test("HTML and unrelated JSON cannot masquerade as a connected relay", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>Wrong service</html>"));
  await assert.rejects(() => new MagnetClient("http://relay.test", "key").checkConnection(), /page instead/);
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => Response.json({ hello: "world" }));
  await assert.rejects(() => new MagnetClient("http://relay.test", "key").checkConnection(), /not a ready/);
});

test("continuations record human turns as user messages unless a model response is selected", async (t) => {
  const bodies: { messages: { role: string }[] }[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return Response.json({ conversation: {} });
  });
  const client = new MagnetClient("http://relay.test", "key");
  await client.continueFromLink({ url: "http://other.test/share/token", provider: "claude", content: "My question" });
  await client.continueFromLink({ url: "http://other.test/share/token", provider: "claude", content: "Pasted response", role: "assistant" });
  assert.deepEqual(bodies.map((body) => body.messages[0].role), ["user", "assistant"]);
});

test("relay URLs exclude embedded credentials, queries and fragments", () => {
  for (const value of ["https://user:key@example.com", "https://example.com?key=secret", "https://example.com/#api"]) {
    assert.throws(() => normalizeBaseUrl(value));
  }
});
