# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Scoped to `frontend/` - the Flutter mobile client for the Velar backend (repo root `../`). See
`docs/DESIGN_SPEC.md` for the full design spec and `docs/API_REFERENCE.md` for the backend
contract this app is built against.

## Commands

```bash
flutter pub get
flutter run --dart-define=VELAR_API_KEY=your-api-key-here
flutter analyze                          # should report no issues
flutter test                              # full widget/unit suite
flutter test test/features/auth/login_screen_test.dart   # single test file
flutter build apk --release \
  --dart-define=VELAR_API_BASE_URL=https://your-production-host \
  --dart-define=VELAR_API_KEY=your-production-api-key
```

## Configuration

The app only ever points at one of exactly two backends - `ApiEnvironment` in
`lib/core/config/api_environment.dart`:

| Environment | Default base URL | Override (`--dart-define`) |
|---|---|---|
| `production` (release default) | `https://velar.deploy.lokeshrc.me/` | `VELAR_API_BASE_URL` |
| `local` | `http://10.0.2.2:9850/` on Android emulator, `http://localhost:9850/` elsewhere (matches `docker-compose_local.yaml`'s port) | `VELAR_LOCAL_API_BASE_URL` |

Which one is active is a **runtime** choice, persisted on-device and switchable from Profile >
Developer > "API server" in debug builds only (switching signs the user out - a session token from
one backend isn't valid on the other); a fresh install always starts on `production`. The one
value that stays build-time only is `VELAR_API_KEY` (`--dart-define`, no usable default - falls
back to a `velar_test_key_123` placeholder otherwise, see `lib/core/config/app_config.dart`).

Local HTTP (not HTTPS) to `10.0.2.2`/`localhost`/`127.0.0.1` is explicitly allowlisted for this
reason; every other host must be HTTPS.

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
still signs with the debug keystore (see the `TODO` there), and the app icons are still Flutter's
default placeholders.
