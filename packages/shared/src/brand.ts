/**
 * Brand configuration — the ONE place the product name lives (decision C11).
 * Every UI string, email template and widget label must read from here.
 * Placeholder values until the owner picks a real name.
 */
export const BRAND = {
  productName: 'AI CRM',
  productNameAr: 'المساعد الذكي',
  shortName: 'AI CRM',
  supportEmail: 'support@example.com',
  marketingUrl: 'https://example.com',
} as const;

export type Brand = typeof BRAND;
