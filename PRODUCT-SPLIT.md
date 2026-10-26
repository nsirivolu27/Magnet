# Proposed product boundary: Magentic and Magnet

Status: product split proposal; component ownership is unchanged. The relay app
is now named Magnet; see docs/MAGNET-RENAME.md for its compatibility migration.
This does not rename or move the separate MCP product.
This supersedes the earlier plan to consolidate MCP work into LLMM; those
separate migration worktrees are not part of this change.

## Magentic (magentic.ai), currently the lnkz-mcp repository

- Owns the MCP server and marketplace product: `mcp.ts`, `surfaces.ts`,
  `stdio.ts`, `http.ts`, `http-main.ts`, and MCP tool registrations.
- Owns `catalog/`, `agents/`, `llm/`, `suggest.ts`, `elicit.ts`, and `list.ts`.
  These files already live here, so no relocation is necessary.
- Owns `client.ts`, `profiles.ts`, and the adapter-side `contract.ts`:
  authenticated REST access, profile selection, and wire validation.
- Owns `brand/tokens.css` and `brand/README.md` as the shared design source.
- Keeps LangChain providers optional. Sampling/provider enrichment belongs
  here; it must not become a required dependency of the relay.
- The current catalog distributes agent configuration. Marketplace ownership
  does not imply payments, third-party publishing, or install trust are complete.

## Magnet, the existing LNKZ repository

- Product scope is universal AI-content sharing to people, apps, AI platforms
  and other receiving systems, as defined in ROADMAP.md. Conversation transfer
  is the current foundation; media and general recipient delivery remain MVP
  work. Workspaces are a separate product concern, not part of this release.
- The messenger MVP requires end-to-end encryption. Magnet owns client key/session
  lifecycle and encrypted delivery. Magentic and server-side AI connectors do
  not gain decryption access to private chats. Current plaintext relay features
  remain separate until an explicit migration is implemented and verified.

- Owns `src/magnet/`: REST routes, storage, authentication, identity, import/export,
  deterministic analysis, handoffs, lineage, and domain authorization.
- Owns `apps/mobile`, `apps/web`, and relay infrastructure and deployment assets.
- Keeps its embedded `/mcp` and stdio compatibility surfaces for current clients.
  Removing or forwarding those is a separate integration change, not a file move.
  They must continue to use the same relay business services as REST.
- Owns its monochrome app tokens without a runtime dependency on the MCP server
  or a sibling checkout.

## The contract is the seam

Magentic calls Magnet through REST with the caller's credentials. It never imports
relay internals or opens the relay database. Magnet owns the authoritative API;
Magentic owns its client-side schema. Evolve both through versioned fixtures and
integration tests for auth failures, preview without redemption, import,
continuation, revocation, and workspace isolation. Keep URLs, tool names,
resource URIs, payloads and error semantics compatible until a migration is agreed.

## Brand decision

Magnet uses a monochrome black-and-white chat interface, neutral dark/light
palettes, system fonts, and a persistent message composer. This supersedes the
previous shared magenta accent. Magentic retains its separate house brand.
See DESIGN.md for the application rules.

## Separate approval required: disruptive naming migration

Proposed next step: rename the GitHub MCP repository to `magentic`, choose and
verify an available package name (for example `@magentic/mcp`), and introduce
`MAGENTIC_*` names for MCP-owned settings. The separate adapter still uses
`LNKZ_BASE_URL` and `LNKZ_API_KEY`; this app rename does not change its configuration.
Introducing `MAGNET_*` adapter aliases requires its own compatibility checks.

Before applying that step, inventory remotes, package/bin names, Docker/Fly/CI
settings, client examples, paths and environment names. Approve exact names,
alias precedence, a deprecation period, and rollback instructions. Then test
old and new client configurations. Do not rename repositories, publish packages,
delete legacy paths, or change deployed settings as part of the brand pass.
