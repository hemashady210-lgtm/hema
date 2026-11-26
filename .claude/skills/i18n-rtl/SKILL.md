---
name: i18n-rtl
description: Add or review user-facing text and layout for Arabic (RTL) + English (LTR) in the dashboard, widget, emails or DB content. Use whenever you write a UI string, a component with directional layout (margins, padding, icons, positioning), a date/number/currency display, or localized database content.
---

# Bilingual UI: Arabic (RTL) + English (LTR)

Source of truth: `docs/DESIGN_SYSTEM.md`, `docs/DECISIONS.md`, `packages/shared/src/locales.ts`.

## Rules

1. **No hard-coded user-facing strings.** Every string has a key present in **both** `ar` and
   `en`. A missing key in either language is a bug. Default locale is `ar`
   (`DEFAULT_LOCALE`); the user's choice persists on `profiles.locale`.
2. **Product name** only from `packages/shared/src/brand.ts` (`BRAND.productName` /
   `BRAND.productNameAr`) — never typed literally.
3. **Direction** comes from `LOCALE_DIRECTION[locale]`; set `dir` and `lang` on `<html>`
   (dashboard) or on the Shadow DOM root (widget). Never branch layout code on `locale === 'ar'`.
4. **Logical CSS only.**
   - Use: `ms-*` `me-*` `ps-*` `pe-*` `start-*` `end-*` `text-start` `text-end` `border-s`
     `border-e` `rounded-s` `rounded-e`.
   - Forbidden: `ml-*` `mr-*` `pl-*` `pr-*` `left-*` `right-*` `text-left` `text-right`
     `border-l` `border-r` `rounded-l` `rounded-r`, and raw CSS `margin-left`,
     `padding-right`, `left:`, `right:`. Use `margin-inline-start`, `inset-inline-end`, etc.
5. **Directional icons** (chevrons, arrows, "back", send) mirror in RTL: `rtl:-scale-x-100` or
   pick the icon by direction. Non-directional icons (search, check, logos) never mirror.
6. **Formatting** with `Intl` using the active locale: `Intl.NumberFormat`, `Intl.DateTimeFormat`
   with the workspace/branch **timezone** (storage is UTC `timestamptz`). Money is integer
   minor units + ISO currency → format with `style: 'currency'`. Decide per surface whether to
   use Arabic-Indic or Latin digits and keep it consistent (see DESIGN_SYSTEM.md).
7. **Fonts:** Arabic IBM Plex Sans Arabic, English Inter — switched by `lang`, not per component.
8. **Mixed-direction content** (phone numbers, order ids, emails, URLs inside Arabic text): wrap
   in `<bdi>` or `dir="ltr"` / `unicode-bidi: isolate`.
9. **Plurals & interpolation** through the i18n library (ICU/i18next plural keys), never string
   concatenation — Arabic has six plural forms.
10. **DB content** that users see is `jsonb {"ar": "...", "en": "..."}` validated by
    `private.is_i18n_text(...)`. Render with fallback: active locale → other locale → empty.
11. **Emails** (Resend) are rendered in the recipient's `profiles.locale` with correct `dir`.

## Review checklist

- [ ] every new key exists in ar **and** en
- [ ] grep the diff for `\b(ml|mr|pl|pr|left|right)-` and `text-(left|right)` → must be empty
- [ ] directional icons mirrored, non-directional not
- [ ] dates/times use workspace timezone + active locale
- [ ] mixed LTR tokens isolated with `<bdi>`/`dir="ltr"`
- [ ] screenshots or Playwright checks in both `dir="rtl"` and `dir="ltr"` for new screens
