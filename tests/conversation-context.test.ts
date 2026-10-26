import assert from "node:assert/strict";
import test from "node:test";
import { continuationText } from "../src/magnet/export/context.js";
import { importConversations } from "../src/magnet/import/index.js";
import { archiveChoices, readerUrl } from "../apps/mobile/src/transfer.js";
import { transferUrl } from "../apps/mobile/src/api.js";

test("ChatGPT pasted labels retain ordered turns, markdown and fenced speaker examples", () => {
  const code = "## Example\n```text\nUser: this is code, not a turn\nChatGPT said:\n```\nKeep this constraint.";
  const result = importConversations(`You said:\nUse no dependencies.\nChatGPT said:\n${code}\nYou said:\nWhat next?`);
  assert.equal(result.conversations[0].source.provider, "chatgpt");
  assert.deepEqual(result.conversations[0].messages.map(({ role, content }) => ({ role, content })), [
    { role: "user", content: "Use no dependencies." }, { role: "assistant", content: code }, { role: "user", content: "What next?" },
  ]);
  assert.deepEqual(result.warnings, []);
});

test("full context retains long content, tools, author, source and chronology without a token budget", () => {
  const content = "constraint\n".repeat(8000) + "FINAL DECISION";
  const conversation = { title: "Plan", source: { provider: "chatgpt", url: "https://example.test/original" }, lineage: { originInstance: "https://sender.test" }, messages: [
    { role: "user", content, author: "Alex", createdAt: "2026-10-26T10:00:00Z" },
    { role: "tool", content: "{\"result\":42}" },
    { role: "assistant", content: "Next question?" },
  ] };
  const text = continuationText(conversation);
  assert.ok(text.includes(content));
  assert.ok(text.indexOf(content) < text.indexOf('{"result":42}'));
  assert.match(text, /\[1\] user \(Alex\).*2026-10-26/);
  assert.match(text, /\[2\] tool/);
  assert.match(text, /Source URL: https:\/\/example.test\/original/);
  assert.match(text, /Shared from: https:\/\/sender.test/);
  assert.match(text, /Messages: 3/);
});

test("archive selection uploads only the selected chat and preserves its original branch data", () => {
  const entries = [{ title: "Share me", mapping: { a: {} }, current_node: "a" }, { title: "PRIVATE OTHER CHAT", mapping: { b: {} } }];
  const choices = archiveChoices(JSON.stringify(entries));
  assert.equal(choices.length, 2);
  assert.deepEqual(JSON.parse(choices[0].payload), entries[0]);
  assert.ok(!choices[0].payload.includes("PRIVATE OTHER CHAT"));
  assert.deepEqual(archiveChoices("You said:\nhello"), []);
});

test("reader links keep bearer tokens in fragments and normalize for existing transfer routes", () => {
  const raw = "https://relay.test/share/token_123-abc";
  assert.equal(readerUrl(raw), "https://relay.test/receive.html#token_123-abc");
  assert.equal(transferUrl(readerUrl(raw)), raw);
  assert.equal(transferUrl(raw), raw);
  assert.throws(() => readerUrl("https://relay.test/api/stats"));
});

test("ChatGPT media-only turns are visible placeholders with an explicit warning", () => {
  const result = importConversations(JSON.stringify({ title: "Image question", current_node: "a", mapping: {
    a: { parent: null, message: { author: { role: "user" }, content: { parts: [{ content_type: "image_asset_pointer", asset_pointer: "private-file" }] } } },
  } }));
  assert.equal(result.conversations[0].messages.length, 1);
  assert.match(result.conversations[0].messages[0].content, /Attachment not transferred/);
  assert.match(result.warnings.join(" "), /Reattach/);
});
