/**
 * Brand configuration — the ONE place the product name lives (decision C11, renamed in H1).
 * Every UI string, email template and widget label must read from here.
 * The name stays in Latin letters in Arabic UI too (decision H1): logos and product names are
 * not translated; render it inside an LTR isolate (`<bdi>` / `dir="ltr"`) in Arabic sentences.
 */
export const BRAND = {
  productName: 'Pro Coders',
  productNameAr: 'Pro Coders',
  shortName: 'Pro Coders',
  supportEmail: 'support@example.com',
  marketingUrl: 'https://example.com',
} as const;

export type Brand = typeof BRAND;
