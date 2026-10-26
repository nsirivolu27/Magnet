/** Account archives are selected locally: only the chosen chat is uploaded. */
export function archiveChoices(text: string): { title: string; payload: string }[] {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(value) || !value.length || !value.every((item) => item && typeof item === "object" && item.mapping)) return [];
  return value.map((item) => ({ title: typeof item.title === "string" ? item.title : "Untitled conversation", payload: JSON.stringify(item) }));
}

export function readerUrl(shareUrl: string): string {
  const url = new URL(shareUrl);
  const token = /^\/share\/([A-Za-z0-9_-]+)$/.exec(url.pathname)?.[1];
  if (!token) throw new Error("Invalid Magnet share link.");
  return `${url.origin}/receive.html#${token}`;
}

export function downloadText(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
