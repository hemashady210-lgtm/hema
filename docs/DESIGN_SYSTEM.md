# Design System

**Foundation:** Apple Human Interface Guidelines principles (clarity, deference, depth; type
scale; materials; 4-pt spacing; spring-like motion), applied to a **dark-first**, premium SaaS
product with a Stripe/Linear level of restraint (A3). Bilingual Arabic/English with full RTL
(A4). The owner's own Apple design-system skill was not available in this environment, so
this document was written from HIG principles directly (owner answer #2).

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

| Role                     | Dark                      | Light                  | Use                                                          |
| ------------------------ | ------------------------- | ---------------------- | ------------------------------------------------------------ |
| `background`             | `#07090F`                 | `#F6F8FC`              | app canvas                                                   |
| `surface-1`              | `#0C1018`                 | `#FFFFFF`              | cards, panels                                                |
| `surface-2`              | `#111723`                 | `#F1F4FA`              | nested panels, table header, inputs                          |
| `surface-3`              | `#171E2C`                 | `#E8EDF6`              | hover, selected rows                                         |
| `elevated`               | `#1C2434`                 | `#FFFFFF`              | popovers, menus, dialogs (with material)                     |
| `border`                 | `rgb(148 170 255 / 0.10)` | `rgb(15 28 77 / 0.10)` | hairlines                                                    |
| `border-strong`          | `rgb(148 170 255 / 0.18)` | `rgb(15 28 77 / 0.18)` | inputs, dividers that must read                              |
| `text-primary`           | `#F2F5FC`                 | `#0B1020`              | body, titles                                                 |
| `text-secondary`         | `#A6B0C6`                 | `#4A5470`              | supporting text                                              |
| `text-tertiary`          | `#7A85A0`                 | `#6B7590`              | metadata, placeholders (≥ 4.5:1 on surface-1 — verify in P3) |
| `text-disabled`          | `#4A5368`                 | `#A3ABBF`              | disabled                                                     |
| `primary` / `primary-fg` | `#3D63F0` / `#FFFFFF`     | `#2747D1` / `#FFFFFF`  | primary buttons, selection                                   |
| `accent`                 | `#00A8FF`                 | `#0089D6`              | focus ring, live indicators, chart highlight                 |
| `success`                | `#2FD27F`                 | `#138A4B`              | connected, paid                                              |
| `warning`                | `#F5B544`                 | `#B26B00`              | pending, 80 % usage                                          |
| `danger`                 | `#FF5C6C`                 | `#C62B3B`              | error, failed payment, 100 % hard stop                       |
| `info`                   | `#5CCBFF`                 | `#006BA8`              | in-progress                                                  |

Contrast: `primary-fg` on `primary` ≈ 4.9:1 (AA). Every text/background pair must meet WCAG 2.2
AA (4.5:1 body, 3:1 large text and UI glyphs); a contrast test runs in CI from P3.

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
(license). Fonts are self-hosted, subset, `font-display: swap`. Numbers use `tabular-nums`
in tables, usage meters and prices.

### 3.2 Scale (dashboard, desktop-first)

| Token         | Size / line (LTR) | Line height AR | Weight | Tracking (Latin only) |
| ------------- | ----------------- | -------------- | ------ | --------------------- |
| `display`     | 40 / 48           | 56             | 600    | −0.02em               |
| `large-title` | 32 / 40           | 46             | 600    | −0.015em              |
| `title-1`     | 26 / 32           | 38             | 600    | −0.01em               |
| `title-2`     | 22 / 28           | 34             | 600    | −0.005em              |
| `title-3`     | 18 / 24           | 30             | 600    | 0                     |
| `headline`    | 15 / 20           | 26             | 600    | 0                     |
| `body`        | 15 / 22           | 26             | 400    | 0                     |
| `callout`     | 14 / 20           | 24             | 400    | 0                     |
| `subheadline` | 13 / 18           | 22             | 400    | 0                     |
| `footnote`    | 12 / 16           | 20             | 400    | 0.005em               |
| `caption`     | 11 / 14           | 18             | 500    | 0.01em                |

Rules: Arabic gets ~15–20 % taller line-height (diacritics, ascenders), **no letter-spacing,
no uppercase transforms, no italics** (use weight or color for emphasis). Minimum Arabic size
13 px. Mobile scale: body 16/24 (prevents iOS zoom on inputs).

## 4. Spacing, layout, radii

- **4-pt grid:** `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`.
- **Shell:** sidebar 264 px (collapsed 72 px) on the _start_ side; top bar 56 px; content max
  width 1280 px, gutters 24 px (desktop) / 16 px (mobile). 12-column grid, 24 px gaps.
- **Breakpoints:** `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`. Inbox is 3-pane at
  `xl` (list · thread · customer panel), 2-pane at `lg`, stacked below.
- **Radii (continuous-corner feel):** `xs 6`, `sm 8`, `md 12` (inputs, buttons), `lg 16`
  (cards), `xl 20` (dialogs, sheets), `2xl 28` (marketing/hero), `full` (pills, avatars).
- **Hit targets:** ≥ 36 px desktop, ≥ 44 px touch.

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
   `border-s/e`, `rounded-s/e`. Lint rule forbids `ml-/mr-/pl-/pr-/left-/right-` in app code
   (P3).
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
