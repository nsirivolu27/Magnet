import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMagnetConnector } from "../src/magnet/connectors/magnet.js";
import { createMagnetMcpServer } from "../src/magnet/mcp.js";
import { SqliteConversationStore } from "../src/magnet/store/index.js";

test("Magnet MCP preserves tools and serves both new and legacy resource URIs", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_790_000_000_000 });
  const store = new SqliteConversationStore(":memory:");
  const server = createMagnetMcpServer(store, [createMagnetConnector(store)], "https://magnet.example");
  const client = new Client({ name: "magnet-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  t.after(async () => {
    await client.close();
    await server.close();
    store.close();
  });

  const tools = await client.listTools();
  assert.ok(tools.tools.some((tool) => tool.name === "save_conversation"));
  assert.ok(tools.tools.some((tool) => tool.name === "list_publish_targets"));
  assert.ok(tools.tools.some((tool) => tool.name === "prepare_publish"));

  const resources = await client.listResources();
  assert.deepEqual(
    resources.resources.map((resource) => resource.uri).sort(),
    ["magnet", "lnkz"].flatMap((scheme) => ["connectors", "conversations", "graph", "stats", "transfers"].map((path) => `${scheme}://${path}`)).sort(),
  );
  assert.equal(client.getServerVersion()?.name, "magnet");
  for (const path of ["stats", "connectors", "graph", "conversations", "transfers"]) {
    const current = await client.readResource({ uri: `magnet://${path}` });
    const legacy = await client.readResource({ uri: `lnkz://${path}` });
    assert.ok("text" in current.contents[0] && "text" in legacy.contents[0]);
    assert.equal(current.contents[0].text, legacy.contents[0].text);
    assert.equal(current.contents[0].uri, `magnet://${path}`);
    assert.equal(legacy.contents[0].uri, `lnkz://${path}`);
  }
  const saved = await store.save({ title: "Rename compatibility", source: { provider: "local" }, messages: [{ role: "user", content: "Keep this conversation." }] });
  const current = await client.readResource({ uri: `magnet://conversation/${saved.id}` });
  const legacy = await client.readResource({ uri: `lnkz://conversation/${saved.id}` });
  assert.ok("text" in current.contents[0] && "text" in legacy.contents[0]);
  assert.equal(current.contents[0].text, legacy.contents[0].text);
});
