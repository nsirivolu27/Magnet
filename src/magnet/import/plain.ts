import { buildConversation, dropPreamble, normalizeRole, titleFromMessages } from "./shared.js";
import type { ConversationInput, MessageInput } from "../types.js";

const SPEAKER_LINE = /^\s*(user|human|me|you|assistant|ai|bot|chatgpt|claude|gemini|copilot|grok|system|tool)\s*[:：]\s*(.*)$/i;
const CHATGPT_LABEL = /^\s*(you|chatgpt) said\s*[:：]?\s*$/i;
export function hasPlainSpeakerLabels(payload: string): boolean {
  return payload.split(/\r?\n/).some((line) => CHATGPT_LABEL.test(line) || SPEAKER_LINE.test(line));
}

/**
 * The lowest common denominator: someone copied a chat out of a window. If the
 * lines are labeled, Magnet splits on the labels; otherwise the text is stored
 * whole so nothing is lost to a guess.
 */
export function importPlainText(payload: string): { conversations: ConversationInput[]; warnings: string[] } {
  const lines = payload.replace(/\r\n/g, "\n").split("\n");
  const messages: (MessageInput & { attributed: boolean })[] = [];
  let current: { role: string; buffer: string[]; attributed: boolean } | null = null;
  const warnings: string[] = [];
  let fence = "";
  let fenceLength = 0;
  let fromChatGpt = false;

  const flush = () => {
    if (!current) return;
    const content = current.buffer.join("\n").trim();
    if (content) messages.push({ role: normalizeRole(current.role), content, attributed: current.attributed });
    current = null;
  };

  for (const line of lines) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    const inFence = Boolean(fence);
    if (marker && !fence) { fence = marker[0]; fenceLength = marker.length; }
    else if (marker && marker[0] === fence && marker.length >= fenceLength && /^\s*(`+|~+)\s*$/.test(line)) fence = "";
    const chatGpt = !inFence && !marker ? CHATGPT_LABEL.exec(line) : null;
    if (chatGpt) fromChatGpt = true;
    const speaker = !inFence && !marker ? chatGpt ?? SPEAKER_LINE.exec(line) : null;
    if (speaker) {
      flush();
      const label = speaker[1].toLowerCase();
      const role = ["you", "me"].includes(label) ? "user" : ["chatgpt", "claude", "gemini", "copilot", "grok"].includes(label) ? "assistant" : label;
      current = { role, buffer: speaker[2] ? [speaker[2]] : [], attributed: true };
      continue;
    }
    if (current) current.buffer.push(line);
    else if (line.trim()) current = { role: "user", buffer: [line], attributed: false };
  }
  flush();

  const turns = dropPreamble(messages);

  if (!turns.some((turn) => turn.attributed)) {
    warnings.push("No speaker labels were found, so the text was stored as one message.");
  }

  const stripped = turns.map(({ attributed, ...message }) => message);
  const conversation = buildConversation({
    title: titleFromMessages(stripped, "Pasted conversation"),
    provider: fromChatGpt ? "chatgpt" : "text",
    app: "paste",
    messages: stripped.length ? stripped : [{ role: "user", content: payload.trim() }],
    tags: ["imported", "text"],
  });

  return { conversations: conversation ? [conversation] : [], warnings };
}
