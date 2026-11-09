# Magnet — pick up the conversation anywhere

## The idea

You have a useful conversation in ChatGPT. You want Claude's perspective, or
you want a friend to pick up where you stopped. Today you repeat the background,
lose constraints, or forward fragments. Magnet keeps the conversation together
and prepares it for the next person or AI.

**The first product loop: bring a conversation → review it → pass it on.**

For example, a user plans a trip in ChatGPT with a $300 budget and no driving.
They import the conversation into Magnet, check the four messages, and choose
Continue in Claude. Magnet prepares the full text, including the budget,
transport decision, code if present, and unanswered questions. The user pastes
or uploads it into Claude and asks their next question. Alternatively they send
a link to a friend, who can read the same conversation without a Magnet account.

## The experience to finish

1. **Bring it in.** A prominent Import conversation action. Accept labelled
   pasted text and text/JSON exports. For ChatGPT account archives, select one
   conversation locally before uploading. Preview the title, source and message
   count, and show warnings before saving. A source URL alone is not an import.
2. **Review the thread.** Show ordered user/assistant turns with readable code
   and source attribution. Let the user add a follow-up. Show what was actually
   saved; never substitute an invented summary for missing history.
3. **Choose where it goes.** Two clear choices: Continue in another AI and
   Send to a person. AI transfer offers full-text copy/download, then an explicit
   open-destination action. Person transfer offers an expiring link, use count,
   optional sensitive-text filtering, and revocation.
4. **Receive it.** A readable, account-free page previews metadata without
   consuming a use. An explicit Open conversation action spends a use and shows
   the transcript. The recipient can copy it for their own AI, download text,
   or download a Magnet copy to import later.

Use a calm conversation interface: black, white, neutral gray, clear type,
generous spacing and a single main action per step. No purple/magenta, gradients,
dashboard metrics, cloud-provider setup, or MCP terminology in the primary flow.
Use the existing Expo app and backend; this is not a new landing-page project.

## What context preservation means

Preserve every saved text message, its role, order, code and available source
information. Follow the selected branch of a ChatGPT export rather than mixing
abandoned drafts into it. Do not silently truncate to a token budget.

Do not promise hidden reasoning, platform memory, attachments, or identical model
behavior. The destination model still has a context limit. State when material
is missing and ask the user to reattach files there. Full AI exports are not
redacted; the optional filter applies to person links. Review before sending.

Anyone with a bearer share link can use it. A recipient label is not identity
verification. Revocation prevents future access, not copies already downloaded.
This version is not E2EE. Do not describe it as an encrypted messenger.

## Existing implementation

Repository: https://github.com/nsirivolu27/Magnet

Handoff branch: `codex/conversation-handoff`.

- `apps/mobile/App.tsx`: Expo conversation interface, import preview, full-context
  copy/download and readable person links.
- `apps/mobile/src/api.ts`: authenticated REST client and reader-link normalization.
- `src/magnet/import/`: conversation parsers, including ChatGPT branch handling
  and pasted speaker labels with code-fence protection.
- `src/magnet/export/context.ts`: full-text continuation document.
- `src/magnet/export/wire.ts`: authenticated `/api/conversations/:id/context`.
- `apps/web/receive.html` and `apps/web/src/receive.ts`: person-facing reader;
  `/share/:token/preview` looks, `/share/:token` redeems. Keep both contracts intact.
- `scripts/acceptance.mjs`: real two-relay import, transfer, return, revocation,
  authentication and restart checks.

The server serves `/mobile/`, `/receive.html`, and the API together. Do not start
separate mock servers or substitute fixture data for real persistence.

## Replit continuation instructions

Continue this repository on the handoff branch. Read AGENTS.md, README.md,
CONTRIBUTING.md and this brief first. Inspect Git status, remotes and differences
before integrating into an existing Replit project. Preserve its uncommitted
work; do not force-reset it or create a second embedded copy of Magnet.

The checked-in `.replit` is stale: it specifies Node 20, placeholder domains and
a build that omits the Expo web bundle. Before running, select a supported Replit
runtime with Node >=22.16 (the SQLite implementation needs it), verify `node -v`,
and replace the old configuration using the actual workspace settings. Do not
guess module identifiers or replace SQLite with a mock to make Node 20 work.

Use the pinned package manager and these existing commands:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build:release
corepack pnpm verify:release
corepack pnpm verify:journey
corepack pnpm start
```

Configure one HTTP server on the workspace's forwarded port, bound to `0.0.0.0`.
Set PORT to that port. Put a strong MAGNET_API_KEY in Replit Secrets. Configure
MAGNET_PUBLIC_BASE_URL to the actual HTTPS app origin and ALLOWED_HOSTS and
ALLOWED_ORIGINS to the exact host/origin. Do not disable host validation or auth
to fix an Invalid Host response. Never put credentials in browser source, Git,
logs, query parameters, or the prompt. Keep same-origin API access in the app.

Use the appropriate persistent store from DEPLOY.md. Do not rely on a temporary
deployment filesystem for durable conversations. Database credentials belong in
Secrets; run the existing migrations if selecting PostgreSQL. Report missing
credentials or storage configuration rather than claiming deployment succeeded.

First get the existing flow running at `/mobile/`. Then simplify the UI around
the three-step product loop above. Keep app logic in the existing implementation,
do not add dependencies without a demonstrated need, and preserve auth, import,
preview, redaction, expiration and revocation tests. Leave the separate Magentic
MCP/marketplace product out of this task. Do not add billing, automatic model
calls, contacts, workspaces, media transfer, or E2EE as part of this pass.

## Acceptance evidence

- Import a four-turn ChatGPT conversation with a constraint, decision, code
  block containing a speaker-like line, and an unanswered question. All four
  messages must retain their content and roles.
- Previewing an import must not save it. Choosing one archive chat must not
  upload the rest of the archive.
- Copy and downloaded AI text must contain every saved turn with no truncation.
  Opening Claude must not silently transmit the conversation.
- A person opens a link without a key; preview twice, then redeem a one-use
  link successfully. A second redemption fails with a useful message.
- Revoke a fresh link and verify preview, import and continuation fail.
- Transfer between two independent stores and preserve source and lineage.
- Refresh/restart and verify saved conversations remain.
- Check phone-width and desktop layouts, keyboard navigation, loading states,
  invalid exports, expired links, clipboard failure and network errors.
- Report commands and results, skipped checks, the actual running preview URL,
  and whether a public deployment exists. Local tests are not hosted evidence.

Before this handoff, local verification passed 141 application tests (2
PostgreSQL integration tests skipped), workspace typechecks, the release build,
standalone release verification, and all 18 two-relay journey checks. The
browser import, clipboard, recipient preview/read and spent-link paths were
also exercised. Replit execution is still unverified.
