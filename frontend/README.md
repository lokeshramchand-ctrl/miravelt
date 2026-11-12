# Miravelt

A financial analyst in your pocket - a React Native (Expo) mobile client for the Miravelt backend. Add a Google Pay statement PDF and Miravelt turns it into a period-based overview, ranked signals, recurring-payment detection, and a searchable transaction activity feed. See `docs/DESIGN_SPEC.md` for the design spec and `docs/API_REFERENCE.md` for the backend contract.

## Prerequisites

- Node.js 20+ (22 recommended) and, for device builds, the Android SDK / Xcode.
- A running Miravelt backend (see the repo root `../`) reachable from the device.
- The backend's `X-Miravelt-API-Key` value (no client-facing signup exists for it).

## Configuration

| Variable (build time) | Purpose |
|---|---|
| `EXPO_PUBLIC_MIRAVELT_API_KEY` | `X-Miravelt-API-Key` sent on every request. No usable default (falls back to a public placeholder). |
| `EXPO_PUBLIC_MIRAVELT_API_BASE_URL` | Overrides the deployed backend URL (default `https://miravelt.deploy-ui.lokeshrc.me/`). |
| `EXPO_PUBLIC_MIRAVELT_LOCAL_API_BASE_URL` | Overrides the Localhost preset (`http://10.0.2.2:9850/` on Android, `http://localhost:9850/` elsewhere). |

Put them in `frontend/.env.local` (gitignored). Which backend the app uses is a **runtime** choice: Developer settings > "API server" (Deployed / Localhost / Custom), unlocked by tapping the version line on the login screen or the "Developer settings" row in Profile five times. Switching signs you out first. On a physical phone `10.0.2.2` does not exist - use Custom with your computer's LAN address (e.g. `http://192.168.1.5:9850/`), or `adb reverse tcp:9850 tcp:9850` plus Custom `http://localhost:9850/`. Cleartext HTTP is enabled for exactly this.

## Running locally

```
npm install --legacy-peer-deps
npx expo run:android        # or run:ios - builds a dev client (native modules need it; Expo Go is not enough)
npx expo start              # then Metro for subsequent runs
```

## Checks

```
npm run typecheck
npm test
```

## Building a release

```
EXPO_PUBLIC_MIRAVELT_API_KEY=<key> eas build -p android --profile production
```

or `npx expo prebuild` and build the generated project with Gradle/Xcode. Bump `android.versionCode` in `app.json` for every release you publish through the backend's in-app updater.

## Legal

`docs/PRIVACY_POLICY.md` and `docs/TERMS_OF_SERVICE.md` are the canonical drafts; `src/lib/legalDocuments.ts` is the same content for the in-app screens - update both together.
