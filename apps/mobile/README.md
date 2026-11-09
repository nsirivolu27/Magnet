# Magnet Mobile

The Expo client connects directly to the canonical Magnet REST relay. It stores the API key with Expo SecureStore on iOS and Android and uses browser local storage only for web previews.

## Run locally

1. Start the relay from the repository root with `corepack pnpm dev`.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_MAGNET_API_URL` to the URL the device can reach.
3. Start Expo with `corepack pnpm dev:mobile`.

`localhost` works in the web preview. A physical phone needs the computer's LAN address or a deployed HTTPS API URL. The connection screen also lets a user override the build-time URL and stores that choice on the device.

## Browser preview and deployment

Add the exact Expo or Replit preview origin to the backend `ALLOWED_ORIGINS` list. Add the backend's public hostname to `ALLOWED_HOSTS`. For example:

```env
ALLOWED_HOSTS=api.example.com
ALLOWED_ORIGINS=https://mobile.example.com
```

Keep `MAGNET_API_KEY` only in the backend's secret manager. Enter it through the mobile connection screen; never place it in `EXPO_PUBLIC_*`, because Expo public variables are embedded in the client bundle.

The combined release is built from the repository root with
`corepack pnpm build:release`; it serves this app at `/mobile/` without Metro.

## Native builds

`eas.json` lives here, in the app directory, as required for an
[Expo monorepo](https://docs.expo.dev/build-reference/build-with-monorepos/).
These profiles are configuration, not evidence of a signed or installed app:

| Profile | Android | iOS |
| --- | --- | --- |
| `preview` | Installable APK, no Metro required | Internal distribution; Apple signing/device registration required |
| `simulator` | Inherits preview | Simulator build, requires a macOS simulator to run |
| `production` | Store AAB | Store-signed app; signing and store setup required |

Use EAS CLI from this directory after logging into your Expo account and linking
the project with `eas init`. Do not invent an EAS project ID or upload signing
credentials to Git. Set the public HTTPS relay URL through the selected EAS
environment as `EXPO_PUBLIC_MAGNET_API_URL`; users can override it in the connection
screen. The URL is public configuration, never an API key.

```bash
cd apps/mobile
eas build --platform android --profile preview
eas build --platform ios --profile simulator
# Only after device testing and signing setup:
eas build --platform all --profile production
```

These remote builds require an Expo account and may incur charges. They do not
submit the app to stores. Validate the pinned Expo SDK against current store
requirements before requesting a store build; a web export cannot prove that.
On two real devices test connection, import, preview without spending a use,
accept/continue, reply, return handoff and restart. The current native app is the
relay client; E2EE is not implemented.
