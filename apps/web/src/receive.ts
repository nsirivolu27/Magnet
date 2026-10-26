import { continuationText, type PortableConversation } from "../../../src/magnet/export/context";
import "./receive.css";

const status = document.querySelector<HTMLElement>("#status")!;
const open = document.querySelector<HTMLButtonElement>("#open")!;
const token = location.hash.slice(1);
let text = "";
let packet: unknown;
const actionStatus = document.querySelector<HTMLElement>("#action-status")!;
const failure = (error: unknown) => { status.textContent = error instanceof Error ? error.message : "Could not open this conversation."; };
async function request(suffix: string) {
  const response = await fetch(`/share/${encodeURIComponent(token)}${suffix}`, { credentials: "omit", cache: "no-store", redirect: "error" });
  if (!response.ok) throw new Error(response.status === 404 || response.status === 410 ? "This link has expired, was revoked, or has no uses left. Ask the sender for a new link." : "Could not reach Magnet. Please try again.");
  return response.json();
}
function download(content: string, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
open.onclick = async () => {
  open.disabled = true;
  try {
    packet = await request("");
    const conversation = (packet as { conversation: PortableConversation }).conversation;
    text = continuationText(conversation);
    document.querySelector("#preview")!.textContent = `${conversation.source.provider} · ${conversation.messages.length} messages · Opened copy`;
    document.querySelector<HTMLTextAreaElement>("#context")!.value = text;
    for (const message of conversation.messages) {
      const article = document.createElement("article");
      const heading = document.createElement("h3"); heading.textContent = message.author ? `${message.role} · ${message.author}` : message.role;
      const body = document.createElement("pre"); body.textContent = message.content;
      article.append(heading, body); document.querySelector("#messages")!.append(article);
    }
    document.querySelector<HTMLElement>("#result")!.hidden = false;
    open.hidden = true;
    status.textContent = "Opened. One link use was spent. Download a copy before leaving; reopening spends another use.";
  } catch (error) { failure(error); open.disabled = false; }
};
document.querySelector<HTMLButtonElement>("#copy")!.onclick = async () => {
  try { await navigator.clipboard.writeText(text); actionStatus.textContent = "Copied. Paste into a new Claude chat and add what you want to do next."; }
  catch { document.querySelector("details")!.open = true; document.querySelector<HTMLTextAreaElement>("#context")!.select(); actionStatus.textContent = "Copy the selected text manually."; }
};
document.querySelector<HTMLButtonElement>("#download")!.onclick = () => download(text, "magnet-context.txt");
document.querySelector<HTMLButtonElement>("#packet")!.onclick = () => download(JSON.stringify(packet, null, 2), "magnet-conversation.json", "application/json");
async function preview() {
  if (!/^[A-Za-z0-9_-]+$/.test(token)) throw new Error("This link is incomplete. Ask the sender to copy the full Magnet link.");
  const { preview } = await request("/preview");
  document.querySelector("h1")!.textContent = preview.title;
  document.querySelector("#preview")!.textContent = `${preview.provider} · ${preview.messageCount} messages · ${preview.usesRemaining} ${preview.usesRemaining === 1 ? "use" : "uses"} left · Expires ${new Date(preview.expiresAt).toLocaleString()}${preview.redact ? " · Sensitive text filtered" : ""}`;
  status.textContent = "Previewing does not spend a use. Anyone with this link can open it. Opening spends one use. No account needed.";
  open.hidden = false;
}
void preview().catch(failure);
