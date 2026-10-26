# Magnet

**Keep the conversation. Share what matters.**

Magnet is a conversation aggregator for passing context between LLMs. It brings
AI conversations into one place so you can save them, add your own
messages, and pass them to another person or device without losing the context.
It has a simple black-and-white chat interface for mobile and the web.

## What you can do today

- **Start a conversation.** Write a message and keep adding to the same thread.
- **Bring an existing chat.** Paste a ChatGPT, Claude, or Gemini export, Markdown,
  JSON, or plain text. In the web app, choose a text file or select one chat from
  ChatGPT's `conversations.json` archive before uploading. Preview the message count and import warnings before saving.
- **Continue in Claude or another AI.** Prepare, copy, or download the full saved
  transcript from Share, then paste or upload it into a new AI chat. This handoff
  retains message roles, order, source, code, and text without summarizing it.
- **Find what you saved.** Browse recent conversations or search your history.
- **Share a conversation.** Create a link with an expiration and a use limit,
  optionally filter common sensitive text, and revoke access when needed. The
  recipient sees a readable preview and can open and download the chat without an account.
- **Pick up where someone left off.** Preview a shared link without using it up,
  keep a copy, or continue it with a new message. The conversation keeps its origin.

The current app stores and shares conversations. It does **not** generate AI
replies or automatically send messages into every AI platform.

## ChatGPT → Magnet → Claude or a person

1. In **Import or receive**, paste a transcript with `You said:` / `ChatGPT said:`
   labels, or choose `conversations.json` from a ChatGPT data export. For an archive,
   select the conversation locally; the other chats are not uploaded.
2. **Preview import**, review the message count and warnings, then **Save conversation**.
3. Open **Share → Prepare full conversation**. Use **Copy for Claude or another AI**
   or **Download transcript (.txt)**, open Claude, and paste or upload the text with
   your next question. Opening Claude alone does not transfer anything.
4. To send to a person instead, create a share link and send it through your preferred
   messenger. They can preview without spending a use, then explicitly open the
   conversation. Downloading a Magnet copy lets them import it later without reopening
   the link. They can also paste the link into their own Magnet installation.

The AI export is the full saved text, not a shortened context packet. It is **not
redacted**; the filtering switch applies to person links only. A destination model's
context limit still applies. Attachments, hidden reasoning and platform memory do
not transfer; reattach needed files in the destination. ChatGPT shared URLs are not
scraped. Revocation cannot erase copies recipients have already saved.

## Try the app locally

Install Node.js 22.16 or newer and use the package manager pinned in this repository:

```bash
git clone https://github.com/nsirivolu27/Magnet.git
cd Magnet
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm build:mobile
corepack pnpm dev:devices 127.0.0.1
```

Open [Magnet A](http://127.0.0.1:3101/mobile/) and
[Magnet B](http://127.0.0.1:3102/mobile/). The command starts two separate local
instances and saves their connection keys in `.data/two-devices/connections.json`.
Enter the matching key on each connection screen. Keep that file private.
Your conversations persist when you stop and restart the command.

1. Write or import a conversation in A.
2. Open **Share**, create a link, and copy it.
3. In B, open **Import or receive**, paste the link, and preview it.
4. Keep a copy or continue the conversation, then share it back to A.

For two physical devices, use your computer's LAN address instead of `127.0.0.1`
and follow [the two-device guide](docs/TWO_DEVICES.md). The local HTTP setup is
for trusted-network testing. A public installation needs HTTPS and authentication.

## Privacy and current limits

**End-to-end encryption is not implemented yet.** The current server can read
stored conversations. Access keys and expiring links are access controls, not E2EE.
Anyone holding a valid share link can use it; an audience label is not recipient
verification. Review content before sharing, even when filtering is enabled.

The planned messenger adds recipient accounts, device-held encryption keys,
encrypted media and file delivery, and supported platform integrations. Video,
image, and audio messaging are not available in this version. See the
[roadmap](ROADMAP.md) for the remaining work.

Magnet is the sharing app. The separate Magentic product owns the MCP adapter
and marketplace work; those are not required to use Magnet's interface.

## Run your own installation

The same server serves the mobile web app at `/mobile/`, the web console at
`/console.html`, and the API. SQLite is the default local store; PostgreSQL is
available for deployments that need it.

```bash
corepack pnpm build:release
corepack pnpm verify:release
```

This creates `artifacts/magnet-0.2.0.tgz` and its SHA-256 checksum. The archive
contains the server, web app, mobile web app, migrations, and maintenance scripts.
It runs without installing runtime dependencies. See [deployment instructions](DEPLOY.md)
for credentials, HTTPS, persistent storage, Docker, and optional AWS infrastructure.

Native Android and iOS build profiles are in `apps/mobile/eas.json`; signed native
builds and app-store releases still require setup. A mobile web build is not proof
of a tested native release.

## Development

The app uses React Native and Expo, with a TypeScript/Node.js backend. The web
console uses Vite. One pnpm workspace covers the application and infrastructure.

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm verify:web
corepack pnpm verify:http
corepack pnpm verify:journey
```

Run the builds above before the verification commands. The journey check exercises
conversation sharing between two independent local servers; it does not replace
testing on physical phones.

- [Mobile development](apps/mobile/README.md)
- [Architecture](ARCHITECTURE.md) and [API reference](REST.md)
- [Optional MCP client setup](MCP.md)
- [Contributing](CONTRIBUTING.md) and [security reporting](SECURITY.md)
- [Upgrading from LNKZ](docs/MAGNET-RENAME.md)

Licensed under [MIT](LICENSE).
