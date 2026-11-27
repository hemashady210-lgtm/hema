import { useEffect } from 'react';
import { BRAND } from '@ai-crm/shared';
import { usePreferences } from '@/app/preferences';

export function useDocumentTitle(title?: string) {
  const { locale } = usePreferences();
  useEffect(() => {
    const product = locale === 'ar' ? BRAND.productNameAr : BRAND.productName;
    document.title = title ? `${title} – ${product}` : product;
  }, [title, locale]);
}
