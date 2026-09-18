# Velar

A financial analyst in your pocket - a Flutter mobile client for the Velar backend. Add a Google Pay statement PDF and Velar turns it into a period-based overview, ranked signals, recurring-payment detection, and a searchable transaction activity feed. See `docs/DESIGN_SPEC.md` for the full design spec and `docs/API_REFERENCE.md` for the backend contract this app is built against.

## Prerequisites

- Flutter SDK matching `environment.sdk` in `pubspec.yaml` (`^3.12.1`).
- A running instance of the Velar backend (see the repo root `../`) reachable from wherever you run the app.
- An issued `X-Velar-API-Key` value for that backend (see the backend's own docs for issuance - there is no client-facing signup for this key).

## Configuration

The app only ever points at one of exactly two backends - see `ApiEnvironment` in `lib/core/config/api_environment.dart`:

| Environment | Default base URL | Override (`--dart-define`) |
|---|---|---|
| `ApiEnvironment.production` (release default) | `https://velar.deploy.lokeshrc.me/` | `VELAR_API_BASE_URL` |
| `ApiEnvironment.local` | `http://10.0.2.2:9850/` on the Android emulator, `http://localhost:9850/` elsewhere (matches `docker-compose_local.yaml`'s published port) | `VELAR_LOCAL_API_BASE_URL` |

Which one is active is a **runtime** choice, not just a build-time one: it's persisted on-device and, in debug builds, switchable from Profile > Developer > "API server" (switching signs you out, since a session token from one backend isn't valid on the other). A fresh install always starts on `production`; the toggle itself is compiled out of release builds.

Override the defaults above for a physical device, a different local port (e.g. a bare `uvicorn app:app --reload` on 8000 instead of the full Docker stack on 9850), or a different production host.

The one value that's still build-time only, via `--dart-define=VELAR_API_KEY=...`, is the `X-Velar-API-Key` header sent on every request - it has no usable default and must always be passed (falls back to a `velar_test_key_123` placeholder otherwise; see `lib/core/config/app_config.dart`).

Local HTTP (not HTTPS) traffic to `10.0.2.2`, `localhost`, and `127.0.0.1` is explicitly allowlisted for this reason (Android's network security config and iOS's App Transport Security both block cleartext traffic by default otherwise) - every other host is still required to be HTTPS.

## Running locally

```
flutter pub get
flutter run --dart-define=VELAR_API_KEY=your-api-key-here
```

Defaults to the deployed backend; switch to Profile > Developer > "API server" > Localhost once the app is running to target a backend on your own machine instead.

## Building a release APK

```
flutter build apk --release \
  --dart-define=VELAR_API_BASE_URL=https://your-production-host \
  --dart-define=VELAR_API_KEY=your-production-api-key
```

Before this is Play-Store-publishable, `android/app/build.gradle.kts`'s release `signingConfig` still needs to be pointed at a real upload keystore - it currently signs with the debug keystore (see the `TODO` there and [Flutter's signing guide](https://docs.flutter.dev/deployment/android#sign-the-app)). The release build type already has R8 minification/resource shrinking enabled.

App icons (`android/app/src/main/res/mipmap-*`, `ios/Runner/Assets.xcassets/AppIcon.appiconset`) are still Flutter's default placeholder - swap in Velar's actual mark before shipping.

## Development

```
flutter analyze   # static analysis - should report no issues
flutter test      # widget/unit tests
```

Architecture notes for contributors:
- Clean Architecture, feature-first: `lib/features/<feature>/{data,domain,presentation}`.
- State management is **classic Riverpod** (`Provider`/`FutureProvider`/`NotifierProvider`/`AsyncNotifierProvider`), not the `@riverpod` code-generator - a resolved `riverpod_generator` → `analyzer` version conflict made codegen unusable in this environment, so don't reintroduce it without re-solving that.
- `build.yaml` sets `json_serializable`'s `field_rename: snake` globally to match the backend's snake_case JSON without per-field `@JsonKey` annotations.
