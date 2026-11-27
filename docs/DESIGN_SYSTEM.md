# Design System

**Foundation:** Apple Human Interface Guidelines principles (clarity, deference, depth; type
scale; materials; 4-pt spacing; spring-like motion), applied to a **dark-first**, premium SaaS
product with a Stripe/Linear level of restraint (A3). Bilingual Arabic/English with full RTL
(A4). Product: **Pro Coders** (H1). Since the P3 design pass, reviews use the vendored
`apple-design` skill (`.claude/skills/apple-design`, Apple's HIG pages + review lenses) — HIG
principles adapted to a **web** dashboard: navigation and controls stay familiar web patterns;
identity lives in color, type, the mark and one signature moment (§13–§15).

Tokens are implemented in [`apps/dashboard/src/styles/tokens.css`](../apps/dashboard/src/styles/tokens.css)
(Tailwind v4 `@theme`, shadcn-compatible variable names). The widget consumes a subset.
Brand name comes from `packages/shared/src/brand.ts` — never hardcode it.

## 1. Principles

1. **Content first, chrome recedes.** Surfaces are quiet near-black blues; color is reserved
   for action, status and data.
2. **Depth through materials, not decoration.** Translucent layers + subtle borders + soft
   shadows convey hierarchy; no gradients on text, no heavy drop shadows.
3. **One accent, used with intent.** Royal Blue = primary action and selection. Electric blue =
   focus, live/realtime signals, and data highlights. Never both on one control.
4. **Truthful UI.** States reflect real data (connection status, billing, usage). No fake
   "connected", no placeholder metrics on production screens — empty states explain what to do.
5. **Direction-agnostic by construction.** Logical properties everywhere; the RTL layout is a
   first-class design, not a mirror afterthought.
6. **Calm motion.** Motion explains change of state or place; it never delays the user.

## 2. Color

### 2.1 Brand scales

| Token   | Royal Blue (primary) | Electric (accent) |
| ------- | -------------------- | ----------------- |
| 50      | `#EEF2FF`            | `#E6F7FF`         |
| 100     | `#E0E7FF`            | `#C7EDFF`         |
| 200     | `#C2D1FF`            | `#94DDFF`         |
| 300     | `#93AEFF`            | `#5CCBFF`         |
| 400     | `#6688FF`            | `#2EBBFF`         |
| **500** | **`#3D63F0`**        | **`#00A8FF`**     |
| 600     | `#2747D1`            | `#0089D6`         |
| 700     | `#1E3AA8`            | `#006BA8`         |
| 800     | `#16297A`            | `#004F7D`         |
| 900     | `#0F1C4D`            | `#003453`         |
| 950     | `#0A1233`            | `#00213A`         |

### 2.2 Semantic tokens (dark = default, light = `data-theme="light"`)

| Role                     | Dark                      | Light                  | Use                                                   |
| ------------------------ | ------------------------- | ---------------------- | ----------------------------------------------------- |
| `background`             | `#07090F`                 | `#F6F8FC`              | app canvas                                            |
| `surface-1`              | `#0C1018`                 | `#FFFFFF`              | cards, panels                                         |
| `surface-2`              | `#111723`                 | `#F1F4FA`              | nested panels, table header, inputs                   |
| `surface-3`              | `#171E2C`                 | `#E8EDF6`              | hover, selected rows                                  |
| `elevated`               | `#1C2434`                 | `#FFFFFF`              | popovers, menus, dialogs (with material)              |
| `border`                 | `rgb(148 170 255 / 0.10)` | `rgb(15 28 77 / 0.10)` | hairlines                                             |
| `border-strong`          | `rgb(148 170 255 / 0.18)` | `rgb(15 28 77 / 0.18)` | inputs, dividers that must read                       |
| `text-primary`           | `#F2F5FC`                 | `#0B1020`              | body, titles                                          |
| `text-secondary`         | `#A6B0C6`                 | `#4A5470`              | supporting text                                       |
| `text-tertiary`          | `#808BA6`                 | `#5F6984`              | metadata, placeholders (≥ 4.5:1 on every surface, P3) |
| `text-disabled`          | `#4A5368`                 | `#A3ABBF`              | disabled                                              |
| `primary` / `primary-fg` | `#3D63F0` / `#FFFFFF`     | `#2747D1` / `#FFFFFF`  | primary buttons, selection                            |
| `accent`                 | `#00A8FF`                 | `#0089D6`              | focus ring, live indicators, chart highlight          |
| `success`                | `#2FD27F`                 | `#0E7540`              | connected, paid                                       |
| `warning`                | `#F5B544`                 | `#8F5600`              | pending, 80 % usage                                   |
| `danger`                 | `#FF5C6C`                 | `#C62B3B`              | error, failed payment, 100 % hard stop                |
| `info`                   | `#5CCBFF`                 | `#006BA8`              | in-progress                                           |

Contrast: `primary-fg` on `primary` ≈ 4.9:1 (AA). Every text/background pair must meet WCAG 2.2
AA (4.5:1 body, 3:1 large text and UI glyphs). **P3:** `apps/dashboard/src/test/contrast.test.ts`
checks every text/status token on every surface in both themes (CI). It caught four failures,
fixed by darkening/lightening the smallest step: dark `text-tertiary` `#7A85A0 → #808BA6`
(4.21:1 on `elevated`), light `text-tertiary` `#6B7590 → #5F6984`, light `success`
`#138A4B → #0E7540`, light `warning` `#B26B00 → #8F5600` (all were < 4.5:1 on `surface-3`).

### 2.2a Brand expression, depth and Increase Contrast (P3 design pass)

| Token                          | Dark                                              | Light             | Use (and only this)                                    |
| ------------------------------ | ------------------------------------------------- | ----------------- | ------------------------------------------------------ |
| `brand-gradient`               | `135° #5A7BFF → #3D63F0 → #2EBBFF`                | same              | logo, the signature scene, plan-card borders           |
| `glow-primary` / `glow-accent` | 1 px ring + soft 40 px bloom (Royal / Electric)   | lighter bloom     | glow borders on plan/KPI/preview cards, focus-adjacent |
| `aurora-1` / `aurora-2`        | Royal 18 % / Electric 10 % radial light           | 10 % / 8 %        | `.bg-aurora` behind auth, onboarding, empty states     |
| `card-highlight`, `card-sheen` | 1 px top inset (white 5 %) + top-lit fill (2.5 %) | white 90 % / 60 % | `.surface-card` — every content card                   |

Brand color stays off controls except primary actions and status (HIG branding › "Apply your
app's accent color judiciously"). **Increase Contrast** (`prefers-contrast: more`): borders
0.10 → 0.30 alpha, `text-secondary` `#A6B0C6 → #C9D1E3`, `text-tertiary` → `#AAB3C8` (light:
`#2C3450` / `#3D4662`), materials opaque, glows become 2 px solid rings, aurora and sheen off.
`forced-colors: active` drops decorative fills and keeps real borders.

### 2.3 Data visualization

Categorical (dark): `#3D63F0`, `#00A8FF`, `#8B7BFF`, `#2FD27F`, `#F5B544`, `#FF7AA8`.
Sequential: Royal Blue 900 → 300. Charts mirror their x-axis in RTL only for time series where
Arabic readers expect right-to-left time (decision deferred to P16 user testing; default:
**keep time axes LTR** as most Arabic business dashboards do — needs validation with users).

## 3. Typography

### 3.1 Families

| Script | Primary                                                     | Fallbacks                                                                 |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| Latin  | `"SF Pro Text"`, `"SF Pro Display"` (Apple devices, system) | `Inter` (self-hosted, variable), `system-ui`, `sans-serif`                |
| Arabic | `"SF Arabic"` (Apple devices, system)                       | `"IBM Plex Sans Arabic"` (self-hosted), `"Noto Sans Arabic"`, `system-ui` |
| Mono   | `"SF Mono"`                                                 | `"JetBrains Mono"`, `ui-monospace`                                        |

SF fonts are used only when installed on the device (system fonts); they are not bundled
(license). Fonts are self-hosted, subset, `font-display: swap`. **Inter ships with its optical-size
axis** (`@fontsource-variable/inter/opsz.css`, +25 kB Latin): titles get the Display cut
automatically, like SF's dynamic optical sizes (HIG typography). IBM Plex Sans Arabic ships
400/500/600/700; Arabic `h1`/`h2` use 700. The wordmark is always Inter (Latin LTR island). Numbers use `tabular-nums`
in tables, usage meters and prices.

### 3.2 Scale (dashboard, desktop-first)

| Token         | Size / line (LTR) | Size / line AR | Weight       | Tracking (Latin; Inter dynamic metrics) |
| ------------- | ----------------- | -------------- | ------------ | --------------------------------------- |
| `display`     | 40 / 48           | 42 / 60        | 600 (AR 700) | −0.022em                                |
| `large-title` | 32 / 40           | 34 / 50        | 600 (AR 700) | −0.022em                                |
| `title-1`     | 26 / 32           | 28 / 42        | 600 (AR 700) | −0.020em                                |
| `title-2`     | 22 / 28           | 24 / 36        | 600          | −0.018em                                |
| `title-3`     | 18 / 24           | 20 / 32        | 600          | −0.014em                                |
| `headline`    | 15 / 20           | 16 / 26        | 600          | −0.009em                                |
| `body`        | 15 / 22           | 16 / 27        | 400          | −0.009em                                |
| `callout`     | 14 / 20           | 15 / 25        | 400          | −0.006em                                |
| `subheadline` | 13 / 18           | 14 / 23        | 400          | −0.003em                                |
| `footnote`    | 12 / 16           | 13 / 21        | 400          | 0                                       |
| `caption`     | 11 / 14           | 12 / 19        | 500          | +0.005em                                |

Tracking = `−0.0223 + 0.185·e^(−0.1745·px)` em (Inter's dynamic metrics; same idea as Apple's
tracking table: tighter as size grows). **Arabic sizes are 1 px larger up to 15 px and 2 px
larger for titles** (review finding: Arabic glyphs read smaller than Latin at the same px; HIG
right-to-left › "Visually balance adjacent Latin and RTL scripts").

Rules: Arabic gets ~60–70 % line-height (diacritics, ascenders), **no letter-spacing,
no uppercase transforms, no italics** (use weight or color for emphasis). Minimum Arabic size
12 px (caption), 13 px for running text. Counters, meters and prices use `tabular-nums`. Mobile scale: body 16/24 (prevents iOS zoom on inputs).

## 4. Spacing, layout, radii

- **4-pt grid:** `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`.
- **Shell:** sidebar 264 px (collapsed 72 px) on the _start_ side; top bar 56 px; content max
  width 1280 px, gutters 24 px (desktop) / 16 px (mobile). 12-column grid, 24 px gaps.
- **Breakpoints:** `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`. Inbox is 3-pane at
  `xl` (list · thread · customer panel), 2-pane at `lg`, stacked below.
- **Radii (continuous-corner feel):** `xs 6`, `sm 8`, `md 12` (inputs, buttons), `lg 16`
  (cards), `xl 20` (dialogs, sheets), `2xl 28` (marketing/hero), `full` (pills, avatars).
- **Hit targets:** ≥ 36 px desktop, ≥ 44 px touch (top bar and sheet controls are 44 px below
  `md`; standalone text links ≥ 24 px tall).
- **Page rhythm (P3 design pass):** page gutters 16 (mobile) / 24 (tablet) / 40 px (desktop);
  settings sections 32 px apart; auth form column 400 px anchored at a fixed top offset so
  headings never jump between steps.

## 5. Materials & elevation (HIG-inspired)

| Material     | Fill (dark)            | Blur  | Use                                     |
| ------------ | ---------------------- | ----- | --------------------------------------- |
| `ultra-thin` | `rgb(12 16 24 / 0.40)` | 12 px | overlays on media                       |
| `thin`       | `rgb(12 16 24 / 0.55)` | 20 px | sticky table headers, top bar on scroll |
| `regular`    | `rgb(17 23 35 / 0.72)` | 30 px | popovers, menus, command palette        |
| `thick`      | `rgb(23 30 44 / 0.86)` | 40 px | dialogs, sheets                         |
| `chrome`     | `rgb(7 9 15 / 0.80)`   | 24 px | sidebar on mobile, widget header        |

All materials: `backdrop-filter: blur() saturate(160%)`, 1 px `border` token, and a top inner
highlight `inset 0 1px 0 rgb(255 255 255 / 0.04)`. `@supports not (backdrop-filter)` → solid
`elevated`. Respect `prefers-reduced-transparency` (solid fills).

**Layers (HIG materials, `liquid-glass.md`):** translucent materials belong only to the
functional layer — top bar, sidebar on mobile, menus, popovers, dialogs, command palette.
Content cards are opaque `.surface-card` (sheen + 1 px highlight), never glass.

Elevation (shadows, dark): `e1 0 1px 2px rgb(0 0 0 / .4)`, `e2 0 4px 12px rgb(0 0 0 / .35)`,
`e3 0 12px 32px rgb(0 0 0 / .45)`, `glow 0 0 0 1px rgb(61 99 240 / .5), 0 8px 24px rgb(61 99 240 / .25)`
(primary focus/selection only).

## 6. Motion

| Token        | Duration | Easing                              | Use                                                    |
| ------------ | -------- | ----------------------------------- | ------------------------------------------------------ |
| `micro`      | 120 ms   | `cubic-bezier(0.2, 0, 0, 1)`        | hover, press, toggle                                   |
| `standard`   | 200 ms   | `cubic-bezier(0.2, 0, 0, 1)`        | popovers, tabs, row expand                             |
| `emphasized` | 320 ms   | `cubic-bezier(0.05, 0.7, 0.1, 1)`   | dialogs, sheets, page transitions                      |
| `spring`     | 450 ms   | `cubic-bezier(0.34, 1.36, 0.64, 1)` | success confirmations, new-message arrival (sparingly) |

Rules: enter = decelerate, exit = accelerate and ~70 % of the enter duration; slide directions
use logical start/end so they mirror in RTL; `prefers-reduced-motion` → opacity-only, ≤ 120 ms.
Realtime arrivals (new message, status change to _Connected_) get a short highlight pulse in
`accent`, never a toast storm.

## 7. Iconography

`lucide-react`, 1.5 px stroke, sizes 16 / 20 / 24, `currentColor`. **Mirror in RTL:** arrows,
chevrons, back/forward, send, reply, undo/redo, list indent, progress direction. **Never
mirror:** checkmarks, search, play/media, clocks, brand/channel logos (WhatsApp, Messenger,
Instagram — use official marks per their brand guidelines; **needs verification** of usage
rules), numbers, charts' value axis.

## 8. Status language (shared across product)

| Domain       | Status                | Badge color | Copy (en / ar)                                              |
| ------------ | --------------------- | ----------- | ----------------------------------------------------------- |
| Channel      | not_connected         | neutral     | Not connected / غير متصل                                    |
|              | pending               | warning     | Pending review / قيد المراجعة                               |
|              | connected             | success     | Connected / متصل                                            |
|              | error                 | danger      | Needs attention / يحتاج إلى تدخل                            |
|              | disabled              | neutral     | Disabled / معطّل                                             |
| Request      | in_progress           | info        | Connecting… / جارٍ الربط                                     |
|              | rejected              | danger      | Couldn't connect / تعذّر الربط                               |
| Subscription | trialing              | info        | Trial · N days left / تجربة · متبقٍ N أيام                   |
|              | active                | success     | Active / نشط                                                |
|              | past_due              | warning     | Payment failed / فشل الدفع                                  |
|              | grace                 | warning     | Grace · N days left / فترة سماح · متبقٍ N أيام               |
|              | read_only (workspace) | danger      | Read-only — upgrade to continue / للقراءة فقط — قم بالترقية |
| Usage        | < 80 %                | primary     | —                                                           |
|              | ≥ 80 %                | warning     | 80 % used / تم استخدام ٨٠٪                                  |
|              | 100 %                 | danger      | Limit reached / تم بلوغ الحد                                |

Badges: pill, `caption` text, 6 px dot + label; color is never the only signal (label always shown).
Arabic copy is a starting point for a native copywriter review.

## 9. Components (shadcn/ui primitives, restyled)

| Group      | Components                                                                                                                                                                              | Notes                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Actions    | Button (primary, secondary, ghost, destructive, link; sm/md/lg; icon), IconButton, SplitButton                                                                                          | primary = Royal Blue fill; focus ring 2 px `accent` + 2 px offset |
| Inputs     | Input, Textarea (auto-grow), Select, Combobox, Checkbox, Radio, Switch, Slider, PhoneInput (E.164, LTR inside RTL), MoneyInput (minor units), TimeRangePicker (opening hours), FileDrop | labels above, helper below, errors inline in both languages       |
| Navigation | Sidebar, TopBar, Tabs, Breadcrumbs, CommandPalette (⌘K / Ctrl K), Pagination (cursor)                                                                                                   | sidebar on start side                                             |
| Data       | Table (sticky header, virtualized), DataList, StatCard, UsageMeter, Sparkline, Chart wrappers, Timeline (request history)                                                               | numbers `tabular-nums`                                            |
| Feedback   | Badge, StatusPill, Toast, InlineAlert, Banner (trial/usage/read-only), Skeleton, EmptyState, ProgressSteps                                                                              | no spinners > 300 ms without skeleton                             |
| Overlays   | Dialog, Sheet (side = end), Popover, Tooltip, DropdownMenu, ContextMenu                                                                                                                 | materials `regular`/`thick`                                       |
| Messaging  | ConversationList item, MessageBubble (customer / AI / agent / system), Composer, TypingIndicator, HandoffBar, ChannelIcon                                                               | bubbles use `dir="auto"`; AI messages labeled "AI"                |
| Connect    | ChannelCard, ConnectionRequestForm, InstallSnippet (copy), OriginListEditor, WidgetPreview                                                                                              | real statuses only                                                |
| Billing    | PlanCard, PriceToggle (monthly/annual "2 months free"), UsageMeter, TransactionTable, UpgradePrompt                                                                                     |                                                                   |

## 10. RTL / bilingual rules

1. Set `<html lang dir>` from the user's locale; switching language re-renders without reload.
2. Use **logical** utilities only: `ms-/me-`, `ps-/pe-`, `start-/end-`, `text-start/end`,
   `border-s/e`, `rounded-s/e`. ESLint rule `local/logical-css` (`eslint-rules/logical-css.js`,
   P3) forbids `ml-/mr-/pl-/pr-/left-/right-/text-left…` in app class strings; deliberate
   `ltr:`/`rtl:` variants are allowed.
3. User-generated content (messages, names, KB text) renders with `dir="auto"` and `<bdi>` for
   inline names/numbers inside sentences.
4. Always-LTR islands: phone numbers, emails, URLs, code/snippets, IDs, prices with currency
   codes (`<span dir="ltr">`).
5. Numerals: `profiles.numeral_style` = `latin` (default) or `arabic_indic`; formatting via
   `Intl.NumberFormat('ar-u-nu-arab' | 'ar-u-nu-latn')`. Dates via `Intl.DateTimeFormat` with
   workspace time zone; Gregorian default, Hijri display optional later.
6. Mixed-direction layouts are tested with snapshots in both directions (TESTING §4).
7. Icons per §7; animations per §6 use logical directions.

## 11. Accessibility

WCAG 2.2 AA: contrast (§2), visible focus on every interactive element, full keyboard support
(inbox shortcuts: `J/K` next/prev, `R` reply, `E` close — shown in a shortcut sheet), roles and
labels on all shadcn/Radix primitives, live regions for new messages (polite) and errors
(assertive), reduced motion/transparency respected, forms with programmatic error association,
target sizes per §4. Automated axe checks in Playwright from P3.

## 12. Widget subset

Tokens exposed to customers: accent color (validated for 4.5:1 against its text color; the
widget auto-picks white/black text), mode (auto/dark/light), radius (`md`/`lg`/`xl`), launcher
icon, position (`start`/`end`), greeting and launcher label (ar/en). Everything else is fixed
for quality. "Powered by" footer unless `widget_remove_branding`.

## 13. Brand — Pro Coders (decision H1)

- **Mark:** a speech bubble holding a code prompt (`›_`) on a rounded tile lit Royal → Electric
  (`#5A7BFF → #3D63F0 → #1E3AA8` + an Electric `#2EBBFF` corner light): conversations, built by
  coders. One-colour version (`currentColor`, prompt knocked out) for single-ink use.
- **Wordmark:** "Pro Coders", Inter Display 620, −0.022em. Latin in every locale (logos are not
  translated); the lockup (mark + wordmark) is an **LTR island** and never mirrors in RTL.
- **Files:** `docs/brand/pro-coders-mark.svg`, `-mark-mono.svg`, `-wordmark.svg` (outlined),
  `-lockup-on-dark.svg`, `-lockup-on-light.svg`; favicon `apps/dashboard/public/favicon.svg`;
  in-app `components/brand-mark.tsx` (`BrandGlyph`, `BrandMark`). Regenerate with
  `python3 scripts/brand/build-wordmark.py` (fontTools; Inter is OFL-1.1).
- **Usage:** min 16 px mark, clear space = ¼ of the mark; never recolour, stretch, rotate,
  add effects to, or animate the mark. One logo per screen (HIG branding › "Resist the
  temptation to display your logo throughout your app").

## 14. Signature and effects (H2–H4)

**Signature:** _every conversation lands in one place_ — channel nodes (WhatsApp, Instagram,
Messenger, Website) send light along beams into a glass assistant core, then a bilingual
exchange appears once. Full on the auth brand panel (WebGL core on desktop), small on
onboarding, a static echo in empty states. Everything else stays quiet.

Effects live in `apps/dashboard/src/components/effects/`, rebuilt with **Motion + Tailwind**
(the 21st.dev registry requires a signed-in account/API key — H3):

| Effect             | Where                                         | How                                                                                                    |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `AnimatedGradient` | auth panel, onboarding, empty-state backdrops | slow CSS drift of two radial lights (`transform` only)                                                 |
| `GlowBorder`       | plan/upgrade card, onboarding preview card    | masked conic gradient ring; rotation off under reduced motion                                          |
| `SpotlightCard`    | KPI cards, plan cards                         | pointer-follow radial highlight via CSS variables (no renders)                                         |
| `TiltCard`         | onboarding workspace preview                  | ≤ 8° 3D tilt from pointer; horizontal sign flips in RTL                                                |
| `FloatingShapes`   | empty states, 404                             | CSS 3D glass shapes, slow float; static under reduced motion                                           |
| `AnimatedBeam`     | auth panel (channels → core)                  | SVG path + travelling gradient; flows toward the core                                                  |
| `ShimmerButton`    | upgrade / plan CTA only                       | one sheen sweep in reading direction; none when reduced                                                |
| `NumberTicker`     | KPI / usage values                            | spring count-up, `Intl` per locale + numeral style, `tabular-nums`; screen readers get the final value |
| `BrandScene3D`     | desktop auth panel only                       | react-three-fiber glass core, lazy chunk, static poster first                                          |

**Never in:** tables, the inbox, forms, dialogs, menus, the sidebar or the top bar — dense
surfaces stay clean and fast.

**Rules:** transform/opacity only; one orchestrated moment per screen; pause off-screen
(IntersectionObserver) and in hidden tabs; fixed-size boxes so nothing shifts (CLS 0);
`prefers-reduced-motion` → final static frame; reduced transparency/increased contrast →
opaque, no glow; directional motion mirrors in RTL (beams, shimmer, tilt) while logos and
real-world objects don't. WebGL loads only when: viewport ≥ 1024 px, no reduced motion, no
Save-Data, WebGL2 available, ≥ 4 CPU cores — after the page is idle; DPR capped at 1.5.

## 15. Performance budgets (H5)

`pnpm --filter dashboard build && pnpm --filter dashboard bundle:check` (CI `checks` job) reads the
Vite manifest and fails when a budget is exceeded. Gzip (level 9), first visit = entry + the
route's static import graph:

| Measure                                   | Before (P3, one 1,122.6 kB file) | After design pass | Budget |
| ----------------------------------------- | -------------------------------- | ----------------- | ------ |
| First visit: sign-in                      | 332.8 kB                         | 304.7 kB          | 315 kB |
| First visit: sign-up                      | 332.8 kB                         | 302.5 kB          | 315 kB |
| First visit: create workspace             | 332.8 kB                         | 312.6 kB          | 320 kB |
| First visit: workspace overview           | 332.8 kB                         | 312.9 kB          | 320 kB |
| First visit: members                      | 332.8 kB                         | 332.7 kB          | 340 kB |
| Brand panel + effects (lazy, ≥ 1024 px)   | —                                | 4.0 kB            | 45 kB  |
| WebGL scene (lazy, capable desktops only) | —                                | 234.9 kB          | 260 kB |
| All CSS                                   | 11.9 kB                          | 15.2 kB           | 16 kB  |

The first target (≤ 230 kB) is not reachable without replacing core libraries — react-dom,
react-router, supabase-js (auth + PostgREST + storage + realtime clients), zod, i18next and
tailwind-merge set the floor — so the budgets are the measured sizes plus ~4 % headroom: they
stop regressions. Effects stay off the critical path: Motion is used only by the desktop-only,
lazily loaded tilt card; counters use `requestAnimationFrame`; the WebGL chunk never loads on
phones, under reduced motion, with Save-Data or without WebGL2.
