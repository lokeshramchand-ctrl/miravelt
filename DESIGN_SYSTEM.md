# Design System

How the Miravelt mobile app (`frontend/`) looks, and the rules that keep it consistent. This file
describes the system **as implemented in code**; `frontend/docs/DESIGN_SPEC.md` is the
screen-by-screen spec it was built from (source: the Claude Design project for "Miravelt Mobile App
v2"). When the two disagree, the code is what ships and the difference is listed in
[§9 Known gaps](#9-known-gaps).

All tokens live in `frontend/src/theme/`. Shared components live in
`frontend/src/components/`. Never hard-code a colour, radius, or text style in a screen when a
token exists - add a token instead.

## 1. Principles

- **Soft glass on a cool wash.** Every screen sits on one backdrop (`Backdrop`): a pale gray
  gradient that turns light blue toward the bottom. Content lives on frosted glass cards
  (translucent white, bright hairline edge, radius 26). Things that float over content (sheets,
  dialogs, toasts) use the opaque `solid` surface.
- **Black is the accent.** The near-black `ink` marks what is selected or primary: the Overview arc
  pill, the selected tab, primary buttons, the headline card. There is no brand hue.
- **Light figures, quiet type.** One family, Inter. Big amounts are 300 weight with slight
  negative tracking; titles are 400; labels 500. Eyebrows are sentence case, not tracked caps.
  Every number uses tabular figures. Currency is `₹` with Indian grouping and a true minus sign.
- **Status only in pastel badges.** Lime (`upSoft`) for better, pink (`downSoft`) for worse,
  amber (`warnSoft`) for watch, always with dark ink text and a sign or glyph, never colour alone.
- **Grounded, not decorative.** Every figure maps to a backend field (see `DESIGN_SPEC.md` §6).
- **No logo inside the app.** The logo mark lives on the launcher icon only; splash and onboarding
  use the "Miravelt" wordmark.
- **Interaction from the SPL Console kit.** Sliding pill indicators, spring presses, tick meters,
  a tappable split meter and spark bars are ported from the bencho.dev-style web dashboard.

## 2. Colour - `colors` (`src/theme/colors.ts`)

`colors` is one object. `applyColorScheme('light' | 'dark')` swaps its values in place; the root
layout calls it from the Theme setting (Light / Dark / Auto) and keys the navigator on the scheme
so every mounted screen repaints. **Read tokens at render time** (inline styles), never inside
`StyleSheet.create`, or a theme switch will miss them.

| Token | Use |
|---|---|
| `bg` | Flat fallback under the backdrop gradient (`backdrop.light` / `backdrop.dark`) |
| `surface`, `surface2` | Glass card fill, recessed glass (segmented-control tracks, pressed rows) |
| `surface3` | Faint ink wash: unlit ticks, inactive bars, switch-off track |
| `border`, `border2` | Bright glass edge; darker hairline for outlined pills and inputs |
| `solid` | Opaque surface for sheets, dialogs, toasts |
| `text` / `muted` / `faint` | Primary / secondary / tertiary text |
| `ink` / `onInk` | The black accent fill and the text on it (they flip in dark mode) |
| `signal`, `signalSoft`, `signalText` | Links, focus rings, active states (ink-coloured in this skin) |
| `up` / `warn` / `down` | Status text directly on glass |
| `upSoft`+`upInk`, `warnSoft`+`warnInk`, `downSoft`+`downInk` | Pastel badge fill + its dark text |
| `hero*` | The fixed dark accent shapes (arc pill, Signals headline), same in both themes |

**Category colours** come only from `categoryColor(name)` (pastel `hues`) and **category glyphs**
only from `categoryIcon(name)` (Phosphor fill). Unknown categories get `hues.rose` and `cat-other`.

## 3. Typography - `typography`

Inter 300/400/500/600/700 via `@expo-google-fonts/inter`. Style names still carry their original
size (`heroAmount44`, `body14`...), so call sites read the same. `num()` styles (amounts) are 300
weight from 19px up and 500 below; `pageTitle` (27px, 400) is the screen heading ("Your latest
insights", "Signals", "Activity"); `cardTitle` (16px, 400) heads cards and sections. Text scaling
is capped at 1.25x app-wide (`src/lib/textScaling.ts`).

## 4. Spacing, radius, elevation

- **Spacing:** `xs 4 · sm 8 · smd 12 · md 16 · gutter 20 · lg 26 · xl 32`; tab bodies end with
  `navClearance` (112) so content clears the floating nav.
- **Radius:** `chip 12 · field 16 · card 26 · sheet 30 · pill 999`. Icon buttons, avatars and arc
  circles are full circles.
- **Elevation:** `shadows.lift()` (soft, wide, cool-tinted, on glass cards) and `shadows.liftHi()`
  (nav, sheets, dialogs, toasts). They are functions so they follow the theme.

## 5. Components - `src/components/`

| Component | What it is |
|---|---|
| `Backdrop` | The gradient wash behind every screen (used by `Screen`) |
| `CategoryArc` | Overview's signature control: categories on an arc. The selected one rides in a thick ink pill (glyph + share of spend along the curve); the next four sit in white circles round the rim, then a `+` (add a statement). Tap a circle to bring it into the pill; tap the pill to open that category |
| `Card`, `Divider` | Frosted glass card; hairline divider |
| `Stat` | Glass stat card: title + ↗, optional spark, faint context line, light value + pastel badge |
| `StatTile` | Small stat card for rows of three (Profile) |
| `SignalCard` | Insight card: ink icon disc, title, status badge (Watch pings), body, optional CTA |
| `CategoryBarRow` | Category row: colour dot, name, amount, tick meter, share, trend caption |
| `MiraveltListRow` | Row with a round category-glyph chip (or initial), two lines, trailing amount |
| `DeltaChip`, `MicroBadge` | Pastel trend pill / badge (`tone`: up, down, warn, signal, neutral); `ping` adds a live dot |
| `SectionHeader`, `Eyebrow` | Sentence-case section title with sub line and trailing action |
| `EmptyState`, `ErrorRetry` | Icon chip + title + hint/CTA; error with Retry |
| `PrimaryPillButton` / `SecondaryPillButton` / `IconButton` / `TextActionLink` | Ink pill / outlined glass pill / round glass icon button / text link; all spring on press (`PressableScale`) |
| `FloatingBottomNav` | Frosted pill nav, ink indicator slides between the three tabs |
| `SegmentedControl` | Pill tabs with a sliding raised indicator and optional count badges (Signals filter, Activity In/Out, Theme) |
| `PeriodPill`, `ScreenBackHeader`, `ToggleRow`, `RowIcon` | Header period selector, round back button, settings rows with icon chips |
| `Ticks`, `ContextMeter`, `Gauge`, `SparkBars`, `SparkLine`, `MiniBarChart` (`Charts.tsx`) | Tick meter; split-by-part meter (tap a tick to isolate a category); 270° gauge; spark glyphs; tappable monthly columns |
| `ProgressRing`, `SweepProgressBar`, `PulsingDot` | Analysis progress ring, flat easing progress bar, ping dot |
| `MiraveltSheet` | Bottom sheet with optional eyebrow/title/sub head and close button, spring rise |
| `Dialog`, `PromptDialog` | Spring pop-in dialog with pill actions (last one primary) |
| `Toast` | Floating card with a status bar on its left edge |
| `TextField` | Glass input, signal border + soft focus ring, inline error with icon |
| `Icon`, `IconChip` | Phosphor glyphs inlined in `iconPaths.ts` (regular; `cat-*` keys use fill) |

### Delight kit - `components/Delight.tsx` and `lib/haptics.ts`

| Piece | What it does |
|---|---|
| `haptics` | One vocabulary: `select` (moving a selection: tabs, chips, arc, chart bars, ticks), `tap` (buttons), `toggle`, `success`/`warning`/`error`. No-op on web |
| `AnimatedNumber` | Counts from the previous value to the new one (Overview total, Net flow, Payments) |
| `Toggle` | The switch in every settings row: knob springs across and stretches while held |
| `useShake` | Horizontal "that's not right" shake + error haptic (sign in / register validation, locked lesson steps) |
| `Confetti` | Paper burst for wins: tour finished, all lesson steps done, analysis complete |
| `Button3D` | Duolingo-style chunky button: face on a darker lip that it presses into (`go` lime, `ink`, `ghost`) |
| `Mascot`, `SpeechBubble` | Miro the octopus (`assets/avatars/baby-octopus.png`): bobs, hops on tap; the bubble types its text out |
| `ChunkyProgress`, `StepTransition`, `PopIn` | Thick progress bar with a highlight stripe; step slide-in; overshoot pop for staggered items |

### Live states - `components/Live.tsx`

From beautifului.dev's agent kit, rebuilt on `Animated`; all static under the OS reduce-motion
setting (`useReducedMotion`). `DotWave` (three rising dots), `ThinkingIndicator` (dot wave +
breathing label + elapsed time; the deeper-explanation request), `StreamedText` (reveals
already-received text word by word with a caret; an invisible copy reserves the final height and
screen readers get the full text), `useElapsed` (Analysing header). Analysing stage rows are task
rows: the check pops in, the active stage carries a dot wave. `Toast` rises with a spring, scales
up from .94 and fades in, and animates out (transitions.dev's toast) instead of vanishing.

Other micro-interactions: `PressableScale` takes `haptic`; nav tab icons squash-and-pop when
selected; the arc pill's glyph spins in on a new pick; sheets drag down to dismiss (follows the
finger, resists upward, springs back unless pulled 110px or flicked); Overview's top bar stays
put and turns opaque with a hairline once content scrolls under it, while the page title drifts
and fades; the greeting follows the time of day.

## 6. Screens

All screens share the backdrop and glass cards; there are no longer separate ink and paper
screens. Overview: top bar (period pill, add, settings, avatar), "Your latest insights" with the
`CategoryArc` around total spend, then Net flow / Received / Payments stat cards, reconciliation,
signals preview and the "Where it went" split meter.

**Onboarding.** Signed out on a first launch (`settings.introSeen` false), the redirect sends
people to `/welcome`: a hello screen, then five steps (goals, how it works, privacy promise,
alerts, done) with Miro, the chunky progress bar and 3D buttons. Goals are saved
(`settings.goals`) and personalise the first-statement screen; picking "Spot unusual spending"
switches that alert on; the alert toggles are the real Profile settings. Finishing or "I already
have an account" sets `introSeen`. Signed in with no periods, `/onboarding` is a lesson path:
three steps on a winding trail (later ones locked until the current one is ticked off), a
bouncing START flag, a step card per node, and a trophy that opens the upload.

## 7. Motion

Built on `Animated` (`components/motion.tsx`): `PressableScale` sinks to .9-.98 and springs back
(`motion.spring`); indicators spring between options; cards fade and rise 6-10px; ticks light up in
sequence (14ms stagger); bars grow from the baseline; arc circles spring in one after another;
skeletons pulse in opacity. The native driver is used everywhere except web.

## 8. Accessibility

- Body text uses `text` / `muted` on glass; badge text uses the matching `*Ink` token on its
  pastel fill. Never put `onInk` text anywhere but an `ink` fill.
- Tap targets are at least 42px (icon buttons, arc circles, avatar).
- Category hues are never the only identifier - the name and amount are always shown next to them.
- Icons that act as buttons carry a `tooltip` or `Semantics(label:)` (e.g. "Open profile",
  "Show password").

## 9. Known gaps

- **Glass blur is web-only.** `backdropFilter` works in the web build; on device the cards are
  translucent without blur (adding `expo-blur` would close the gap).
- **`DESIGN_SPEC.md` describes the previous ink/paper design** (Space Grotesk + Instrument Sans,
  luminous green accent). This file and the code are the current source of truth.
- **Haptics** are implemented (`lib/haptics.ts`, `expo-haptics`); there are no sounds.
