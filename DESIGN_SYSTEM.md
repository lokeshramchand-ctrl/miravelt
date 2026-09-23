# Design System

How the Miravelt mobile app (`frontend/`) looks, and the rules that keep it consistent. This file
describes the system **as implemented in code**; `frontend/docs/DESIGN_SPEC.md` is the
screen-by-screen spec it was built from (source: the Claude Design project for "Miravelt Mobile App
v2"). When the two disagree, the code is what ships and the difference is listed in
[§9 Known gaps](#9-known-gaps).

All tokens live in `frontend/lib/core/theme/`. Shared components live in
`frontend/lib/shared/widgets/`. Never hard-code a colour, radius, or text style in a screen when a
token exists - add a token instead.

## 1. Principles

- **Dark money surfaces, light reading surfaces, one luminous accent.** Headers, hero numbers,
  sheets and system states sit on *ink* (near-black). Lists, breakdowns and reading content sit on
  *paper* (near-white). A screen chooses its surface explicitly - this is a fixed two-surface
  design, not a global light/dark palette swap.
- **Numbers are the product.** Amounts use Space Grotesk with tabular figures everywhere so columns
  of money align. Currency is always `₹` with Indian grouping (`₹80,634`) and a true minus sign
  before the symbol (`−₹4,500`).
- **Colour is never the only signal.** Direction is carried by sign and glyph (`▲`, `↓`, `+`/`−`)
  as well as rose/accent.
- **Grounded, not decorative.** No donut charts, no invented metrics. Every figure maps to a
  backend field (see `DESIGN_SPEC.md` §6).
- **No logo inside the app.** The logo mark lives on the launcher icon only. In-app branding is
  the "Miravelt" wordmark (`AppTypography.wordmark14`) on the splash and onboarding screens, and
  the Android 12+ system splash icon is blanked (`android/app/src/main/res/values-v31/styles.xml`).

## 2. Colour - `AppColors`

Values are OKLCH, converted by `oklch.dart`, copied from the design source.

**Ink (dark) surfaces**

| Token | Use |
|---|---|
| `ink900` | Darkest background: dark screens, headers, splash. Also the launcher-icon background (`values/ic_launcher_background.xml`, keep in sync). |
| `ink850` | Elevated dark surface: sheets, cards, tiles, text fields |
| `ink800` | Level-2 dark surface: pills, icon buttons |
| `ink700` | Level-3: active nav segment, toggle-off track, drag handle |
| `hairlineDark` | 1px borders and dividers on dark |
| `onDark` / `onDarkMuted` / `onDarkFaint` | Primary / secondary / tertiary text on dark |

**Paper (light) surfaces**

| Token | Use |
|---|---|
| `paper` | Light screen background |
| `card` | Light card surface |
| `hairlineLight` | Borders and dividers on light |
| `onLight` / `onLightMuted` / `onLightFaint` | Primary / secondary / tertiary text on light |

**Accent and semantic colours**

| Token | Meaning |
|---|---|
| `accent` | Brand, positive, "money kept", primary buttons, active states |
| `accentDim` | Links, secondary bars, Food category |
| `accentInk` | Text and icons on an `accent` fill |
| `accentTint` | Light background for accent chips |
| `rose` | Outflow, negative, error, destructive actions |
| `amber` | "Watch" signals, warnings |
| `violet`, `sky` | Category hues |
| `*Tint` / `*Ink` pairs | Chip, badge and avatar backgrounds with matching text (`amberTint`/`amberTextOnTint`, `violetTint`/`violetInk`, `skyTint`/`skyInk`, `roseTint`/`roseInk`) |

**Category colours** come only from `AppColors.forCategory(name)`: Food → `accentDim`, Travel →
`violet`, Bills → `amber`, Shopping → `sky`, Personal Care → `violet`, Income → `accent`,
Entertainment → `sky`, Healthcare → `amber`, Subscription → `sky`, Utility → `amber`,
Friends → `accentDim`, Education → `violet`. Anything else (including `Uncategorized`) is `rose`.
Add new backend categories to this switch rather than colouring them at the call site.

**Misc:** `skeletonBase`/`skeletonHighlight` (+ `Dark` variants), `progressTrackLight`,
`analysingGlowCenter` (Analysing screen radial glow), `scrimHeavy`/`scrimMedium` (sheet scrims),
`roseFlowGradientEnd` (the outflow segment of Overview's flow bar only).

## 3. Typography - `AppTypography`

Three families via `google_fonts`; every style applies tabular figures.

| Family | Role | Styles |
|---|---|---|
| **Space Grotesk** | Amounts, headlines, wordmark | `heroAmount44/40/36/34`, `screenTitle24`, `bigHeadline32/26/22`, `amountMedium20/19/17/16/15/14`, `amountSmall22`, `navTitle15`, `wordmark14` |
| **Instrument Sans** | Body, labels, buttons | `signalBody17`, `cardBody15`, `cardBody135`, `body14/13`, `rowLabel145/14`, `buttonLabel15/14/13/12`, `footnote15/12/1155`, `meta115` |
| **Instrument Sans (caps, tracked)** | Micro labels (`SENT`, `WHERE IT WENT`) | `microLabel11`, `microLabelTracked105`, `microLabelTracked11` |

Style names carry their size (`heroAmount44` is 44px). Colour is applied at the call site
(`.copyWith(color: AppColors.onDark)`), because the same role appears on both surfaces. Text
scaling is clamped to 0.85–1.25× app-wide (`main.dart`) so hero amounts can't overflow.

Formatting helpers live in `lib/core/utils/formatters.dart` (`formatCurrency`,
`formatPeriodRange`, date and time labels). Use them rather than building amount strings by hand.

## 4. Spacing, radius, elevation

- **Spacing - `AppSpacing`:** `xs 4 · sm 8 · smd 12 · md 16 · gutter 22 · lg 26 · xl 32`. The screen
  side gutter is always `gutter` (22). Tab bodies end with `navClearance` (108) of bottom padding
  so content clears the floating nav.
- **Radius - `AppRadius`:** `chip 8 · field 12 · card 18 · sheet 28` (top corners only) `· pill 100`
  (buttons, badges, avatars, nav, toggles, segmented controls).
- **Elevation - `AppShadows`:** `flat`, `card`, `sheetLight`, `floatingNav`. **Dark surfaces never
  use shadows** - they use `hairlineDark` borders. Light surfaces use the soft `card` shadow.

## 5. Components - `lib/shared/widgets/`

| Component | What it is | Notes |
|---|---|---|
| `PrimaryPillButton` / `SecondaryPillButton` | Filled accent pill / outline pill | `loading:` shows a spinner and blocks taps; `expand:` for full width |
| `FloatingBottomNav` | The 3-tab pill nav (Overview · Signals · Activity) | Exactly three tabs. Profile is reached from the avatar, never a tab |
| `PeriodPill` | Header period selector (dot + label + caret) | Opens the period switcher sheet |
| `SignalCard` | Typed insight card (WATCH / GOOD / CONTEXT) | Shared by the Overview preview and the Signals list |
| `CategoryBarRow` | Ranked category row with a bar relative to the largest category | Spending views pass `StatementAnalytics.spendingBreakdown` (Income excluded) |
| `MiraveltListRow` | Avatar + two lines + trailing amount + optional badge | Merchant, transaction and subscription rows |
| `AvatarChip` / `UserAvatar` | Initials avatar / the user's bundled illustration | `UserAvatar` picks one of `assets/avatars/` from a hash of the user id |
| `DeltaChip`, `MicroBadge` | Tinted pill with a direction glyph / uppercase tag (`UNUSUAL`, `WATCH`) | |
| `StatTile` | Micro label + Space Grotesk value | Put rows of tiles in `IntrinsicHeight` so wrapped labels don't make them uneven |
| `SectionHeader` | Tracked micro label + optional trailing action | |
| `ToggleRow` | Settings row with the 38×22 pill switch | Every toggle must change real behaviour - no decorative switches |
| `ProgressRing`, `SweepProgressBar`, `PulsingDot` | Job progress ring, upload bar with shine, live "analysing" dot | |
| `MiniBarChart`, `RegularityStrip` | Monthly bars with one highlighted month; 7-segment recurring rhythm strip | |
| `SkeletonBox` | Shimmer placeholder | Use for loading states instead of spinners inside content |
| `EmptyState`, `ErrorRetry` | No-data state; error with a Retry action | A screen whose main load fails renders `ErrorRetry` so it is recoverable without restarting the app; optional sections may hide themselves instead |
| `ScreenBackHeader` | Back chevron + title row for secondary screens | |
| `BottomSheetScaffold` | Modal sheet shell: 28px top radius, drag handle, scrim | |
| `MiraveltSegmentedControl` | Pill segmented control (Theme, API server) | Defined in `toggle_row.dart` |

## 6. Screens and surfaces

| Screen | Surface |
|---|---|
| Splash, Login, Register, Onboarding, Analysing, Profile ("You"), Manage periods, Signals, Developer settings | Ink |
| Overview | Ink header, paper body |
| Category drill-down, Recurring | Ink header, paper body |
| Activity, Transaction sheet, Rejected file, Spending patterns, Legal | Paper |

Every screen draws its own header. Material `AppBar` is not used.

## 7. Motion

From the design spec, implemented with `flutter_animate` and custom painters: signal cards rise 6px
and fade in (240ms, 60ms stagger), bars grow from the baseline (420ms), a period switch
cross-fades numbers with no page slide, and skeletons shimmer on a 1.4s loop. Android page
transitions use `FadeForwardsPageTransitionsBuilder`. Material ink splashes are off app-wide
(`NoSplash`).

## 8. Accessibility

- Body text meets 4.5:1 contrast on its surface. Use the `onDark*` / `onLight*` pair that matches
  the surface; never put `onLight*` text on ink.
- Tap targets are at least 44px (the avatar button wraps a 34px chip in a 44px hit area).
- Category hues are never the only identifier - the name and amount are always shown next to them.
- Icons that act as buttons carry a `tooltip` or `Semantics(label:)` (e.g. "Open profile",
  "Show password").

## 9. Known gaps

- **The Theme setting (Light / Dark / Auto) has almost no visible effect.** Screens pick
  `AppColors` ink/paper tokens directly (roughly 440 references versus 2 `Theme.of` lookups), and
  the design defines no dark variant of the paper surfaces. Making the setting real needs a design
  decision first - a dark palette for the reading surfaces - and then moving screens onto
  theme-aware tokens.
- **Micro labels use Instrument Sans, not IBM Plex Mono** as `DESIGN_SPEC.md` §2.2 specifies.
- **Haptics** from the spec (period switch tick, analysis-complete thud) are not implemented.
