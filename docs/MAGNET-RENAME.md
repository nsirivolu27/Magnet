# Magnet rename and upgrades

Magnet is the new name of the LNKZ relay and its web/mobile app. Source lives in
`src/magnet`, packages use `magnet` / `@magnet/*`, and the PowerShell helper is
`magnet.ps1`. The GitHub repository is now `nsirivolu27/Magnet`. Existing local checkouts may
retain their `LNKZ` folder name; update their origin URL to
`https://github.com/nsirivolu27/Magnet.git`. The separate Magentic MCP/marketplace
product is unchanged.

## Compatibility kept deliberately

| Surface | Behavior |
| --- | --- |
| Configuration | Use `MAGNET_*`. Matching `LNKZ_*` variables remain accepted. The new name wins when both exist, including an explicitly empty value. |
| Mobile URL | `EXPO_PUBLIC_MAGNET_API_URL` wins over the older `EXPO_PUBLIC_LNKZ_API_URL`. |
| SQLite and JSON | Fresh installs use `.data/magnet.db` and `.data/magnet.json`. If only the corresponding old `.data/lnkz.*` file exists, it is reused in place. No database is moved or deleted. If both exist, explicitly set `MAGNET_DB_FILE` to the intended database. |
| Saved connections | Mobile reads the old connection key and migrates it after a successful write. The browser console similarly migrates its session key. Disconnect removes both keys. |
| Native app identity | Display name becomes Magnet. `app.lnkz.mobile` remains the native application ID to preserve installed-app data. Both `magnet` and `lnkz` URL schemes are registered. |
| MCP | Tool names remain stable. Both `magnet://` and `lnkz://` resource URIs work. The server identifies itself as `magnet`. |
| MCP launch paths | `dist/magnet/stdio.mjs` is canonical. The build emits a small `dist/lnkz/stdio.mjs` forwarding launcher for existing desktop configurations; the migration CLI has the same compatibility launcher. |
| Conversation interchange | `magnet` and `lnkz` import/export selectors produce the same `lnkz.conversation.v1` packet. Preview format versions, the `x-lnkz-context` header, and connector IDs remain stable for older peers. |
| Infrastructure | Existing AWS stack/resource identifiers, database roles, repository name, and persistent disk/volume names stay stable to avoid replacing deployed resources. |

New documentation uses Magnet. Historical changelogs and recorded demos retain
the names used at the time. Old strings in compatibility code are intentional.

## Running and upgrading

Use the existing checkout; no folder rename is required:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
npm test
npm run build
corepack pnpm build:mobile
corepack pnpm verify:web
corepack pnpm verify:http
corepack pnpm verify:journey
```

The release archive is `artifacts/magnet-0.2.0.tgz`. Back up the current database
before replacing an installation. Keep the existing `.data` directory and API
credentials. For Compose, stop the old service before starting the newly named
`magnet` service; preserve the named volume and never use `down -v` during an upgrade.
For an existing Render service, retain its service identity when applying the
blueprint. A new display name alone is not a data migration.

This is a name and compatibility change. It does not implement end-to-end
encryption, recipient accounts, encrypted media delivery, or app-store deployment.
The current app still uses the existing plaintext conversation relay.
