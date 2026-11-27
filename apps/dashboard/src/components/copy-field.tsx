import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Read-only value with a copy button. Always LTR (URLs, ids — DESIGN_SYSTEM §10.4). */
export function CopyField({ value, label, id }: { value: string; label: string; id?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.getElementById(id ?? '') as HTMLInputElement | null;
      el?.select();
      document.execCommand?.('copy');
    }
    setCopied(true);
  };
  return (
    <div className="flex items-center gap-2" dir="ltr">
      <input
        id={id}
        readOnly
        value={value}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(inputClass, 'font-mono text-footnote')}
      />
      <Button
        type="button"
        variant="secondary"
        onClick={copy}
        aria-live="polite"
        className="shrink-0"
      >
        {copied ? <Check aria-hidden className="text-success" /> : <Copy aria-hidden />}
        <span>{copied ? t('common.copied') : t('common.copy')}</span>
      </Button>
    </div>
  );
}
