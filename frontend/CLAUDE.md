# CLAUDE.md

Guidance for working in `frontend/` - the React Native (Expo, TypeScript) mobile client for the
Miravelt backend (repo root `../`). See `docs/DESIGN_SPEC.md` for the design spec and
`docs/API_REFERENCE.md` for the backend contract this app is built against. (The app was ported
from Flutter; the Dart sources remain in git history before the "remove the Flutter client" commit.)

## Commands

```bash
npm install --legacy-peer-deps           # the testing library's peer range trips npm's resolver
npx expo start                           # Metro; use a dev build or emulator (expo-dev-client)
npm run typecheck                        # tsc --noEmit - should report nothing
npm test                                 # jest-expo: unit + screen tests
npx jest __tests__/redirect.test.ts      # single file
npx expo export --platform android       # proves the whole app bundles (also: ios)
```

Native `android/` and `ios/` are generated (`npx expo prebuild`), gitignored, and not committed.

## Configuration

Build-time only (`EXPO_PUBLIC_*`, inlined by Metro): `EXPO_PUBLIC_MIRAVELT_API_KEY` (no usable
default - falls back to the public `miravelt_test_key_123` placeholder, which Developer settings'
BUILD section flags), `EXPO_PUBLIC_MIRAVELT_API_BASE_URL`, `EXPO_PUBLIC_MIRAVELT_LOCAL_API_BASE_URL`.

The backend is a **runtime** choice (`src/config/apiEnvironment.ts`, `src/state/settings.ts`):

| Environment | Default base URL |
|---|---|
| `production` (fresh-install default) | `https://miravelt.deploy.lokeshrc.me/` |
| `local` | `http://10.0.2.2:9850/` on Android, `http://localhost:9850/` elsewhere |
| `custom` | a URL typed into Developer settings |

Switch it from Profile > Developer settings, unlocked by tapping that row (or the version line on
the login screen) 5 times; it works in release builds. Switching signs out *first* so tokens are
never sent to the newly chosen host. `usesCleartextTraffic` is on (via `expo-build-properties`) so a
LAN `http://192.168.x.y:9850/` works. The app never talks to Ollama/Milvus directly.

## Architecture

- `app/` - expo-router file routes, each a one-line re-export of a screen in `src/screens/`.
  `app/_layout.tsx` loads fonts + settings, bootstraps the session, hosts the global sheets/toast and
  runs `RedirectGate`. `app/(tabs)/_layout.tsx` is the Overview/Signals/Activity shell with the
  floating pill nav and the launch-time update check.
- `src/api` - `client.ts` (fetch + XHR upload; API-key/bearer headers; single-flight refresh on 401
  with one retry; typed errors in `errors.ts`), `repositories.ts`, `mappers.ts` (snake_case ->
  camelCase + Dates; bare `YYYY-MM-DD` is a *local* date), `instance.ts` (the singleton, reads the
  base URL from settings per request).
- `src/state` - zustand: `auth`, `settings` (persisted to AsyncStorage), `session` (selected period),
  `upload`, `sheets`, `toast`, `appUpdate`. `src/hooks/periods.ts` - TanStack Query hooks (cached
  until invalidated, no auto-retry).
- `src/lib/redirect.ts` - `computeRedirect`, the launch/sign-in/onboarding rules as a pure function.
- `src/components`, `src/theme` (one `colors` palette swapped in place for light/dark by
  `applyColorScheme`, Inter typography), `src/screens`. Read colour tokens at render time, never
  inside `StyleSheet.create`, so a theme switch repaints them. See `../DESIGN_SYSTEM.md`.
- Tests live in `__tests__/`; `__tests__/support/fakes.ts` has a scripted fake `fetch` and in-memory
  token storage - reuse them instead of writing new mocks.

Launch: the router starts on `/` (splash) and holds there while the stored session is checked.
Signed out, a first launch goes to the `/welcome` tour (`settings.introSeen`), later ones to `/login`.
`usePeriods` is keyed on the signed-in user id, and the redirect waits for it before choosing
Overview vs onboarding. Only a *finished* period pulls someone off onboarding (see the comment in
`redirect.ts`). The logo mark is deliberately not shown in-app - splash/onboarding use the wordmark.

## Releases

Android: `eas build -p android` (credentials in EAS) or `npx expo prebuild` + Gradle with your own
upload keystore (keep it outside the repo; an APK signed with one key can't be installed over one
signed with another - uninstall first). `android.versionCode` in `app.json` is the integer the
in-app updater compares against the backend's `version_code`; bump it per release. The updater
(Android only) downloads the APK with `expo-file-system` and hands it to the system installer.

## Icons and avatars

`tool/generate_app_icons.py` (Pillow, run from the repo root) builds `assets/icon.png`,
`adaptive-icon.png` and `favicon.png` from `../assets/Frame.png` onto `#0D0F15` (the launcher-icon
background, also set in `app.json`). The user avatar is one of the nine illustrations in `assets/avatars/`,
chosen by `src/lib/avatars.ts` from a stable FNV-1a hash of the user id (identical to the Flutter
client's, so existing users keep their face). Render it with `UserAvatar`.
