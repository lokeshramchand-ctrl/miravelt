# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Scoped to `frontend/` - the Flutter mobile client for the Miravelt backend (repo root `../`). See
`docs/DESIGN_SPEC.md` for the full design spec and `docs/API_REFERENCE.md` for the backend
contract this app is built against.

## Commands

```bash
flutter pub get
flutter run --dart-define=MIRAVELT_API_KEY=your-api-key-here
flutter analyze                          # should report no issues
flutter test                              # full widget/unit suite
flutter test test/features/auth/login_screen_test.dart   # single test file
flutter build apk --release \
  --dart-define=MIRAVELT_API_BASE_URL=https://your-production-host \
  --dart-define=MIRAVELT_API_KEY=your-production-api-key
```

## Configuration

The app points at one of three backends - `ApiEnvironment` in `lib/core/config/api_environment.dart`:

| Environment | Default base URL | Override (`--dart-define`) |
|---|---|---|
| `production` (release default) | `https://miravelt.deploy.lokeshrc.me/` | `MIRAVELT_API_BASE_URL` |
| `local` | `http://10.0.2.2:9850/` on Android emulator, `http://localhost:9850/` elsewhere (matches `docker-compose_local.yaml`'s port) | `MIRAVELT_LOCAL_API_BASE_URL` |
| `custom` | none - a URL a developer types in at runtime, stored via `customApiBaseUrlProvider` | n/a |

Which one is active is a **runtime** choice, persisted on-device and switchable from Profile >
Developer settings > "API server" (switching signs the user out - a session token from one backend
isn't valid on the other); a fresh install always starts on `production`. `effectiveApiBaseUrlProvider`
(`lib/core/providers/settings_providers.dart`) is what `apiClientProvider` actually watches - it
resolves `custom` against the stored override, since `ApiEnvironment.baseUrl` itself only knows the
two static presets. The Developer settings section is unlocked by tapping its row 5 times (like
Android's Developer Options), not gated by `kDebugMode` - it's reachable in release builds too, so
QA on a release APK can point at a staging/local backend without a debug build. There is no
separate Ollama/Milvus setting: the app never talks to those directly (see `ARCHITECTURE.md`), only
to whichever backend is active, so pointing at a different backend is the only lever the client has.
On Android, `network_security_config.xml` permits cleartext app-wide (it can't express "private LAN
ranges"), so a Custom `http://192.168.x.y:9850/` works; see that file for the tradeoff. The Localhost
preset's `10.0.2.2` only exists inside the Android emulator - on a physical phone use Custom with the
host's LAN address, or `adb reverse tcp:9850 tcp:9850` plus Custom `http://localhost:9850/` (the
sheet says this when Localhost is picked). Switching backends signs out *first*, so the current
session's tokens are never sent to the newly-selected host. The one value that stays build-time only
is `MIRAVELT_API_KEY` (`--dart-define`, no usable default - falls back to a `miravelt_test_key_123`
placeholder otherwise, see `lib/core/config/app_config.dart`); Developer settings' BUILD section
flags a build that shipped with the placeholder.

## Launch and branding

The router starts on `/splash` (not `/login`) and holds there while the stored session is checked,
so a signed-in user never sees the login form flash. `periodsProvider` is keyed on the signed-in
user id - the router reads it to pick Overview vs onboarding, and without that key it would carry a
signed-out (or previous account's) result through a sign-in. The app's logo mark is deliberately
not shown inside the app - splash and onboarding use the "Miravelt" wordmark only, and
`values-v31`/`values-night-v31` blank the Android 12+ system splash icon (it would otherwise draw
the launcher icon on every launch).

## Architecture

Clean Architecture, feature-first: `lib/features/<feature>/{data,domain,presentation}` (see
`auth`, `statements`, `analytics`, `app_update` for the full three-layer shape; simpler features
like `overview`, `signals`, `profile`, `legal`, `onboarding`, `upload` are presentation-only,
reading from another feature's data layer). Shared cross-feature code lives in `lib/core/`
(`config`, `network`, `routing`, `storage`, `theme`, `notifications`, `providers`, `utils`) and
`lib/shared/widgets/`.

- **State management is classic Riverpod** (`Provider`/`FutureProvider`/`NotifierProvider`/
  `AsyncNotifierProvider`), not the `@riverpod` code generator - a resolved `riverpod_generator` →
  `analyzer` version conflict made codegen unusable in this environment. Don't reintroduce it
  without re-solving that conflict.
- `build.yaml` sets `json_serializable`'s `field_rename: snake` globally, so model classes don't
  need per-field `@JsonKey(name: ...)` annotations to match the backend's snake_case JSON.
- Routing is centralized in `lib/core/routing/app_router.dart` / `app_shell.dart`.
- Tests live under `test/features/<feature>/...`, mirroring `lib/`; `test/support/` holds shared
  fakes (`fake_http_client_adapter.dart`, `fake_secure_storage_platform.dart`) - reuse these for
  new tests needing a fake network/storage layer rather than writing new mocks per test.

Before this is Play-Store-publishable: `android/app/build.gradle.kts`'s release `signingConfig`
still signs with the debug keystore (see the `TODO` there).

## Icons and avatars

Launcher icons on both platforms are generated from `../assets/upfront_icon.png` by
`tool/generate_app_icons.py` (needs Pillow, run from the repo root) - edit the source art and
rerun it rather than hand-editing the bitmaps. It writes the iOS `AppIcon.appiconset` slots
flattened onto `#0D0F15` (iOS rejects alpha in app icons), plus Android's adaptive layers
(`mipmap-anydpi-v26` + `ic_launcher_foreground.png`, art kept inside the 66dp safe zone) and
the legacy/round bitmaps. The background colour is `AppColors.ink900`, duplicated in
`values/ic_launcher_background.xml` - keep the two in sync.

The *user* avatar is one of the nine illustrations in `assets/avatars/`, assigned by
`lib/core/avatars/user_avatars.dart` from a stable FNV-1a hash of the user id (not stored
server-side, not random per launch). Render it with `UserAvatar`, which falls back to the
initials `AvatarChip` when there's no user; `AvatarChip` on its own is still what merchant
rows use.
